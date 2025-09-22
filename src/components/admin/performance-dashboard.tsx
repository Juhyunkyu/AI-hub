'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Activity, Zap, Eye, Clock, MousePointer } from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceMetric {
  id: string;
  session_id: string;
  page_url: string;
  metric_type: string;
  metric_value: number;
  metric_rating: 'good' | 'needs-improvement' | 'poor';
  user_agent?: string;
  device_type?: string;
  created_at: string;
}

interface PerformanceSummary {
  date: string;
  page_url: string;
  total_sessions: number;
  avg_lcp?: number;
  avg_cls?: number;
  avg_fid?: number;
  avg_ttfb?: number;
  avg_fcp?: number;
  avg_inp?: number;
  p75_lcp?: number;
  p75_cls?: number;
  p75_fid?: number;
  p75_ttfb?: number;
  good_lcp_ratio?: number;
  good_cls_ratio?: number;
  good_fid_ratio?: number;
}

const MetricIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'lcp': return <Eye className="h-4 w-4" />;
    case 'cls': return <Activity className="h-4 w-4" />;
    case 'fid': return <MousePointer className="h-4 w-4" />;
    case 'ttfb': return <Zap className="h-4 w-4" />;
    case 'fcp': return <Clock className="h-4 w-4" />;
    case 'inp': return <MousePointer className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

const getMetricName = (type: string) => {
  const names: Record<string, string> = {
    'lcp': 'Largest Contentful Paint',
    'cls': 'Cumulative Layout Shift',
    'fid': 'First Input Delay',
    'ttfb': 'Time to First Byte',
    'fcp': 'First Contentful Paint',
    'inp': 'Interaction to Next Paint',
  };
  return names[type] || type.toUpperCase();
};

