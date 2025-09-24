/**
 * React Hook for SmartMessageWindow Integration
 * VirtualizedMessageList와 연동하여 메모리 최적화 제공
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SmartMessageWindow, MessageWindowUtils, type Message, type MessageWindow } from '@/lib/chat-memory-optimization';
import type { ChatMessage } from '@/types/chat';

interface UseSmartMessageWindowConfig {
  windowSize?: number;
  bufferSize?: number;
  cleanupThreshold?: number;
  enableAutoCleanup?: boolean;
  debugMode?: boolean;
}

interface UseSmartMessageWindowReturn {
  // 현재 윈도우 상태
  currentWindow: MessageWindow;
  memoryInfo: ReturnType<SmartMessageWindow['getMemoryInfo']>;

  // 메시지 관리 함수들
  updateWindow: (scrollPosition: number, totalCount: number) => MessageWindow;
  addMessages: (messages: ChatMessage[], startIndex: number) => void;
  loadRequiredMessages: () => Promise<void>;

  // 유틸리티 함수들
  forceCleanup: () => void;
  reset: () => void;
  isInWindow: (messageId: string) => boolean;

  // 상태 정보
  isLoading: boolean;
  loadingRange: { start: number; end: number } | null;
}

/**
 * SmartMessageWindow을 React 컴포넌트에서 사용하기 위한 Hook
 */
export function useSmartMessageWindow(
  config: UseSmartMessageWindowConfig = {}
): UseSmartMessageWindowReturn {
  const {
    windowSize = 50,
    bufferSize = 10,
    cleanupThreshold = 100,
    enableAutoCleanup = true,
    debugMode = false
  } = config;

  // SmartMessageWindow 인스턴스
  const windowRef = useRef<SmartMessageWindow>();

  // 상태 관리
  const [currentWindow, setCurrentWindow] = useState<MessageWindow>({
    startIndex: 0,
    endIndex: 0,
    messages: [],
    totalCount: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [memoryInfo, setMemoryInfo] = useState({
    messagesInMemory: 0,
    windowSize: 0,
    windowStart: 0,
    windowEnd: 0,
    totalMessages: 0,
    memoryUsageKB: 0,
    compressionRatio: 0
  });

  // 로딩 중인 범위
  const [loadingRange, setLoadingRange] = useState<{ start: number; end: number } | null>(null);

  // 디바운스된 업데이트 함수
  const debouncedUpdateRef = useRef<ReturnType<typeof MessageWindowUtils.createDebouncedWindowUpdate>>();

  // SmartMessageWindow 초기화
  useEffect(() => {
    if (!windowRef.current) {
      windowRef.current = new SmartMessageWindow({
        windowSize,
        bufferSize,
        cleanupThreshold
      });

      // 정리 콜백 등록
      if (enableAutoCleanup) {
        windowRef.current.onCleanup(() => {
          updateMemoryInfo();
          if (debugMode) {
            console.debug('SmartMessageWindow cleanup performed');
          }
        });
      }

      // 디바운스된 업데이트 함수 생성
      debouncedUpdateRef.current = MessageWindowUtils.createDebouncedWindowUpdate(
        (scrollPosition: number, totalCount: number) => {
          if (windowRef.current) {
            const newWindow = windowRef.current.updateWindow(scrollPosition, totalCount);
            setCurrentWindow(newWindow);
            updateMemoryInfo();

            // 필요한 메시지 로딩 확인
            const requiredRange = windowRef.current.getRequiredRange();
            if (requiredRange && !isLoading) {
              setLoadingRange(requiredRange);
            }
          }
        },
        16 // ~60fps
      );
    }
  }, [windowSize, bufferSize, cleanupThreshold, enableAutoCleanup, debugMode, isLoading]);

  // 메모리 정보 업데이트
  const updateMemoryInfo = useCallback(() => {
    if (windowRef.current) {
      setMemoryInfo(windowRef.current.getMemoryInfo());
    }
  }, []);

  // 윈도우 업데이트 (디바운스됨)
  const updateWindow = useCallback((scrollPosition: number, totalCount: number): MessageWindow => {
    if (debouncedUpdateRef.current) {
      debouncedUpdateRef.current(scrollPosition, totalCount);
    }
    return currentWindow;
  }, [currentWindow]);

  // 메시지 배치 추가
  const addMessages = useCallback((messages: ChatMessage[], startIndex: number) => {
    if (windowRef.current && messages.length > 0) {
      // ChatMessage를 Message 형태로 변환
      const convertedMessages: Message[] = messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        user_id: msg.from_user_id,
        ...msg
      }));

      windowRef.current.addMessages(convertedMessages, startIndex);
      setCurrentWindow(windowRef.current.getCurrentWindow());
      updateMemoryInfo();

      if (debugMode) {
        console.debug(`Added ${messages.length} messages starting at index ${startIndex}`);
      }
    }
  }, [debugMode, updateMemoryInfo]);

  // 필요한 메시지 로딩
  const loadRequiredMessages = useCallback(async () => {
    if (!windowRef.current || isLoading || !loadingRange) {
      return;
    }

    setIsLoading(true);

    try {
      if (debugMode) {
        console.debug(`Loading messages from ${loadingRange.start} to ${loadingRange.end}`);
      }

      // 실제 메시지 로딩 로직은 상위 컴포넌트에서 제공해야 함
      // 여기서는 로딩 상태만 관리

      // TODO: 메시지 로딩 API 호출
      // const messages = await fetchMessages(loadingRange.start, loadingRange.end);
      // addMessages(messages, loadingRange.start);

    } catch (error) {
      console.error('Failed to load required messages:', error);
    } finally {
      setIsLoading(false);
      setLoadingRange(null);
    }
  }, [isLoading, loadingRange, debugMode]);

  // 자동 메시지 로딩
  useEffect(() => {
    if (loadingRange && !isLoading && enableAutoCleanup) {
      loadRequiredMessages();
    }
  }, [loadingRange, isLoading, enableAutoCleanup, loadRequiredMessages]);

  // 강제 정리
  const forceCleanup = useCallback(() => {
    if (windowRef.current) {
      windowRef.current.forceCleanup();
      updateMemoryInfo();

      if (debugMode) {
        console.debug('Forced cleanup performed');
      }
    }
  }, [updateMemoryInfo, debugMode]);

  // 리셋
  const reset = useCallback(() => {
    if (windowRef.current) {
      windowRef.current.reset();
      setCurrentWindow({
        startIndex: 0,
        endIndex: 0,
        messages: [],
        totalCount: 0
      });
      setLoadingRange(null);
      updateMemoryInfo();

      if (debugMode) {
        console.debug('SmartMessageWindow reset');
      }
    }
  }, [updateMemoryInfo, debugMode]);

  // 윈도우 포함 확인
  const isInWindow = useCallback((messageId: string): boolean => {
    if (!windowRef.current) return false;
    return windowRef.current.isInWindow(messageId);
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (windowRef.current) {
        windowRef.current.reset();
      }
    };
  }, []);

  return {
    currentWindow,
    memoryInfo,
    updateWindow,
    addMessages,
    loadRequiredMessages,
    forceCleanup,
    reset,
    isInWindow,
    isLoading,
    loadingRange
  };
}

