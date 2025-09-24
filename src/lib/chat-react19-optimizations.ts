/**
 * React 19 Enhanced Chat Optimizations
 * Next.js 15 호환 최적화 기능들
 */

import { ChatMessage } from '@/types/chat';

// React 19 Promise-based message processing
export interface MessagePromise extends Promise<ChatMessage[]> {}

// React 19 Enhanced message processor with Promise support
export class React19MessageProcessor {
  private processingCache = new Map<string, MessagePromise>();
  private renderScheduler: typeof requestIdleCallback | typeof setTimeout;

  constructor() {
    // Use requestIdleCallback if available, fallback to setTimeout
    this.renderScheduler = 'requestIdleCallback' in window
      ? window.requestIdleCallback
      : (callback: () => void) => setTimeout(callback, 0);
  }

  // Create Promise-based message processing for React 19's `use` hook
  processMessages(messages: ChatMessage[], windowSize: number = 50): MessagePromise {
    const cacheKey = `${messages.length}-${windowSize}`;

    if (this.processingCache.has(cacheKey)) {
      return this.processingCache.get(cacheKey)!;
    }

    const promise = new Promise<ChatMessage[]>((resolve) => {
      // Use React 19's concurrent features for background processing
      this.renderScheduler(() => {
        try {
          // Process messages in background
          const optimizedMessages = messages.slice(-windowSize).map(message => ({
            ...message,
            // Pre-calculate rendering properties
            _renderCache: {
              estimatedHeight: this.estimateMessageHeight(message),
              processedAt: Date.now(),
              isOptimized: true
            }
          }));

          resolve(optimizedMessages);
        } catch (error) {
          console.error('Message processing error:', error);
          resolve(messages.slice(-windowSize));
        }
      }, { timeout: 50 });
    });

    this.processingCache.set(cacheKey, promise);

    // Cleanup cache after 5 seconds
    setTimeout(() => {
      this.processingCache.delete(cacheKey);
    }, 5000);

    return promise;
  }

  // Enhanced height estimation with caching
  private estimateMessageHeight(message: ChatMessage): number {
    const baseHeight = 40;
    const contentLength = (message.content || '').length;

    // Simple height estimation based on content length
    if (contentLength < 50) return baseHeight;
    if (contentLength < 100) return baseHeight + 20;
    if (contentLength < 200) return baseHeight + 40;

    return baseHeight + Math.min(contentLength / 5, 200);
  }

  // Clear all caches
  clearCache() {
    this.processingCache.clear();
  }

  // Get processing statistics
  getStats() {
    return {
      cacheSize: this.processingCache.size,
      hasIdleCallback: 'requestIdleCallback' in window
    };
  }
}

// React 19 Enhanced Suspense boundary for message loading
export interface MessageSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// React 19 compatible message state manager
export class React19MessageStateManager {
  private messagePromises = new Map<string, Promise<any>>();

  // Create a Promise that can be used with React 19's `use` hook
  createMessagePromise<T>(key: string, asyncFn: () => Promise<T>): Promise<T> {
    if (this.messagePromises.has(key)) {
      return this.messagePromises.get(key)!;
    }

    const promise = asyncFn().catch(error => {
      console.error(`Message promise error for key ${key}:`, error);
      throw error;
    });

    this.messagePromises.set(key, promise);

    // Auto-cleanup after 10 seconds
    setTimeout(() => {
      this.messagePromises.delete(key);
    }, 10000);

    return promise;
  }

  // Clear specific promise
  clearPromise(key: string) {
    this.messagePromises.delete(key);
  }

  // Clear all promises
  clearAllPromises() {
    this.messagePromises.clear();
  }

  // Get promise cache statistics
  getStats() {
    return {
      promiseCount: this.messagePromises.size,
      promiseKeys: Array.from(this.messagePromises.keys())
    };
  }
}

// React 19 Enhanced transition manager for chat updates
export class React19TransitionManager {
  private pendingTransitions = new Set<() => void>();
  private isProcessingTransitions = false;

  // Add transition to queue
  queueTransition(transition: () => void) {
    this.pendingTransitions.add(transition);
    this.processTransitions();
  }

