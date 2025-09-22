import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter'
import * as fs from 'fs'
import * as path from 'path'

interface PerformanceMetrics {
  testName: string
  projectName: string
  duration: number
  loadTime?: number
  ttfb?: number
  fcp?: number
  lcp?: number
  cls?: number
  resourceCount?: number
  memoryUsage?: number
  networkErrors?: number
  status: 'passed' | 'failed' | 'timedOut' | 'skipped'
  browser: string
  viewport: string
  timestamp: string
}

interface WebVitalsData {
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  entries: any[]
  id: string
  navigationType: string
}

/**
 * Custom Performance Reporter for E2E Tests
 * Collects and reports Core Web Vitals and performance metrics
 */
class PerformanceReporter implements Reporter {
  private metrics: PerformanceMetrics[] = []
  private outputDir = 'test-results'
  private startTime = 0

  onBegin(config: FullConfig, suite: Suite) {
    this.startTime = Date.now()
    console.log(`🚀 Starting E2E performance testing with ${config.projects.length} projects`)

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const projectName = test.parent.project()?.name || 'unknown'
    const browser = this.extractBrowserName(projectName)
    const viewport = this.extractViewport(test.parent.project()?.use?.viewport)

    const metric: PerformanceMetrics = {
      testName: test.title,
      projectName,
      duration: result.duration,
      status: result.status,
      browser,
      viewport,
      timestamp: new Date().toISOString()
    }

    // Extract performance data from attachments
    result.attachments.forEach(attachment => {
      if (attachment.name === 'performance-metrics') {
        try {
          const perfData = JSON.parse(attachment.body?.toString() || '{}')
          metric.loadTime = perfData.loadTime
          metric.ttfb = perfData.ttfb
          metric.fcp = perfData.fcp
          metric.lcp = perfData.lcp
          metric.cls = perfData.cls
          metric.resourceCount = perfData.resourceCount
          metric.memoryUsage = perfData.memoryUsage
          metric.networkErrors = perfData.networkErrors
        } catch (error) {
          console.warn('Failed to parse performance metrics:', error)
        }
      }
    })

    this.metrics.push(metric)
  }

  async onEnd(result: FullResult) {
    const totalDuration = Date.now() - this.startTime

    console.log(`\n📊 Performance Test Summary (${totalDuration}ms)`)
    console.log('=' .repeat(60))

    await this.generatePerformanceReport()
    await this.generateWebVitalsReport()
    await this.generateBudgetReport()

    this.printSummaryStats()
  }

