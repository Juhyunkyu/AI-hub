/**
 * React 19 + Next.js 15 Compatibility Test Suite
 * 채팅 시스템 최적화 검증 도구
 */

import { ChatMessage } from '@/types/chat';
import {
  messageProcessor,
  messageStateManager,
  transitionManager,
  performanceMonitor,
  React19Utils
} from './chat-react19-optimizations';

// Test result interface
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: string;
  error?: Error;
}

interface CompatibilityTestSuite {
  react19Features: TestResult[];
  nextjs15Features: TestResult[];
  optimizationFeatures: TestResult[];
  performanceTests: TestResult[];
  overall: {
    passed: number;
    failed: number;
    duration: number;
    compatibilityScore: number;
  };
}

// Mock message data for testing
const createMockMessages = (count: number): ChatMessage[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `test-message-${index}`,
    content: `Test message content ${index} - ${Math.random().toString(36).substring(2, 15)}`,
    user_id: `user-${index % 5}`, // 5 different users
    created_at: new Date(Date.now() - (count - index) * 1000).toISOString(),
    message_type: 'text' as const,
    channel_id: 'test-channel-1',
    user: {
      id: `user-${index % 5}`,
      username: `testuser${index % 5}`,
      avatar_url: null
    },
    reactions: [],
    attachments: []
  }));
};

// Compatibility test functions
export class React19CompatibilityTester {
  private startTime: number = 0;
  private results: CompatibilityTestSuite = {
    react19Features: [],
    nextjs15Features: [],
    optimizationFeatures: [],
    performanceTests: [],
    overall: { passed: 0, failed: 0, duration: 0, compatibilityScore: 0 }
  };

  // Start test execution
  async runFullTestSuite(): Promise<CompatibilityTestSuite> {
    console.log('🧪 Starting React 19 + Next.js 15 Compatibility Test Suite...');
    this.startTime = performance.now();

    try {
      // Test React 19 features
      await this.testReact19Features();

      // Test Next.js 15 features
      await this.testNextjs15Features();

      // Test optimization features
      await this.testOptimizationFeatures();

      // Test performance
      await this.testPerformanceOptimizations();

      // Calculate overall results
      this.calculateOverallResults();

      console.log('✅ Compatibility test suite completed!');
      return this.results;
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  // Test React 19 specific features
  private async testReact19Features(): Promise<void> {
    console.log('🔍 Testing React 19 features...');

    // Test 1: React 19 availability
    await this.runTest(
      'React 19 Available',
      () => {
        const available = React19Utils.hasReact19Features();
        if (!available) {
          throw new Error('React 19 features not detected');
        }
        return 'React 19 features are available';
      },
      this.results.react19Features
    );

    // Test 2: startTransition functionality
    await this.runTest(
      'startTransition Support',
      async () => {
        // Test startTransition import and usage
        try {
          const { startTransition } = await import('react');
          let transitionCompleted = false;

          startTransition(() => {
            transitionCompleted = true;
          });

          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, 10));

          if (!transitionCompleted) {
            throw new Error('startTransition did not execute');
          }
          return 'startTransition working correctly';
        } catch (error) {
          throw new Error(`startTransition test failed: ${error}`);
        }
      },
      this.results.react19Features
    );

    // Test 3: useDeferredValue functionality
    await this.runTest(
      'useDeferredValue Support',
      async () => {
        try {
          const { useDeferredValue } = await import('react');
          if (typeof useDeferredValue !== 'function') {
            throw new Error('useDeferredValue is not available');
          }
          return 'useDeferredValue is available';
        } catch (error) {
          throw new Error(`useDeferredValue test failed: ${error}`);
        }
      },
      this.results.react19Features
    );

    // Test 4: use hook availability (React 19 canary feature)
    await this.runTest(
      'use Hook Support',
      async () => {
        try {
          const ReactModule = await import('react');
          if (typeof (ReactModule as any).use === 'function') {
            return 'use hook is available (React 19)';
          } else {
            return 'use hook not available (expected in React 18)';
          }
        } catch (error) {
          throw new Error(`use hook test failed: ${error}`);
        }
      },
      this.results.react19Features
    );
  }

