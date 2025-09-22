import { test, expect } from '@playwright/test'

test.describe('인증 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/auth/login')
  })

  test('로그인 페이지가 올바르게 렌더링되어야 한다', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/로그인|Login|Team Hub/)

    // 소셜 로그인 버튼들이 보여야 함
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /github로 계속하기/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /kakao로 계속하기/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /naver로 계속하기/i })).toBeVisible()
  })

  test('소셜 로그인 버튼들이 클릭 가능해야 한다', async ({ page }) => {
    const googleButton = page.getByRole('button', { name: /google로 계속하기/i })
    const githubButton = page.getByRole('button', { name: /github로 계속하기/i })
    const kakaoButton = page.getByRole('button', { name: /kakao로 계속하기/i })
    const naverButton = page.getByRole('button', { name: /naver로 계속하기/i })

    // 버튼들이 활성화되어 있어야 함
    await expect(googleButton).toBeEnabled()
    await expect(githubButton).toBeEnabled()
    await expect(kakaoButton).toBeEnabled()
    await expect(naverButton).toBeEnabled()

    // 버튼들이 클릭 가능해야 함 (실제로 클릭하지는 않음)
    await expect(googleButton).toBeVisible()
    await expect(githubButton).toBeVisible()
    await expect(kakaoButton).toBeVisible()
    await expect(naverButton).toBeVisible()
  })

  test('키보드 네비게이션이 가능해야 한다', async ({ page }) => {
    // Tab 키로 네비게이션
    await page.keyboard.press('Tab')

    // 첫 번째 버튼이 포커스되어야 함
    const googleButton = page.getByRole('button', { name: /google로 계속하기/i })
    await expect(googleButton).toBeFocused()

    // 다음 버튼으로 이동
    await page.keyboard.press('Tab')
    const githubButton = page.getByRole('button', { name: /github로 계속하기/i })
    await expect(githubButton).toBeFocused()

    // Enter 키로 버튼 활성화 가능 (실제 OAuth는 테스트하지 않음)
    await expect(githubButton).toBeVisible()
  })

  test('반응형 디자인이 적용되어야 한다', async ({ page }) => {
    // 데스크탑 크기
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()

    // 태블릿 크기
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()

    // 모바일 크기
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
  })

  test('다크모드에서도 정상 작동해야 한다', async ({ page }) => {
    // 다크모드 설정 (시스템 설정을 다크모드로)
    await page.emulateMedia({ colorScheme: 'dark' })

    // 새로고침 후 버튼들이 여전히 보여야 함
    await page.reload()
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /github로 계속하기/i })).toBeVisible()
  })

  test('페이지 로딩 성능이 양호해야 한다', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // 페이지 로딩이 3초 이내에 완료되어야 함
    expect(loadTime).toBeLessThan(3000)

    // 버튼들이 모두 렌더링되어야 함
    await expect(page.getByRole('button', { name: /google로 계속하기/i })).toBeVisible()
  })
})

test.describe('접근성 테스트', () => {
  test('로그인 페이지 접근성 검증', async ({ page }) => {
    await page.goto('/auth/login')

    // 기본적인 접근성 검증
    // 1. 모든 버튼에 적절한 레이블이 있어야 함
    const buttons = await page.locator('button').all()
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label')
      const textContent = await button.textContent()

      // aria-label이나 텍스트 내용 중 하나는 있어야 함
      expect(ariaLabel || textContent).toBeTruthy()
    }

    // 2. 이미지/아이콘에 적절한 alt 텍스트나 aria-hidden이 있어야 함
    const svgs = await page.locator('svg').all()
    for (const svg of svgs) {
      const ariaHidden = await svg.getAttribute('aria-hidden')
      const ariaLabel = await svg.getAttribute('aria-label')
      const role = await svg.getAttribute('role')

      // 장식용 아이콘은 aria-hidden="true"이거나 적절한 레이블이 있어야 함
      expect(ariaHidden === 'true' || ariaLabel || role).toBeTruthy()
    }
  })

  test('고대비 모드에서도 정상 작동해야 한다', async ({ page }) => {
    // 고대비 모드 시뮬레이션
    await page.emulateMedia({ forcedColors: 'active' })

    await page.goto('/auth/login')

    // 버튼들이 여전히 보이고 클릭 가능해야 함
    const buttons = [
      page.getByRole('button', { name: /google로 계속하기/i }),
      page.getByRole('button', { name: /github로 계속하기/i }),
      page.getByRole('button', { name: /kakao로 계속하기/i }),
      page.getByRole('button', { name: /naver로 계속하기/i })
    ]

    for (const button of buttons) {
      await expect(button).toBeVisible()
      await expect(button).toBeEnabled()
    }
  })
})