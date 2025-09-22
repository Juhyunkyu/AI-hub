import { test, expect } from '@playwright/test'
import { TestDataManager, AuthHelpers, PageHelpers, TestReportHelpers } from '../utils/e2e-utils'
import { accessibility } from '../utils/setup-accessibility'

test.describe('관리자 기능 E2E 테스트', () => {
  let testDataManager: TestDataManager
  let authHelpers: AuthHelpers
  let pageHelpers: PageHelpers
  let reportHelpers: TestReportHelpers
  let adminUser: any
  let regularUser: any

  test.beforeAll(async () => {
    testDataManager = new TestDataManager()

    // 관리자 사용자 생성
    adminUser = await testDataManager.createTestUser({
      username: 'admin-user',
      role: 'admin'
    })

    // 일반 사용자 생성
    regularUser = await testDataManager.createTestUser({
      username: 'regular-user',
      role: 'user'
    })
  })

  test.afterAll(async () => {
    await testDataManager.cleanup()
  })

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
    pageHelpers = new PageHelpers(page)
    reportHelpers = new TestReportHelpers(page)
  })

  test.describe('관리자 인증 및 접근 제어', () => {
    test('관리자로 로그인하여 관리자 패널에 접근할 수 있어야 한다', async ({ page }) => {
      await authHelpers.loginAsTestUser(adminUser)
      await pageHelpers.navigateAndWait('/admin-panel')

      // 관리자 패널 페이지가 로드되었는지 확인
      await expect(page.getByRole('heading', { name: /관리자 패널|admin panel|dashboard/i })).toBeVisible()

      // 관리자 메뉴들이 표시되는지 확인
      await expect(page.getByRole('link', { name: /사용자 관리|user management/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /게시물 관리|post management/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /통계|statistics|analytics/i })).toBeVisible()
    })

    test('일반 사용자는 관리자 패널에 접근할 수 없어야 한다', async ({ page }) => {
      await authHelpers.loginAsTestUser(regularUser)

      // 관리자 패널 접근 시도
      await page.goto('/admin-panel')

      // 접근 거부 또는 홈페이지로 리다이렉트되어야 함
      await expect(page.getByText(/접근 권한이 없습니다|access denied|unauthorized/i)).toBeVisible()
        .or(expect(page).toHaveURL('/'))
    })
  })
})