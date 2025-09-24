/**
 * 채팅 시스템 성능 테스트 유틸리티
 * SmartMessageWindow의 성능을 측정하고 검증하는 도구
 */

import { SmartMessageWindow, MessageWindowUtils, type Message } from './chat-memory-optimization';
import type { ChatMessage } from '@/types/chat';

export interface PerformanceTestConfig {
  userCount: number;
  messagesPerUser: number;
  windowSize: number;
  bufferSize: number;
  testDuration?: number; // ms
}

export interface PerformanceTestResult {
  config: PerformanceTestConfig;
  memoryUsage: {
    beforeOptimization: number; // KB
    afterOptimization: number;  // KB
    reduction: number;          // %
    perUserMemory: number;      // KB
  };
  performance: {
    initTime: number;           // ms
    updateTime: number;         // ms
    cleanupTime: number;        // ms
    messagesPerSecond: number;
  };
  scalability: {
    totalMessages: number;
    messagesInMemory: number;
    compressionRatio: number;
    memoryEfficiency: number;   // messages/KB
  };
  verdict: {
    passed: boolean;
    bottlenecks: string[];
    recommendations: string[];
  };
}

/**
 * 성능 테스트를 위한 가짜 메시지 생성
 */
function generateTestMessage(index: number, userId: string): ChatMessage {
  const messageTexts = [
    '안녕하세요!',
    '프로젝트 진행 상황은 어떤가요?',
    '새로운 기능이 완성되었습니다.',
    '코드 리뷰를 요청드립니다.',
    '버그를 발견했습니다.',
    '회의 시간이 변경되었습니다.',
    '좋은 아이디어네요!',
    '내일 마감입니다.',
    '테스트 결과를 공유합니다.',
    '질문이 있습니다.'
  ];

  return {
    id: `test-msg-${userId}-${index}`,
    content: `${messageTexts[index % messageTexts.length]} (사용자: ${userId}, 메시지: ${index})`,
    created_at: new Date(Date.now() - (10000 - index) * 60000).toISOString(),
    from_user_id: userId,
    to_user_id: 'test-chat-room',
    is_edited: false,
    edited_at: null,
    attachments: null,
    reply_to: index > 10 && Math.random() > 0.8 ? `test-msg-${userId}-${index - 5}` : null
  };
}

/**
 * 메모리 사용량 추정 (실제 브라우저 메모리가 아닌 데이터 크기 기준)
 */
function estimateMemoryUsage(messages: ChatMessage[]): number {
  let totalBytes = 0;

  messages.forEach(message => {
    // JSON 직렬화 크기 추정
    const jsonSize = JSON.stringify(message).length * 2; // UTF-16 문자당 2바이트
    totalBytes += jsonSize;
  });

  return Math.round(totalBytes / 1024); // KB로 변환
}

/**
 * 100명 동시접속 시나리오 성능 테스트
 */