const getRatingColor = (rating: string) => {
  switch (rating) {
    case 'good': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'needs-improvement': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'poor': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const formatMetricValue = (type: string, value: number) => {
  if (type === 'cls') return value.toFixed(3);
  return `${Math.round(value)}ms`;
};

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [summaries, setSummaries] = useState<PerformanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('7');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch recent metrics
      const metricsParams = new URLSearchParams({
        limit: '100',
        ...(selectedPage !== 'all' && { pageUrl: selectedPage }),
        ...(selectedMetric !== 'all' && { metricType: selectedMetric }),
      });

      const metricsResponse = await fetch(`/api/performance/metrics?${metricsParams}`);
      if (!metricsResponse.ok) throw new Error('Failed to fetch metrics');
      const metricsData = await metricsResponse.json();

      // Fetch summaries
      const summaryParams = new URLSearchParams({
        days: timeRange,
        ...(selectedPage !== 'all' && { pageUrl: selectedPage }),
      });

      const summaryResponse = await fetch(`/api/performance/summary?${summaryParams}`);
      if (!summaryResponse.ok) throw new Error('Failed to fetch summaries');
      const summaryData = await summaryResponse.json();

      setMetrics(metricsData.data || []);
      setSummaries(summaryData.data || []);

    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('성능 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedPage, selectedMetric, timeRange]);

  const refreshSummary = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/performance/summary', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh summary');

      toast.success('성능 요약 데이터가 갱신되었습니다.');

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error refreshing summary:', error);
      toast.error('요약 데이터 갱신에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique pages from metrics
  const uniquePages = Array.from(new Set(metrics.map(m => m.page_url)));

  // Calculate overall metrics
  const overallMetrics = metrics.reduce((acc, metric) => {
    if (!acc[metric.metric_type]) {
      acc[metric.metric_type] = { total: 0, count: 0, good: 0, poor: 0 };
    }
    acc[metric.metric_type].total += metric.metric_value;
    acc[metric.metric_type].count += 1;
    if (metric.metric_rating === 'good') acc[metric.metric_type].good += 1;
    if (metric.metric_rating === 'poor') acc[metric.metric_type].poor += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number; good: number; poor: number }>);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">성능 모니터링</h2>
          <p className="text-muted-foreground">
            웹 바이털스 및 커스텀 성능 메트릭을 모니터링합니다
          </p>
        </div>
        <Button onClick={refreshSummary} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          요약 갱신
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1일</SelectItem>
            <SelectItem value="7">7일</SelectItem>
            <SelectItem value="30">30일</SelectItem>
            <SelectItem value="90">90일</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedPage} onValueChange={setSelectedPage}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="페이지 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 페이지</SelectItem>
            {uniquePages.map(page => (
              <SelectItem key={page} value={page}>
                {new URL(page).pathname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="메트릭 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 메트릭</SelectItem>
            <SelectItem value="lcp">LCP</SelectItem>
            <SelectItem value="cls">CLS</SelectItem>
            <SelectItem value="fid">FID</SelectItem>
            <SelectItem value="ttfb">TTFB</SelectItem>
            <SelectItem value="fcp">FCP</SelectItem>
            <SelectItem value="inp">INP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(overallMetrics).map(([type, data]) => {
          const avgValue = data.total / data.count;
          const goodRatio = data.good / data.count;

          return (
            <Card key={type}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MetricIcon type={type} />
                    <div className="text-sm font-medium">{getMetricName(type)}</div>
                  </div>
                  <Badge variant={goodRatio > 0.75 ? 'default' : goodRatio > 0.5 ? 'secondary' : 'destructive'}>
                    {Math.round(goodRatio * 100)}%
                  </Badge>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">
                    {formatMetricValue(type, avgValue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.count}개 샘플
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Data */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">최근 메트릭</TabsTrigger>
          <TabsTrigger value="summary">일별 요약</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>최근 성능 메트릭</CardTitle>
              <CardDescription>
                최근 수집된 성능 데이터입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    선택한 조건에 해당하는 데이터가 없습니다.
                  </p>
                ) : (
                  metrics.slice(0, 50).map((metric) => (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center space-x-3">
                        <MetricIcon type={metric.metric_type} />
                        <div>
                          <div className="font-medium">{getMetricName(metric.metric_type)}</div>
                          <div className="text-sm text-muted-foreground">
                            {new URL(metric.page_url).pathname} • {metric.device_type}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono">
                          {formatMetricValue(metric.metric_type, metric.metric_value)}
                        </div>
                        <Badge
                          variant="secondary"
                          className={getRatingColor(metric.metric_rating)}
                        >
                          {metric.metric_rating}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>일별 성능 요약</CardTitle>
              <CardDescription>
                날짜별 성능 메트릭 요약 데이터입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summaries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    요약 데이터가 없습니다. &apos;요약 갱신&apos; 버튼을 눌러주세요.
                  </p>
                ) : (
                  summaries.map((summary) => (
                    <div
                      key={`${summary.date}-${summary.page_url}`}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{new URL(summary.page_url).pathname}</div>
                        <Badge variant="outline">{summary.date}</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">세션</div>
                          <div className="font-medium">{summary.total_sessions}</div>
                        </div>

                        {summary.avg_lcp && (
                          <div>
                            <div className="text-muted-foreground">평균 LCP</div>
                            <div className="font-medium">{Math.round(summary.avg_lcp)}ms</div>
                          </div>
                        )}

                        {summary.avg_cls && (
                          <div>
                            <div className="text-muted-foreground">평균 CLS</div>
                            <div className="font-medium">{summary.avg_cls.toFixed(3)}</div>
                          </div>
                        )}

                        {summary.avg_fid && (
                          <div>
                            <div className="text-muted-foreground">평균 FID</div>
                            <div className="font-medium">{Math.round(summary.avg_fid)}ms</div>
                          </div>
                        )}

                        {summary.good_lcp_ratio && (
                          <div>
                            <div className="text-muted-foreground">LCP 양호율</div>
                            <div className="font-medium">{Math.round(summary.good_lcp_ratio * 100)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}