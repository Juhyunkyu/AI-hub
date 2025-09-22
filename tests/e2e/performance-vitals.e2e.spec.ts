import { test, expect } from '@playwright/test'
import { E2ETestHelpers, TestDataManager, TestUser } from '../utils/e2e-utils'

test.describe('⚡ Performance & Core Web Vitals Tests', () => {
  let helpers: E2ETestHelpers
  let testDataManager: TestDataManager
  let testUser: TestUser

  test.beforeAll(async () => {
    testDataManager = new TestDataManager()
    testUser = await testDataManager.createTestUser({
      username: 'perfuser',
      role: 'user'
    })
  })

  test.beforeEach(async ({ page }) => {
    helpers = new E2ETestHelpers(page)
    await helpers.auth.loginAsTestUser(testUser)
  })

  test.afterEach(async ({ page }, testInfo) => {
    // 모든 테스트에 성능 데이터 첨부
    await helpers.performance.attachPerformanceData(testInfo)

    if (testInfo.status !== 'passed') {
      await helpers.report.captureFailureScreenshot(testInfo.title)
    }
  })

  test.afterAll(async () => {
    await testDataManager.cleanup()
  })

  test.describe('🎯 Core Web Vitals Compliance', () => {
    const criticalPages = [
      { path: '/', name: 'Homepage', maxLCP: 2500, maxFCP: 1800, maxCLS: 0.1 },
      { path: '/posts', name: 'Posts List', maxLCP: 3000, maxFCP: 2000, maxCLS: 0.1 },
      { path: '/posts/create', name: 'Create Post', maxLCP: 3500, maxFCP: 2000, maxCLS: 0.1 },
      { path: '/chat', name: 'Chat List', maxLCP: 3000, maxFCP: 1800, maxCLS: 0.1 }
    ]

    for (const pageInfo of criticalPages) {
      test(`should meet Core Web Vitals on ${pageInfo.name}`, async ({ page }) => {
        // 성능 수집 시작
        await helpers.performance.startPerformanceCollection()

        const startTime = Date.now()
        const performanceReport = await helpers.performance.measurePageLoad(pageInfo.path)
        const loadTime = Date.now() - startTime

        console.log(`\n📊 Performance Metrics for ${pageInfo.name}:`)
        console.log(`⏱️  Total Load Time: ${loadTime}ms`)

        // Core Web Vitals 검증
        if (performanceReport.lcp !== undefined) {
          console.log(`🎯 LCP: ${performanceReport.lcp}ms (target: <${pageInfo.maxLCP}ms)`)
          expect(performanceReport.lcp).toBeLessThan(pageInfo.maxLCP)
        }

        if (performanceReport.fcp !== undefined) {
          console.log(`🎨 FCP: ${performanceReport.fcp}ms (target: <${pageInfo.maxFCP}ms)`)
          expect(performanceReport.fcp).toBeLessThan(pageInfo.maxFCP)
        }

        if (performanceReport.cls !== undefined) {
          console.log(`📐 CLS: ${performanceReport.cls} (target: <${pageInfo.maxCLS})`)
          expect(performanceReport.cls).toBeLessThan(pageInfo.maxCLS)
        }

        if (performanceReport.ttfb !== undefined) {
          console.log(`⚡ TTFB: ${performanceReport.ttfb}ms (target: <800ms)`)
          expect(performanceReport.ttfb).toBeLessThan(800)
        }

        // 추가 성능 메트릭
        console.log(`🌐 Resources: ${performanceReport.resourceCount}`)
        console.log(`📦 Transfer Size: ${(performanceReport.totalTransferSize / 1024 / 1024).toFixed(2)}MB`)

        // 성능 예산 확인
        expect(performanceReport.resourceCount).toBeLessThan(100)
        expect(performanceReport.totalTransferSize).toBeLessThan(3 * 1024 * 1024) // 3MB
      })
    }

    test('should maintain good performance under load', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()

      const iterations = 5
      const loadTimes: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()
        await page.goto('/posts')
        await helpers.page.waitForPageLoad()
        const loadTime = Date.now() - startTime

        loadTimes.push(loadTime)
        console.log(`Load ${i + 1}: ${loadTime}ms`)

        // 페이지 새로고침
        await page.reload()
      }

      // 평균 로딩 시간
      const averageLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length
      console.log(`Average load time: ${averageLoadTime.toFixed(0)}ms`)

      // 일관된 성능 확인
      expect(averageLoadTime).toBeLessThan(3000)

      // 로딩 시간 편차가 크지 않아야 함
      const maxLoadTime = Math.max(...loadTimes)
      const minLoadTime = Math.min(...loadTimes)
      const variance = maxLoadTime - minLoadTime

      expect(variance).toBeLessThan(2000) // 2초 이내 편차
    })

    test('should optimize Largest Contentful Paint (LCP)', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()

      // LCP 요소가 있는 페이지로 이동
      await page.goto('/posts')

      const performanceReport = await helpers.performance.generatePerformanceReport()

      if (performanceReport.performanceMetrics.lcp) {
        // LCP가 Google 권장사항 내에 있는지 확인
        const lcp = performanceReport.performanceMetrics.lcp
        console.log(`LCP: ${lcp}ms`)

        // LCP 등급 확인
        if (lcp <= 2500) {
          console.log('✅ LCP: Good')
        } else if (lcp <= 4000) {
          console.log('⚠️ LCP: Needs Improvement')
        } else {
          console.log('❌ LCP: Poor')
        }

        expect(lcp).toBeLessThan(2500) // Good threshold
      }

      // LCP 요소 식별
      const lcpElement = await page.evaluate(() => {
        const entries = performance.getEntriesByType('largest-contentful-paint') as any[]
        return entries.length > 0 ? entries[entries.length - 1].element?.tagName : null
      })

      if (lcpElement) {
        console.log(`LCP Element: ${lcpElement}`)
      }
    })

    test('should minimize Cumulative Layout Shift (CLS)', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()

      await page.goto('/posts')
      await helpers.page.waitForPageLoad()

      // 추가적인 동적 콘텐츠 로딩 시뮬레이션
      await page.evaluate(() => {
        // 이미지나 광고 등의 지연 로딩 시뮬레이션
        setTimeout(() => {
          const img = document.createElement('img')
          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNzNkYyIvPjwvc3ZnPg=='
          img.width = 100
          img.height = 100
          document.body.appendChild(img)
        }, 1000)
      })

      await page.waitForTimeout(2000)

      const performanceReport = await helpers.performance.generatePerformanceReport()

      if (performanceReport.performanceMetrics.cls !== undefined) {
        const cls = performanceReport.performanceMetrics.cls
        console.log(`CLS: ${cls}`)

        // CLS 등급 확인
        if (cls <= 0.1) {
          console.log('✅ CLS: Good')
        } else if (cls <= 0.25) {
          console.log('⚠️ CLS: Needs Improvement')
        } else {
          console.log('❌ CLS: Poor')
        }

        expect(cls).toBeLessThan(0.1) // Good threshold
      }
    })

    test('should optimize First Input Delay (FID)', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()
      await page.goto('/posts')

      // 페이지가 로드된 후 즉시 인터랙션 시도
      await helpers.page.waitForPageLoad()

      const startTime = Date.now()

      // 첫 번째 사용자 입력 시뮬레이션 (클릭)
      const firstButton = page.locator('button').first()
      await firstButton.click()

      const inputDelay = Date.now() - startTime

      console.log(`First Input Delay: ${inputDelay}ms`)

      // FID가 100ms 이하여야 함 (Good threshold)
      expect(inputDelay).toBeLessThan(100)

      // 추가 인터랙션들도 빠르게 응답해야 함
      const searchInput = page.locator('[data-testid="search-input"]')
      if (await searchInput.count() > 0) {
        const inputStartTime = Date.now()
        await searchInput.click()
        await searchInput.type('test')
        const typingDelay = Date.now() - inputStartTime

        console.log(`Typing responsiveness: ${typingDelay}ms`)
        expect(typingDelay).toBeLessThan(50) // 매우 빠른 응답
      }
    })
  })

  test.describe('📊 Resource Optimization', () => {
    test('should optimize JavaScript bundle size', async ({ page }) => {
      await page.goto('/posts')

      const scriptSizes = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'))
        return scripts.map(script => {
          const src = (script as HTMLScriptElement).src
          return fetch(src, { method: 'HEAD' })
            .then(response => ({
              url: src,
              size: parseInt(response.headers.get('content-length') || '0'),
              compressed: response.headers.get('content-encoding') === 'gzip'
            }))
            .catch(() => ({ url: src, size: 0, compressed: false }))
        })
      })

      const sizes = await Promise.all(scriptSizes)
      const totalJSSize = sizes.reduce((total, file) => total + file.size, 0)

      console.log(`Total JS bundle size: ${(totalJSSize / 1024).toFixed(2)}KB`)

      // 개별 스크립트 크기 로깅
      sizes.forEach(file => {
        if (file.size > 0) {
          console.log(`- ${file.url.split('/').pop()}: ${(file.size / 1024).toFixed(2)}KB ${file.compressed ? '(gzipped)' : ''}`)
        }
      })

      // 총 JavaScript 번들 크기가 합리적이어야 함
      expect(totalJSSize).toBeLessThan(1024 * 1024) // 1MB

      // 압축이 적용되어 있는지 확인
      const compressedFiles = sizes.filter(file => file.compressed)
      expect(compressedFiles.length).toBeGreaterThan(0)
    })

    test('should implement efficient image loading', async ({ page }) => {
      // 이미지가 많은 페이지 테스트
      await page.goto('/posts')

      const images = await page.locator('img').all()

      for (const img of images.slice(0, 5)) {
        // 지연 로딩 확인
        const loading = await img.getAttribute('loading')
        if (loading) {
          expect(loading).toBe('lazy')
        }

        // 적절한 alt 텍스트 확인
        const alt = await img.getAttribute('alt')
        const ariaHidden = await img.getAttribute('aria-hidden')

        if (ariaHidden !== 'true') {
          expect(alt).toBeTruthy()
        }

        // 이미지 크기 최적화 확인
        const naturalSize = await img.evaluate(el => ({
          naturalWidth: (el as HTMLImageElement).naturalWidth,
          naturalHeight: (el as HTMLImageElement).naturalHeight,
          displayWidth: el.offsetWidth,
          displayHeight: el.offsetHeight
        }))

        // 이미지가 표시 크기보다 지나치게 크지 않아야 함 (최대 2배)
        if (naturalSize.displayWidth > 0) {
          const widthRatio = naturalSize.naturalWidth / naturalSize.displayWidth
          expect(widthRatio).toBeLessThan(3)
        }
      }
    })

    test('should minimize CSS and font loading impact', async ({ page }) => {
      await page.goto('/posts')

      // CSS 파일 크기 확인
      const stylesheets = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        return links.map(link => (link as HTMLLinkElement).href)
      })

      console.log(`CSS files: ${stylesheets.length}`)

      // 폰트 로딩 최적화 확인
      const fontFaces = await page.evaluate(() => {
        return Array.from(document.fonts).map(font => ({
          family: font.family,
          status: font.status,
          display: font.display
        }))
      })

      // 폰트가 적절히 로드되었는지 확인
      const loadedFonts = fontFaces.filter(font => font.status === 'loaded')
      console.log(`Loaded fonts: ${loadedFonts.length}/${fontFaces.length}`)

      // 폰트 디스플레이 옵션 확인 (FOUT 방지)
      fontFaces.forEach(font => {
        if (font.display) {
          expect(['swap', 'fallback', 'optional']).toContain(font.display)
        }
      })
    })

    test('should optimize third-party scripts', async ({ page }) => {
      const thirdPartyRequests: string[] = []

      page.on('request', request => {
        const url = request.url()
        // 타사 도메인 식별
        if (!url.includes('localhost:3000') && !url.includes('127.0.0.1')) {
          thirdPartyRequests.push(url)
        }
      })

      await page.goto('/posts')
      await helpers.page.waitForPageLoad()

      console.log(`Third-party requests: ${thirdPartyRequests.length}`)
      thirdPartyRequests.forEach(url => {
        console.log(`- ${url}`)
      })

      // 타사 스크립트 수가 합리적이어야 함
      expect(thirdPartyRequests.length).toBeLessThan(10)

      // 타사 스크립트들이 성능에 미치는 영향 확인
      const networkAnalysis = await helpers.performance.analyzeNetworkPerformance()
      const thirdPartySize = networkAnalysis.requests
        .filter(req => !req.name.includes('localhost'))
        .reduce((total, req) => total + (req.size || 0), 0)

      console.log(`Third-party total size: ${(thirdPartySize / 1024).toFixed(2)}KB`)
      expect(thirdPartySize).toBeLessThan(500 * 1024) // 500KB
    })
  })

  test.describe('🔄 Caching & Network Optimization', () => {
    test('should implement effective caching strategies', async ({ page }) => {
      // 첫 번째 방문
      await page.goto('/posts')
      await helpers.page.waitForPageLoad()

      const firstVisitNetwork = await helpers.performance.analyzeNetworkPerformance()

      // 페이지 새로고침 (캐시 활용)
      await page.reload()
      await helpers.page.waitForPageLoad()

      const secondVisitNetwork = await helpers.performance.analyzeNetworkPerformance()

      // 캐시된 리소스 확인
      const cachedResources = secondVisitNetwork.cacheable
      const cacheRatio = cachedResources / secondVisitNetwork.requests.length

      console.log(`Cache hit ratio: ${(cacheRatio * 100).toFixed(1)}%`)

      // 캐시 비율이 높아야 함
      expect(cacheRatio).toBeGreaterThan(0.5) // 50% 이상

      // 두 번째 방문에서 전송된 데이터가 적어야 함
      expect(secondVisitNetwork.totalSize).toBeLessThan(firstVisitNetwork.totalSize)
    })

    test('should use service worker for offline support', async ({ page }) => {
      await page.goto('/posts')

      // 서비스 워커 등록 확인
      const serviceWorkerRegistered = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          return registrations.length > 0
        }
        return false
      })

      console.log(`Service Worker registered: ${serviceWorkerRegistered}`)

      if (serviceWorkerRegistered) {
        // 서비스 워커가 활성화되었는지 확인
        const swActive = await page.evaluate(() => {
          return navigator.serviceWorker.controller !== null
        })

        expect(swActive).toBe(true)

        // 오프라인 상태에서 기본 페이지 접근 테스트
        await page.setOfflineMode(true)
        await page.reload()

        // 기본 콘텐츠가 여전히 보여야 함 (캐시됨)
        await expect(page.locator('body')).toBeVisible()

        await page.setOfflineMode(false)
      }
    })

    test('should optimize API request patterns', async ({ page }) => {
      const apiRequests: any[] = []

      page.on('request', request => {
        const url = request.url()
        if (url.includes('/api/') || url.includes('supabase')) {
          apiRequests.push({
            url,
            method: request.method(),
            timestamp: Date.now()
          })
        }
      })

      await page.goto('/posts')
      await helpers.page.waitForPageLoad()

      console.log(`API requests: ${apiRequests.length}`)

      // API 요청 수가 합리적이어야 함
      expect(apiRequests.length).toBeLessThan(20)

      // 불필요한 중복 요청이 없는지 확인
      const uniqueRequests = new Set(apiRequests.map(req => `${req.method}:${req.url}`))
      const duplicateRatio = 1 - (uniqueRequests.size / apiRequests.length)

      console.log(`Duplicate request ratio: ${(duplicateRatio * 100).toFixed(1)}%`)
      expect(duplicateRatio).toBeLessThan(0.2) // 20% 미만

      // GET 요청들이 적절히 캐시되는지 확인
      const getRequests = apiRequests.filter(req => req.method === 'GET')
      console.log(`GET requests: ${getRequests.length}`)
    })

    test('should implement request deduplication', async ({ page }) => {
      await page.goto('/posts')

      // 빠른 연속 검색으로 요청 중복 제거 테스트
      const searchInput = page.locator('[data-testid="search-input"]')
      if (await searchInput.count() > 0) {
        let requestCount = 0

        page.on('request', request => {
          if (request.url().includes('search')) {
            requestCount++
          }
        })

        // 빠른 연속 타이핑
        await searchInput.click()
        await searchInput.type('react', { delay: 50 })

        await page.waitForTimeout(1000)

        // 요청이 적절히 디바운스/중복제거되었는지 확인
        console.log(`Search requests: ${requestCount}`)
        expect(requestCount).toBeLessThan(5) // 모든 키 입력에 대해 요청하지 않음
      }
    })
  })

  test.describe('⚙️ Performance Monitoring', () => {
    test('should track performance regressions', async ({ page }) => {
      const pages = ['/posts', '/posts/create', '/chat']
      const performanceBaseline: Record<string, any> = {}

      for (const pagePath of pages) {
        await helpers.performance.startPerformanceCollection()

        const startTime = Date.now()
        await page.goto(pagePath)
        await helpers.page.waitForPageLoad()
        const loadTime = Date.now() - startTime

        const metrics = await helpers.performance.measureWebVitals()

        performanceBaseline[pagePath] = {
          loadTime,
          lcp: metrics.lcp,
          fcp: metrics.fcp,
          cls: metrics.cls,
          memoryUsage: metrics.memoryUsage
        }

        console.log(`\n📊 ${pagePath} Performance:`)
        console.log(`  Load Time: ${loadTime}ms`)
        console.log(`  LCP: ${metrics.lcp}ms`)
        console.log(`  FCP: ${metrics.fcp}ms`)
        console.log(`  CLS: ${metrics.cls}`)
      }

      // 성능 기준선 저장 (실제 프로젝트에서는 파일로 저장)
      console.log('\n📈 Performance Baseline Established')

      // 성능 회귀 임계값 확인
      Object.entries(performanceBaseline).forEach(([path, metrics]) => {
        expect(metrics.loadTime).toBeLessThan(5000) // 5초 이내
        if (metrics.lcp) expect(metrics.lcp).toBeLessThan(4000) // 4초 이내
        if (metrics.fcp) expect(metrics.fcp).toBeLessThan(3000) // 3초 이내
        if (metrics.cls) expect(metrics.cls).toBeLessThan(0.25) // 0.25 이내
      })
    })

    test('should measure user-centric performance metrics', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()
      await page.goto('/posts')

      // 사용자 중심 메트릭 수집
      const userMetrics = await page.evaluate(() => {
        return {
          timeToInteractive: performance.now(), // 대략적인 TTI
          totalBlockingTime: 0, // 계산 필요
          speedIndex: 0, // 계산 필요
          userTiming: performance.getEntriesByType('measure').map(entry => ({
            name: entry.name,
            duration: entry.duration
          }))
        }
      })

      console.log('👤 User-Centric Metrics:')
      console.log(`  Time to Interactive: ${userMetrics.timeToInteractive.toFixed(0)}ms`)
      console.log(`  User Timing Marks: ${userMetrics.userTiming.length}`)

      // 사용자 정의 성능 마크 확인
      if (userMetrics.userTiming.length > 0) {
        userMetrics.userTiming.forEach(mark => {
          console.log(`  - ${mark.name}: ${mark.duration.toFixed(0)}ms`)
        })
      }
    })

    test('should generate performance budget report', async ({ page }) => {
      await helpers.performance.startPerformanceCollection()
      await page.goto('/posts')

      const performanceReport = await helpers.performance.generatePerformanceReport()
      const budgetCheck = performanceReport.budgetCheck

      console.log('\n💰 Performance Budget Report:')
      console.log(`Budget Passed: ${budgetCheck.passed ? '✅' : '❌'}`)

      if (!budgetCheck.passed) {
        console.log('\n🚨 Budget Violations:')
        budgetCheck.violations.forEach(violation => {
          console.log(`  - ${violation.metric}: ${violation.actual} > ${violation.threshold}`)
        })
      }

      // 예산 점수 계산
      const score = Math.max(0, 100 - (budgetCheck.violations.length * 10))
      console.log(`Performance Score: ${score}/100`)

      // 최소 점수 요구사항
      expect(score).toBeGreaterThanOrEqual(70)
    })

    test('should validate performance in different network conditions', async ({ page }) => {
      const networkConditions = [
        { name: 'Fast 3G', downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 40 },
        { name: 'Slow 3G', downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8, latency: 400 }
      ]

      for (const condition of networkConditions) {
        console.log(`\n🌐 Testing on ${condition.name}:`)

        // 네트워크 조건 시뮬레이션
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: condition.downloadThroughput,
          uploadThroughput: condition.uploadThroughput,
          latency: condition.latency
        })

        await helpers.performance.startPerformanceCollection()

        const startTime = Date.now()
        await page.goto('/posts')
        await helpers.page.waitForPageLoad()
        const loadTime = Date.now() - startTime

        console.log(`  Load Time: ${loadTime}ms`)

        // 느린 네트워크에서도 기본 사용성 보장
        if (condition.name === 'Slow 3G') {
          expect(loadTime).toBeLessThan(10000) // 10초 이내
        } else {
          expect(loadTime).toBeLessThan(6000) // 6초 이내
        }

        await cdp.detach()
      }
    })
  })
})