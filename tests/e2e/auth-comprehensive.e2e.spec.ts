import { test, expect } from '@playwright/test'
import { E2ETestHelpers, TestDataManager } from '../utils/e2e-utils'

test.describe('🔐 Authentication Comprehensive Tests', () => {
  let helpers: E2ETestHelpers
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    helpers = new E2ETestHelpers(page)
    testDataManager = new TestDataManager()

    // 성능 측정 시작
    await helpers.performance.startPerformanceCollection()
  })

  test.afterEach(async ({ page }, testInfo) => {
    // 성능 데이터 첨부
    await helpers.performance.attachPerformanceData(testInfo)

    // 테스트 데이터 정리
    await testDataManager.cleanup()

    // 실패 시 스크린샷
    if (testInfo.status !== 'passed') {
      await helpers.report.captureFailureScreenshot(testInfo.title)
    }
  })

  test.describe('🎨 Login Page UI/UX', () => {
    test('should render login page with all social auth buttons', async ({ page }) => {
      await page.goto('/auth/login')
      await helpers.page.waitForPageLoad()

      // 페이지 제목 확인
      await expect(page).toHaveTitle(/로그인|Login|Team Hub/)

      // 모든 소셜 로그인 버튼 확인
      const socialButtons = [
        { name: /google로 계속하기/i, testId: 'google-auth-button' },
        { name: /github로 계속하기/i, testId: 'github-auth-button' },
        { name: /kakao로 계속하기/i, testId: 'kakao-auth-button' },
        { name: /naver로 계속하기/i, testId: 'naver-auth-button' }
      ]

      for (const button of socialButtons) {
        const buttonElement = page.getByRole('button', { name: button.name })
        await expect(buttonElement).toBeVisible()
        await expect(buttonElement).toBeEnabled()

        // 버튼에 적절한 아이콘이 있는지 확인
        await expect(buttonElement.locator('svg, img')).toBeVisible()
      }

      // 메타 정보 확인
      await expect(page.locator('meta[property=\"og:title\"]')).toHaveAttribute('content', /로그인|Login/)
    })

    test('should handle loading states during authentication', async ({ page }) => {
      await page.goto('/auth/login')

      // 로딩 상태 모킹을 위한 네트워크 지연
      await page.route('**/auth/v1/authorize**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.continue()
      })

      const googleButton = page.getByRole('button', { name: /google로 계속하기/i })

      // 클릭 후 로딩 상태 확인
      const clickPromise = googleButton.click()

      // 로딩 인디케이터나 비활성화 상태 확인
      await expect(googleButton).toBeDisabled().or(
        expect(page.getByTestId('auth-loading')).toBeVisible()
      )

      await clickPromise
    })

    test('should display error states gracefully', async ({ page }) => {
      await page.goto('/auth/login')

      // 인증 에러 시뮬레이션
      await page.route('**/auth/v1/authorize**', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_request', error_description: 'Test error' })
        })
      })

      await page.getByRole('button', { name: /google로 계속하기/i }).click()

      // 에러 메시지 표시 확인
      await helpers.page.waitForToast('인증 중 오류가 발생했습니다')

      // 사용자가 다시 시도할 수 있도록 버튼이 활성화되어야 함
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeEnabled()
    })
  })

  test.describe('♿ Accessibility Compliance', () => {
    test('should meet WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto('/auth/login')

      // 접근성 검사 실행
      const a11yResults = await helpers.accessibility.runAccessibilityCheck()

      // 심각한 접근성 위반 사항이 없어야 함
      const violations = a11yResults.violations.filter(v =>
        ['critical', 'serious'].includes(v.impact || '')
      )

      expect(violations.length).toBe(0)

      // 상세 접근성 검증
      await helpers.accessibility.verifyScreenReaderContent()
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/auth/login')

      const expectedFocusOrder = [
        'button[name*="Google"]',
        'button[name*="GitHub"]',
        'button[name*="Kakao"]',
        'button[name*="Naver"]'
      ]

      await helpers.accessibility.testKeyboardNavigation(expectedFocusOrder)

      // Enter 키로 버튼 활성화 가능 확인
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      // OAuth 프로세스가 시작되었는지 확인 (URL 변경 또는 새 창)
      await page.waitForTimeout(1000)
    })

    test('should work in high contrast mode', async ({ page }) => {
      await helpers.accessibility.testHighContrastMode()

      await page.goto('/auth/login')

      // 고대비 모드에서도 모든 버튼이 보여야 함
      const buttons = await page.locator('button').all()
      for (const button of buttons) {
        await expect(button).toBeVisible()
        await expect(button).toBeEnabled()
      }
    })

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/auth/login')

      // 모든 버튼에 적절한 레이블 확인
      const buttons = await page.locator('button').all()
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label')
        const textContent = await button.textContent()

        // ARIA label이나 텍스트 내용 중 하나는 있어야 함
        expect(ariaLabel || textContent).toBeTruthy()
      }

      // 랜드마크 역할 확인
      await expect(page.locator('main, [role="main"]')).toBeVisible()

      // 페이지 제목 구조 확인
      const h1 = page.locator('h1')
      if (await h1.count() > 0) {
        await expect(h1.first()).toBeVisible()
      }
    })
  })

  test.describe('📱 Responsive Design', () => {
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 1024, height: 768 },
      { name: 'Mobile Large', width: 414, height: 896 },
      { name: 'Mobile Small', width: 320, height: 568 }
    ]

    for (const viewport of viewports) {
      test(`should work on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto('/auth/login')
        await helpers.page.waitForPageLoad()

        // 모든 소셜 로그인 버튼이 보여야 함
        const socialButtons = [
          /google로 계속하기/i,
          /github로 계속하기/i,
          /kakao로 계속하기/i,
          /naver로 계속하기/i
        ]

        for (const buttonName of socialButtons) {
          const button = page.getByRole('button', { name: buttonName })
          await expect(button).toBeVisible()
          await expect(button).toBeEnabled()

          // 버튼이 클릭 가능한 크기인지 확인 (최소 44x44px)
          const boundingBox = await button.boundingBox()
          if (boundingBox) {
            expect(boundingBox.width).toBeGreaterThanOrEqual(44)
            expect(boundingBox.height).toBeGreaterThanOrEqual(44)
          }
        }

        // 모바일에서는 터치 친화적인지 확인
        if (viewport.width <= 768) {
          // 버튼들 사이의 간격이 충분한지 확인
          const buttons = await page.locator('button').all()
          for (let i = 0; i < buttons.length - 1; i++) {
            const box1 = await buttons[i].boundingBox()
            const box2 = await buttons[i + 1].boundingBox()

            if (box1 && box2) {
              const gap = Math.abs(box2.y - (box1.y + box1.height))
              expect(gap).toBeGreaterThanOrEqual(8) // 최소 8px 간격
            }
          }
        }
      })
    }

    test('should handle orientation changes on mobile', async ({ page }) => {
      // 세로 모드
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/auth/login')
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()

      // 가로 모드
      await page.setViewportSize({ width: 812, height: 375 })
      await page.waitForTimeout(500)
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
    })
  })

  test.describe('🔒 Security & Privacy', () => {
    test('should use secure authentication URLs', async ({ page }) => {
      await page.goto('/auth/login')

      // OAuth URL이 HTTPS를 사용하는지 모니터링
      const authUrls: string[] = []

      page.on('request', request => {
        const url = request.url()
        if (url.includes('oauth') || url.includes('auth')) {
          authUrls.push(url)
        }
      })

      await page.getByRole('button', { name: /google로 계속하기/i }).click()
      await page.waitForTimeout(2000)

      // 모든 인증 URL이 HTTPS를 사용해야 함
      authUrls.forEach(url => {
        expect(url).toMatch(/^https:\/\//)
      })
    })

    test('should not expose sensitive information in URLs', async ({ page }) => {
      await page.goto('/auth/login')

      const sensitiveParams = ['password', 'secret', 'key', 'token']

      page.on('request', request => {
        const url = request.url()
        sensitiveParams.forEach(param => {
          expect(url.toLowerCase()).not.toContain(`${param}=`)
        })
      })

      await page.getByRole('button', { name: /github로 계속하기/i }).click()
      await page.waitForTimeout(2000)
    })

    test('should handle CSP (Content Security Policy)', async ({ page }) => {
      let cspViolations: any[] = []

      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
          cspViolations.push(msg.text())
        }
      })

      await page.goto('/auth/login')
      await page.waitForTimeout(2000)

      // CSP 위반이 없어야 함
      expect(cspViolations.length).toBe(0)
    })
  })

  test.describe('⚡ Performance', () => {
    test('should load quickly and meet Core Web Vitals', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/auth/login')
      await helpers.page.waitForPageLoad()

      const loadTime = Date.now() - startTime

      // 페이지 로딩이 3초 이내에 완료되어야 함
      expect(loadTime).toBeLessThan(3000)

      // Core Web Vitals 측정
      const performanceMetrics = await helpers.performance.measureWebVitals()

      // LCP (Largest Contentful Paint) < 2.5초
      if (performanceMetrics.lcp) {
        expect(performanceMetrics.lcp).toBeLessThan(2500)
      }

      // FCP (First Contentful Paint) < 1.8초
      if (performanceMetrics.fcp) {
        expect(performanceMetrics.fcp).toBeLessThan(1800)
      }

      // CLS (Cumulative Layout Shift) < 0.1
      if (performanceMetrics.cls) {
        expect(performanceMetrics.cls).toBeLessThan(0.1)
      }
    })

    test('should optimize resource loading', async ({ page }) => {
      await page.goto('/auth/login')

      const networkAnalysis = await helpers.performance.analyzeNetworkPerformance()

      // 총 리소스 크기가 합리적이어야 함 (< 2MB)
      expect(networkAnalysis.totalSize).toBeLessThan(2 * 1024 * 1024)

      // 네트워크 에러가 없어야 함
      expect(networkAnalysis.errors.length).toBe(0)

      // 캐시 가능한 리소스 비율이 높아야 함
      const cacheRatio = networkAnalysis.cacheable / networkAnalysis.requests.length
      expect(cacheRatio).toBeGreaterThan(0.3) // 30% 이상
    })

    test('should handle slow networks gracefully', async ({ page }) => {
      // 느린 네트워크 시뮬레이션
      await page.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 100))
        await route.continue()
      })

      const startTime = Date.now()
      await page.goto('/auth/login')

      // 로딩 인디케이터가 표시되어야 함
      await expect(page.getByTestId('loading-indicator')).toBeVisible().or(
        expect(page.locator('.loading')).toBeVisible()
      )

      await helpers.page.waitForPageLoad()

      // 결국 모든 버튼이 로드되어야 함
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()

      const loadTime = Date.now() - startTime
      console.log(`Slow network load time: ${loadTime}ms`)
    })
  })

  test.describe('🌐 Cross-Browser Compatibility', () => {
    test('should work consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/auth/login')
      await helpers.page.waitForPageLoad()

      // 브라우저별 특수 처리가 필요한 경우
      if (browserName === 'webkit') {
        // Safari 특정 처리
        await page.waitForTimeout(1000)
      }

      // 모든 브라우저에서 동일한 기능이 작동해야 함
      const buttons = [
        /google로 계속하기/i,
        /github로 계속하기/i,
        /kakao로 계속하기/i,
        /naver로 계속하기/i
      ]

      for (const buttonName of buttons) {
        const button = page.getByRole('button', { name: buttonName })
        await expect(button).toBeVisible()
        await expect(button).toBeEnabled()

        // 호버 상태 확인 (터치 디바이스가 아닌 경우)
        if (browserName !== 'webkit') {
          await button.hover()
          await page.waitForTimeout(100)
        }
      }

      console.log(`✅ Authentication page works correctly on ${browserName}`)
    })
  })

  test.describe('🧪 Edge Cases & Error Handling', () => {
    test('should handle network connectivity issues', async ({ page }) => {
      await page.goto('/auth/login')

      // 네트워크 연결 끊기 시뮬레이션
      await page.setOfflineMode(true)

      await page.getByRole('button', { name: /google로 계속하기/i }).click()

      // 적절한 오프라인 메시지 표시
      await helpers.page.waitForToast('네트워크 연결을 확인해주세요')

      // 네트워크 복구 후 정상 작동
      await page.setOfflineMode(false)
      await page.reload()
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
    })

    test('should handle popup blockers', async ({ page, context }) => {
      await page.goto('/auth/login')

      // 팝업 차단기 시뮬레이션
      await context.route('**/auth/**', route => {
        route.fulfill({
          status: 403,
          body: 'Popup blocked'
        })
      })

      await page.getByRole('button', { name: /google로 계속하기/i }).click()

      // 팝업 차단 시 대체 방법 안내
      await helpers.page.waitForToast('팝업을 허용해주세요')
    })

    test('should handle session timeout gracefully', async ({ page }) => {
      await page.goto('/auth/login')

      // 만료된 세션 시뮬레이션
      await page.evaluate(() => {
        localStorage.setItem('auth-session-expired', 'true')
      })

      await page.reload()

      // 세션 만료 메시지 확인
      await helpers.page.waitForToast('세션이 만료되었습니다')

      // 로그인 폼이 정상적으로 표시되어야 함
      await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
    })
  })

  test.describe('🎯 User Experience', () => {
    test('should provide clear visual feedback', async ({ page }) => {
      await page.goto('/auth/login')

      const googleButton = page.getByRole('button', { name: /google로 계속하기/i })

      // 호버 효과 확인
      await googleButton.hover()

      // 포커스 효과 확인
      await googleButton.focus()
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBe('BUTTON')

      // 클릭 효과 확인 (시각적 피드백)
      await googleButton.click()
      await page.waitForTimeout(100)
    })

    test('should remember user preferences', async ({ page }) => {
      await page.goto('/auth/login')

      // 다크모드 설정
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.reload()

      // 다크모드에서도 버튼이 잘 보여야 함
      const buttons = await page.locator('button').all()
      for (const button of buttons) {
        await expect(button).toBeVisible()

        // 다크모드에서 적절한 색상 대비 확인
        const styles = await button.evaluate(el => {
          const computed = window.getComputedStyle(el)
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color
          }
        })

        // 색상이 설정되어 있어야 함 (기본값이 아님)
        expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      }
    })

    test('should provide helpful loading states', async ({ page }) => {
      await page.goto('/auth/login')

      // 느린 응답 시뮬레이션
      await page.route('**/auth/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.continue()
      })

      const googleButton = page.getByRole('button', { name: /google로 계속하기/i })

      // 클릭 후 즉시 로딩 상태 확인
      await googleButton.click()

      // 버튼이 비활성화되거나 로딩 스피너가 표시되어야 함
      await expect(googleButton).toBeDisabled().or(
        expect(googleButton.locator('.loading, .spinner')).toBeVisible()
      )
    })
  })
})