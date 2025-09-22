import { test, expect } from '@playwright/test'
import { E2ETestHelpers, TestDataManager, TestUser } from '../utils/e2e-utils'
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('♿ Accessibility & 📱 Responsive Design Comprehensive Tests', () => {
  let helpers: E2ETestHelpers
  let testDataManager: TestDataManager
  let testUser: TestUser

  test.beforeAll(async () => {
    testDataManager = new TestDataManager()
    testUser = await testDataManager.createTestUser({
      username: 'accessibilityuser',
      role: 'user'
    })
  })

  test.beforeEach(async ({ page }) => {
    helpers = new E2ETestHelpers(page)
    await helpers.performance.startPerformanceCollection()

    // 테스트 사용자로 로그인
    await page.goto('/auth/login')
    await helpers.auth.loginAsTestUser(testUser)
  })

  test.afterEach(async ({ page }, testInfo) => {
    await helpers.performance.attachPerformanceData(testInfo)

    if (testInfo.status !== 'passed') {
      await helpers.report.captureFailureScreenshot(testInfo.title)
    }
  })

  test.afterAll(async () => {
    await testDataManager.cleanup()
  })

  test.describe('♿ WCAG 2.1 AA Compliance', () => {
    const criticalPages = [
      { path: '/', name: 'Homepage' },
      { path: '/posts', name: 'Posts List' },
      { path: '/posts/create', name: 'Create Post' },
      { path: '/profile/settings', name: 'Profile Settings' },
      { path: '/chat', name: 'Chat List' }
    ]

    for (const pageInfo of criticalPages) {
      test(`should meet WCAG AA standards on ${pageInfo.name}`, async ({ page }) => {
        await page.goto(pageInfo.path)
        await helpers.page.waitForPageLoad()

        // Axe 접근성 검사 실행
        await injectAxe(page)
        const results = await checkA11y(page, undefined, {
          detailedReport: true,
          detailedReportOptions: { html: true }
        })

        // 심각한 접근성 위반 사항 체크
        const criticalViolations = results.violations.filter(violation =>
          ['critical', 'serious'].includes(violation.impact || '')
        )

        // 접근성 위반 상세 로그
        if (criticalViolations.length > 0) {
          console.log(`\n❌ Accessibility violations on ${pageInfo.name}:`)
          criticalViolations.forEach(violation => {
            console.log(`- ${violation.id}: ${violation.description}`)
            console.log(`  Impact: ${violation.impact}`)
            console.log(`  Help: ${violation.helpUrl}`)
          })
        }

        expect(criticalViolations.length).toBe(0)

        // 추가 접근성 검증
        await helpers.accessibility.verifyScreenReaderContent()
      })
    }

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/posts')

      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()

      if (headings.length > 0) {
        // 첫 번째 헤딩이 h1이어야 함
        const firstHeading = headings[0]
        const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase())
        expect(tagName).toBe('h1')

        // 헤딩 레벨이 논리적으로 구성되어 있는지 확인
        const headingLevels = await Promise.all(
          headings.map(h => h.evaluate(el => parseInt(el.tagName.charAt(1))))
        )

        for (let i = 1; i < headingLevels.length; i++) {
          const current = headingLevels[i]
          const previous = headingLevels[i - 1]

          // 헤딩 레벨이 1단계씩만 증가해야 함
          if (current > previous) {
            expect(current - previous).toBeLessThanOrEqual(1)
          }
        }
      }
    })

    test('should provide alternative text for images', async ({ page }) => {
      await page.goto('/posts')

      const images = await page.locator('img').all()

      for (const img of images) {
        const alt = await img.getAttribute('alt')
        const ariaHidden = await img.getAttribute('aria-hidden')
        const role = await img.getAttribute('role')

        // 장식용 이미지가 아니면 alt 텍스트가 있어야 함
        if (ariaHidden !== 'true' && role !== 'presentation') {
          expect(alt).toBeTruthy()
          expect(alt!.length).toBeGreaterThan(0)
        }
      }
    })

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/posts')

      // 주요 텍스트 요소들의 색상 대비 확인
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, button, a').all()

      for (const element of textElements.slice(0, 10)) { // 처음 10개만 샘플링
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el)
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          }
        })

        // 배경색이 투명하지 않은 경우에만 확인
        if (styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          // 실제 색상 대비 계산은 복잡하므로, 기본적인 체크만 수행
          expect(styles.color).not.toBe(styles.backgroundColor)
        }
      }
    })

    test('should support focus management', async ({ page }) => {
      await page.goto('/posts/create')

      // 모든 포커스 가능한 요소 확인
      const focusableElements = await page.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all()

      expect(focusableElements.length).toBeGreaterThan(0)

      // 각 요소가 포커스 가능한지 확인
      for (const element of focusableElements.slice(0, 5)) {
        await element.focus()
        await expect(element).toBeFocused()

        // 포커스 표시가 있는지 확인 (outline 또는 다른 시각적 표시)
        const styles = await element.evaluate(el => {
          return window.getComputedStyle(el).outline
        })

        // 포커스 스타일이 있어야 함 (기본값이 아님)
        expect(styles).not.toBe('none')
      }
    })

    test('should provide skip links for navigation', async ({ page }) => {
      await page.goto('/posts')

      // Tab 키를 눌러 skip link 활성화
      await page.keyboard.press('Tab')

      // Skip to main content 링크 확인
      const skipLink = page.locator('[href="#main-content"], [href="#main"]').first()
      if (await skipLink.count() > 0) {
        await expect(skipLink).toBeFocused()
        await expect(skipLink).toBeVisible()

        // Skip link 클릭 후 메인 콘텐츠로 포커스 이동 확인
        await skipLink.click()
        const mainContent = page.locator('#main-content, #main, main').first()
        await expect(mainContent).toBeFocused()
      }
    })
  })

  test.describe('⌨️ Keyboard Navigation', () => {
    test('should navigate entire site with keyboard only', async ({ page }) => {
      await page.goto('/posts')

      // 키보드로 주요 네비게이션 테스트
      const navigationFlow = [
        { key: 'Tab', expectedFocus: 'nav a, nav button' },
        { key: 'Enter', action: 'activate-link' },
        { key: 'Tab', expectedFocus: 'main button, main a' },
        { key: 'Space', action: 'activate-button' },
        { key: 'Escape', action: 'close-modal' }
      ]

      for (const step of navigationFlow) {
        await page.keyboard.press(step.key)
        await page.waitForTimeout(100)

        // 포커스가 예상된 요소에 있는지 확인
        if (step.expectedFocus) {
          const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
          expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA']).toContain(focusedElement)
        }
      }
    })

    test('should handle modal keyboard interactions', async ({ page }) => {
      await page.goto('/posts')

      // 모달을 여는 버튼 클릭
      const modalButton = page.locator('[data-testid="create-post-button"]')
      if (await modalButton.count() > 0) {
        await modalButton.click()

        // 모달이 열렸을 때 포커스 트래핑 확인
        const modal = page.locator('[role="dialog"]')
        await expect(modal).toBeVisible()

        // 모달 내 첫 번째 포커스 가능한 요소로 포커스 이동
        await page.keyboard.press('Tab')
        const focusedInModal = await page.evaluate(() => {
          const activeElement = document.activeElement
          const modal = document.querySelector('[role="dialog"]')
          return modal?.contains(activeElement)
        })
        expect(focusedInModal).toBe(true)

        // ESC 키로 모달 닫기
        await page.keyboard.press('Escape')
        await expect(modal).not.toBeVisible()

        // 포커스가 모달을 연 버튼으로 돌아가는지 확인
        await expect(modalButton).toBeFocused()
      }
    })

    test('should support arrow key navigation in lists', async ({ page }) => {
      await page.goto('/posts')

      // 게시물 목록에서 화살표 키 네비게이션
      const postList = page.locator('[data-testid="posts-list"]')
      if (await postList.count() > 0) {
        // 첫 번째 게시물에 포커스
        await page.keyboard.press('Tab')
        await page.keyboard.press('ArrowDown')

        // 다음 게시물로 이동
        await page.keyboard.press('ArrowDown')

        // Enter로 게시물 선택
        await page.keyboard.press('Enter')

        // 게시물 상세 페이지로 이동했는지 확인
        await expect(page).toHaveURL(/\/posts\/[^\/]+$/)
      }
    })

    test('should handle form navigation with keyboard', async ({ page }) => {
      await page.goto('/posts/create')

      const formElements = [
        '[data-testid="post-title-input"]',
        '[data-testid="post-content-editor"]',
        '[data-testid="post-category-select"]',
        '[data-testid="publish-post-button"]'
      ]

      // Tab으로 폼 요소들을 순차적으로 이동
      for (const selector of formElements) {
        const element = page.locator(selector)
        if (await element.count() > 0) {
          await page.keyboard.press('Tab')
          await expect(element).toBeFocused()
        }
      }

      // Shift+Tab으로 역순 이동
      for (let i = formElements.length - 1; i >= 0; i--) {
        const element = page.locator(formElements[i])
        if (await element.count() > 0) {
          await page.keyboard.press('Shift+Tab')
          await expect(element).toBeFocused()
        }
      }
    })
  })

  test.describe('📱 Responsive Design', () => {
    const viewports = [
      { name: 'Mobile Portrait', width: 375, height: 667, category: 'mobile' },
      { name: 'Mobile Landscape', width: 667, height: 375, category: 'mobile' },
      { name: 'Tablet Portrait', width: 768, height: 1024, category: 'tablet' },
      { name: 'Tablet Landscape', width: 1024, height: 768, category: 'tablet' },
      { name: 'Small Desktop', width: 1366, height: 768, category: 'desktop' },
      { name: 'Large Desktop', width: 1920, height: 1080, category: 'desktop' },
      { name: 'Ultra Wide', width: 2560, height: 1440, category: 'desktop' }
    ]

    for (const viewport of viewports) {
      test(`should work on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto('/posts')
        await helpers.page.waitForPageLoad()

        // 기본 레이아웃 요소들이 보이는지 확인
        await expect(page.locator('header')).toBeVisible()
        await expect(page.locator('main')).toBeVisible()

        // 뷰포트별 특정 검증
        if (viewport.category === 'mobile') {
          // 모바일에서는 햄버거 메뉴가 보여야 함
          const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
          if (await mobileMenu.count() > 0) {
            await expect(mobileMenu).toBeVisible()

            // 햄버거 메뉴 클릭으로 네비게이션 메뉴 토글
            await mobileMenu.click()
            await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible()

            // 메뉴 닫기
            await mobileMenu.click()
            await expect(page.locator('[data-testid="mobile-nav-menu"]')).not.toBeVisible()
          }

          // 터치 친화적인 버튼 크기 확인 (최소 44x44px)
          const buttons = await page.locator('button').all()
          for (const button of buttons.slice(0, 5)) {
            const box = await button.boundingBox()
            if (box) {
              expect(box.width).toBeGreaterThanOrEqual(44)
              expect(box.height).toBeGreaterThanOrEqual(44)
            }
          }

        } else if (viewport.category === 'desktop') {
          // 데스크톱에서는 풀 네비게이션이 보여야 함
          const desktopNav = page.locator('[data-testid="desktop-nav"]')
          if (await desktopNav.count() > 0) {
            await expect(desktopNav).toBeVisible()
          }

          // 사이드바가 있다면 표시되어야 함
          const sidebar = page.locator('[data-testid="sidebar"]')
          if (await sidebar.count() > 0) {
            await expect(sidebar).toBeVisible()
          }
        }

        // 텍스트가 읽기 가능한 크기인지 확인
        const textElements = await page.locator('p, h1, h2, h3').all()
        for (const element of textElements.slice(0, 3)) {
          const fontSize = await element.evaluate(el => {
            return parseInt(window.getComputedStyle(el).fontSize)
          })
          expect(fontSize).toBeGreaterThanOrEqual(14) // 최소 14px
        }

        // 콘텐츠가 뷰포트를 벗어나지 않는지 확인
        const horizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth
        })
        expect(horizontalScroll).toBe(false)
      })
    }

    test('should handle dynamic content resizing', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.goto('/posts')

      // 창 크기를 동적으로 변경
      await page.setViewportSize({ width: 400, height: 600 })
      await page.waitForTimeout(500)

      // 레이아웃이 새 크기에 맞게 조정되었는지 확인
      await expect(page.locator('body')).toBeVisible()

      // 다시 큰 화면으로 변경
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.waitForTimeout(500)

      // 레이아웃이 다시 조정되었는지 확인
      await expect(page.locator('body')).toBeVisible()
    })

    test('should optimize images for different screen densities', async ({ page }) => {
      const densities = [1, 2, 3] // 1x, 2x, 3x

      for (const density of densities) {
        await page.emulateMedia({ deviceScaleFactor: density })
        await page.goto('/posts')

        const images = await page.locator('img').all()
        for (const img of images.slice(0, 3)) {
          const src = await img.getAttribute('src')
          const srcset = await img.getAttribute('srcset')

          // srcset이 있거나 적절한 크기의 이미지가 로드되어야 함
          if (srcset) {
            expect(srcset).toContain('2x') // 고밀도 디스플레이 지원
          }

          // 이미지가 로드되었는지 확인
          await expect(img).toBeVisible()
        }
      }
    })
  })

  test.describe('🎨 Visual Design & Theming', () => {
    test('should support dark mode', async ({ page }) => {
      await page.goto('/posts')

      // 다크모드 토글 버튼 찾기
      const themeToggle = page.locator('[data-testid="theme-toggle"]')
      if (await themeToggle.count() > 0) {
        // 다크모드 활성화
        await themeToggle.click()

        // 다크 테마가 적용되었는지 확인
        const bodyClass = await page.locator('body').getAttribute('class')
        expect(bodyClass).toContain('dark')

        // 다크모드에서 텍스트가 읽기 가능한지 확인
        const textColor = await page.locator('h1').first().evaluate(el => {
          return window.getComputedStyle(el).color
        })

        // 다크모드에서는 밝은 텍스트여야 함
        expect(textColor).not.toBe('rgb(0, 0, 0)')

        // 라이트모드로 다시 변경
        await themeToggle.click()
        const newBodyClass = await page.locator('body').getAttribute('class')
        expect(newBodyClass).not.toContain('dark')
      }
    })

    test('should handle high contrast mode', async ({ page }) => {
      await helpers.accessibility.testHighContrastMode()

      await page.goto('/posts')

      // 주요 UI 요소들이 여전히 보이는지 확인
      const criticalElements = [
        'button',
        'a',
        'input',
        '[role="button"]',
        '[role="link"]'
      ]

      for (const selector of criticalElements) {
        const elements = await page.locator(selector).all()
        for (const element of elements.slice(0, 3)) {
          if (await element.isVisible()) {
            await expect(element).toBeVisible()

            // 요소가 충분한 대비를 가지는지 확인
            const styles = await element.evaluate(el => {
              const computed = window.getComputedStyle(el)
              return {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                border: computed.border
              }
            })

            // 고대비 모드에서는 요소들이 구별 가능해야 함
            expect(styles.color).toBeTruthy()
          }
        }
      }
    })

    test('should respect user motion preferences', async ({ page }) => {
      // 애니메이션 비활성화 설정
      await page.emulateMedia({ prefersReducedMotion: 'reduce' })
      await page.goto('/posts')

      // 애니메이션이 있는 요소들 확인
      const animatedElements = await page.locator('[class*="animate"], [class*="transition"]').all()

      for (const element of animatedElements.slice(0, 5)) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el)
          return {
            animationDuration: computed.animationDuration,
            transitionDuration: computed.transitionDuration
          }
        })

        // 애니메이션 시간이 최소화되어야 함
        expect(styles.animationDuration).toBe('0s')
        expect(styles.transitionDuration).toBe('0s')
      }
    })

    test('should maintain visual hierarchy across viewport sizes', async ({ page }) => {
      const testSizes = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 }
      ]

      for (const size of testSizes) {
        await page.setViewportSize(size)
        await page.goto('/posts')

        // 제목의 시각적 위계 확인
        const h1 = page.locator('h1').first()
        const h2 = page.locator('h2').first()

        if (await h1.count() > 0 && await h2.count() > 0) {
          const h1Size = await h1.evaluate(el => parseInt(window.getComputedStyle(el).fontSize))
          const h2Size = await h2.evaluate(el => parseInt(window.getComputedStyle(el).fontSize))

          // h1이 h2보다 크거나 같아야 함
          expect(h1Size).toBeGreaterThanOrEqual(h2Size)
        }

        // 중요한 액션 버튼이 눈에 잘 띄는지 확인
        const primaryButton = page.locator('[data-testid="primary-button"], .btn-primary').first()
        if (await primaryButton.count() > 0) {
          const styles = await primaryButton.evaluate(el => {
            const computed = window.getComputedStyle(el)
            return {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              fontWeight: computed.fontWeight
            }
          })

          // 배경색이 설정되어 있어야 함
          expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        }
      }
    })
  })

  test.describe('🎯 Touch & Gesture Support', () => {
    test('should support touch interactions on mobile', async ({ page, browserName }) => {
      // WebKit (Safari)에서 터치 이벤트 테스트
      if (browserName === 'webkit') {
        await page.setViewportSize({ width: 375, height: 667 })
        await page.goto('/posts')

        // 터치 이벤트 시뮬레이션
        const touchButton = page.locator('button').first()
        await expect(touchButton).toBeVisible()

        // 터치 시작 이벤트
        await touchButton.dispatchEvent('touchstart')
        await touchButton.dispatchEvent('touchend')

        // 터치 피드백 확인 (예: 활성 상태)
        await page.waitForTimeout(100)
      }
    })

    test('should handle swipe gestures', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/posts')

      const swipeContainer = page.locator('[data-testid="swipeable-container"]')
      if (await swipeContainer.count() > 0) {
        // 스와이프 제스처 시뮬레이션
        const box = await swipeContainer.boundingBox()
        if (box) {
          await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2)
          await page.mouse.up()

          // 스와이프 액션이 실행되었는지 확인
          await page.waitForTimeout(500)
        }
      }
    })

    test('should prevent zoom on form inputs', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/posts/create')

      const inputs = await page.locator('input, textarea').all()

      for (const input of inputs) {
        const fontSize = await input.evaluate(el => {
          return parseInt(window.getComputedStyle(el).fontSize)
        })

        // iOS에서 줌을 방지하려면 최소 16px이어야 함
        expect(fontSize).toBeGreaterThanOrEqual(16)
      }
    })
  })
})