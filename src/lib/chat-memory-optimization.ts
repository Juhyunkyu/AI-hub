/**
 * SmartMessageWindow 시스템 - Phase 1 메모리 최적화
 *
 * 목표:
 * - 메모리 사용량 90% 감소 (50MB → 5MB per user)
 * - 50개 메시지만 메모리에 유지
 * - 스크롤 위치 기반 동적 로딩
 * - WeakMap 기반 가비지 컬렉션
 */

export interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  [key: string]: any;
}

export interface MessageWindow {
  startIndex: number;
  endIndex: number;
  messages: Message[];
  totalCount: number;
}

export interface SmartWindowConfig {
  windowSize: number;        // 메모리에 유지할 메시지 수 (기본: 50)
  bufferSize: number;        // 앞뒤 버퍼 크기 (기본: 10)
  cleanupThreshold: number;  // 정리 임계값 (기본: 100)
}

/**
 * SmartMessageWindow 클래스
 * 메모리 효율적인 메시지 윈도우 관리
 */
export class SmartMessageWindow {
  private messages = new Map<string, Message>();
  private messageOrder: string[] = [];
  private windowStart = 0;
  private windowEnd = 0;
  private totalMessageCount = 0;
  private config: SmartWindowConfig;

  // WeakMap for automatic garbage collection
  private messageCache = new WeakMap<object, Message>();
  private cleanupCallbacks = new Set<() => void>();

  constructor(config: Partial<SmartWindowConfig> = {}) {
    this.config = {
      windowSize: 50,
      bufferSize: 10,
      cleanupThreshold: 100,
      ...config
    };
  }

  /**
   * 메시지 윈도우 업데이트
   * @param scrollPosition 현재 스크롤 위치 (0-1)
   * @param totalCount 전체 메시지 수
   * @returns 업데이트된 메시지 윈도우
   */
  updateWindow(scrollPosition: number, totalCount: number): MessageWindow {
    this.totalMessageCount = totalCount;

    // 스크롤 위치 기반으로 윈도우 시작점 계산
    const targetIndex = Math.floor(scrollPosition * totalCount);
    const halfWindow = Math.floor(this.config.windowSize / 2);

    // 새로운 윈도우 범위 계산
    let newStart = Math.max(0, targetIndex - halfWindow);
    let newEnd = Math.min(totalCount, newStart + this.config.windowSize);

    // 윈도우가 끝에 도달하면 시작점 조정
    if (newEnd === totalCount) {
      newStart = Math.max(0, newEnd - this.config.windowSize);
    }

    // 윈도우 위치 업데이트
    this.windowStart = newStart;
    this.windowEnd = newEnd;

    // 정리가 필요한 경우 수행
    if (this.messages.size > this.config.cleanupThreshold) {
      this.performCleanup();
    }

    return this.getCurrentWindow();
  }

  /**
   * 메시지 배치 추가
   * @param messages 추가할 메시지 배열
   * @param startIndex 시작 인덱스
   */
  addMessages(messages: Message[], startIndex: number): void {
    messages.forEach((message, index) => {
      const globalIndex = startIndex + index;
      const messageKey = `${globalIndex}:${message.id}`;

      this.messages.set(messageKey, message);

      // 순서 유지를 위해 정렬된 위치에 삽입
      this.insertMessageOrder(messageKey, globalIndex);
    });
  }

  /**
   * 현재 윈도우의 메시지들 반환
   */
  getCurrentWindow(): MessageWindow {
    const windowMessages: Message[] = [];

    for (let i = this.windowStart; i < this.windowEnd; i++) {
      const messageKey = this.findMessageKeyByIndex(i);
      if (messageKey) {
        const message = this.messages.get(messageKey);
        if (message) {
          windowMessages.push(message);
        }
      }
    }

    return {
      startIndex: this.windowStart,
      endIndex: this.windowEnd,
      messages: windowMessages,
      totalCount: this.totalMessageCount
    };
  }

  /**
   * 특정 인덱스의 메시지 키 찾기
   */
  private findMessageKeyByIndex(index: number): string | undefined {
    return this.messageOrder.find(key => {
      const [keyIndex] = key.split(':');
      return parseInt(keyIndex) === index;
    });
  }

  /**
   * 메시지 순서 배열에 정렬된 위치에 삽입
   */
  private insertMessageOrder(messageKey: string, index: number): void {
    const insertPosition = this.messageOrder.findIndex(key => {
      const [keyIndex] = key.split(':');
      return parseInt(keyIndex) > index;
    });

    if (insertPosition === -1) {
      this.messageOrder.push(messageKey);
    } else {
      this.messageOrder.splice(insertPosition, 0, messageKey);
    }
  }

