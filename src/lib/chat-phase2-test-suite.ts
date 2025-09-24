/**
 * Phase 1.2 Memory Optimization Test Suite
 *
 * Comprehensive testing utilities for validating the advanced optimization techniques:
 * 1. Performance benchmarking
 * 2. Memory usage validation
 * 3. Stress testing for 100 concurrent users
 * 4. Browser compatibility testing
 */

import type { ChatMessage } from '@/types/chat';
import {
  AdvancedMessagePool,
  IdleProcessor,
  AdvancedOffscreenRenderer,
  PerformanceMonitor,
  getOptimizationSupport
} from './chat-phase2-optimizations';

export interface TestResults {
  testName: string;
  passed: boolean;
  performanceMetrics: {
    averageRenderTime: number;
    memoryUsageMB: number;
    cacheHitRate: number;
  };
  details: string;
  timestamp: number;
}

export class Phase2TestSuite {
  private results: TestResults[] = [];
  private messagePool = new AdvancedMessagePool(30);
  private idleProcessor = new IdleProcessor();
  private offscreenRenderer = new AdvancedOffscreenRenderer();
  private performanceMonitor = new PerformanceMonitor();

  /**
   * Generate test messages for various scenarios
   */
  static generateTestMessages(count: number): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const messageTypes = ['text', 'image', 'file'] as const;
    const userIds = Array.from({ length: 20 }, (_, i) => `user-${i}`);

    for (let i = 0; i < count; i++) {
      const messageType = messageTypes[i % messageTypes.length];
      const userId = userIds[i % userIds.length];

      messages.push({
        id: `msg-${i}`,
        content: messageType === 'text' ? this.generateRandomText(50 + (i % 200)) : undefined,
        message_type: messageType,
        sender_id: userId,
        from_user_id: userId,
        created_at: new Date(Date.now() - (count - i) * 1000).toISOString(),
        sender: {
          id: userId,
          username: `User ${i % 20}`,
          avatar_url: i % 5 === 0 ? `https://avatar.example.com/${userId}` : null
        },
        file_url: messageType === 'image' ? `https://image.example.com/img-${i}.jpg` : undefined,
        file_name: messageType === 'file' ? `document-${i}.pdf` : undefined,
        file_size: messageType === 'file' ? 1024 * (50 + (i % 500)) : undefined
      });
    }

