import { test } from '@playwright/test'
import { injectAxe, checkA11y } from '@axe-core/playwright'

// Extend Playwright's expect with axe matchers
test.beforeEach(async ({ page }) => {
  // axe-core를 각 페이지에 주입
  await injectAxe(page)
})

// 전역 접근성 테스트 헬퍼 함수들을 추가
export const accessibility = {
  /**
   * 페이지 전체의 접근성을 검사합니다
   */
  async checkPageA11y(page: any, options?: any) {
    await checkA11y(page, null, {
      axeOptions: {
        rules: {
          // 색상 대비 검사 활성화
          'color-contrast': { enabled: true },
          // 키보드 접근성 검사
          'keyboard': { enabled: true },
          // 스크린 리더 호환성 검사
          'aria-valid-attr-value': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-required-attr': { enabled: true },
          // 포커스 관리 검사
          'focus-order-semantics': { enabled: true },
          'focusable-content': { enabled: true },
          // 제목 구조 검사
          'heading-order': { enabled: true },
          // 이미지 alt 텍스트 검사
          'image-alt': { enabled: true },
          // 폼 레이블 검사
          'label': { enabled: true },
          // 링크 접근성 검사
          'link-name': { enabled: true }
        },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      },
      ...options
    })
  },

  /**
   * 특정 요소의 접근성을 검사합니다
   */
  async checkElementA11y(page: any, selector: string, options?: any) {
    await checkA11y(page, selector, {
      axeOptions: {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      },
      ...options
    })
  },

  /**
   * 키보드 네비게이션을 테스트합니다
   */
  async testKeyboardNavigation(page: any, selectors: string[]) {
    // Tab으로 순회 가능한 요소들을 테스트
    for (let i = 0; i < selectors.length; i++) {
      await page.keyboard.press('Tab')
      const element = page.locator(selectors[i])
      await expect(element).toBeFocused()
    }
  },

  /**
   * 스크린 리더 호환성을 테스트합니다
   */
  async testScreenReaderCompatibility(page: any) {
    // aria-label, aria-describedby 등의 속성이 올바르게 설정되었는지 확인
    const interactiveElements = await page.locator('button, a, input, select, textarea').all()

    for (const element of interactiveElements) {
      const ariaLabel = await element.getAttribute('aria-label')
      const ariaLabelledBy = await element.getAttribute('aria-labelledby')
      const textContent = await element.textContent()
      const placeholderText = await element.getAttribute('placeholder')

      // 접근 가능한 이름이 있는지 확인
      const hasAccessibleName = ariaLabel || ariaLabelledBy || textContent?.trim() || placeholderText
      expect(hasAccessibleName).toBeTruthy()
    }
  }
}

// WCAG 준수를 위한 색상 대비 검사
export const colorContrast = {
  /**
   * 색상 대비 비율을 확인합니다 (WCAG AA 기준: 4.5:1)
   */
  async checkContrastRatio(page: any, selector: string, expectedRatio = 4.5) {
    await checkA11y(page, selector, {
      axeOptions: {
        rules: {
          'color-contrast': { enabled: true }
        }
      },
      tags: ['wcag2aa']
    })
  }
}

// 모바일 접근성 테스트
export const mobileAccessibility = {
  /**
   * 터치 타겟 크기를 검사합니다 (최소 44x44px)
   */
  async checkTouchTargetSize(page: any) {
    const touchTargets = await page.locator('button, a, input[type="button"], input[type="submit"]').all()

    for (const target of touchTargets) {
      const box = await target.boundingBox()
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
  },

  /**
   * 확대/축소 기능을 테스트합니다
   */
  async testZoomCapability(page: any) {
    // 페이지가 200%까지 확대 가능한지 테스트
    await page.setViewportSize({ width: 640, height: 480 })

    // meta viewport 태그 확인
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewportMeta).not.toContain('user-scalable=no')
    expect(viewportMeta).not.toContain('maximum-scale=1')
  }
}