  private async generatePerformanceReport() {
    const report = {
      summary: {
        totalTests: this.metrics.length,
        passed: this.metrics.filter(m => m.status === 'passed').length,
        failed: this.metrics.filter(m => m.status === 'failed').length,
        averageDuration: this.calculateAverage(this.metrics.map(m => m.duration)),
        averageLoadTime: this.calculateAverage(this.metrics.map(m => m.loadTime).filter(Boolean) as number[]),
        generatedAt: new Date().toISOString()
      },
      metrics: this.metrics,
      browsers: this.groupByBrowser(),
      performanceBudget: this.checkPerformanceBudget()
    }

    const filePath = path.join(this.outputDir, 'performance-report.json')
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2))
    console.log(`📈 Performance report saved: ${filePath}`)
  }

  private async generateWebVitalsReport() {
    const webVitalsMetrics = this.metrics.filter(m =>
      m.fcp !== undefined || m.lcp !== undefined || m.cls !== undefined
    )

    if (webVitalsMetrics.length === 0) {
      console.log('⚠️  No Web Vitals data collected')
      return
    }

    const vitalsReport = {
      summary: {
        totalMeasurements: webVitalsMetrics.length,
        averageFCP: this.calculateAverage(webVitalsMetrics.map(m => m.fcp).filter(Boolean) as number[]),
        averageLCP: this.calculateAverage(webVitalsMetrics.map(m => m.lcp).filter(Boolean) as number[]),
        averageCLS: this.calculateAverage(webVitalsMetrics.map(m => m.cls).filter(Boolean) as number[]),
        goodFCP: webVitalsMetrics.filter(m => (m.fcp || 0) <= 1800).length,
        goodLCP: webVitalsMetrics.filter(m => (m.lcp || 0) <= 2500).length,
        goodCLS: webVitalsMetrics.filter(m => (m.cls || 0) <= 0.1).length
      },
      details: webVitalsMetrics,
      budgetStatus: this.getWebVitalsBudgetStatus(webVitalsMetrics)
    }

    const filePath = path.join(this.outputDir, 'web-vitals-report.json')
    fs.writeFileSync(filePath, JSON.stringify(vitalsReport, null, 2))
    console.log(`📊 Web Vitals report saved: ${filePath}`)
  }

  private async generateBudgetReport() {
    const budgetThresholds = {
      loadTime: 3000, // 3 seconds
      ttfb: 800,      // 800ms
      fcp: 1800,      // 1.8 seconds
      lcp: 2500,      // 2.5 seconds
      cls: 0.1,       // 0.1
      resourceCount: 100,
      memoryUsage: 50 * 1024 * 1024 // 50MB
    }

    const violations: Array<{
      testName: string
      metric: string
      value: number
      threshold: number
      severity: 'warning' | 'error'
    }> = []

    this.metrics.forEach(metric => {
      Object.entries(budgetThresholds).forEach(([key, threshold]) => {
        const value = (metric as any)[key]
        if (value !== undefined && value > threshold) {
          violations.push({
            testName: metric.testName,
            metric: key,
            value,
            threshold,
            severity: value > threshold * 1.5 ? 'error' : 'warning'
          })
        }
      })
    })

    const budgetReport = {
      thresholds: budgetThresholds,
      violations,
      summary: {
        totalViolations: violations.length,
        errors: violations.filter(v => v.severity === 'error').length,
        warnings: violations.filter(v => v.severity === 'warning').length,
        budgetScore: Math.max(0, 100 - (violations.length * 5))
      }
    }

    const filePath = path.join(this.outputDir, 'performance-budget.json')
    fs.writeFileSync(filePath, JSON.stringify(budgetReport, null, 2))
    console.log(`💰 Performance budget report saved: ${filePath}`)

    if (violations.length > 0) {
      console.log(`\n⚠️  Performance Budget Violations: ${violations.length}`)
      violations.slice(0, 5).forEach(v => {
        console.log(`  ${v.severity === 'error' ? '❌' : '⚠️ '} ${v.testName}: ${v.metric} (${v.value}ms > ${v.threshold}ms)`)
      })
      if (violations.length > 5) {
        console.log(`  ... and ${violations.length - 5} more violations`)
      }
    }
  }

  private printSummaryStats() {
    const passedTests = this.metrics.filter(m => m.status === 'passed')
    const failedTests = this.metrics.filter(m => m.status === 'failed')

    console.log(`\n📈 Performance Statistics:`)
    console.log(`  ✅ Passed: ${passedTests.length}`)
    console.log(`  ❌ Failed: ${failedTests.length}`)
    console.log(`  ⏱️  Average Duration: ${this.calculateAverage(this.metrics.map(m => m.duration)).toFixed(0)}ms`)

    const loadTimes = this.metrics.map(m => m.loadTime).filter(Boolean) as number[]
    if (loadTimes.length > 0) {
      console.log(`  🚀 Average Load Time: ${this.calculateAverage(loadTimes).toFixed(0)}ms`)
    }

    const browsers = this.groupByBrowser()
    console.log(`\n🌐 Browser Coverage:`)
    Object.entries(browsers).forEach(([browser, count]) => {
      console.log(`  ${browser}: ${count} tests`)
    })
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private extractBrowserName(projectName: string): string {
    if (projectName.includes('chromium') || projectName.includes('chrome')) return 'Chrome'
    if (projectName.includes('firefox')) return 'Firefox'
    if (projectName.includes('webkit') || projectName.includes('safari')) return 'Safari'
    return projectName
  }

  private extractViewport(viewport: any): string {
    if (!viewport) return 'default'
    return `${viewport.width}x${viewport.height}`
  }

  private groupByBrowser(): Record<string, number> {
    const browsers: Record<string, number> = {}
    this.metrics.forEach(metric => {
      browsers[metric.browser] = (browsers[metric.browser] || 0) + 1
    })
    return browsers
  }

  private checkPerformanceBudget(): Record<string, boolean> {
    return {
      loadTime: this.calculateAverage(this.metrics.map(m => m.loadTime).filter(Boolean) as number[]) <= 3000,
      ttfb: this.calculateAverage(this.metrics.map(m => m.ttfb).filter(Boolean) as number[]) <= 800,
      lcp: this.calculateAverage(this.metrics.map(m => m.lcp).filter(Boolean) as number[]) <= 2500
    }
  }

  private getWebVitalsBudgetStatus(metrics: PerformanceMetrics[]): Record<string, string> {
    const avgFCP = this.calculateAverage(metrics.map(m => m.fcp).filter(Boolean) as number[])
    const avgLCP = this.calculateAverage(metrics.map(m => m.lcp).filter(Boolean) as number[])
    const avgCLS = this.calculateAverage(metrics.map(m => m.cls).filter(Boolean) as number[])

    return {
      fcp: avgFCP <= 1800 ? 'good' : avgFCP <= 3000 ? 'needs-improvement' : 'poor',
      lcp: avgLCP <= 2500 ? 'good' : avgLCP <= 4000 ? 'needs-improvement' : 'poor',
      cls: avgCLS <= 0.1 ? 'good' : avgCLS <= 0.25 ? 'needs-improvement' : 'poor'
    }
  }
}

export default PerformanceReporter