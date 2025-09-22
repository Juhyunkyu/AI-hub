-- Create performance monitoring system tables and functions
-- Migration: 20250922000000_create_performance_monitoring.sql

-- Enable RLS (Row Level Security)
-- Performance metrics table for storing individual metric data points
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id text NOT NULL,
    page_url text NOT NULL,
    metric_type text NOT NULL,
    metric_value numeric NOT NULL,
    metric_rating text NOT NULL CHECK (metric_rating IN ('good', 'needs-improvement', 'poor')),
    user_agent text,
    connection_type text,
    device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
    viewport_width integer,
    viewport_height integer,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance summaries table for aggregated daily metrics
CREATE TABLE IF NOT EXISTS public.performance_summaries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    page_url text NOT NULL,
    total_sessions integer NOT NULL DEFAULT 0,

    -- Core Web Vitals averages
    avg_lcp numeric,
    avg_cls numeric,
    avg_fid numeric,
    avg_ttfb numeric,
    avg_fcp numeric,
    avg_inp numeric,

    -- 75th percentile values (Web Vitals standard)
    p75_lcp numeric,
    p75_cls numeric,
    p75_fid numeric,
    p75_ttfb numeric,
    p75_fcp numeric,
    p75_inp numeric,

    -- Good/Poor ratios (for Core Web Vitals scoring)
    good_lcp_ratio numeric DEFAULT 0 CHECK (good_lcp_ratio >= 0 AND good_lcp_ratio <= 1),
    good_cls_ratio numeric DEFAULT 0 CHECK (good_cls_ratio >= 0 AND good_cls_ratio <= 1),
    good_fid_ratio numeric DEFAULT 0 CHECK (good_fid_ratio >= 0 AND good_fid_ratio <= 1),
    good_ttfb_ratio numeric DEFAULT 0 CHECK (good_ttfb_ratio >= 0 AND good_ttfb_ratio <= 1),
    good_fcp_ratio numeric DEFAULT 0 CHECK (good_fcp_ratio >= 0 AND good_fcp_ratio <= 1),
    good_inp_ratio numeric DEFAULT 0 CHECK (good_inp_ratio >= 0 AND good_inp_ratio <= 1),

    -- Device breakdown
    mobile_sessions integer DEFAULT 0,
    tablet_sessions integer DEFAULT 0,
    desktop_sessions integer DEFAULT 0,

    -- Additional metadata
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Unique constraint for date + page_url combination
    UNIQUE(date, page_url)
);

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON public.performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page_url ON public.performance_metrics(page_url);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type ON public.performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON public.performance_metrics(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_performance_metrics_device_type ON public.performance_metrics(device_type) WHERE device_type IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page_created ON public.performance_metrics(page_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_created ON public.performance_metrics(metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_rating_type ON public.performance_metrics(metric_rating, metric_type);

-- Performance summaries indexes
CREATE INDEX IF NOT EXISTS idx_performance_summaries_date ON public.performance_summaries(date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_summaries_page_url ON public.performance_summaries(page_url);
CREATE INDEX IF NOT EXISTS idx_performance_summaries_date_page ON public.performance_summaries(date DESC, page_url);

-- Row Level Security (RLS) policies
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_summaries ENABLE ROW LEVEL SECURITY;

-- Performance metrics policies
-- Allow anonymous users to insert metrics (for data collection)
CREATE POLICY "Allow anonymous metric collection" ON public.performance_metrics
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow authenticated users to insert their own metrics
CREATE POLICY "Users can insert own metrics" ON public.performance_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins can read metrics
CREATE POLICY "Admins can read all metrics" ON public.performance_metrics
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Performance summaries policies
-- Only admins can read summaries
CREATE POLICY "Admins can read all summaries" ON public.performance_summaries
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Only system can insert/update summaries (via functions)
CREATE POLICY "System can manage summaries" ON public.performance_summaries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Data retention: Keep raw metrics for 90 days, summaries for 2 years
-- This will be handled by a separate cleanup function

-- Comments for documentation
COMMENT ON TABLE public.performance_metrics IS 'Individual performance metric data points collected from client-side monitoring';
COMMENT ON TABLE public.performance_summaries IS 'Aggregated daily performance summaries for efficient reporting and analytics';

COMMENT ON COLUMN public.performance_metrics.metric_type IS 'Type of metric: lcp, cls, fid, ttfb, fcp, inp, custom metrics';
COMMENT ON COLUMN public.performance_metrics.metric_rating IS 'Web Vitals rating: good, needs-improvement, poor';
COMMENT ON COLUMN public.performance_metrics.metadata IS 'Additional metric metadata including id, delta, timestamp, ip';

COMMENT ON COLUMN public.performance_summaries.p75_lcp IS '75th percentile Largest Contentful Paint (Web Vitals standard)';
COMMENT ON COLUMN public.performance_summaries.good_lcp_ratio IS 'Ratio of good LCP measurements (0.0 to 1.0)';

-- Function to calculate percentiles (helper function)
CREATE OR REPLACE FUNCTION percentile_cont_agg(state decimal[], value decimal, percentile decimal)
RETURNS decimal[] AS $$
BEGIN
    IF state IS NULL THEN
        state := ARRAY[value];
    ELSE
        state := array_append(state, value);
    END IF;
    RETURN state;
END;
$$ LANGUAGE plpgsql;

-- Function to update performance summaries
CREATE OR REPLACE FUNCTION update_performance_summary(target_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
    page_record RECORD;
    metric_data RECORD;
    summary_exists boolean;
BEGIN
    -- Loop through each unique page for the target date
    FOR page_record IN
        SELECT DISTINCT page_url
        FROM public.performance_metrics
        WHERE DATE(created_at) = target_date
    LOOP
        -- Check if summary already exists
        SELECT EXISTS(
            SELECT 1 FROM public.performance_summaries
            WHERE date = target_date AND page_url = page_record.page_url
        ) INTO summary_exists;

        -- Calculate metrics for this page/date combination
        SELECT
            COUNT(DISTINCT session_id) as total_sessions,
            -- Average calculations
            AVG(CASE WHEN metric_type = 'lcp' THEN metric_value END) as avg_lcp,
            AVG(CASE WHEN metric_type = 'cls' THEN metric_value END) as avg_cls,
            AVG(CASE WHEN metric_type = 'fid' THEN metric_value END) as avg_fid,
            AVG(CASE WHEN metric_type = 'ttfb' THEN metric_value END) as avg_ttfb,
            AVG(CASE WHEN metric_type = 'fcp' THEN metric_value END) as avg_fcp,
            AVG(CASE WHEN metric_type = 'inp' THEN metric_value END) as avg_inp,

            -- 75th percentile calculations using percentile_cont
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'lcp' THEN metric_value END) as p75_lcp,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'cls' THEN metric_value END) as p75_cls,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'fid' THEN metric_value END) as p75_fid,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'ttfb' THEN metric_value END) as p75_ttfb,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'fcp' THEN metric_value END) as p75_fcp,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY CASE WHEN metric_type = 'inp' THEN metric_value END) as p75_inp,

            -- Good ratio calculations (percentage of 'good' ratings)
            COALESCE(
                COUNT(CASE WHEN metric_type = 'lcp' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'lcp' THEN 1 END), 0),
                0
            ) as good_lcp_ratio,
            COALESCE(
                COUNT(CASE WHEN metric_type = 'cls' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'cls' THEN 1 END), 0),
                0
            ) as good_cls_ratio,
            COALESCE(
                COUNT(CASE WHEN metric_type = 'fid' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'fid' THEN 1 END), 0),
                0
            ) as good_fid_ratio,
            COALESCE(
                COUNT(CASE WHEN metric_type = 'ttfb' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'ttfb' THEN 1 END), 0),
                0
            ) as good_ttfb_ratio,
            COALESCE(
                COUNT(CASE WHEN metric_type = 'fcp' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'fcp' THEN 1 END), 0),
                0
            ) as good_fcp_ratio,
            COALESCE(
                COUNT(CASE WHEN metric_type = 'inp' AND metric_rating = 'good' THEN 1 END)::numeric /
                NULLIF(COUNT(CASE WHEN metric_type = 'inp' THEN 1 END), 0),
                0
            ) as good_inp_ratio,

            -- Device breakdown
            COUNT(CASE WHEN device_type = 'mobile' THEN session_id END) as mobile_sessions,
            COUNT(CASE WHEN device_type = 'tablet' THEN session_id END) as tablet_sessions,
            COUNT(CASE WHEN device_type = 'desktop' THEN session_id END) as desktop_sessions

        FROM public.performance_metrics
        WHERE DATE(created_at) = target_date
        AND page_url = page_record.page_url
        INTO metric_data;

        -- Insert or update summary
        IF summary_exists THEN
            UPDATE public.performance_summaries
            SET
                total_sessions = metric_data.total_sessions,
                avg_lcp = metric_data.avg_lcp,
                avg_cls = metric_data.avg_cls,
                avg_fid = metric_data.avg_fid,
                avg_ttfb = metric_data.avg_ttfb,
                avg_fcp = metric_data.avg_fcp,
                avg_inp = metric_data.avg_inp,
                p75_lcp = metric_data.p75_lcp,
                p75_cls = metric_data.p75_cls,
                p75_fid = metric_data.p75_fid,
                p75_ttfb = metric_data.p75_ttfb,
                p75_fcp = metric_data.p75_fcp,
                p75_inp = metric_data.p75_inp,
                good_lcp_ratio = metric_data.good_lcp_ratio,
                good_cls_ratio = metric_data.good_cls_ratio,
                good_fid_ratio = metric_data.good_fid_ratio,
                good_ttfb_ratio = metric_data.good_ttfb_ratio,
                good_fcp_ratio = metric_data.good_fcp_ratio,
                good_inp_ratio = metric_data.good_inp_ratio,
                mobile_sessions = metric_data.mobile_sessions,
                tablet_sessions = metric_data.tablet_sessions,
                desktop_sessions = metric_data.desktop_sessions,
                updated_at = timezone('utc'::text, now())
            WHERE date = target_date AND page_url = page_record.page_url;
        ELSE
            INSERT INTO public.performance_summaries (
                date, page_url, total_sessions,
                avg_lcp, avg_cls, avg_fid, avg_ttfb, avg_fcp, avg_inp,
                p75_lcp, p75_cls, p75_fid, p75_ttfb, p75_fcp, p75_inp,
                good_lcp_ratio, good_cls_ratio, good_fid_ratio,
                good_ttfb_ratio, good_fcp_ratio, good_inp_ratio,
                mobile_sessions, tablet_sessions, desktop_sessions
            ) VALUES (
                target_date, page_record.page_url, metric_data.total_sessions,
                metric_data.avg_lcp, metric_data.avg_cls, metric_data.avg_fid,
                metric_data.avg_ttfb, metric_data.avg_fcp, metric_data.avg_inp,
                metric_data.p75_lcp, metric_data.p75_cls, metric_data.p75_fid,
                metric_data.p75_ttfb, metric_data.p75_fcp, metric_data.p75_inp,
                metric_data.good_lcp_ratio, metric_data.good_cls_ratio, metric_data.good_fid_ratio,
                metric_data.good_ttfb_ratio, metric_data.good_fcp_ratio, metric_data.good_inp_ratio,
                metric_data.mobile_sessions, metric_data.tablet_sessions, metric_data.desktop_sessions
            );
        END IF;
    END LOOP;

    RAISE NOTICE 'Performance summary updated for date: %', target_date;
END;
$$ LANGUAGE plpgsql;

-- Function for automatic daily summary generation (can be called by cron)
CREATE OR REPLACE FUNCTION generate_daily_summaries()
RETURNS void AS $$
BEGIN
    -- Generate summary for yesterday (data should be complete by then)
    PERFORM update_performance_summary(CURRENT_DATE - INTERVAL '1 day');

    -- Also update today's summary (for real-time updates)
    PERFORM update_performance_summary(CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Function for data cleanup (remove old metrics after 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_performance_data()
RETURNS void AS $$
BEGIN
    -- Remove metrics older than 90 days
    DELETE FROM public.performance_metrics
    WHERE created_at < (CURRENT_DATE - INTERVAL '90 days');

    -- Remove summaries older than 2 years
    DELETE FROM public.performance_summaries
    WHERE date < (CURRENT_DATE - INTERVAL '2 years');

    RAISE NOTICE 'Cleaned up old performance data';
END;
$$ LANGUAGE plpgsql;