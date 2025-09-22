import { test, expect } from '@playwright/test'
import { TestDataManager, AuthHelpers, PageHelpers } from '../utils/e2e-utils'
import { accessibility, colorContrast, mobileAccessibility } from '../utils/setup-accessibility'
import { injectAxe, checkA11y } from '@axe-core/playwright'

test.describe('고급 접근성 테스트 (WCAG 준수 검증)', () => {
  let testDataManager: TestDataManager
  let authHelpers: AuthHelpers
  let pageHelpers: PageHelpers

  test.beforeEach(async ({ page }) => {
    testDataManager = new TestDataManager()
    authHelpers = new AuthHelpers(page)
    pageHelpers = new PageHelpers(page)

    // axe-core 주입
    await injectAxe(page)
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test.describe('WCAG 2.1 AA 준수 검증', () => {
    test('홈페이지 WCAG 2.1 AA 준수 검증', async ({ page }) => {
      await pageHelpers.navigateAndWait('/')

      // WCAG 2.1 AA 레벨 규칙으로 접근성 검사
      await checkA11y(page, null, {
        axeOptions: {
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
          rules: {
            // 색상과 대비
            'color-contrast': { enabled: true },
            'color-contrast-enhanced': { enabled: false }, // AAA 레벨은 제외

            // 키보드 접근성
            'keyboard': { enabled: true },
            'focus-order-semantics': { enabled: true },
            'focusable-content': { enabled: true },

            // 이미지와 미디어
            'image-alt': { enabled: true },
            'object-alt': { enabled: true },
            'audio-caption': { enabled: true },

            // 폼 접근성
            'label': { enabled: true },
            'label-title-only': { enabled: true },
            'form-field-multiple-labels': { enabled: true },

            // 링크와 버튼
            'link-name': { enabled: true },
            'button-name': { enabled: true },
            'link-in-text-block': { enabled: true },

            // 제목 구조
            'heading-order': { enabled: true },
            'empty-heading': { enabled: true },

            // ARIA 사용
            'aria-valid-attr': { enabled: true },
            'aria-valid-attr-value': { enabled: true },
            'aria-required-attr': { enabled: true },
            'aria-roles': { enabled: true },

            // 언어 식별
            'html-has-lang': { enabled: true },
            'html-lang-valid': { enabled: true },

            // 페이지 제목
            'document-title': { enabled: true },

            // 중복 콘텐츠
            'duplicate-id': { enabled: true },
            'duplicate-id-active': { enabled: true },
            'duplicate-id-aria': { enabled: true }
          }
        },
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      })
    })

    test('로그인 페이지 WCAG 2.1 AA 준수 검증', async ({ page }) => {
      await pageHelpers.navigateAndWait('/auth/login')

      await checkA11y(page, null, {
        axeOptions: {
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
        }
      })
    })

    test('게시물 목록 페이지 WCAG 2.1 AA 준수 검증', async ({ page }) => {
      // 테스트 사용자 및 게시물 생성
      const testUser = await testDataManager.createTestUser()
      await testDataManager.createTestPost({
        title: '접근성 테스트 게시물',
        content: '<p>접근성을 확인할 게시물</p>',
        author_id: testUser.id
      })

      await pageHelpers.navigateAndWait('/posts')

      await checkA11y(page, null, {
        axeOptions: {
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
        }
      })
    })

    test('채팅 페이지 WCAG 2.1 AA 준수 검증', async ({ page }) => {
      const testUser = await testDataManager.createTestUser()
      await authHelpers.loginAsTestUser(testUser)

      await pageHelpers.navigateAndWait('/chat')

      await checkA11y(page, null, {
        axeOptions: {
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
        }
      })
    })
  })

  test.describe('키보드 접근성 테스트', () => {
    test('Tab 키로 모든 상호작용 요소에 접근할 수 있어야 한다', async ({ page }) => {
      await pageHelpers.navigateAndWait('/')

      // 페이지의 모든 포커스 가능한 요소 수집
      const focusableElements = await page.locator(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all()

      console.log(`Found ${focusableElements.length} focusable elements`)

      // Tab 키로 순차적으로 이동하면서 각 요소가 포커스되는지 확인
      for (let i = 0; i < Math.min(focusableElements.length, 20); i++) { // 처음 20개만 테스트
        await page.keyboard.press('Tab')

        // 현재 포커스된 요소 확인
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeVisible()

        // 포커스 표시가 명확한지 확인
        const focusedElementHandle = await focusedElement.elementHandle()
        const styles = await focusedElementHandle?.evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            outline: computed.outline,
            outlineOffset: computed.outlineOffset,
            boxShadow: computed.boxShadow
          }
        })

        // 포커스 표시가 있는지 확인 (outline 또는 box-shadow)
        const hasFocusIndicator = styles && (
          styles.outline !== 'none' && styles.outline !== '' ||
          styles.boxShadow !== 'none' && styles.boxShadow !== ''
        )

        expect(hasFocusIndicator).toBeTruthy()
      }
    })

    test('Shift+Tab으로 역순 네비게이션이 가능해야 한다', async ({ page }) => {
      await pageHelpers.navigateAndWait('/')

      // 몇 번 Tab으로 이동
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      const forwardElement = page.locator(':focus')
      const forwardElementText = await forwardElement.textContent()

      // Shift+Tab으로 뒤로 이동
      await page.keyboard.press('Shift+Tab')

      const backwardElement = page.locator(':focus')
      const backwardElementText = await backwardElement.textContent()

      // 다른 요소로 이동했는지 확인
      expect(backwardElementText).not.toBe(forwardElementText)
    })
  })
})