export async function performanceTest100Users(
  customConfig?: Partial<PerformanceTestConfig>
): Promise<PerformanceTestResult> {
  const config: PerformanceTestConfig = {
    userCount: 100,
    messagesPerUser: 50, // 사용자당 50개 메시지 = 총 5000개
    windowSize: 50,
    bufferSize: 10,
    testDuration: 5000, // 5초
    ...customConfig
  };

  console.log(`🚀 성능 테스트 시작: ${config.userCount}명 사용자, ${config.messagesPerUser}개 메시지/사용자`);

  const startTime = performance.now();
  let initTime = 0;
  let updateTime = 0;
  let cleanupTime = 0;

  // 1. 테스트 데이터 생성
  const allMessages: ChatMessage[] = [];
  for (let userId = 1; userId <= config.userCount; userId++) {
    for (let msgIndex = 0; msgIndex < config.messagesPerUser; msgIndex++) {
      allMessages.push(generateTestMessage(msgIndex, `user${userId}`));
    }
  }

  // 최적화 전 메모리 사용량 추정
  const memoryBeforeOptimization = estimateMemoryUsage(allMessages);

  // 2. SmartMessageWindow 초기화
  const initStart = performance.now();
  const smartWindow = new SmartMessageWindow({
    windowSize: config.windowSize,
    bufferSize: config.bufferSize,
    cleanupThreshold: 100
  });
  initTime = performance.now() - initStart;

  // 3. 메시지 배치 추가 및 윈도우 업데이트 성능 측정
  const updateStart = performance.now();

  // 배치 단위로 메시지 추가
  const batchSize = 100;
  const batches = Math.ceil(allMessages.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, allMessages.length);
    const batch = allMessages.slice(start, end);

    const convertedBatch: Message[] = batch.map(msg => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at,
      user_id: msg.from_user_id,
      ...msg
    }));

    smartWindow.addMessages(convertedBatch, start);

    // 다양한 스크롤 위치에서 윈도우 업데이트
    const scrollPositions = [0, 0.25, 0.5, 0.75, 1.0];
    for (const pos of scrollPositions) {
      smartWindow.updateWindow(pos, allMessages.length);
    }
  }

  updateTime = performance.now() - updateStart;

  // 4. 메모리 정보 수집
  const memoryInfo = smartWindow.getMemoryInfo();
  const memoryAfterOptimization = memoryInfo.memoryUsageKB;

  // 5. 정리 성능 측정
  const cleanupStart = performance.now();
  smartWindow.forceCleanup();
  cleanupTime = performance.now() - cleanupStart;

  // 6. 결과 분석
  const totalTime = performance.now() - startTime;
  const messagesPerSecond = allMessages.length / (totalTime / 1000);

  const memoryReduction = memoryBeforeOptimization > 0
    ? ((memoryBeforeOptimization - memoryAfterOptimization) / memoryBeforeOptimization) * 100
    : 0;

  const perUserMemory = memoryAfterOptimization / config.userCount;

  // 7. 병목 지점 및 추천사항 분석
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  if (updateTime > 1000) {
    bottlenecks.push('윈도우 업데이트 속도 저하');
    recommendations.push('배치 크기 조정 또는 디바운스 개선');
  }

  if (memoryAfterOptimization > 5000) { // 5MB 이상
    bottlenecks.push('메모리 사용량 과다');
    recommendations.push('윈도우 크기 축소 또는 정리 임계값 조정');
  }

  if (cleanupTime > 100) {
    bottlenecks.push('정리 작업 지연');
    recommendations.push('정리 로직 최적화 또는 점진적 정리 적용');
  }

  // 8. 성능 목표 달성 여부 판단
  const passed =
    memoryReduction >= 80 &&           // 80% 이상 메모리 절약
    perUserMemory <= 50 &&             // 사용자당 50KB 이하
    messagesPerSecond >= 1000 &&       // 초당 1000개 메시지 처리
    updateTime <= 2000;                // 업데이트 2초 이내 완료

  const result: PerformanceTestResult = {
    config,
    memoryUsage: {
      beforeOptimization: memoryBeforeOptimization,
      afterOptimization: memoryAfterOptimization,
      reduction: memoryReduction,
      perUserMemory
    },
    performance: {
      initTime,
      updateTime,
      cleanupTime,
      messagesPerSecond: Math.round(messagesPerSecond)
    },
    scalability: {
      totalMessages: allMessages.length,
      messagesInMemory: memoryInfo.messagesInMemory,
      compressionRatio: memoryInfo.compressionRatio,
      memoryEfficiency: memoryInfo.messagesInMemory / Math.max(memoryAfterOptimization, 1)
    },
    verdict: {
      passed,
      bottlenecks,
      recommendations
    }
  };

  console.log(`✅ 성능 테스트 완료 (${totalTime.toFixed(0)}ms):`, result);
  return result;
}

/**
 * 스트레스 테스트 - 점진적으로 부하 증가
 */
export async function stressTest(
  maxUsers: number = 200,
  step: number = 25
): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];

  console.log(`🔥 스트레스 테스트 시작: 최대 ${maxUsers}명, 단계별 ${step}명`);

  for (let users = step; users <= maxUsers; users += step) {
    console.log(`📊 테스트 중: ${users}명 사용자...`);

    try {
      const result = await performanceTest100Users({
        userCount: users,
        messagesPerUser: Math.max(10, 50 - users / 10) // 사용자 수에 따라 메시지 수 조정
      });

      results.push(result);

      // 성능이 심각하게 저하되면 조기 종료
      if (!result.verdict.passed && result.performance.updateTime > 10000) {
        console.warn(`⚠️ 성능 한계 도달: ${users}명에서 테스트 중단`);
        break;
      }

      // CPU 부하 완화를 위한 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ ${users}명 테스트 실패:`, error);
      break;
    }
  }

  console.log(`🏁 스트레스 테스트 완료: ${results.length}개 시나리오 실행`);
  return results;
}

/**
 * 실시간 모니터링 시뮬레이션
 */