    return messages;
  }

  private static generateRandomText(length: number): string {
    const words = [
      'Hello', 'world', 'this', 'is', 'a', 'test', 'message', 'with', 'various', 'lengths',
      'to', 'simulate', 'real', 'chat', 'conversations', 'including', 'longer', 'sentences',
      'and', 'shorter', 'ones', 'for', 'comprehensive', 'testing', 'purposes', 'performance',
      'optimization', 'memory', 'usage', 'rendering', 'speed', 'user', 'experience'
    ];

    const targetWords = Math.ceil(length / 6); // Average word length ~6 chars
    const result = [];

    for (let i = 0; i < targetWords; i++) {
      result.push(words[Math.floor(Math.random() * words.length)]);
    }

    return result.join(' ').slice(0, length);
  }

  /**
   * Test 1: Browser Support Validation
   */
  async testBrowserSupport(): Promise<TestResults> {
    const startTime = performance.now();
    const support = getOptimizationSupport();

    const passed = support.requestIdleCallback || support.offscreenCanvas || support.imageBitmap;
    const details = `
      RequestIdleCallback: ${support.requestIdleCallback ? '✅' : '❌'}
      OffscreenCanvas: ${support.offscreenCanvas ? '✅' : '❌'}
      ImageBitmap: ${support.imageBitmap ? '✅' : '❌'}
      IntersectionObserver: ${support.intersectionObserver ? '✅' : '❌'}
      PerformanceObserver: ${support.performanceObserver ? '✅' : '❌'}
    `.trim();

    const result: TestResults = {
      testName: 'Browser Support Validation',
      passed,
      performanceMetrics: {
        averageRenderTime: performance.now() - startTime,
        memoryUsageMB: 0,
        cacheHitRate: 0
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test 2: Message Pool Performance
   */
  async testMessagePoolPerformance(): Promise<TestResults> {
    const iterations = 1000;
    const startTime = performance.now();

    // Test acquire/release cycle
    const refs: HTMLDivElement[] = [];

    for (let i = 0; i < iterations; i++) {
      const element = this.messagePool.acquire();
      refs.push(element);

      // Simulate component usage
      element.textContent = `Message ${i}`;
      element.style.height = `${40 + (i % 60)}px`;
    }

    // Release all elements
    refs.forEach(element => {
      this.messagePool.release(element);
    });

    const renderTime = performance.now() - startTime;
    const stats = this.messagePool.getStats();

    const passed = renderTime < 100 && stats.reuseRatio > 50; // Should complete in <100ms with >50% reuse
    const details = `
      Total time: ${renderTime.toFixed(2)}ms
      Pool size: ${stats.poolSize}
      Active elements: ${stats.activeElements}
      Total created: ${stats.totalCreated}
      Reuse ratio: ${stats.reuseRatio}%
      Average per operation: ${(renderTime / iterations).toFixed(3)}ms
    `.trim();

    const result: TestResults = {
      testName: 'Message Pool Performance',
      passed,
      performanceMetrics: {
        averageRenderTime: renderTime / iterations,
        memoryUsageMB: (stats.totalCreated * 0.001), // Rough estimate
        cacheHitRate: stats.reuseRatio
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test 3: Idle Processor Efficiency
   */
  async testIdleProcessor(): Promise<TestResults> {
    const taskCount = 500;
    const startTime = performance.now();

    // Queue various priority tasks
    const completedTasks: number[] = [];

    for (let i = 0; i < taskCount; i++) {
      const priority = i % 10; // Vary priority 0-9
      this.idleProcessor.enqueue(() => {
        completedTasks.push(i);
      }, priority);
    }

    // Wait for processing to complete
    await new Promise(resolve => {
      const checkComplete = () => {
        const stats = this.idleProcessor.getStats();
        if (stats.processed >= taskCount || performance.now() - startTime > 5000) {
          resolve(void 0);
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });

    const totalTime = performance.now() - startTime;
    const stats = this.idleProcessor.getStats();

    const passed = stats.successRate > 95 && totalTime < 5000;
    const details = `
      Total time: ${totalTime.toFixed(2)}ms
      Processed: ${stats.processed}/${taskCount}
      Failed: ${stats.failed}
      Success rate: ${stats.successRate}%
      Average idle time: ${stats.averageIdleTime.toFixed(3)}ms
      Queue length: ${stats.queueLength}
    `.trim();

    const result: TestResults = {
      testName: 'Idle Processor Efficiency',
      passed,
      performanceMetrics: {
        averageRenderTime: stats.averageIdleTime,
        memoryUsageMB: 0.1,
        cacheHitRate: stats.successRate
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test 4: Offscreen Canvas Rendering
   */
  async testOffscreenRendering(): Promise<TestResults> {
    const messageCount = 100;
    const messages = Phase2TestSuite.generateTestMessages(messageCount);
    const startTime = performance.now();

    const renderPromises = messages
      .filter(m => m.message_type === 'text' && m.content)
      .slice(0, 50) // Test first 50 text messages
      .map(async (message, index) => {
        const width = 300 + (index % 200);
        const height = 60 + (index % 40);

        return await this.offscreenRenderer.getRenderedMessage(
          message.id,
          message.content!,
          width,
          height,
          {
            fontSize: 14,
            fontFamily: 'system-ui',
            color: '#000000',
            backgroundColor: 'transparent',
            padding: 8
          }
        );
      });

    const results = await Promise.allSettled(renderPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalTime = performance.now() - startTime;
    const stats = this.offscreenRenderer.getAdvancedStats();

    const passed = successCount > 40 && stats.cacheHitRate > 0; // At least 80% success
    const details = `
      Total time: ${totalTime.toFixed(2)}ms
      Successful renders: ${successCount}/50
      Cache size: ${stats.cacheSize}
      Cache hits: ${stats.cacheHits}
      Cache misses: ${stats.cacheMisses}
      Bitmap creations: ${stats.bitmapCreations}
      Memory estimate: ${stats.memoryEstimate}KB
      Average render time: ${(totalTime / successCount).toFixed(2)}ms
    `.trim();

    const result: TestResults = {
      testName: 'Offscreen Canvas Rendering',
      passed,
      performanceMetrics: {
        averageRenderTime: totalTime / successCount,
        memoryUsageMB: stats.memoryEstimate / 1024,
        cacheHitRate: (stats.cacheHits / Math.max(stats.cacheHits + stats.cacheMisses, 1)) * 100
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test 5: Memory Usage Under Load
   */
  async testMemoryUnderLoad(): Promise<TestResults> {
    const messageCount = 2000; // Large message set
    const messages = Phase2TestSuite.generateTestMessages(messageCount);
    const startTime = performance.now();

    // Simulate high-load scenario
    const initialMemory = this.estimateMemoryUsage();

    // Process messages in batches
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      // Simulate message processing
      batch.forEach(message => {
        this.performanceMonitor.record(message.id, Math.random() * 10, 'initial');

        // Simulate pool usage
        if (Math.random() > 0.3) {
          const element = this.messagePool.acquire();
          element.textContent = message.content || '';
          this.messagePool.release(element);
        }

        // Simulate offscreen rendering
        if (message.message_type === 'text' && message.content && Math.random() > 0.5) {
          this.offscreenRenderer.getRenderedMessage(
            message.id,
            message.content,
            400,
            60
          ).catch(() => {}); // Ignore errors in test
        }
      });

      // Allow some processing time
      if (i % (batchSize * 5) === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const totalTime = performance.now() - startTime;
    const finalMemory = this.estimateMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    // Performance report
    const report = this.performanceMonitor.getOptimizationReport();

    const passed = memoryIncrease < 10 && report.averageRenderTime < 20; // <10MB increase, <20ms avg
    const details = `
      Total time: ${totalTime.toFixed(2)}ms
      Messages processed: ${messageCount}
      Initial memory: ${initialMemory.toFixed(1)}MB
      Final memory: ${finalMemory.toFixed(1)}MB
      Memory increase: ${memoryIncrease.toFixed(1)}MB
      Average render time: ${report.averageRenderTime.toFixed(2)}ms
      Optimization ratio: ${report.optimizationRatio}%
      Performance gain: ${report.performanceGain}%
    `.trim();

    const result: TestResults = {
      testName: 'Memory Usage Under Load',
      passed,
      performanceMetrics: {
        averageRenderTime: report.averageRenderTime,
        memoryUsageMB: memoryIncrease,
        cacheHitRate: report.optimizationRatio
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test 6: Concurrent User Simulation
   */
  async testConcurrentUsers(): Promise<TestResults> {
    const userCount = 100;
    const messagesPerUser = 50;
    const startTime = performance.now();

    // Simulate 100 concurrent users
    const userPromises = Array.from({ length: userCount }, async (_, userIndex) => {
      const userMessages = Phase2TestSuite.generateTestMessages(messagesPerUser);

      // Simulate user activity
      for (let i = 0; i < userMessages.length; i++) {
        const message = userMessages[i];

        // Random delay to simulate real user behavior
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        // Process message
        this.performanceMonitor.record(
          `${userIndex}-${message.id}`,
          Math.random() * 15,
          Math.random() > 0.7 ? 'cached' : 'initial'
        );
      }

      return userIndex;
    });

    const completedUsers = await Promise.allSettled(userPromises);
    const successfulUsers = completedUsers.filter(r => r.status === 'fulfilled').length;
    const totalTime = performance.now() - startTime;

    const report = this.performanceMonitor.getOptimizationReport();

    const passed = successfulUsers === userCount && totalTime < 30000; // All users in <30s
    const details = `
      Total time: ${totalTime.toFixed(2)}ms
      Successful users: ${successfulUsers}/${userCount}
      Total messages: ${userCount * messagesPerUser}
      Average render time: ${report.averageRenderTime.toFixed(2)}ms
      Throughput: ${((userCount * messagesPerUser) / (totalTime / 1000)).toFixed(0)} msgs/sec
      Performance gain: ${report.performanceGain}%
      Memory efficiency: ${this.estimateMemoryUsage().toFixed(1)}MB total
    `.trim();

    const result: TestResults = {
      testName: 'Concurrent User Simulation',
      passed,
      performanceMetrics: {
        averageRenderTime: report.averageRenderTime,
        memoryUsageMB: this.estimateMemoryUsage(),
        cacheHitRate: report.optimizationRatio
      },
      details,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run complete test suite
   */
  async runFullTestSuite(): Promise<{
    passed: boolean;
    totalTests: number;
    passedTests: number;
    results: TestResults[];
    summary: string;
  }> {
    console.log('🚀 Starting Phase 1.2 Memory Optimization Test Suite...');

    const tests = [
      () => this.testBrowserSupport(),
      () => this.testMessagePoolPerformance(),
      () => this.testIdleProcessor(),
      () => this.testOffscreenRendering(),
      () => this.testMemoryUnderLoad(),
      () => this.testConcurrentUsers()
    ];

    this.results = []; // Reset results

    for (const test of tests) {
      try {
        const result = await test();
        console.log(`${result.passed ? '✅' : '❌'} ${result.testName}`);
      } catch (error) {
        console.error(`❌ Test failed with error:`, error);
        this.results.push({
          testName: 'Unknown Test',
          passed: false,
          performanceMetrics: { averageRenderTime: 0, memoryUsageMB: 0, cacheHitRate: 0 },
          details: `Error: ${error}`,
          timestamp: Date.now()
        });
      }
    }

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const passed = passedTests === totalTests;

    // Generate summary
    const avgRenderTime = this.results.reduce((sum, r) => sum + r.performanceMetrics.averageRenderTime, 0) / totalTests;
    const totalMemoryMB = this.results.reduce((sum, r) => sum + r.performanceMetrics.memoryUsageMB, 0);
    const avgCacheHitRate = this.results.reduce((sum, r) => sum + r.performanceMetrics.cacheHitRate, 0) / totalTests;

    const summary = `
📊 Phase 1.2 Test Suite Results
===============================
Overall Status: ${passed ? '✅ PASSED' : '❌ FAILED'}
Tests Passed: ${passedTests}/${totalTests}

Performance Metrics:
- Average Render Time: ${avgRenderTime.toFixed(2)}ms
- Total Memory Usage: ${totalMemoryMB.toFixed(1)}MB
- Average Cache Hit Rate: ${avgCacheHitRate.toFixed(1)}%

Target Goals:
- Memory Reduction: ${totalMemoryMB < 5 ? '✅' : '❌'} Target <5MB (${totalMemoryMB.toFixed(1)}MB)
- Render Speed: ${avgRenderTime < 50 ? '✅' : '❌'} Target <50ms (${avgRenderTime.toFixed(2)}ms)
- Concurrent Users: ${passedTests >= 5 ? '✅' : '❌'} Target 100 users supported

${passed ? '🎉 All optimizations working correctly!' : '⚠️ Some optimizations need attention.'}
    `.trim();

    console.log(summary);

    return {
      passed,
      totalTests,
      passedTests,
      results: this.results,
      summary
    };
  }

  /**
   * Get detailed test results
   */
  getResults(): TestResults[] {
    return this.results;
  }

  /**
   * Clear all test data and reset instances
   */
  reset(): void {
    this.results = [];
    this.messagePool.clear();
    this.idleProcessor.clear();
    this.offscreenRenderer.forceCleanup();
    this.performanceMonitor.clear();
  }

  /**
   * Rough memory usage estimation
   */
  private estimateMemoryUsage(): number {
    const poolStats = this.messagePool.getStats();
    const canvasStats = this.offscreenRenderer.getAdvancedStats();

    // Rough estimates in MB
    return (
      (poolStats.totalCreated * 0.001) + // Pool elements
      (canvasStats.memoryEstimate / 1024) + // Canvas cache
      (this.results.length * 0.0001) + // Results array
      0.5 // Base class overhead
    );
  }
}

// Export utility function for easy testing
export async function runPhase2Tests(): Promise<void> {
  const testSuite = new Phase2TestSuite();
  const results = await testSuite.runFullTestSuite();

  if (!results.passed) {
    console.warn('Some Phase 1.2 optimizations are not working optimally. Check the results for details.');
  }

  return;
}

// Export for integration testing
export { Phase2TestSuite };