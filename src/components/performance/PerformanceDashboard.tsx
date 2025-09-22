'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Activity, Clock, Zap, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface PerformanceMetric {
  type: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  pageUrl: string;
}

interface PerformanceSummary {
  avgLCP: number;
  avgFCP: number;
  avgCLS: number;
  avgTTFB: number;
  avgINP?: number;
  totalSessions: number;
  timeRange: string;
  deviceBreakdown: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

// 성능 점수 계산 함수
function calculateScore(metric: string, value: number): number {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    FCP: { good: 1800, poor: 3000 },
    CLS: { good: 0.1, poor: 0.25 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
  };

  const threshold = thresholds[metric as keyof typeof thresholds];
  if (!threshold) return 0;

  if (value <= threshold.good) return 100;
  if (value >= threshold.poor) return 0;

  // Linear interpolation between good and poor
  return Math.round(100 - ((value - threshold.good) / (threshold.poor - threshold.good)) * 100);
}

// 성능 등급 반환
function getPerformanceGrade(score: number): { grade: string; color: string; icon: React.ReactNode } {
  if (score >= 90) return {
    grade: 'A',
    color: 'bg-green-500',
    icon: <CheckCircle className="h-4 w-4 text-green-600" />
  };
  if (score >= 80) return {
    grade: 'B',
    color: 'bg-blue-500',
    icon: <CheckCircle className="h-4 w-4 text-blue-600" />
  };
  if (score >= 70) return {
    grade: 'C',
    color: 'bg-yellow-500',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />
  };
  if (score >= 60) return {
    grade: 'D',
    color: 'bg-orange-500',
    icon: <AlertTriangle className="h-4 w-4 text-orange-600" />
  };
  return {
    grade: 'F',
    color: 'bg-red-500',
    icon: <XCircle className="h-4 w-4 text-red-600" />
  };
}

export function PerformanceDashboard() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const [summaryRes, metricsRes] = await Promise.all([
        fetch('/api/performance/summary'),
        fetch('/api/performance/metrics?limit=50')
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setRecentMetrics(metricsData.metrics || []);
      }
    } catch (error) {
      console.error('성능 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 5분마다 자동 새로고침
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <h2 className="text-2xl font-bold">성능 대시보드</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600">성능 데이터 없음</h3>
        <p className="text-gray-500">아직 수집된 성능 메트릭이 없습니다.</p>
      </div>
    );
  }

  // 전체 성능 점수 계산
  const lcpScore = calculateScore('LCP', summary.avgLCP);
  const fcpScore = calculateScore('FCP', summary.avgFCP);
  const clsScore = calculateScore('CLS', summary.avgCLS * 1000); // CLS는 0-1 범위
  const ttfbScore = calculateScore('TTFB', summary.avgTTFB);
  const inpScore = summary.avgINP ? calculateScore('INP', summary.avgINP) : 0;

  const totalScore = Math.round(
    (lcpScore + fcpScore + clsScore + ttfbScore + (inpScore || 0)) /
    (inpScore ? 5 : 4)
  );

  const performanceGrade = getPerformanceGrade(totalScore);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <h2 className="text-2xl font-bold">성능 대시보드</h2>
        </div>
        <Button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </Button>
      </div>

      {/* 전체 성능 점수 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {performanceGrade.icon}
            전체 성능 점수
          </CardTitle>
          <CardDescription>
            Core Web Vitals 기반 종합 평가 • {summary.timeRange}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${performanceGrade.color} flex items-center justify-center`}>
              <span className="text-2xl font-bold text-white">{performanceGrade.grade}</span>
            </div>
            <div className="flex-1">
              <div className="text-3xl font-bold">{totalScore}점</div>
              <Progress value={totalScore} className="mt-2" />
            </div>
            <div className="text-sm text-gray-500">
              총 {summary.totalSessions.toLocaleString()}개 세션
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              LCP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.avgLCP / 1000).toFixed(2)}s
            </div>
            <Badge variant={lcpScore >= 75 ? "default" : lcpScore >= 50 ? "secondary" : "destructive"}>
              {lcpScore}점
            </Badge>
            <p className="text-xs text-gray-500 mt-1">Largest Contentful Paint</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              FCP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.avgFCP / 1000).toFixed(2)}s
            </div>
            <Badge variant={fcpScore >= 75 ? "default" : fcpScore >= 50 ? "secondary" : "destructive"}>
              {fcpScore}점
            </Badge>
            <p className="text-xs text-gray-500 mt-1">First Contentful Paint</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              CLS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avgCLS.toFixed(3)}
            </div>
            <Badge variant={clsScore >= 75 ? "default" : clsScore >= 50 ? "secondary" : "destructive"}>
              {clsScore}점
            </Badge>
            <p className="text-xs text-gray-500 mt-1">Cumulative Layout Shift</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              TTFB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.avgTTFB / 1000).toFixed(2)}s
            </div>
            <Badge variant={ttfbScore >= 75 ? "default" : ttfbScore >= 50 ? "secondary" : "destructive"}>
              {ttfbScore}점
            </Badge>
            <p className="text-xs text-gray-500 mt-1">Time to First Byte</p>
          </CardContent>
        </Card>
      </div>

      {/* 디바이스 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>디바이스별 접속 현황</CardTitle>
          <CardDescription>기기별 성능 메트릭 분포</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.deviceBreakdown.desktop}%
              </div>
              <p className="text-sm text-gray-500">데스크톱</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summary.deviceBreakdown.mobile}%
              </div>
              <p className="text-sm text-gray-500">모바일</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summary.deviceBreakdown.tablet}%
              </div>
              <p className="text-sm text-gray-500">태블릿</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 최근 메트릭 */}
      {recentMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>최근 성능 메트릭</CardTitle>
            <CardDescription>실시간 수집된 최신 성능 데이터</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentMetrics.slice(0, 10).map((metric, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{metric.type.toUpperCase()}</Badge>
                    <span className="text-sm font-medium">
                      {metric.type.includes('cls')
                        ? metric.value.toFixed(3)
                        : `${(metric.value / 1000).toFixed(2)}s`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        metric.rating === 'good' ? 'default' :
                        metric.rating === 'needs-improvement' ? 'secondary' : 'destructive'
                      }
                    >
                      {metric.rating === 'good' ? '좋음' :
                       metric.rating === 'needs-improvement' ? '보통' : '나쁨'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}