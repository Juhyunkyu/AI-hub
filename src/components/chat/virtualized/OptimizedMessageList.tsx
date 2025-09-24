/**
 * OptimizedMessageList - SmartMessageWindow가 통합된 가상화 메시지 리스트
 *
 * 메모리 최적화 기능:
 * - 50개 메시지만 메모리에 유지
 * - 스크롤 기반 동적 로딩
 * - WeakMap 가비지 컬렉션
 * - requestIdleCallback 활용
 */

"use client";

import {
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
  useState,
  createRef,
  use,
  startTransition,
  useDeferredValue
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessage } from "@/types/chat";
import { MessageRenderer } from "./MessageRenderer";
import { useMessageHeight } from "./useMessageHeight";
import { TypingIndicatorMessage } from "../TypingIndicatorMessage";
import { useSmartMessageWindow, useScrollIntegration, useMemoryMonitoring } from "@/hooks/use-smart-message-window";
import {
  messageProcessor,
  messageStateManager,
  transitionManager,
  performanceMonitor,
  React19Utils
} from "@/lib/chat-react19-optimizations";

// Phase 1.2 Advanced Optimizations
interface MessageRenderCache {
  canvas?: OffscreenCanvas;
  imageData?: ImageData;
  height: number;
  lastRendered: number;
  renderCount: number;
}

// Message Pool for component reuse
class MessageComponentPool {
  private pool: React.RefObject<HTMLDivElement>[] = [];
  private activeComponents = new Set<React.RefObject<HTMLDivElement>>();
  private maxPoolSize = 20;

  acquire(): React.RefObject<HTMLDivElement> {
    const ref = this.pool.pop() || createRef<HTMLDivElement>();
    this.activeComponents.add(ref);
    return ref;
  }

  release(ref: React.RefObject<HTMLDivElement>) {
    if (this.activeComponents.has(ref)) {
      this.activeComponents.delete(ref);
      if (this.pool.length < this.maxPoolSize) {
        this.pool.push(ref);
      }
    }
  }

  clear() {
    this.pool.length = 0;
    this.activeComponents.clear();
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeComponents: this.activeComponents.size,
      totalRefs: this.pool.length + this.activeComponents.size
    };
  }
}

// Idle Callback Queue for background processing
class IdleCallbackQueue {
  private queue: Array<{ callback: () => void; priority: number }> = [];
  private isProcessing = false;
  private maxExecutionTime = 5; // 5ms per frame

  enqueue(callback: () => void, priority = 0) {
    this.queue.push({ callback, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.processQueue();
  }

  private processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    const processInIdle = (deadline?: IdleDeadline) => {
      const startTime = performance.now();

      while (
        this.queue.length > 0 &&
        (deadline ? deadline.timeRemaining() > 1 : performance.now() - startTime < this.maxExecutionTime)
      ) {
        const item = this.queue.shift();
        if (item) {
          try {
            item.callback();
          } catch (error) {
            console.error('Idle callback error:', error);
          }
        }
      }

      if (this.queue.length > 0) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(processInIdle, { timeout: 100 });
        } else {
          setTimeout(() => processInIdle(), 16);
        }
      } else {
        this.isProcessing = false;
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(processInIdle, { timeout: 50 });
    } else {
      setTimeout(() => processInIdle(), 0);
    }
  }

  clear() {
    this.queue.length = 0;
    this.isProcessing = false;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}

// Offscreen Canvas Manager
class OffscreenCanvasManager {
  private canvasCache = new Map<string, MessageRenderCache>();
  private maxCacheSize = 100;
  private cleanupThreshold = 150;

  getCanvas(messageId: string, width: number, height: number): MessageRenderCache | null {
    const cached = this.canvasCache.get(messageId);
    if (cached && cached.height === height) {
      cached.lastRendered = Date.now();
      return cached;
    }

    // Create new cache entry
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const cache: MessageRenderCache = {
        canvas,
        height,
        lastRendered: Date.now(),
        renderCount: 0
      };

      this.canvasCache.set(messageId, cache);
      this.cleanup();
      return cache;
    }

    return null;
  }

  cleanup() {
    if (this.canvasCache.size <= this.maxCacheSize) return;

    // Sort by last rendered time and remove oldest entries
    const entries = Array.from(this.canvasCache.entries())
      .sort((a, b) => a[1].lastRendered - b[1].lastRendered);

    const toRemove = entries.slice(0, this.canvasCache.size - this.maxCacheSize);
    toRemove.forEach(([messageId]) => {
      this.canvasCache.delete(messageId);
    });
  }

