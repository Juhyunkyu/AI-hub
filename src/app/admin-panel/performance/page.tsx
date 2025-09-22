import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/performance/PerformanceDashboard';

export const metadata: Metadata = {
  title: '성능 모니터링 | Admin Panel',
  description: 'Real-time performance monitoring and Core Web Vitals analysis',
};

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-6">
      <PerformanceDashboard />
    </div>
  );
}