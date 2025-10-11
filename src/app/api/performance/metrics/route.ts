import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

interface PerformanceMetricData {
  type: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  pageUrl: string;
  id: string;
  delta?: number;
}

interface DeviceInfo {
  userAgent: string;
  connectionType: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  viewportWidth: number;
  viewportHeight: number;
}

interface MetricsPayload {
  sessionId: string;
  userId?: string;
  deviceInfo: DeviceInfo;
  metrics: PerformanceMetricData[];
}

// Rate limiting map (in memory for simplicity)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // 100 requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request body
    let payload: MetricsPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload
    if (!payload.sessionId || !Array.isArray(payload.metrics)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate each metric
    for (const metric of payload.metrics) {
      if (!metric.type || typeof metric.value !== 'number' || !metric.rating) {
        return NextResponse.json(
          { error: 'Invalid metric format' },
          { status: 400 }
        );
      }
    }

    // Limit batch size to prevent abuse
    if (payload.metrics.length > 20) {
      return NextResponse.json(
        { error: 'Too many metrics in batch' },
        { status: 400 }
      );
    }

    // For performance metrics, we need to support anonymous users
    // Use service role key to bypass RLS since we have explicit validation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Try to get user from cookies if available (for attribution)
    let user = null;
    try {
      const serverClient = await createServerClient();
      const { data: { user: authUser } } = await serverClient.auth.getUser();
      user = authUser;
    } catch {
      // Ignore - anonymous user
    }

    // Prepare data for batch insert
    const metricsToInsert = payload.metrics.map(metric => ({
      user_id: user?.id || null, // Use actual logged in user ID or null
      session_id: payload.sessionId,
      page_url: metric.pageUrl,
      metric_type: metric.type.toLowerCase(), // Convert to lowercase for DB constraint
      metric_value: metric.value,
      metric_rating: metric.rating,
      user_agent: payload.deviceInfo?.userAgent || null,
      connection_type: payload.deviceInfo?.connectionType || null,
      device_type: payload.deviceInfo?.deviceType || null,
      viewport_width: payload.deviceInfo?.viewportWidth || null,
      viewport_height: payload.deviceInfo?.viewportHeight || null,
      metadata: {
        id: metric.id,
        delta: metric.delta,
        timestamp: metric.timestamp,
        ip: ip !== 'unknown' ? ip : null,
      },
    }));

    // Batch insert metrics using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('performance_metrics')
      .insert(metricsToInsert)
      .select('id');

    if (error) {
      console.error('Performance metrics insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        user_id: user?.id || 'anonymous',
        sample_data: metricsToInsert[0]
      });
      return NextResponse.json(
        { error: 'Failed to store metrics', details: error.message },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
    });

  } catch (error) {
    console.error('Performance metrics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving metrics (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const pageUrl = url.searchParams.get('pageUrl');
    const metricType = url.searchParams.get('metricType');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let query = supabase
      .from('performance_metrics')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Apply filters
    if (pageUrl) {
      query = query.eq('page_url', pageUrl);
    }
    if (metricType) {
      query = query.eq('metric_type', metricType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Performance metrics query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Performance metrics GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}