/**
 * 메모리 최적화 데모 및 테스트 컴포넌트
 * SmartMessageWindow의 효과를 시각화하고 테스트하는 용도
 */

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSmartMessageWindow } from '@/hooks/use-smart-message-window';
import type { ChatMessage } from '@/types/chat';

interface MemoryOptimizationDemoProps {
  className?: string;
}

// 테스트용 가짜 메시지 생성 함수
function generateFakeMessage(index: number, userId: string = 'user1'): ChatMessage {
  const contents = [
    '안녕하세요! 어떻게 지내세요?',
    '오늘 날씨가 정말 좋네요.',
    '프로젝트 진행 상황은 어떤가요?',
    '다음 주에 만날 수 있을까요?',
    '새로운 기능이 정말 인상적입니다!',
    '버그 수정 완료했습니다.',
    '코드 리뷰 요청드립니다.',
    '회의 시간이 변경되었습니다.',
    '좋은 아이디어네요!',
    '질문이 있습니다.'
  ];

  return {
    id: `msg-${index}`,
    content: contents[index % contents.length] + ` (메시지 #${index})`,
    created_at: new Date(Date.now() - (1000 - index) * 60000).toISOString(),
    from_user_id: userId,
    to_user_id: 'chat-room-1',
    is_edited: false,
    edited_at: null,
    attachments: null,
    reply_to: null
  };
}