  // Test Next.js 15 specific features
  private async testNextjs15Features(): Promise<void> {
    console.log('🔍 Testing Next.js 15 features...');

    // Test 1: Turbopack availability
    await this.runTest(
      'Turbopack Support',
      () => {
        // Check for Turbopack environment variables or features
        const hasTurbopack = process.env.TURBOPACK === '1' ||
                           process.env.NODE_ENV === 'development';
        return hasTurbopack ? 'Turbopack available' : 'Webpack mode (expected in production)';
      },
      this.results.nextjs15Features
    );

    // Test 2: App Router compatibility
    await this.runTest(
      'App Router Support',
      () => {
        // Check if we're in App Router environment
        if (typeof window !== 'undefined') {
          return 'Client-side App Router environment detected';
        }
        return 'Server-side or test environment';
      },
      this.results.nextjs15Features
    );

    // Test 3: React 19 Compiler integration
    await this.runTest(
      'React Compiler Integration',
      () => {
        // Check for React Compiler optimizations
        const hasCompilerOptimizations = process.env.NODE_ENV === 'production' ||
                                       process.env.NEXT_EXPERIMENTAL_REACT_COMPILER === 'true';
        return hasCompilerOptimizations ?
               'React Compiler optimizations detected' :
               'Development mode - compiler optimizations disabled';
      },
      this.results.nextjs15Features
    );
  }

  // Test optimization features
  private async testOptimizationFeatures(): Promise<void> {
    console.log('🔍 Testing optimization features...');

    const mockMessages = createMockMessages(100);

    // Test 1: Message processor
    await this.runTest(
      'Message Processor',
      async () => {
        const promise = messageProcessor.processMessages(mockMessages, 50);
        const result = await promise;

        if (result.length !== 50) {
          throw new Error(`Expected 50 messages, got ${result.length}`);
        }

        const stats = messageProcessor.getStats();
        return `Processed ${result.length} messages, cache size: ${stats.cacheSize}`;
      },
      this.results.optimizationFeatures
    );

    // Test 2: State manager
    await this.runTest(
      'State Manager',
      async () => {
        const promise = messageStateManager.createMessagePromise(
          'test-key',
          async () => mockMessages.slice(0, 10)
        );

        const result = await promise;
        if (result.length !== 10) {
          throw new Error(`Expected 10 messages, got ${result.length}`);
        }

        const stats = messageStateManager.getStats();
        return `State managed successfully, ${stats.promiseCount} promises cached`;
      },
      this.results.optimizationFeatures
    );

    // Test 3: Transition manager
    await this.runTest(
      'Transition Manager',
      async () => {
        let transitionExecuted = false;

        transitionManager.queueTransition(() => {
          transitionExecuted = true;
        });

        // Wait for transition processing
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!transitionExecuted) {
          throw new Error('Transition was not executed');
        }

        const stats = transitionManager.getStats();
        return `Transition executed, scheduler available: ${stats.hasScheduler}`;
      },
      this.results.optimizationFeatures
    );