  // Process all pending transitions
  private processTransitions() {
    if (this.isProcessingTransitions || this.pendingTransitions.size === 0) {
      return;
    }

    this.isProcessingTransitions = true;

    // Use React 19's concurrent features if available
    if ('scheduler' in window) {
      // Use React's internal scheduler if available
      (window as any).scheduler.unstable_scheduleCallback(
        (window as any).scheduler.unstable_IdlePriority,
        () => {
          const transitions = Array.from(this.pendingTransitions);
          this.pendingTransitions.clear();

          transitions.forEach(transition => {
            try {
              transition();
            } catch (error) {
              console.error('Transition error:', error);
            }
          });

          this.isProcessingTransitions = false;
        }
      );
    } else {
      // Fallback to requestIdleCallback
      const processInIdle = () => {
        const transitions = Array.from(this.pendingTransitions);
        this.pendingTransitions.clear();

        transitions.forEach(transition => {
          try {
            transition();
          } catch (error) {
            console.error('Transition error:', error);
          }
        });

        this.isProcessingTransitions = false;
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(processInIdle, { timeout: 100 });
      } else {
        setTimeout(processInIdle, 0);
      }
    }
  }

  // Clear all pending transitions
  clearTransitions() {
    this.pendingTransitions.clear();
    this.isProcessingTransitions = false;
  }

  // Get transition statistics
  getStats() {
    return {
      pendingTransitions: this.pendingTransitions.size,
      isProcessing: this.isProcessingTransitions,
      hasScheduler: 'scheduler' in window
    };
  }
}

// Export singleton instances for global use
export const messageProcessor = new React19MessageProcessor();
export const messageStateManager = new React19MessageStateManager();
export const transitionManager = new React19TransitionManager();

// React 19 Enhanced performance monitor
export class React19PerformanceMonitor {
  private renderTimes: number[] = [];
  private transitionTimes: number[] = [];
  private memorySnapshots: number[] = [];
  private maxSamples = 100;

  // Record render performance
  recordRender(startTime: number, endTime: number) {
    const renderTime = endTime - startTime;
    this.renderTimes.push(renderTime);

    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
  }

  // Record transition performance
  recordTransition(startTime: number, endTime: number) {
    const transitionTime = endTime - startTime;
    this.transitionTimes.push(transitionTime);

    if (this.transitionTimes.length > this.maxSamples) {
      this.transitionTimes.shift();
    }
  }

  // Record memory snapshot
  recordMemorySnapshot() {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.memorySnapshots.push(memoryInfo.usedJSHeapSize);

      if (this.memorySnapshots.length > this.maxSamples) {
        this.memorySnapshots.shift();
      }
    }
  }

  // Get performance statistics
  getStats() {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;

    const avgTransitionTime = this.transitionTimes.length > 0
      ? this.transitionTimes.reduce((a, b) => a + b, 0) / this.transitionTimes.length
      : 0;

    const currentMemory = this.memorySnapshots.length > 0
      ? this.memorySnapshots[this.memorySnapshots.length - 1]
      : 0;

    return {
      averageRenderTime: Math.round(avgRenderTime * 100) / 100,
      averageTransitionTime: Math.round(avgTransitionTime * 100) / 100,
      currentMemoryUsage: Math.round(currentMemory / 1024 / 1024 * 100) / 100, // MB
      totalSamples: this.renderTimes.length,
      isPerformanceAPIAvailable: 'memory' in performance
    };
  }

  // Clear all performance data
  clear() {
    this.renderTimes.length = 0;
    this.transitionTimes.length = 0;
    this.memorySnapshots.length = 0;
  }
}

// Export singleton performance monitor
export const performanceMonitor = new React19PerformanceMonitor();

// React 19 Enhanced utility functions
export const React19Utils = {
  // Check if React 19 features are available
  hasReact19Features(): boolean {
    try {
      // Check for React 19 specific features
      // We use dynamic import to avoid compilation issues
      const ReactModule = require('react');
      return typeof ReactModule.use === 'function';
    } catch {
      return false;
    }
  },

  // Check if concurrent features are available
  hasConcurrentFeatures(): boolean {
    return 'scheduler' in window || 'requestIdleCallback' in window;
  },

  // Create optimized message processing promise
  createMessagePromise(messages: ChatMessage[], windowSize: number = 50): MessagePromise {
    return messageProcessor.processMessages(messages, windowSize);
  },

  // Schedule non-urgent updates using available concurrent features
  scheduleUpdate(callback: () => void, priority: 'normal' | 'low' = 'normal') {
    if ('scheduler' in window && (window as any).scheduler.unstable_scheduleCallback) {
      const schedulerPriority = priority === 'normal'
        ? (window as any).scheduler.unstable_NormalPriority
        : (window as any).scheduler.unstable_IdlePriority;

      (window as any).scheduler.unstable_scheduleCallback(schedulerPriority, callback);
    } else if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: priority === 'normal' ? 100 : 1000 });
    } else {
      setTimeout(callback, priority === 'normal' ? 0 : 100);
    }
  }
};