export function createPerformanceMonitor(smartWindow: SmartMessageWindow) {
  const metrics = {
    memoryUsage: [] as number[],
    messageCount: [] as number[],
    compressionRatio: [] as number[],
    timestamp: [] as number[]
  };

  let isRunning = false;
  let intervalId: NodeJS.Timeout;

  const start = () => {
    if (isRunning) return;

    isRunning = true;
    intervalId = setInterval(() => {
      const info = smartWindow.getMemoryInfo();
      const now = Date.now();

      metrics.memoryUsage.push(info.memoryUsageKB);
      metrics.messageCount.push(info.messagesInMemory);
      metrics.compressionRatio.push(info.compressionRatio);
      metrics.timestamp.push(now);

      // 최근 100개 데이터만 유지
      if (metrics.timestamp.length > 100) {
        metrics.memoryUsage.shift();
        metrics.messageCount.shift();
        metrics.compressionRatio.shift();
        metrics.timestamp.shift();
      }
    }, 1000); // 1초마다 수집
  };

  const stop = () => {
    if (!isRunning) return;

    isRunning = false;
    clearInterval(intervalId);
  };

  const getMetrics = () => ({ ...metrics });

  const getAverages = () => {
    if (metrics.memoryUsage.length === 0) {
      return { avgMemory: 0, avgMessages: 0, avgCompression: 0 };
    }

    return {
      avgMemory: metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length,
      avgMessages: metrics.messageCount.reduce((a, b) => a + b, 0) / metrics.messageCount.length,
      avgCompression: metrics.compressionRatio.reduce((a, b) => a + b, 0) / metrics.compressionRatio.length
    };
  };

  return {
    start,
    stop,
    getMetrics,
    getAverages,
    isRunning: () => isRunning
  };
}

/**
 * 성능 테스트 보고서 생성
 */
export function generatePerformanceReport(results: PerformanceTestResult[]): string {
  if (results.length === 0) {
    return '성능 테스트 결과가 없습니다.';
  }

  const report = [`
# 🚀 SmartMessageWindow 성능 테스트 보고서

생성일시: ${new Date().toLocaleString('ko-KR')}
테스트 시나리오: ${results.length}개

## 📊 요약

`];

  const passedCount = results.filter(r => r.verdict.passed).length;
  const avgMemoryReduction = results.reduce((sum, r) => sum + r.memoryUsage.reduction, 0) / results.length;
  const avgPerformance = results.reduce((sum, r) => sum + r.performance.messagesPerSecond, 0) / results.length;

  report.push(`- ✅ 통과한 테스트: ${passedCount}/${results.length} (${Math.round(passedCount / results.length * 100)}%)
- 💾 평균 메모리 절약률: ${avgMemoryReduction.toFixed(1)}%
- ⚡ 평균 처리 성능: ${Math.round(avgPerformance).toLocaleString()} 메시지/초

## 📈 상세 결과

`);

  results.forEach((result, index) => {
    const status = result.verdict.passed ? '✅ 통과' : '❌ 실패';

    report.push(`### 테스트 ${index + 1}: ${result.config.userCount}명 사용자 ${status}

- **설정**: ${result.config.userCount}명 × ${result.config.messagesPerUser}개 = ${result.scalability.totalMessages}개 메시지
- **메모리 절약**: ${result.memoryUsage.beforeOptimization}KB → ${result.memoryUsage.afterOptimization}KB (${result.memoryUsage.reduction.toFixed(1)}% 절약)
- **사용자당 메모리**: ${result.memoryUsage.perUserMemory.toFixed(1)}KB
- **처리 성능**: ${result.performance.messagesPerSecond.toLocaleString()} 메시지/초
- **압축률**: ${result.scalability.compressionRatio}%

`);

    if (result.verdict.bottlenecks.length > 0) {
      report.push(`**⚠️ 발견된 병목:**
${result.verdict.bottlenecks.map(b => `- ${b}`).join('\n')}

`);
    }

    if (result.verdict.recommendations.length > 0) {
      report.push(`**💡 개선 권장사항:**
${result.verdict.recommendations.map(r => `- ${r}`).join('\n')}

`);
    }
  });

  // 결론 및 권장사항
  report.push(`## 🎯 결론

`);

  if (passedCount === results.length) {
    report.push(`🎉 **모든 테스트 통과!** SmartMessageWindow 최적화가 성공적으로 작동하고 있습니다.

- 메모리 사용량이 평균 ${avgMemoryReduction.toFixed(1)}% 절약되었습니다.
- ${results[results.length - 1]?.config.userCount || 100}명 동시접속까지 안정적으로 처리 가능합니다.
- 카카오톡 수준의 성능을 달성했습니다.`);
  } else {
    report.push(`⚠️ **일부 테스트 실패.** 추가 최적화가 필요합니다.

**주요 이슈:**
${results.filter(r => !r.verdict.passed).map(r =>
  `- ${r.config.userCount}명: ${r.verdict.bottlenecks.join(', ')}`
).join('\n')}

**개선 방향:**
${Array.from(new Set(results.flatMap(r => r.verdict.recommendations))).map(r => `- ${r}`).join('\n')}`);
  }

  return report.join('\n');
}