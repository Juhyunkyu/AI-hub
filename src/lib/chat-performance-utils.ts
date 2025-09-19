/**
 * Chat Performance Utilities
 *
 * 채팅 시스템 성능 모니터링 및 최적화 도구
 * PostgreSQL 함수 성능 추적, 메모리 사용량 모니터링, 실시간 메트릭
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = createSupabaseBrowserClient();

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface ChatPerformanceMetrics {
  operationType: 'create_chat_room' | 'get_chat_rooms' | 'send_message' | 'get_messages';
  executionTime: number;
  success: boolean;
  error?: string;
  roomId?: string;
  userId: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface ChatRoomStats {
  totalRooms: number;
  totalMessages: number;
  totalParticipants: number;
  avgMessagesPerRoom: number;
  mostActiveRooms: Array<{
    roomId: string;
    messageCount: number;
  }>;
}

export interface DatabasePerformanceStats {
  queryExecutionTime: number;
  indexHitRatio: number;
  connectionCount: number;
  cacheHitRatio: number;
}

// ============================================================================
// Performance Monitoring Class
// ============================================================================

export class ChatPerformanceMonitor {
  private metrics: ChatPerformanceMetrics[] = [];
  private maxMetrics = 1000; // 메모리 사용량 제한

  /**
   * 성능 메트릭 기록
   */
  recordMetric(metric: ChatPerformanceMetrics): void {
    this.metrics.push(metric);

    // 메모리 관리: 오래된 메트릭 제거
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 개발 환경에서 로깅
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Chat Performance] ${metric.operationType}: ${metric.executionTime}ms`, metric);
    }
  }

  /**
   * 성능 통계 계산
   */
  getPerformanceStats(operationType?: ChatPerformanceMetrics['operationType']): {
    avgExecutionTime: number;
    successRate: number;
    totalOperations: number;
    errorRate: number;
  } {
    const filteredMetrics = operationType
      ? this.metrics.filter(m => m.operationType === operationType)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        avgExecutionTime: 0,
        successRate: 0,
        totalOperations: 0,
        errorRate: 0,
      };
    }

    const successfulOperations = filteredMetrics.filter(m => m.success);
    const avgExecutionTime = filteredMetrics.reduce((sum, m) => sum + m.executionTime, 0) / filteredMetrics.length;
    const successRate = (successfulOperations.length / filteredMetrics.length) * 100;

    return {
      avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      totalOperations: filteredMetrics.length,
      errorRate: Math.round((100 - successRate) * 100) / 100,
    };
  }

  /**
   * 최근 에러 가져오기
   */
  getRecentErrors(limit = 10): ChatPerformanceMetrics[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * 메트릭 초기화
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// 전역 성능 모니터 인스턴스
export const chatPerformanceMonitor = new ChatPerformanceMonitor();

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * 성능 측정 데코레이터
 */
export function measurePerformance<T extends any[], R>(
  operationType: ChatPerformanceMetrics['operationType'],
  userId: string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      const startTime = performance.now();
      let success = true;
      let error: string | undefined;
      let result: R;

      try {
        result = await method.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      } finally {
        const executionTime = performance.now() - startTime;

        chatPerformanceMonitor.recordMetric({
          operationType,
          executionTime,
          success,
          error,
          userId,
          timestamp: new Date(),
          additionalData: { args: args.length },
        });
      }
    };

    return descriptor;
  };
}

/**
 * 채팅방 통계 조회
 */
export async function getChatRoomStats(): Promise<ChatRoomStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_chat_room_function_stats');

    if (error) {
      console.error('Error fetching chat room stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching chat room stats:', error);
    return null;
  }
}

/**
 * 최적화된 채팅방 목록 조회 (성능 모니터링 포함)
 */
export async function getOptimizedChatRooms(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ rooms: any[] | null; performanceTime: number }> {
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const { data, error: queryError } = await supabase.rpc('get_chat_rooms_optimized', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    });

    if (queryError) {
      success = false;
      error = queryError.message;
      throw queryError;
    }

    const performanceTime = performance.now() - startTime;

    chatPerformanceMonitor.recordMetric({
      operationType: 'get_chat_rooms',
      executionTime: performanceTime,
      success,
      userId,
      timestamp: new Date(),
      additionalData: { limit, offset },
    });

    return {
      rooms: data,
      performanceTime,
    };
  } catch (err) {
    const performanceTime = performance.now() - startTime;
    success = false;
    error = err instanceof Error ? err.message : 'Unknown error';

    chatPerformanceMonitor.recordMetric({
      operationType: 'get_chat_rooms',
      executionTime: performanceTime,
      success,
      error,
      userId,
      timestamp: new Date(),
      additionalData: { limit, offset },
    });

    throw err;
  }
}

/**
 * 메모리 사용량 모니터링
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} {
  if (typeof window !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100, // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100, // MB
      percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100),
    };
  }

  return {
    used: 0,
    total: 0,
    percentage: 0,
  };
}

/**
 * 연결 상태 모니터링
 */
export async function checkDatabaseConnection(): Promise<{
  isConnected: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);

    const responseTime = performance.now() - startTime;

    return {
      isConnected: !error,
      responseTime: Math.round(responseTime * 100) / 100,
      error: error?.message,
    };
  } catch (err) {
    const responseTime = performance.now() - startTime;

    return {
      isConnected: false,
      responseTime: Math.round(responseTime * 100) / 100,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * 실시간 성능 대시보드 데이터
 */
export async function getPerformanceDashboardData(userId: string): Promise<{
  chatStats: ChatRoomStats | null;
  performanceStats: ReturnType<ChatPerformanceMonitor['getPerformanceStats']>;
  memoryUsage: ReturnType<typeof getMemoryUsage>;
  dbConnection: Awaited<ReturnType<typeof checkDatabaseConnection>>;
  recentErrors: ChatPerformanceMetrics[];
}> {
  const [chatStats, dbConnection] = await Promise.all([
    getChatRoomStats(),
    checkDatabaseConnection(),
  ]);

  return {
    chatStats,
    performanceStats: chatPerformanceMonitor.getPerformanceStats(),
    memoryUsage: getMemoryUsage(),
    dbConnection,
    recentErrors: chatPerformanceMonitor.getRecentErrors(5),
  };
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

/**
 * 자동 재시도 함수
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      // 지수 백오프
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError!;
}

/**
 * 회로 차단기 패턴
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000 // 1분
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await operation();

      if (this.state === 'HALF_OPEN') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  getState(): { state: string; failureCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
    };
  }
}

// 전역 회로 차단기 인스턴스들
export const chatRoomCircuitBreaker = new CircuitBreaker();
export const messageCircuitBreaker = new CircuitBreaker();

// ============================================================================
// Performance Testing Utilities
// ============================================================================

/**
 * 부하 테스트 유틸리티
 */
export async function runLoadTest(
  operation: () => Promise<any>,
  concurrentRequests = 10,
  duration = 5000 // 5초
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  requestsPerSecond: number;
}> {
  const startTime = Date.now();
  const endTime = startTime + duration;
  const results: { success: boolean; responseTime: number }[] = [];

  while (Date.now() < endTime) {
    const promises = Array(concurrentRequests)
      .fill(null)
      .map(async () => {
        const requestStart = performance.now();
        try {
          await operation();
          return {
            success: true,
            responseTime: performance.now() - requestStart,
          };
        } catch (error) {
          return {
            success: false,
            responseTime: performance.now() - requestStart,
          };
        }
      });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // 작은 지연을 주어 시스템이 회복할 시간을 줌
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const successfulRequests = results.filter(r => r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const actualDuration = Date.now() - startTime;

  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests: results.length - successfulRequests,
    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    requestsPerSecond: Math.round((results.length / actualDuration) * 1000 * 100) / 100,
  };
}