import { Page } from '@playwright/test'

export interface WebVitalsData {
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  entries: any[]
  id: string
  navigationType: string
}

export interface PerformanceMetrics {
  // Core Web Vitals
  cls?: number
  fcp?: number
  fid?: number
  lcp?: number
  ttfb?: number
  inp?: number

  // Additional metrics
  loadTime: number
  domContentLoaded: number
  resourceCount: number
  totalTransferSize: number
  memoryUsage?: number
  jsHeapSize?: number

  // Network metrics
  networkErrors: number
  failedRequests: string[]

  // Custom metrics
  hydrationTime?: number
  routeChangeTime?: number

  // Meta data
  timestamp: string
  url: string
  userAgent: string
}

/**
 * Web Vitals Collector for comprehensive performance measurement
 */
export class WebVitalsCollector {
  private webVitalsData: WebVitalsData[] = []
  private performanceMetrics: PerformanceMetrics | null = null
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Setup Web Vitals collection on the page
   */
  async setupCollection(): Promise<void> {
    // Inject web-vitals library
    await this.page.addScriptTag({
      url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js'
    })

    // Setup collection script
    await this.page.evaluate(() => {
      const vitalsData: any[] = []

      // Collect all Core Web Vitals
      function onVitals(metric: any) {
        vitalsData.push(metric)
        // Store in window for retrieval
        ;(window as any).__webVitalsData = vitalsData
      }

      // Register all vitals
      if ((window as any).webVitals) {
        const { getCLS, getFCP, getFID, getLCP, getTTFB, getINP } = (window as any).webVitals

        getCLS(onVitals)
        getFCP(onVitals)
        getFID(onVitals)
        getLCP(onVitals)
        getTTFB(onVitals)

        // INP is newer metric, might not be available
        if (getINP) {
          getINP(onVitals)
        }
      }

      // Additional performance observers
      const perfObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()

        // Store performance entries for analysis
        if (!(window as any).__performanceEntries) {
          ;(window as any).__performanceEntries = []
        }
        ;(window as any).__performanceEntries.push(...entries)
      })

      // Observe various performance entry types
      const entryTypes = ['navigation', 'resource', 'measure', 'paint', 'largest-contentful-paint']
      entryTypes.forEach(type => {
        try {
          perfObserver.observe({ entryTypes: [type] })
        } catch (e) {
          // Some entry types might not be supported
        }
      })

      // Track hydration time for React apps
      const hydrationStart = performance.now()
      ;(window as any).__hydrationStart = hydrationStart

      // Track when React hydration completes
      const originalConsoleError = console.error
      let hydrationComplete = false

      // Listen for React hydration completion
      const checkHydration = () => {
        if (!hydrationComplete && document.readyState === 'complete') {
          const hydrationEnd = performance.now()
          ;(window as any).__hydrationTime = hydrationEnd - hydrationStart
          hydrationComplete = true
        }
      }

      document.addEventListener('DOMContentLoaded', checkHydration)
      window.addEventListener('load', checkHydration)

      // Setup error tracking
      ;(window as any).__networkErrors = []

      const originalFetch = window.fetch
      window.fetch = async function(...args) {
        try {
          const response = await originalFetch.apply(this, args)
          if (!response.ok) {
            ;(window as any).__networkErrors.push({
              url: args[0],
              status: response.status,
              statusText: response.statusText,
              timestamp: new Date().toISOString()
            })
          }
          return response
        } catch (error) {
          ;(window as any).__networkErrors.push({
            url: args[0],
            error: error.message,
            timestamp: new Date().toISOString()
          })
          throw error
        }
      }
    })
  }

  /**
   * Collect Web Vitals data from the page
   */
  async collectWebVitals(): Promise<WebVitalsData[]> {
    // Wait a bit for vitals to be collected
    await this.page.waitForTimeout(1000)

    this.webVitalsData = await this.page.evaluate(() => {
      return (window as any).__webVitalsData || []
    })

    return this.webVitalsData
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = performance.getEntriesByType('resource')
      const networkErrors = (window as any).__networkErrors || []

      // Calculate basic metrics
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
      const ttfb = navigation.responseStart - navigation.requestStart

      // Resource metrics
      const resourceCount = resources.length
      const totalTransferSize = resources.reduce((total: number, resource: any) => {
        return total + (resource.transferSize || 0)
      }, 0)

      // Memory metrics (if available)
      let memoryUsage: number | undefined
      let jsHeapSize: number | undefined

      if ((performance as any).memory) {
        memoryUsage = (performance as any).memory.usedJSHeapSize
        jsHeapSize = (performance as any).memory.totalJSHeapSize
      }

      // Get Web Vitals data
      const webVitalsData = (window as any).__webVitalsData || []
      const vitalsMap: Record<string, number> = {}

      webVitalsData.forEach((vital: any) => {
        vitalsMap[vital.name.toLowerCase()] = vital.value
      })

      // Custom metrics
      const hydrationTime = (window as any).__hydrationTime

      return {
        // Core Web Vitals
        cls: vitalsMap.cls,
        fcp: vitalsMap.fcp,
        fid: vitalsMap.fid,
        lcp: vitalsMap.lcp,
        ttfb: vitalsMap.ttfb || ttfb,
        inp: vitalsMap.inp,

        // Basic metrics
        loadTime,
        domContentLoaded,
        resourceCount,
        totalTransferSize,
        memoryUsage,
        jsHeapSize,

        // Network metrics
        networkErrors: networkErrors.length,
        failedRequests: networkErrors.map((err: any) => err.url),

        // Custom metrics
        hydrationTime,

        // Meta data
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    })

    this.performanceMetrics = metrics
    return metrics
  }

  /**
   * Assess Web Vitals ratings according to Google's thresholds
   */
  assessWebVitalsRatings(vitals: WebVitalsData[]): Record<string, string> {
    const ratings: Record<string, string> = {}

    vitals.forEach(vital => {
      switch (vital.name) {
        case 'CLS':
          ratings.cls = vital.value <= 0.1 ? 'good' : vital.value <= 0.25 ? 'needs-improvement' : 'poor'
          break
        case 'FCP':
          ratings.fcp = vital.value <= 1800 ? 'good' : vital.value <= 3000 ? 'needs-improvement' : 'poor'
          break
        case 'FID':
          ratings.fid = vital.value <= 100 ? 'good' : vital.value <= 300 ? 'needs-improvement' : 'poor'
          break
        case 'LCP':
          ratings.lcp = vital.value <= 2500 ? 'good' : vital.value <= 4000 ? 'needs-improvement' : 'poor'
          break
        case 'TTFB':
          ratings.ttfb = vital.value <= 800 ? 'good' : vital.value <= 1800 ? 'needs-improvement' : 'poor'
          break
        case 'INP':
          ratings.inp = vital.value <= 200 ? 'good' : vital.value <= 500 ? 'needs-improvement' : 'poor'
          break
      }
    })

    return ratings
  }

  /**
   * Generate performance score based on Core Web Vitals
   */
  calculatePerformanceScore(vitals: WebVitalsData[]): number {
    const ratings = this.assessWebVitalsRatings(vitals)
    const weights = {
      lcp: 0.25,
      fid: 0.25,
      cls: 0.25,
      fcp: 0.15,
      ttfb: 0.1
    }

    let score = 0
    Object.entries(weights).forEach(([metric, weight]) => {
      const rating = ratings[metric]
      if (rating === 'good') score += weight * 100
      else if (rating === 'needs-improvement') score += weight * 50
      // 'poor' adds 0 to score
    })

    return Math.round(score)
  }

  /**
   * Check if performance meets budget thresholds
   */
  checkPerformanceBudget(metrics: PerformanceMetrics): {
    passed: boolean
    violations: Array<{ metric: string; actual: number; threshold: number }>
  } {
    const budgets = {
      loadTime: 3000,
      ttfb: 800,
      lcp: 2500,
      fcp: 1800,
      cls: 0.1,
      resourceCount: 100,
      totalTransferSize: 2 * 1024 * 1024 // 2MB
    }

    const violations: Array<{ metric: string; actual: number; threshold: number }> = []

    Object.entries(budgets).forEach(([metric, threshold]) => {
      const actual = (metrics as any)[metric]
      if (actual !== undefined && actual > threshold) {
        violations.push({ metric, actual, threshold })
      }
    })

    return {
      passed: violations.length === 0,
      violations
    }
  }

  /**
   * Wait for page to be fully loaded and stable
   */
  async waitForPageStability(timeout = 5000): Promise<void> {
    // Wait for network idle
    await this.page.waitForLoadState('networkidle')

    // Wait for any remaining async operations
    await this.page.waitForFunction(() => {
      // Check if there are any pending requests
      return (window as any).__pendingRequests === 0 ||
             performance.now() - (window as any).__lastNetworkActivity > 500
    }, { timeout })

    // Additional wait for LCP to stabilize
    await this.page.waitForTimeout(1000)
  }

  /**
   * Get detailed performance report
   */
  async generateDetailedReport(): Promise<{
    webVitals: WebVitalsData[]
    performanceMetrics: PerformanceMetrics
    ratings: Record<string, string>
    score: number
    budgetCheck: ReturnType<typeof this.checkPerformanceBudget>
  }> {
    await this.waitForPageStability()

    const webVitals = await this.collectWebVitals()
    const performanceMetrics = await this.collectPerformanceMetrics()
    const ratings = this.assessWebVitalsRatings(webVitals)
    const score = this.calculatePerformanceScore(webVitals)
    const budgetCheck = this.checkPerformanceBudget(performanceMetrics)

    return {
      webVitals,
      performanceMetrics,
      ratings,
      score,
      budgetCheck
    }
  }

  /**
   * Attach performance data to test for reporting
   */
  async attachPerformanceData(test: any): Promise<void> {
    try {
      const report = await this.generateDetailedReport()

      await test.attach('performance-metrics', {
        body: JSON.stringify(report.performanceMetrics, null, 2),
        contentType: 'application/json'
      })

      await test.attach('web-vitals', {
        body: JSON.stringify(report.webVitals, null, 2),
        contentType: 'application/json'
      })

      await test.attach('performance-summary', {
        body: JSON.stringify({
          score: report.score,
          ratings: report.ratings,
          budgetPassed: report.budgetCheck.passed,
          violations: report.budgetCheck.violations
        }, null, 2),
        contentType: 'application/json'
      })

    } catch (error) {
      console.warn('Failed to attach performance data:', error)
    }
  }
}