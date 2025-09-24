/**
 * Phase 1.2 Advanced Memory Optimization Utilities
 *
 * This module provides advanced optimization techniques for chat message rendering:
 * 1. requestIdleCallback Background Processing
 * 2. Offscreen Canvas Rendering
 * 3. Message Pooling Pattern
 *
 * Performance Goals:
 * - Memory usage: 50MB → 5MB per user (90% reduction)
 * - Message loading: 800ms → 50ms (10x improvement)
 * - Support 100 concurrent users smoothly
 */

export interface PerformanceMetrics {
  renderTime: number;
  timestamp: number;
  messageId: string;
  renderType: 'initial' | 'cached' | 'offscreen';
}

export interface OptimizationStats {
  memoryReduction: number; // percentage
  averageRenderTime: number; // milliseconds
  cacheHitRate: number; // percentage
  totalOptimizedMessages: number;
}

/**
 * Advanced Message Component Pool
 * Reuses message component instances to minimize garbage collection
 */
export class AdvancedMessagePool {
  private pool: HTMLDivElement[] = [];
  private activeElements = new Set<HTMLDivElement>();
  private maxPoolSize: number;
  private createdElements = 0;

  constructor(maxPoolSize = 30) {
    this.maxPoolSize = maxPoolSize;
  }

  acquire(): HTMLDivElement {
    let element = this.pool.pop();

    if (!element) {
      element = document.createElement('div');
      element.className = 'message-container pooled-element';
      element.setAttribute('data-pooled', 'true');
      this.createdElements++;
    }

    // Reset element state
    element.innerHTML = '';
    element.style.transform = '';
    element.style.opacity = '1';

    this.activeElements.add(element);
    return element;
  }

  release(element: HTMLDivElement) {
    if (this.activeElements.has(element)) {
      this.activeElements.delete(element);

      // Clean up element
      element.innerHTML = '';
      element.removeAttribute('style');
      element.className = 'message-container pooled-element';

      if (this.pool.length < this.maxPoolSize) {
        this.pool.push(element);
      }
    }
  }

  clear() {
    this.pool.length = 0;
    this.activeElements.clear();
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeElements: this.activeElements.size,
      totalCreated: this.createdElements,
      reuseRatio: Math.round((this.createdElements - this.activeElements.size) / Math.max(this.createdElements, 1) * 100)
    };
  }
}

/**
 * Intelligent Idle Callback Scheduler
 * Optimizes background processing during browser idle time
 */
export class IdleProcessor {
  private queue: Array<{
    callback: () => void;
    priority: number;
    deadline?: number;
    retryCount: number;
  }> = [];
  private isProcessing = false;
  private maxExecutionTime = 5; // 5ms per frame
  private statsTracker = {
    processed: 0,
    failed: 0,
    totalIdleTime: 0
  };