/**
 * 스크롤 이벤트를 SmartMessageWindow와 연동하기 위한 헬퍼 Hook
 */
export function useScrollIntegration(
  containerRef: React.RefObject<HTMLElement>,
  updateWindow: (scrollPosition: number, totalCount: number) => void,
  totalCount: number
) {
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPosition = MessageWindowUtils.normalizeScrollPosition(
      scrollTop,
      scrollHeight,
      clientHeight
    );

    updateWindow(scrollPosition, totalCount);
  }, [containerRef, updateWindow, totalCount]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return handleScroll;
}

/**
 * 메모리 사용량 모니터링을 위한 Hook
 */
export function useMemoryMonitoring(
  memoryInfo: ReturnType<SmartMessageWindow['getMemoryInfo']>,
  thresholds: {
    warning: number;    // MB
    critical: number;   // MB
  } = { warning: 10, critical: 50 }
) {
  const [memoryStatus, setMemoryStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    const memoryUsageMB = memoryInfo.memoryUsageKB / 1024;

    if (memoryUsageMB >= thresholds.critical) {
      setMemoryStatus('critical');
    } else if (memoryUsageMB >= thresholds.warning) {
      setMemoryStatus('warning');
    } else {
      setMemoryStatus('normal');
    }
  }, [memoryInfo.memoryUsageKB, thresholds]);

  return {
    memoryStatus,
    memoryUsageMB: memoryInfo.memoryUsageKB / 1024,
    compressionRatio: memoryInfo.compressionRatio,
    recommendations: memoryStatus === 'critical' ? [
      'Force cleanup을 실행하세요',
      '윈도우 크기를 줄이는 것을 고려하세요',
      '더 자주 정리를 수행하세요'
    ] : memoryStatus === 'warning' ? [
      '메모리 사용량을 모니터링하세요',
      'Auto cleanup이 활성화되어 있는지 확인하세요'
    ] : []
  };
}