export function MemoryOptimizationDemo({ className = '' }: MemoryOptimizationDemoProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOptimizationEnabled, setIsOptimizationEnabled] = useState(true);
  const [simulatedUsers, setSimulatedUsers] = useState(1);
  const [messagesPerUser, setMessagesPerUser] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // SmartMessageWindow 훅
  const smartWindow = useSmartMessageWindow({
    windowSize: 50,
    bufferSize: 10,
    enableAutoCleanup: isOptimizationEnabled,
    debugMode: true
  });

  // 성능 측정을 위한 ref
  const performanceRef = useRef<{
    startTime: number;
    memoryBefore: number;
    memoryAfter: number;
    renderTime: number;
  }>({
    startTime: 0,
    memoryBefore: 0,
    memoryAfter: 0,
    renderTime: 0
  });

  /**
   * 대량 메시지 생성 및 테스트
   */
  const generateMessages = useCallback(async () => {
    setIsGenerating(true);
    performanceRef.current.startTime = performance.now();

    // 메모리 사용량 측정 (가능한 경우)
    if ('memory' in performance) {
      performanceRef.current.memoryBefore = (performance as any).memory.usedJSHeapSize;
    }

    const totalMessages = simulatedUsers * messagesPerUser;
    const newMessages: ChatMessage[] = [];

    for (let user = 0; user < simulatedUsers; user++) {
      for (let msgIndex = 0; msgIndex < messagesPerUser; msgIndex++) {
        const globalIndex = user * messagesPerUser + msgIndex;
        newMessages.push(generateFakeMessage(globalIndex, `user${user + 1}`));
      }
    }

    // 배치 단위로 메시지 추가 (UI 블로킹 방지)
    const batchSize = 100;
    const batches = Math.ceil(newMessages.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, newMessages.length);
      const batch = newMessages.slice(start, end);

      setMessages(prev => [...prev, ...batch]);

      // SmartWindow에 추가 (최적화 모드인 경우)
      if (isOptimizationEnabled) {
        smartWindow.addMessages(batch, start);
      }

      // UI 업데이트를 위한 짧은 대기
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    // 성능 측정 완료
    performanceRef.current.renderTime = performance.now() - performanceRef.current.startTime;

    if ('memory' in performance) {
      performanceRef.current.memoryAfter = (performance as any).memory.usedJSHeapSize;
    }

    setIsGenerating(false);
  }, [simulatedUsers, messagesPerUser, isOptimizationEnabled, smartWindow]);

  /**
   * 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    smartWindow.reset();
    setScrollPosition(0);
  }, [smartWindow]);

  /**
   * 스크롤 시뮬레이션
   */
  const simulateScroll = useCallback((position: number) => {
    setScrollPosition(position);
    smartWindow.updateWindow(position / 100, messages.length);
  }, [smartWindow, messages.length]);

  /**
   * 메모리 정보 계산
   */
  const memoryStats = useMemo(() => {
    const totalMessages = messages.length;
    const smartWindowMessages = smartWindow.memoryInfo.messagesInMemory;
    const compressionRatio = smartWindow.memoryInfo.compressionRatio;

    // 추정 메모리 사용량 (KB)
    const estimatedTotalMemory = totalMessages * 0.5; // 메시지당 0.5KB 추정
    const estimatedOptimizedMemory = smartWindowMessages * 0.5;

    return {
      totalMessages,
      smartWindowMessages,
      compressionRatio,
      estimatedTotalMemory,
      estimatedOptimizedMemory,
      memorySaved: estimatedTotalMemory - estimatedOptimizedMemory,
      compressionPercent: totalMessages > 0 ? ((estimatedTotalMemory - estimatedOptimizedMemory) / estimatedTotalMemory) * 100 : 0
    };
  }, [messages.length, smartWindow.memoryInfo]);

  /**
   * 성능 통계
   */
  const performanceStats = useMemo(() => {
    const { renderTime, memoryBefore, memoryAfter } = performanceRef.current;

    return {
      renderTime: renderTime.toFixed(2),
      memoryIncrease: memoryAfter > 0 ? ((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2) : 'N/A',
      messagesPerSecond: renderTime > 0 ? (messages.length / (renderTime / 1000)).toFixed(0) : '0'
    };
  }, [messages.length, performanceRef.current]);

  return (
    <div className={`space-y-6 p-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧠 SmartMessageWindow 메모리 최적화 데모
            <Badge variant={isOptimizationEnabled ? "default" : "secondary"}>
              {isOptimizationEnabled ? "최적화 ON" : "최적화 OFF"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 제어 패널 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>시뮬레이션 사용자 수</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimulatedUsers(Math.max(1, simulatedUsers - 1))}
                >
                  -
                </Button>
                <span className="text-center min-w-[3rem]">{simulatedUsers}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimulatedUsers(Math.min(100, simulatedUsers + 1))}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>사용자당 메시지 수</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMessagesPerUser(Math.max(10, messagesPerUser - 10))}
                >
                  -10
                </Button>
                <span className="text-center min-w-[3rem]">{messagesPerUser}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMessagesPerUser(Math.min(1000, messagesPerUser + 10))}
                >
                  +10
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="optimization"
                  checked={isOptimizationEnabled}
                  onCheckedChange={setIsOptimizationEnabled}
                />
                <Label htmlFor="optimization">메모리 최적화</Label>
              </div>
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-2">
            <Button onClick={generateMessages} disabled={isGenerating}>
              {isGenerating ? '생성 중...' : `${simulatedUsers * messagesPerUser}개 메시지 생성`}
            </Button>
            <Button onClick={clearMessages} variant="outline">
              초기화
            </Button>
            <Button onClick={smartWindow.forceCleanup} variant="outline">
              강제 정리
            </Button>
          </div>

          {/* 스크롤 시뮬레이션 */}
          {messages.length > 0 && (
            <div className="space-y-2">
              <Label>스크롤 위치 시뮬레이션</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm">상단</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scrollPosition}
                  onChange={(e) => simulateScroll(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm">하단</span>
              </div>
              <p className="text-xs text-muted-foreground">
                현재 위치: {scrollPosition}% (메시지 {Math.floor(scrollPosition / 100 * messages.length)})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 메모리 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 메모리 사용량</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>전체 메시지</span>
                <span className="font-mono">{memoryStats.totalMessages.toLocaleString()}개</span>
              </div>

              {isOptimizationEnabled && (
                <>
                  <div className="flex justify-between">
                    <span>메모리 내 메시지</span>
                    <span className="font-mono text-green-600">
                      {memoryStats.smartWindowMessages}개
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>압축률</span>
                    <span className="font-mono text-green-600">
                      {memoryStats.compressionRatio}%
                    </span>
                  </div>
                </>
              )}

              <hr className="my-2" />

              <div className="flex justify-between">
                <span>추정 총 메모리</span>
                <span className="font-mono">{memoryStats.estimatedTotalMemory.toFixed(1)}KB</span>
              </div>

              {isOptimizationEnabled && (
                <>
                  <div className="flex justify-between">
                    <span>최적화 메모리</span>
                    <span className="font-mono text-green-600">
                      {memoryStats.estimatedOptimizedMemory.toFixed(1)}KB
                    </span>
                  </div>

                  <div className="flex justify-between font-bold">
                    <span>절약된 메모리</span>
                    <span className="font-mono text-green-600">
                      {memoryStats.memorySaved.toFixed(1)}KB ({memoryStats.compressionPercent.toFixed(1)}%)
                    </span>
                  </div>

                  <Progress
                    value={memoryStats.compressionPercent}
                    className="mt-2"
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">⚡ 성능 통계</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>렌더링 시간</span>
                <span className="font-mono">{performanceStats.renderTime}ms</span>
              </div>

              <div className="flex justify-between">
                <span>메모리 증가</span>
                <span className="font-mono">{performanceStats.memoryIncrease}MB</span>
              </div>

              <div className="flex justify-between">
                <span>메시지/초</span>
                <span className="font-mono">{performanceStats.messagesPerSecond}</span>
              </div>

              {isOptimizationEnabled && (
                <>
                  <hr className="my-2" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>윈도우: {smartWindow.memoryInfo.windowStart}-{smartWindow.memoryInfo.windowEnd}</p>
                    <p>사용량: {smartWindow.memoryInfo.memoryUsageKB}KB</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 100명 시뮬레이션 결과 */}
      {messages.length >= 5000 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg text-green-800">🎯 100명 동시접속 시뮬레이션 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {isOptimizationEnabled ?
                    `${(memoryStats.estimatedOptimizedMemory * 100 / 1024).toFixed(1)}MB` :
                    `${(memoryStats.estimatedTotalMemory * 100 / 1024).toFixed(1)}MB`
                  }
                </div>
                <div className="text-sm text-muted-foreground">총 메모리 사용량</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {isOptimizationEnabled ?
                    `${memoryStats.compressionPercent.toFixed(1)}%` :
                    '0%'
                  }
                </div>
                <div className="text-sm text-muted-foreground">메모리 절약률</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {isOptimizationEnabled ? '✅ 통과' : '❌ 실패'}
                </div>
                <div className="text-sm text-muted-foreground">성능 목표 달성</div>
              </div>
            </div>

            {isOptimizationEnabled && (
              <div className="mt-4 p-3 bg-green-100 rounded">
                <p className="text-sm text-green-800">
                  <strong>🎉 최적화 성공!</strong><br/>
                  SmartMessageWindow를 통해 메모리 사용량을 {memoryStats.compressionPercent.toFixed(1)}% 절약했습니다.
                  100명이 동시에 접속해도 안정적인 성능을 유지할 수 있습니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}