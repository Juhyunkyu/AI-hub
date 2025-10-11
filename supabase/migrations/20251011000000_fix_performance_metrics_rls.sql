-- Fix performance_metrics RLS to allow anonymous users
-- This allows web vitals metrics to be collected from non-logged-in users

-- Drop existing policies if they exist
DROP POLICY IF EXISTS performance_metrics_insert_authenticated ON public.performance_metrics;
DROP POLICY IF EXISTS performance_metrics_select_admin ON public.performance_metrics;

-- Create new policies that allow anonymous inserts
CREATE POLICY performance_metrics_insert_all
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (true);  -- Allow anyone (including anon) to insert metrics

-- Only admins can read metrics
CREATE POLICY performance_metrics_select_admin
  ON public.performance_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Ensure RLS is enabled
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
