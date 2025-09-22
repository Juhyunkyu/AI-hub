import { test, expect } from '@playwright/test'

/**
 * 이모지 모달 UX 문제 재현 및 수정 검증 테스트
 * 문제: 댓글 작성 시 이모지 모달이 위로 올라와서 텍스트 영역을 가림
 */
test.describe('댓글 이모지 모달 UX 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 개발 서버 접속
    await page.goto('/')

    // 로그인 필요시 로그인 로직 추가
    // (로그인 페이지가 있다면 여기서 로그인 처리)
  })

  test('현재 이모지 모달 위치 문제 재현', async ({ page }) => {
    // 게시물 페이지로 이동 (댓글을 작성할 수 있는 페이지)
    await page.goto('/posts')

    // 첫 번째 게시물 클릭 (게시물 상세 페이지로 이동)
    const firstPost = page.locator('[data-testid="post-item"]').first()
    if (await firstPost.count() > 0) {
      await firstPost.click()
    } else {
      // 게시물이 없으면 직접 URL로 이동
      console.log('게시물이 없어서 메인 페이지에서 테스트 진행')
    }

    // 댓글 작성 영역 찾기
    const commentTextarea = page.locator('textarea[placeholder*="댓글"]')
    await expect(commentTextarea).toBeVisible()

    // 댓글 작성 영역에 포커스
    await commentTextarea.focus()

    // 이모지 버튼 찾기 및 클릭
    const emojiButton = page.locator('button:has-text("이모지")')
    await expect(emojiButton).toBeVisible()

    // 현재 상태 스크린샷 (문제 상황 전)
    await page.screenshot({
      path: 'test-results/emoji-modal-before.png',
      fullPage: true
    })

    // 이모지 버튼 클릭
    await emojiButton.click()

    // 이모지 팝오버가 열렸는지 확인
    const emojiPopover = page.locator('[role="dialog"], .popover-content')
    await expect(emojiPopover).toBeVisible()

    // 문제 상황 스크린샷 (모달이 열린 상태)
    await page.screenshot({
      path: 'test-results/emoji-modal-problem.png',
      fullPage: true
    })

    // 이모지 팝오버의 위치 확인
    const popoverBounds = await emojiPopover.boundingBox()
    const textareaBounds = await commentTextarea.boundingBox()

    console.log('이모지 팝오버 위치:', popoverBounds)
    console.log('댓글 텍스트 영역 위치:', textareaBounds)

    // 팝오버가 텍스트 영역을 가리는지 확인
    if (popoverBounds && textareaBounds) {
      const isOverlapping = (
        popoverBounds.y < textareaBounds.y + textareaBounds.height &&
        popoverBounds.y + popoverBounds.height > textareaBounds.y &&
        popoverBounds.x < textareaBounds.x + textareaBounds.width &&
        popoverBounds.x + popoverBounds.width > textareaBounds.x
      )

      console.log('모달이 텍스트 영역과 겹치는가?', isOverlapping)

      // 현재는 문제가 있다고 가정하고 테스트
      expect(isOverlapping).toBe(true) // 문제 재현 확인
    }

    // 이모지 선택해보기
    const firstEmoji = page.locator('button:has-text("😀")').first()
    if (await firstEmoji.count() > 0) {
      await firstEmoji.click()

      // 이모지가 텍스트에 추가되었는지 확인 (하지만 가려져서 보기 어려울 것)
      const textareaValue = await commentTextarea.inputValue()
      expect(textareaValue).toContain('😀')

      // 이모지 선택 후 스크린샷
      await page.screenshot({
        path: 'test-results/emoji-selected-but-hidden.png',
        fullPage: true
      })
    }
  })

  test('다양한 뷰포트에서 이모지 모달 문제 확인', async ({ page }) => {
    // 모바일 뷰포트에서 테스트
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE 크기

    await page.goto('/')

    const commentTextarea = page.locator('textarea[placeholder*="댓글"]')
    if (await commentTextarea.count() > 0) {
      await commentTextarea.scrollIntoViewIfNeeded()

      const emojiButton = page.locator('button:has-text("이모지")')
      await emojiButton.click()

      await page.screenshot({
        path: 'test-results/emoji-modal-mobile-problem.png',
        fullPage: true
      })

      // 모바일에서는 더 심각할 것으로 예상
      const emojiPopover = page.locator('[role="dialog"], .popover-content')
      await expect(emojiPopover).toBeVisible()
    }
  })

  test('접근성 확인 - 키보드 네비게이션', async ({ page }) => {
    await page.goto('/')

    const commentTextarea = page.locator('textarea[placeholder*="댓글"]')
    if (await commentTextarea.count() > 0) {
      // Tab으로 이모지 버튼까지 이동
      await page.keyboard.press('Tab') // 다른 요소들 건너뛰기
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Enter로 이모지 모달 열기
      await page.keyboard.press('Enter')

      // 키보드로 이모지 선택 가능한지 확인
      await page.keyboard.press('Tab') // 첫 번째 이모지로 이동
      await page.keyboard.press('Enter') // 이모지 선택

      // 포커스가 다시 텍스트 영역으로 돌아왔는지 확인
      const focusedElement = page.locator(':focus')
      const textareaFocused = await commentTextarea.evaluate(
        (el, focusedEl) => el === focusedEl,
        await focusedElement.elementHandle()
      )

      // 현재는 포커스 복원이 안될 가능성이 높음
      console.log('이모지 선택 후 텍스트 영역 포커스 복원:', textareaFocused)
    }
  })
})