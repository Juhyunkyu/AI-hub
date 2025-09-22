'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
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

class PerformanceCollector {
  private sessionId: string;
  private userId?: string;
  private deviceInfo: DeviceInfo;
  private metricsQueue: Array<{
    metric: PerformanceMetric;
    timestamp: number;
    pageUrl: string;
  }> = [];
  private transmissionTimer: NodeJS.Timeout | null = null;

  constructor(userId?: string) {
    this.sessionId = this.generateSessionId();
    this.userId = userId;
    this.deviceInfo = this.getDeviceInfo();

    // Start metric collection
    this.initWebVitals();

    // Flush metrics on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flushMetrics());
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushMetrics();
        }
      });
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    // Simple device type detection
    const deviceType = /Mobi|Android/i.test(userAgent) ? 'mobile'
      : /iPad|Tablet/i.test(userAgent) ? 'tablet'
      : 'desktop';

    return {
      userAgent,
      connectionType: connection?.effectiveType || 'unknown',
      deviceType,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }

  private async initWebVitals() {
    try {
      // Dynamic import to avoid SSR issues - web-vitals 4.x+ uses onCLS instead of getCLS
      const webVitals = await import('web-vitals');

      // Collect Core Web Vitals with proper v5+ API
      if ('onCLS' in webVitals) {
        // web-vitals v5+ API
        webVitals.onCLS(this.handleMetric.bind(this));
        webVitals.onFCP(this.handleMetric.bind(this));
        webVitals.onLCP(this.handleMetric.bind(this));
        webVitals.onTTFB(this.handleMetric.bind(this));

        // INP replaces FID in v5+
        if ('onINP' in webVitals) {
          webVitals.onINP(this.handleMetric.bind(this));
        }

        // FID is deprecated in v5+ but check if available for backward compatibility
        if ('onFID' in webVitals) {
          try {
            webVitals.onFID(this.handleMetric.bind(this));
          } catch (e) {
            console.warn('FID is deprecated in web-vitals v5+, using INP instead');
          }
        }
      } else {
        // Fallback for older versions
        const { getCLS, getFID, getFCP, getLCP, getTTFB, onINP } = webVitals as any;
        getCLS?.(this.handleMetric.bind(this));
        getFID?.(this.handleMetric.bind(this));
        getFCP?.(this.handleMetric.bind(this));
        getLCP?.(this.handleMetric.bind(this));
        getTTFB?.(this.handleMetric.bind(this));
        onINP?.(this.handleMetric.bind(this));
      }
    } catch (error) {
      console.warn('웹 바이털스 라이브러리 로드 실패:', error);
    }
  }

  private handleMetric(metric: PerformanceMetric) {
    // Add to queue with current page info
    this.metricsQueue.push({
      metric,
      timestamp: Date.now(),
      pageUrl: window.location.href,
    });

    // Schedule transmission (debounced)
    if (this.transmissionTimer) {
      clearTimeout(this.transmissionTimer);
    }

    this.transmissionTimer = setTimeout(() => {
      this.transmitMetrics();
    }, 1000); // 1초 후 전송 (디바운싱)
  }

  private async transmitMetrics() {
    if (this.metricsQueue.length === 0) return;

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceInfo: this.deviceInfo,
      metrics: this.metricsQueue.map(({ metric, timestamp, pageUrl }) => ({
        type: metric.name.toLowerCase(),
        value: Math.round(metric.value * 1000) / 1000, // 소수점 3자리
        rating: metric.rating,
        timestamp,
        pageUrl,
        id: metric.id,
        delta: metric.delta,
      })),
    };

    // Clear queue immediately to prevent duplicate sends
    this.metricsQueue = [];

    try {
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        const success = navigator.sendBeacon(
          '/api/performance/metrics',
          JSON.stringify(payload)
        );

        if (!success) {
          // Fallback to fetch if beacon fails
          await this.fetchFallback(payload);
        }
      } else {
        await this.fetchFallback(payload);
      }
    } catch (error) {
      console.warn('성능 메트릭 전송 실패:', error);
      // Re-add to queue for retry (but limit queue size)
      if (this.metricsQueue.length < 50) {
        this.metricsQueue.push(...payload.metrics.map(metric => ({
          metric: {
            name: metric.type,
            value: metric.value,
            rating: metric.rating,
            id: metric.id,
            delta: metric.delta,
          },
          timestamp: metric.timestamp,
          pageUrl: metric.pageUrl,
        })));
      }
    }
  }

  private async fetchFallback(payload: any) {
    await fetch('/api/performance/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true, // Keep request alive during page unload
    });
  }

  public flushMetrics() {
    if (this.transmissionTimer) {
      clearTimeout(this.transmissionTimer);
      this.transmissionTimer = null;
    }
    this.transmitMetrics();
  }

  public updateUserId(userId?: string) {
    this.userId = userId;
  }

  // Manual custom metric tracking
  public trackCustomMetric(name: string, value: number, metadata?: any) {
    const rating: 'good' | 'needs-improvement' | 'poor' =
      value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor';

    this.handleMetric({
      name: `custom-${name}`,
      value,
      rating,
      id: `custom-${Date.now()}`,
    });
  }
}

// Global collector instance
let performanceCollector: PerformanceCollector | null = null;

interface WebVitalsMonitorProps {
  children?: React.ReactNode;
}

export function WebVitalsMonitor({ children }: WebVitalsMonitorProps) {
  const { user } = useAuthStore();
  const collectorRef = useRef<PerformanceCollector | null>(null);

  useEffect(() => {
    // Initialize collector only once
    if (!collectorRef.current && typeof window !== 'undefined') {
      collectorRef.current = new PerformanceCollector(user?.id);
      performanceCollector = collectorRef.current;
    }

    // Update user ID when auth changes
    if (collectorRef.current && user?.id) {
      collectorRef.current.updateUserId(user.id);
    }

    return () => {
      // Cleanup on unmount
      if (collectorRef.current) {
        collectorRef.current.flushMetrics();
      }
    };
  }, [user?.id]);

  // This component doesn't render anything visible
  return children || null;
}

// Export hook for manual tracking
export function usePerformanceTracking() {
  return {
    trackCustomMetric: (name: string, value: number, metadata?: any) => {
      if (performanceCollector) {
        performanceCollector.trackCustomMetric(name, value, metadata);
      }
    },
    flushMetrics: () => {
      if (performanceCollector) {
        performanceCollector.flushMetrics();
      }
    },
  };
}

// Next.js specific performance tracking
export function trackNextJSMetrics() {
  if (typeof window === 'undefined') return;

  // Track Next.js specific metrics
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;

        // Track custom Next.js metrics
        if (performanceCollector) {
          performanceCollector.trackCustomMetric('next-hydration',
            navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart);
          performanceCollector.trackCustomMetric('next-route-change',
            navEntry.loadEventEnd - navEntry.fetchStart);
        }
      }

      if (entry.entryType === 'measure' && entry.name.startsWith('Next.js')) {
        if (performanceCollector) {
          performanceCollector.trackCustomMetric(
            entry.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            entry.duration
          );
        }
      }
    }
  });

  observer.observe({ entryTypes: ['navigation', 'measure'] });
}