  enqueue(callback: () => void, priority = 0, deadline?: number) {
    this.queue.push({
      callback,
      priority,
      deadline,
      retryCount: 0
    });

    // Sort by priority (higher numbers first)
    this.queue.sort((a, b) => b.priority - a.priority);

    if (!this.isProcessing) {
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing() {
    this.isProcessing = true;

    const processInIdle = (deadline?: IdleDeadline) => {
      const startTime = performance.now();
      let processedInThisFrame = 0;

      while (
        this.queue.length > 0 &&
        processedInThisFrame < 10 && // Max 10 tasks per frame
        (deadline ? deadline.timeRemaining() > 1 : performance.now() - startTime < this.maxExecutionTime)
      ) {
        const item = this.queue.shift();
        if (!item) break;

        // Check deadline
        if (item.deadline && Date.now() > item.deadline) {
          this.statsTracker.failed++;
          continue;
        }

        try {
          item.callback();
          this.statsTracker.processed++;
          processedInThisFrame++;
        } catch (error) {
          console.warn('Idle callback error:', error);

          // Retry logic for important tasks
          if (item.priority > 5 && item.retryCount < 2) {
            item.retryCount++;
            this.queue.unshift(item); // Put back at front
          } else {
            this.statsTracker.failed++;
          }
        }
      }

      this.statsTracker.totalIdleTime += performance.now() - startTime;

      if (this.queue.length > 0) {
        // Schedule next processing
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
      isProcessing: this.isProcessing,
      processed: this.statsTracker.processed,
      failed: this.statsTracker.failed,
      averageIdleTime: this.statsTracker.totalIdleTime / Math.max(this.statsTracker.processed, 1),
      successRate: Math.round(this.statsTracker.processed / Math.max(this.statsTracker.processed + this.statsTracker.failed, 1) * 100)
    };
  }
}

/**
 * Advanced Offscreen Canvas Manager
 * Pre-renders message content for faster display
 */
export class AdvancedOffscreenRenderer {
  private canvasCache = new Map<string, {
    canvas: OffscreenCanvas;
    context: OffscreenCanvasRenderingContext2D;
    bitmap?: ImageBitmap;
    lastUsed: number;
    renderTime: number;
    width: number;
    height: number;
  }>();
  private maxCacheSize = 150;
  private performanceTracker = {
    cacheHits: 0,
    cacheMisses: 0,
    totalRenderTime: 0,
    bitmapCreations: 0
  };

  async getRenderedMessage(
    messageId: string,
    content: string,
    width: number,
    height: number,
    style: {
      fontSize?: number;
      fontFamily?: string;
      color?: string;
      backgroundColor?: string;
      padding?: number;
    } = {}
  ): Promise<ImageBitmap | null> {
    const cacheKey = `${messageId}-${width}x${height}`;
    const cached = this.canvasCache.get(cacheKey);

    if (cached && cached.bitmap) {
      cached.lastUsed = Date.now();
      this.performanceTracker.cacheHits++;
      return cached.bitmap;
    }

    this.performanceTracker.cacheMisses++;

    try {
      if (typeof OffscreenCanvas === 'undefined') {
        return null; // Fallback for browsers without OffscreenCanvas support
      }

      const startTime = performance.now();
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');

      if (!context) return null;

      // Apply styles
      const {
        fontSize = 14,
        fontFamily = 'system-ui, -apple-system, sans-serif',
        color = '#000000',
        backgroundColor = 'transparent',
        padding = 8
      } = style;

      context.font = `${fontSize}px ${fontFamily}`;
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);

      context.fillStyle = color;
      context.textAlign = 'left';
      context.textBaseline = 'top';

      // Text wrapping
      const words = content.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      const maxWidth = width - (padding * 2);

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = context.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Render lines
      const lineHeight = fontSize * 1.4;
      lines.forEach((line, index) => {
        context.fillText(line, padding, padding + (index * lineHeight));
      });

      // Create bitmap
      const bitmap = await canvas.transferToImageBitmap();
      this.performanceTracker.bitmapCreations++;

      const renderTime = performance.now() - startTime;
      this.performanceTracker.totalRenderTime += renderTime;

      // Cache the result
      this.canvasCache.set(cacheKey, {
        canvas,
        context,
        bitmap,
        lastUsed: Date.now(),
        renderTime,
        width,
        height
      });

      this.cleanup();
      return bitmap;

    } catch (error) {
      console.warn('Offscreen rendering error:', error);
      return null;
    }
  }

  private cleanup() {
    if (this.canvasCache.size <= this.maxCacheSize) return;

    // Sort by last used time and remove oldest entries
    const entries = Array.from(this.canvasCache.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = entries.slice(0, this.canvasCache.size - this.maxCacheSize);
    toRemove.forEach(([key, entry]) => {
      entry.bitmap?.close(); // Free ImageBitmap memory
      this.canvasCache.delete(key);
    });
  }

  forceCleanup() {
    this.canvasCache.forEach(entry => {
      entry.bitmap?.close();
    });
    this.canvasCache.clear();
  }

  getStats(): OptimizationStats {
    const totalRequests = this.performanceTracker.cacheHits + this.performanceTracker.cacheMisses;

    return {
      memoryReduction: Math.round((this.canvasCache.size / Math.max(totalRequests, 1)) * 100),
      averageRenderTime: this.performanceTracker.totalRenderTime / Math.max(this.performanceTracker.bitmapCreations, 1),
      cacheHitRate: Math.round(this.performanceTracker.cacheHits / Math.max(totalRequests, 1) * 100),
      totalOptimizedMessages: this.canvasCache.size
    };
  }

  getAdvancedStats() {
    return {
      cacheSize: this.canvasCache.size,
      ...this.performanceTracker,
      memoryEstimate: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimate: width * height * 4 bytes per pixel for RGBA
    let totalBytes = 0;
    this.canvasCache.forEach(entry => {
      totalBytes += entry.width * entry.height * 4;
    });
    return Math.round(totalBytes / 1024); // Return KB
  }
}

/**
 * Performance Monitor for Phase 1.2 optimizations
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000;
  private startTime = performance.now();

  record(messageId: string, renderTime: number, renderType: 'initial' | 'cached' | 'offscreen') {
    this.metrics.push({
      messageId,
      renderTime,
      renderType,
      timestamp: performance.now() - this.startTime
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getOptimizationReport() {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        optimizationRatio: 0,
        totalMessages: 0,
        performanceGain: 0
      };
    }

    const initialRenders = this.metrics.filter(m => m.renderType === 'initial');
    const optimizedRenders = this.metrics.filter(m => m.renderType !== 'initial');

    const avgInitialTime = initialRenders.reduce((sum, m) => sum + m.renderTime, 0) / Math.max(initialRenders.length, 1);
    const avgOptimizedTime = optimizedRenders.reduce((sum, m) => sum + m.renderTime, 0) / Math.max(optimizedRenders.length, 1);

    return {
      averageRenderTime: this.metrics.reduce((sum, m) => sum + m.renderTime, 0) / this.metrics.length,
      optimizationRatio: Math.round(optimizedRenders.length / this.metrics.length * 100),
      totalMessages: this.metrics.length,
      performanceGain: Math.round((avgInitialTime - avgOptimizedTime) / Math.max(avgInitialTime, 1) * 100),
      breakdown: {
        initial: { count: initialRenders.length, avgTime: avgInitialTime },
        cached: {
          count: this.metrics.filter(m => m.renderType === 'cached').length,
          avgTime: this.metrics.filter(m => m.renderType === 'cached').reduce((sum, m) => sum + m.renderTime, 0) / Math.max(this.metrics.filter(m => m.renderType === 'cached').length, 1)
        },
        offscreen: {
          count: this.metrics.filter(m => m.renderType === 'offscreen').length,
          avgTime: this.metrics.filter(m => m.renderType === 'offscreen').reduce((sum, m) => sum + m.renderTime, 0) / Math.max(this.metrics.filter(m => m.renderType === 'offscreen').length, 1)
        }
      }
    };
  }

  clear() {
    this.metrics.length = 0;
    this.startTime = performance.now();
  }
}

/**
 * Utility function to detect if advanced optimizations are supported
 */
export function getOptimizationSupport() {
  return {
    requestIdleCallback: 'requestIdleCallback' in window,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    imageBitmap: 'createImageBitmap' in window,
    intersectionObserver: 'IntersectionObserver' in window,
    performanceObserver: 'PerformanceObserver' in window
  };
}

/**
 * Factory function to create optimized instances based on browser support
 */
export function createOptimizationInstances(config: {
  enablePooling?: boolean;
  enableOffscreenRendering?: boolean;
  enableIdleCallback?: boolean;
  maxPoolSize?: number;
  maxCacheSize?: number;
}) {
  const support = getOptimizationSupport();

  return {
    messagePool: config.enablePooling ? new AdvancedMessagePool(config.maxPoolSize) : null,
    offscreenRenderer: config.enableOffscreenRendering && support.offscreenCanvas ? new AdvancedOffscreenRenderer() : null,
    idleProcessor: config.enableIdleCallback && support.requestIdleCallback ? new IdleProcessor() : null,
    performanceMonitor: new PerformanceMonitor(),
    support
  };
}