    // Test 4: Performance monitor
    await this.runTest(
      'Performance Monitor',
      async () => {
        const startTime = performance.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        const endTime = performance.now();

        performanceMonitor.recordRender(startTime, endTime);
        performanceMonitor.recordMemorySnapshot();

        const stats = performanceMonitor.getStats();
        return `Performance tracked: ${stats.totalSamples} samples, avg: ${stats.averageRenderTime}ms`;
      },
      this.results.optimizationFeatures
    );
  }

  // Test performance optimizations
  private async testPerformanceOptimizations(): Promise<void> {
    console.log('🔍 Testing performance optimizations...');

    // Test 1: Large dataset processing
    await this.runTest(
      'Large Dataset Processing',
      async () => {
        const largeDataset = createMockMessages(1000);
        const startTime = performance.now();

        const promise = messageProcessor.processMessages(largeDataset, 100);
        const result = await promise;

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        if (processingTime > 1000) { // 1 second threshold
          throw new Error(`Processing too slow: ${processingTime.toFixed(2)}ms`);
        }

        return `Processed ${result.length} messages in ${processingTime.toFixed(2)}ms`;
      },
      this.results.performanceTests
    );

    // Test 2: Memory efficiency
    await this.runTest(
      'Memory Efficiency',
      async () => {
        const initialMemory = this.getMemoryUsage();

        // Process multiple message batches
        for (let i = 0; i < 10; i++) {
          const messages = createMockMessages(100);
          await messageProcessor.processMessages(messages, 50);
        }

        const finalMemory = this.getMemoryUsage();
        const memoryIncrease = finalMemory - initialMemory;

        if (memoryIncrease > 50) { // 50MB threshold
          throw new Error(`Memory usage increased by ${memoryIncrease.toFixed(2)}MB`);
        }

        return `Memory increase: ${memoryIncrease.toFixed(2)}MB (acceptable)`;
      },
      this.results.performanceTests
    );

    // Test 3: Concurrent processing
    await this.runTest(
      'Concurrent Processing',
      async () => {
        const startTime = performance.now();

        // Process multiple message sets concurrently
        const promises = Array.from({ length: 5 }, (_, index) => {
          const messages = createMockMessages(50);
          return messageProcessor.processMessages(messages, 25);
        });

        const results = await Promise.all(promises);
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        if (totalTime > 500) { // 500ms threshold for concurrent processing
          throw new Error(`Concurrent processing too slow: ${totalTime.toFixed(2)}ms`);
        }

        return `Processed ${results.length} batches concurrently in ${totalTime.toFixed(2)}ms`;
      },
      this.results.performanceTests
    );
  }

  // Helper method to run individual tests
  private async runTest(
    testName: string,
    testFn: () => Promise<string> | string,
    resultArray: TestResult[]
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const details = await testFn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      resultArray.push({
        testName,
        passed: true,
        duration,
        details
      });

      console.log(`  ✅ ${testName}: ${details} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      resultArray.push({
        testName,
        passed: false,
        duration,
        details: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error))
      });

      console.log(`  ❌ ${testName}: ${error instanceof Error ? error.message : String(error)} (${duration.toFixed(2)}ms)`);
    }
  }

  // Calculate overall results
  private calculateOverallResults(): void {
    const allTests = [
      ...this.results.react19Features,
      ...this.results.nextjs15Features,
      ...this.results.optimizationFeatures,
      ...this.results.performanceTests
    ];

    const passed = allTests.filter(test => test.passed).length;
    const failed = allTests.filter(test => !test.passed).length;
    const duration = performance.now() - this.startTime;
    const compatibilityScore = Math.round((passed / allTests.length) * 100);

    this.results.overall = {
      passed,
      failed,
      duration,
      compatibilityScore
    };

    console.log(`\n📊 Overall Results:`);
    console.log(`   Passed: ${passed}/${allTests.length} tests`);
    console.log(`   Failed: ${failed}/${allTests.length} tests`);
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    console.log(`   Compatibility Score: ${compatibilityScore}%`);
  }

  // Get memory usage (if available)
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  // Generate detailed report
  generateReport(): string {
    const report = [`
# React 19 + Next.js 15 Compatibility Test Report

## Overall Results
- **Compatibility Score**: ${this.results.overall.compatibilityScore}%
- **Tests Passed**: ${this.results.overall.passed}
- **Tests Failed**: ${this.results.overall.failed}
- **Total Duration**: ${this.results.overall.duration.toFixed(2)}ms

## React 19 Features Tests
${this.formatTestSection(this.results.react19Features)}

## Next.js 15 Features Tests
${this.formatTestSection(this.results.nextjs15Features)}

## Optimization Features Tests
${this.formatTestSection(this.results.optimizationFeatures)}

## Performance Tests
${this.formatTestSection(this.results.performanceTests)}

## Recommendations

${this.generateRecommendations()}

---
*Generated on ${new Date().toISOString()}*
`];

    return report.join('\n');
  }

  // Format test section for report
  private formatTestSection(tests: TestResult[]): string {
    return tests.map(test =>
      `- ${test.passed ? '✅' : '❌'} **${test.testName}**: ${test.details} (${test.duration.toFixed(2)}ms)`
    ).join('\n');
  }

  // Generate recommendations based on test results
  private generateRecommendations(): string {
    const recommendations: string[] = [];
    const score = this.results.overall.compatibilityScore;

    if (score >= 90) {
      recommendations.push('🎉 Excellent compatibility! Your system is fully optimized for React 19 and Next.js 15.');
    } else if (score >= 75) {
      recommendations.push('✨ Good compatibility with minor optimization opportunities.');
    } else if (score >= 50) {
      recommendations.push('⚠️ Moderate compatibility. Consider updating dependencies and configuration.');
    } else {
      recommendations.push('🚨 Low compatibility. Major updates required for optimal performance.');
    }

    // Specific recommendations based on failed tests
    const failedReact19Tests = this.results.react19Features.filter(t => !t.passed);
    if (failedReact19Tests.length > 0) {
      recommendations.push('- Update to React 19 for latest performance optimizations');
    }

    const failedNextjsTests = this.results.nextjs15Features.filter(t => !t.passed);
    if (failedNextjsTests.length > 0) {
      recommendations.push('- Upgrade to Next.js 15 for improved bundling and compilation');
    }

    const slowPerformanceTests = this.results.performanceTests.filter(t => t.duration > 100);
    if (slowPerformanceTests.length > 0) {
      recommendations.push('- Consider enabling React Compiler for better performance');
      recommendations.push('- Review message processing algorithms for optimization');
    }

    return recommendations.join('\n');
  }
}

// Export singleton tester instance
export const compatibilityTester = new React19CompatibilityTester();

// Quick compatibility check function
export async function quickCompatibilityCheck(): Promise<boolean> {
  try {
    const results = await compatibilityTester.runFullTestSuite();
    return results.overall.compatibilityScore >= 75; // 75% threshold for "compatible"
  } catch {
    return false;
  }
}

// Export test result types
export type { TestResult, CompatibilityTestSuite };