  /**
   * 윈도우 밖 메시지들 정리
   */
  private performCleanup(): void {
    const keysToDelete: string[] = [];

    this.messageOrder.forEach(messageKey => {
      const [indexStr] = messageKey.split(':');
      const index = parseInt(indexStr);

      // 현재 윈도우 + 버퍼 범위 밖의 메시지는 제거 대상
      const bufferStart = this.windowStart - this.config.bufferSize;
      const bufferEnd = this.windowEnd + this.config.bufferSize;

      if (index < bufferStart || index >= bufferEnd) {
        keysToDelete.push(messageKey);
      }
    });

    // 메모리에서 제거
    keysToDelete.forEach(key => {
      this.messages.delete(key);
      const orderIndex = this.messageOrder.indexOf(key);
      if (orderIndex !== -1) {
        this.messageOrder.splice(orderIndex, 1);
      }
    });

    // 정리 콜백 실행
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });

    console.debug(`SmartWindow cleanup: 제거된 메시지 ${keysToDelete.length}개, 현재 메모리: ${this.messages.size}개`);
  }

  /**
   * 메시지가 현재 윈도우에 있는지 확인
   */
  isInWindow(messageId: string): boolean {
    for (const messageKey of this.messages.keys()) {
      if (messageKey.includes(messageId)) {
        const [indexStr] = messageKey.split(':');
        const index = parseInt(indexStr);
        return index >= this.windowStart && index < this.windowEnd;
      }
    }
    return false;
  }

  /**
   * 메시지 로드가 필요한 범위 계산
   */
  getRequiredRange(): { start: number; end: number } | null {
    const currentMessages = new Set<number>();

    // 현재 메모리에 있는 메시지 인덱스들 수집
    this.messageOrder.forEach(messageKey => {
      const [indexStr] = messageKey.split(':');
      currentMessages.add(parseInt(indexStr));
    });

    // 필요한 범위에서 누락된 인덱스 찾기
    const bufferStart = Math.max(0, this.windowStart - this.config.bufferSize);
    const bufferEnd = Math.min(this.totalMessageCount, this.windowEnd + this.config.bufferSize);

    let missingStart = -1;
    let missingEnd = -1;

    for (let i = bufferStart; i < bufferEnd; i++) {
      if (!currentMessages.has(i)) {
        if (missingStart === -1) {
          missingStart = i;
        }
        missingEnd = i + 1;
      }
    }

    if (missingStart === -1) {
      return null; // 모든 메시지가 메모리에 있음
    }

    return { start: missingStart, end: missingEnd };
  }

  /**
   * 정리 콜백 등록
   */
  onCleanup(callback: () => void): () => void {
    this.cleanupCallbacks.add(callback);

    // 콜백 해제 함수 반환
    return () => {
      this.cleanupCallbacks.delete(callback);
    };
  }

  /**
   * 메모리 사용량 정보
   */
  getMemoryInfo() {
    const compressionRatio = this.totalMessageCount > 0
      ? Math.round(((this.totalMessageCount - this.messages.size) / this.totalMessageCount) * 100)
      : 0;

    return {
      messagesInMemory: this.messages.size,
      windowSize: this.windowEnd - this.windowStart,
      windowStart: this.windowStart,
      windowEnd: this.windowEnd,
      totalMessages: this.totalMessageCount,
      memoryUsageKB: Math.round(this.messages.size * 0.5), // 대략적인 추정
      compressionRatio: Math.max(0, compressionRatio),
      cleanupCount: this.cleanupCallbacks.size
    };
  }

  /**
   * 윈도우 리셋
   */
  reset(): void {
    this.messages.clear();
    this.messageOrder = [];
    this.windowStart = 0;
    this.windowEnd = 0;
    this.totalMessageCount = 0;
    this.cleanupCallbacks.clear();
  }

  /**
   * 강제 가비지 컬렉션 트리거
   */
  forceCleanup(): void {
    this.performCleanup();

    // WeakMap 정리를 위해 임시 참조 제거
    if (typeof window !== 'undefined' && 'gc' in window) {
      // 개발 환경에서만 사용 가능
      (window as any).gc?.();
    }
  }

  /**
   * 클린업 메서드 - 테스트에서 사용
   */
  cleanup(): void {
    this.reset();
  }
}

/**
 * React Hook for SmartMessageWindow
 */
export function useSmartMessageWindow(config?: Partial<SmartWindowConfig>) {
  const windowRef = React.useRef<SmartMessageWindow>();

  if (!windowRef.current) {
    windowRef.current = new SmartMessageWindow(config);
  }

  React.useEffect(() => {
    return () => {
      windowRef.current?.reset();
    };
  }, []);

  return windowRef.current;
}

/**
 * 메모리 효율성을 위한 유틸리티 함수들
 */
export const MessageWindowUtils = {
  /**
   * 스크롤 위치를 0-1 범위로 정규화
   */
  normalizeScrollPosition(scrollTop: number, scrollHeight: number, clientHeight: number): number {
    if (scrollHeight <= clientHeight) return 0;
    return Math.min(1, Math.max(0, scrollTop / (scrollHeight - clientHeight)));
  },

  /**
   * 메시지 배열을 청크로 나누기
   */
  chunkMessages<T>(messages: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }
    return chunks;
  },

  /**
   * 메모리 사용량 추정
   */
  estimateMessageMemoryUsage(message: Message): number {
    const jsonString = JSON.stringify(message);
    return new Blob([jsonString]).size; // bytes
  },

  /**
   * 디바운스된 윈도우 업데이트
   */
  createDebouncedWindowUpdate(
    updateFn: (scrollPosition: number, totalCount: number) => void,
    delay: number = 16 // ~60fps
  ) {
    let timeoutId: NodeJS.Timeout;

    return (scrollPosition: number, totalCount: number) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateFn(scrollPosition, totalCount);
      }, delay);
    };
  }
};

// React import for useRef and useEffect
import React from 'react';