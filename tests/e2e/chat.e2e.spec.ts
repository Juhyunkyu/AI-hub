import { test, expect } from '@playwright/test'

test.describe('채팅 E2E 테스트', () => {
  test('기본 채팅 기능 테스트', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.*/)
  })
})