  forceCleanup() {
    this.canvasCache.clear();
  }

  getStats() {
    return {
      cacheSize: this.canvasCache.size,
      totalRenderCount: Array.from(this.canvasCache.values()).reduce((sum, cache) => sum + cache.renderCount, 0)
    };
  }
}

interface OptimizedMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  containerHeight: number;
  onLoadMore?: (startIndex: number, stopIndex: number) => Promise<void>;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  scrollToBottom?: boolean;
  searchQuery?: string;
  highlightIndices?: number[];
  className?: string;
  typingUsers?: string[];
  participants?: {
    id: string;
    user_id: string;
    user?: {
      id: string;
      username: string;
      avatar_url?: string | null;
    };
  }[];
  // Phase 1.2 Enhanced memory optimization settings
  memoryOptimization?: {
    windowSize?: number;
    bufferSize?: number;
    enableAutoCleanup?: boolean;
    debugMode?: boolean;
    // Phase 1.2 Advanced settings
    enableOffscreenRendering?: boolean;
    enableMessagePooling?: boolean;
    enableIdleCallback?: boolean;
    maxPoolSize?: number;
    idleCallbackTimeout?: number;
  };
}

export interface OptimizedMessageListRef {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToIndex: (index: number, align?: "auto" | "center" | "end" | "start") => void;
  scrollToItem: (messageId: string) => void;
  // Enhanced memory optimization methods - Phase 1.2
  forceCleanup: () => void;
  getMemoryInfo: () => ReturnType<typeof useSmartMessageWindow>['memoryInfo'];
  resetWindow: () => void;
  // Phase 1.2 Advanced optimization methods
  getAdvancedStats: () => {
    messagePool: ReturnType<MessageComponentPool['getStats']>;
    idleQueue: ReturnType<IdleCallbackQueue['getStats']>;
    offscreenCanvas: ReturnType<OffscreenCanvasManager['getStats']>;
    performanceMetrics: {
      averageRenderTime: number;
      totalRenderedMessages: number;
      memoryReductionRatio: number;
    };
  };
  clearAllCaches: () => void;
  enablePerformanceMode: () => void;
}

/**
 * 메모리 최적화된 가상화 메시지 리스트
 */
export const OptimizedMessageList = forwardRef<
  OptimizedMessageListRef,
  OptimizedMessageListProps
>(({
  messages,
  currentUserId,
  containerHeight,
  onLoadMore,
  hasNextPage = false,
  isNextPageLoading = false,
  scrollToBottom = false,
  searchQuery,
  highlightIndices = [],
  className = "",
  typingUsers = [],
  participants = [],
  memoryOptimization = {}
}, ref) => {
  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  const wasAtBottomRef = useRef(true);

  // Phase 1.2 Advanced optimization instances
  const messagePoolRef = useRef<MessageComponentPool>(new MessageComponentPool());
  const idleQueueRef = useRef<IdleCallbackQueue>(new IdleCallbackQueue());
  const offscreenManagerRef = useRef<OffscreenCanvasManager>(new OffscreenCanvasManager());

  // Performance tracking
  const renderTimesRef = useRef<number[]>([]);
  const totalRenderedRef = useRef(0);
  const lastPerformanceUpdateRef = useRef(Date.now());

  // 상태
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);

  // React 19 Enhanced: Message processing state
  const [messagePromise, setMessagePromise] = useState<Promise<ChatMessage[]> | null>(null);
  const [isReact19Available] = useState(() => React19Utils.hasReact19Features());

  // Phase 1.2 optimization settings with defaults
  const optimizationConfig = {
    windowSize: memoryOptimization.windowSize || 50,
    bufferSize: memoryOptimization.bufferSize || 10,
    enableAutoCleanup: memoryOptimization.enableAutoCleanup ?? true,
    debugMode: memoryOptimization.debugMode ?? false,
    enableOffscreenRendering: memoryOptimization.enableOffscreenRendering ?? true,
    enableMessagePooling: memoryOptimization.enableMessagePooling ?? true,
    enableIdleCallback: memoryOptimization.enableIdleCallback ?? true,
    maxPoolSize: memoryOptimization.maxPoolSize || 20,
    idleCallbackTimeout: memoryOptimization.idleCallbackTimeout || 50
  };

  // SmartMessageWindow 훅 with enhanced config
  const smartWindow = useSmartMessageWindow({
    windowSize: optimizationConfig.windowSize,
    bufferSize: optimizationConfig.bufferSize,
    enableAutoCleanup: optimizationConfig.enableAutoCleanup,
    debugMode: optimizationConfig.debugMode
  });

  // React 19 Enhanced: Background message processing with startTransition
  const processMessagesInIdle = useCallback((newMessages: ChatMessage[]) => {
    if (!optimizationConfig.enableIdleCallback) return;

    // Use React 19's startTransition for non-urgent updates
    startTransition(() => {
      newMessages.forEach((message, index) => {
        idleQueueRef.current.enqueue(() => {
          // Pre-process message content during idle time
          if (optimizationConfig.enableOffscreenRendering && message.message_type === 'text') {
            const cache = offscreenManagerRef.current.getCanvas(
              message.id,
              400, // estimated width
              60   // estimated height
            );

            if (cache?.canvas) {
              // Pre-render text content in offscreen canvas during idle time
              const ctx = cache.canvas.getContext('2d');
              if (ctx) {
                ctx.font = '14px system-ui';
                ctx.fillStyle = '#000';
                ctx.fillText(message.content || '', 10, 20);
                cache.renderCount++;
              }
            }
          }
        }, 1); // Lower priority for background processing
      });
    });
  });

  // Phase 1.2: Enhanced message pooling
  const getPooledMessageRef = useCallback(() => {
    if (!optimizationConfig.enableMessagePooling) {
      return createRef<HTMLDivElement>();
    }
    return messagePoolRef.current.acquire();
  }, [optimizationConfig.enableMessagePooling]);

  const releasePooledMessageRef = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    if (optimizationConfig.enableMessagePooling) {
      messagePoolRef.current.release(ref);
    }
  }, [optimizationConfig.enableMessagePooling]);

  // React 19 Enhanced: Performance tracking with React 19 monitor
  const trackRenderPerformance = useCallback((renderTime: number) => {
    const startTime = performance.now();

    renderTimesRef.current.push(renderTime);
    totalRenderedRef.current++;

    // Keep only last 100 render times for average calculation
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }

    // React 19 Enhanced: Record in performance monitor
    if (isReact19Available) {
      const endTime = performance.now();
      performanceMonitor.recordRender(startTime, endTime);
      performanceMonitor.recordMemorySnapshot();
    }

    // Auto-enable performance mode if render times are consistently high
    const avgRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
    if (avgRenderTime > 16 && !performanceMode) { // 16ms = 60fps threshold
      startTransition(() => {
        setPerformanceMode(true);
      });
    }
  }, [performanceMode, isReact19Available]);

  // Enhanced memory monitoring with Phase 1.2 metrics
  const memoryMonitoring = useMemoryMonitoring(smartWindow.memoryInfo, {
    warning: performanceMode ? 5 : 10,  // Lower thresholds in performance mode
    critical: performanceMode ? 25 : 50
  });

  // 높이 관리 훅
  const { estimateSize } = useMessageHeight();

  // 타이핑 중인 사용자 필터링
  const otherTypingUsers = useMemo(() => {
    return typingUsers.filter(userId => userId !== currentUserId);
  }, [typingUsers, currentUserId]);

  const typingItemCount = otherTypingUsers.length;

  // React 19 Enhanced: 스마트 윈도우에서 표시할 메시지들 (useDeferredValue로 더 최적화)
  const deferredMessages = useDeferredValue(smartWindow.currentWindow.messages);

  // React 19 Enhanced: Use Promise-based message processing for better performance
  const optimizedMessages = useMemo(() => {
    if (isReact19Available && optimizationConfig.enableOffscreenRendering) {
      // Create or update message promise for React 19's `use` hook
      const promise = messageProcessor.processMessages(
        deferredMessages as ChatMessage[],
        optimizationConfig.windowSize
      );

      if (messagePromise !== promise) {
        setMessagePromise(promise);
      }

      // Return deferred messages for immediate rendering while promise processes
      return deferredMessages as ChatMessage[];
    }

    return deferredMessages as ChatMessage[];
  }, [deferredMessages, isReact19Available, optimizationConfig.enableOffscreenRendering, optimizationConfig.windowSize, messagePromise]);

  // 총 아이템 수 (실제 메시지 수 기반)
  const itemCount = messages.length + typingItemCount + (hasNextPage ? 1 : 0);

  // Enhanced TanStack Virtual configuration with Phase 1.2 optimizations
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      const startTime = performance.now();

      let size = 40; // default

      // 로딩 아이템
      if (hasNextPage && index === itemCount - 1) {
        size = 60;
      }
      // 타이핑 인디케이터
      else if (index >= messages.length && index < messages.length + typingItemCount) {
        size = 70;
      }
      // 일반 메시지 - with caching optimization
      else if (index < messages.length) {
        const message = messages[index];
        if (message && optimizationConfig.enableOffscreenRendering) {
          const cached = offscreenManagerRef.current.getCanvas(message.id, 400, 60);
          if (cached) {
            size = cached.height;
          } else {
            size = Math.max(estimateSize(index, messages), 40);
          }
        } else {
          size = Math.max(estimateSize(index, messages), 40);
        }
      }

      // Track performance
      const renderTime = performance.now() - startTime;
      if (optimizationConfig.debugMode && renderTime > 1) {
        trackRenderPerformance(renderTime);
      }

      return size;
    }, [messages, estimateSize, itemCount, typingItemCount, hasNextPage, optimizationConfig.enableOffscreenRendering, optimizationConfig.debugMode, trackRenderPerformance]),
    overscan: performanceMode ? 3 : 5, // Reduce overscan in performance mode
    shouldAdjustScrollPositionOnItemSizeChange: () => false,
    getItemKey: useCallback((index: number) => {
      if (hasNextPage && index === itemCount - 1) {
        return `loading-${index}`;
      }

      if (index >= messages.length && index < messages.length + typingItemCount) {
        const typingIndex = index - messages.length;
        const userId = otherTypingUsers[typingIndex];
        return `typing-${userId}`;
      }

      if (index < messages.length) {
        return messages[index]?.id || `msg-${index}`;
      }

      return `item-${index}`;
    }, [messages, hasNextPage, itemCount, typingItemCount, otherTypingUsers]),
    debug: false
  });

  // 스크롤 통합
  useScrollIntegration(parentRef, smartWindow.updateWindow, messages.length);

  // 가상 아이템 목록
  const virtualItems = virtualizer.getVirtualItems();

  // 메시지 데이터 (최적화된 메시지 사용)
  const itemData = useMemo(() => ({
    messages: optimizedMessages.length > 0 ? optimizedMessages : messages,
    currentUserId,
    searchQuery,
    highlightIndices
  }), [optimizedMessages, messages, currentUserId, searchQuery, highlightIndices]);

  /**
   * 스크롤 관련 함수들
   */
  const scrollToBottomImpl = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!virtualizer || itemCount === 0) return;

    try {
      const lastIndex = itemCount - 1;
      virtualizer.scrollToIndex(lastIndex, {
        align: 'end',
        behavior: "auto"
      });
    } catch (error) {
      if (parentRef.current) {
        requestAnimationFrame(() => {
          if (parentRef.current) {
            parentRef.current.scrollTo({
              top: parentRef.current.scrollHeight,
              behavior: behavior === "smooth" ? "smooth" : "auto"
            });
          }
        });
      }
    }
  }, [virtualizer, itemCount]);

  const scrollToIndex = useCallback((
    index: number,
    align: "auto" | "center" | "end" | "start" = "auto"
  ) => {
    if (!virtualizer) return;
    virtualizer.scrollToIndex(index, { align, behavior: "smooth" });
  }, [virtualizer]);

  const scrollToItem = useCallback((messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      scrollToIndex(index, "center");
    }
  }, [messages, scrollToIndex]);

  // Enhanced external reference exposure with Phase 1.2 methods
  useImperativeHandle(ref, () => ({
    scrollToBottom: scrollToBottomImpl,
    scrollToIndex,
    scrollToItem,
    forceCleanup: () => {
      smartWindow.forceCleanup();
      messagePoolRef.current.clear();
      offscreenManagerRef.current.forceCleanup();
      idleQueueRef.current.clear();

      // React 19 Enhanced: Clear React 19 optimization caches
      if (isReact19Available) {
        messageProcessor.clearCache();
        messageStateManager.clearAllPromises();
        transitionManager.clearTransitions();
        performanceMonitor.clear();
      }
    },
    getMemoryInfo: () => smartWindow.memoryInfo,
    resetWindow: smartWindow.reset,
    // Phase 1.2 Advanced optimization methods
    getAdvancedStats: () => ({
      messagePool: messagePoolRef.current.getStats(),
      idleQueue: idleQueueRef.current.getStats(),
      offscreenCanvas: offscreenManagerRef.current.getStats(),
      performanceMetrics: {
        averageRenderTime: renderTimesRef.current.reduce((a, b) => a + b, 0) / Math.max(renderTimesRef.current.length, 1),
        totalRenderedMessages: totalRenderedRef.current,
        memoryReductionRatio: Math.round(((smartWindow.memoryInfo.totalMessages - smartWindow.memoryInfo.messagesInMemory) / Math.max(smartWindow.memoryInfo.totalMessages, 1)) * 100)
      }
    }),
    clearAllCaches: () => {
      messagePoolRef.current.clear();
      offscreenManagerRef.current.forceCleanup();
      idleQueueRef.current.clear();
      renderTimesRef.current.length = 0;
      totalRenderedRef.current = 0;

      // React 19 Enhanced: Clear all React 19 optimization caches
      if (isReact19Available) {
        messageProcessor.clearCache();
        messageStateManager.clearAllPromises();
        transitionManager.clearTransitions();
        performanceMonitor.clear();
      }
    },
    enablePerformanceMode: () => {
      setPerformanceMode(true);
    }
  }), [scrollToBottomImpl, scrollToIndex, scrollToItem, smartWindow]);

  /**
   * 무한 스크롤 + 스마트 로딩
   */
  const handleLoadMore = useCallback(async () => {
    if (isNextPageLoading || !onLoadMore || !hasNextPage) return;

    const firstVisibleIndex = virtualItems[0]?.index ?? 0;

    if (firstVisibleIndex <= 20) {
      try {
        await onLoadMore(0, firstVisibleIndex + 20);
      } catch (error) {
        console.error('Failed to load more messages:', error);
      }
    }
  }, [virtualItems, isNextPageLoading, onLoadMore, hasNextPage]);

  /**
   * React 19 Enhanced: 스크롤 이벤트 핸들러 (startTransition으로 최적화)
   */
  const handleScroll = useCallback((event: Event) => {
    const element = event.target as HTMLElement;

    // 사용자 스크롤 감지
    if (!isScrollingRef.current) {
      // Use React 19's startTransition for non-urgent updates
      startTransition(() => {
        setIsUserScrolling(true);
      });
      isScrollingRef.current = true;

      // requestIdleCallback 활용한 디바운스
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          startTransition(() => {
            setIsUserScrolling(false);
          });
          isScrollingRef.current = false;
        }, { timeout: 150 });
      } else {
        setTimeout(() => {
          startTransition(() => {
            setIsUserScrolling(false);
          });
          isScrollingRef.current = false;
        }, 150);
      }
    }

    // 맨 아래 확인
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    wasAtBottomRef.current = isAtBottom;

    // 무한 스크롤 처리 (비동기로 처리)
    startTransition(() => {
      handleLoadMore();
    });
  }, [handleLoadMore]);

  /**
   * 스크롤 이벤트 등록
   */
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  /**
   * React 19 Enhanced: Message processing with startTransition optimization
   */
  useEffect(() => {
    if (messages.length > 0) {
      // 새 메시지들을 스마트 윈도우에 즉시 추가 (긴급한 업데이트)
      const startIndex = Math.max(0, messages.length - smartWindow.memoryInfo.windowSize);
      const newMessages = messages.slice(startIndex);

      // Add to smart window immediately
      smartWindow.addMessages(newMessages, startIndex);

      // Use React 19's concurrent features for background processing
      startTransition(() => {
        processMessagesInIdle(newMessages);
      });
    }
  }, [messages, smartWindow, processMessagesInIdle]);

  /**
   * 자동 스크롤 처리
   */
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousMessageCount = lastMessageCountRef.current;
    const hasTypingUsers = typingItemCount > 0;

    if (
      (currentMessageCount > previousMessageCount || hasTypingUsers) &&
      (wasAtBottomRef.current || scrollToBottom) &&
      !isUserScrolling
    ) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottomImpl("instant");
        });
      });
    }

    lastMessageCountRef.current = currentMessageCount;
  }, [messages.length, typingItemCount, scrollToBottom, scrollToBottomImpl, isUserScrolling]);

  /**
   * 검색 결과 처리
   */
  useEffect(() => {
    if (highlightIndices.length > 0 && virtualizer) {
      const firstIndex = Math.min(...highlightIndices);
      setTimeout(() => {
        scrollToIndex(firstIndex, "center");
      }, 100);
    }
  }, [highlightIndices, scrollToIndex, virtualizer]);

  /**
   * React 19 Enhanced: Memory warning handling with concurrent features
   */
  useEffect(() => {
    if (memoryMonitoring.memoryStatus === 'critical') {
      console.warn('Phase 1.2: 메모리 사용량이 임계점에 도달했습니다. 고급 정리를 수행합니다.');

      // Use startTransition for non-blocking memory cleanup
      startTransition(() => {
        idleQueueRef.current.enqueue(() => {
          smartWindow.forceCleanup();
          messagePoolRef.current.clear();
          offscreenManagerRef.current.forceCleanup();

          // Clear performance tracking to free memory
          renderTimesRef.current.length = 0;

          // Enable performance mode to reduce future memory usage
          if (!performanceMode) {
            setPerformanceMode(true);
          }
        }, 10); // High priority
      });
    } else if (memoryMonitoring.memoryStatus === 'warning') {
      // Gradual cleanup during warning state with concurrent features
      startTransition(() => {
        idleQueueRef.current.enqueue(() => {
          offscreenManagerRef.current.cleanup();
        }, 5);
      });
    }
  }, [memoryMonitoring.memoryStatus, smartWindow, performanceMode]);

  /**
   * Phase 1.2: Performance mode optimization effects
   */
  useEffect(() => {
    if (performanceMode) {
      console.log('Phase 1.2: 성능 모드가 활성화되었습니다. 메모리 사용량을 최적화합니다.');

      // More aggressive cleanup in performance mode
      const cleanup = () => {
        offscreenManagerRef.current.cleanup();
        if (renderTimesRef.current.length > 50) {
          renderTimesRef.current.splice(0, renderTimesRef.current.length - 50);
        }
      };

      const interval = setInterval(cleanup, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [performanceMode]);

  // 로딩 인디케이터
  const LoadingIndicator = useCallback(() => (
    <div className="flex justify-center items-center p-4 min-h-[60px]">
      <div className="text-sm text-muted-foreground animate-pulse">
        이전 메시지를 불러오는 중...
      </div>
    </div>
  ), []);

  // React 19 Enhanced: Debug info with React 19 optimization metrics
  const MemoryDebugInfo = useCallback(() => {
    if (!optimizationConfig.debugMode) return null;

    const stats = {
      messagePool: messagePoolRef.current.getStats(),
      idleQueue: idleQueueRef.current.getStats(),
      offscreenCanvas: offscreenManagerRef.current.getStats(),
      avgRenderTime: renderTimesRef.current.reduce((a, b) => a + b, 0) / Math.max(renderTimesRef.current.length, 1)
    };

    // React 19 Enhanced: Get additional React 19 performance stats
    const react19Stats = isReact19Available ? {
      processor: messageProcessor.getStats(),
      stateManager: messageStateManager.getStats(),
      transitionManager: transitionManager.getStats(),
      performance: performanceMonitor.getStats()
    } : null;

    return (
      <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded text-xs font-mono z-50 max-w-xs">
        <div className="font-bold text-green-400 mb-2">
          Phase 1.2 + React 19 Optimizations {isReact19Available && '🚀'}
        </div>

        {/* Core Memory Info */}
        <div className="border-b border-gray-600 pb-2 mb-2">
          <div>메모리: {smartWindow.memoryInfo.messagesInMemory}개</div>
          <div>윈도우: {smartWindow.memoryInfo.windowStart}-{smartWindow.memoryInfo.windowEnd}</div>
          <div>압축률: {smartWindow.memoryInfo.compressionRatio}%</div>
          <div>사용량: {memoryMonitoring.memoryUsageMB.toFixed(1)}MB</div>
          <div className={`상태: ${memoryMonitoring.memoryStatus}`}>
            {memoryMonitoring.memoryStatus} {performanceMode && '(성능모드)'}
          </div>
        </div>

        {/* Phase 1.2 Advanced Metrics */}
        <div className="space-y-1">
          <div className="text-yellow-400">고급 최적화:</div>
          <div>풀: {stats.messagePool.activeComponents}/{stats.messagePool.totalRefs}</div>
          <div>유휴큐: {stats.idleQueue.queueLength} {stats.idleQueue.isProcessing ? '⚡' : ''}</div>
          <div>캔버스: {stats.offscreenCanvas.cacheSize}</div>
          <div>렌더: {stats.avgRenderTime.toFixed(2)}ms</div>
          <div>총 렌더: {totalRenderedRef.current}</div>

          {/* React 19 Enhanced Metrics */}
          {react19Stats && (
            <>
              <div className="text-blue-400 mt-2">React 19 최적화:</div>
              <div>프로세서: {react19Stats.processor.cacheSize}</div>
              <div>프로미스: {react19Stats.stateManager.promiseCount}</div>
              <div>전환: {react19Stats.transitionManager.pendingTransitions}</div>
              <div>평균렌더: {react19Stats.performance.averageRenderTime}ms</div>
              <div>메모리: {react19Stats.performance.currentMemoryUsage}MB</div>
              <div className="text-xs text-gray-400">
                스케줄러: {react19Stats.transitionManager.hasScheduler ? '✓' : '✗'}
                | 유휴: {react19Stats.processor.hasIdleCallback ? '✓' : '✗'}
              </div>
            </>
          )}

          {/* Memory Reduction Calculation */}
          <div className="text-green-400">
            메모리 절약: {Math.round(((smartWindow.memoryInfo.totalMessages - smartWindow.memoryInfo.messagesInMemory) / Math.max(smartWindow.memoryInfo.totalMessages, 1)) * 100)}%
          </div>
        </div>
      </div>
    );
  }, [optimizationConfig.debugMode, smartWindow.memoryInfo, memoryMonitoring, performanceMode, isReact19Available]);

  // 빈 상태
  if (messages.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-sm">아직 메시지가 없습니다.</p>
          <p className="text-xs mt-1">첫 메시지를 보내보세요!</p>
        </div>
        <MemoryDebugInfo />
      </div>
    );
  }

  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      className={`w-full overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        ref={parentRef}
        className="h-full w-full overflow-auto scrollbar-thin"
      >
        <div
          style={{
            height: `${Math.max(totalSize, containerHeight)}px`,
            width: '100%',
            position: 'relative',
            contain: 'layout'
          }}
        >
          {virtualItems.map((virtualItem) => {
            const { index, start, size } = virtualItem;

            // 로딩 아이템
            if (hasNextPage && index === itemCount - 1) {
              return (
                <div
                  key={`loading-${index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${size}px`,
                    transform: `translateY(${start}px)`,
                  }}
                >
                  <LoadingIndicator />
                </div>
              );
            }

            // 타이핑 인디케이터
            if (index >= messages.length && index < messages.length + typingItemCount) {
              const typingIndex = index - messages.length;
              const userId = otherTypingUsers[typingIndex];

              return (
                <div
                  key={`typing-${userId}`}
                  data-index={index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${start}px)`,
                    contain: 'layout',
                  }}
                >
                  <TypingIndicatorMessage
                    userId={userId}
                    participants={participants}
                  />
                </div>
              );
            }

            // 일반 메시지 (메모리 최적화됨)
            return (
              <div
                key={virtualItem.key}
                data-index={index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${start}px)`,
                  contain: 'layout',
                }}
              >
                <MessageRenderer
                  index={index}
                  style={{
                    width: '100%',
                  }}
                  data={itemData}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 메모리 디버그 정보 */}
      <MemoryDebugInfo />

      {/* 메모리 경고 알림 */}
      {memoryMonitoring.memoryStatus === 'warning' && (
        <div className="fixed bottom-4 right-4 bg-yellow-500/90 text-white p-2 rounded text-sm">
          메모리 사용량 경고: {memoryMonitoring.memoryUsageMB.toFixed(1)}MB
        </div>
      )}

      {memoryMonitoring.memoryStatus === 'critical' && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white p-2 rounded text-sm">
          메모리 사용량 위험: {memoryMonitoring.memoryUsageMB.toFixed(1)}MB
          <br />
          자동 정리가 실행되었습니다.
        </div>
      )}
    </div>
  );
});

OptimizedMessageList.displayName = 'OptimizedMessageList';