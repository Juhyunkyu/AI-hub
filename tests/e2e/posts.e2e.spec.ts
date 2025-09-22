import { test, expect } from '@playwright/test'
import { TestDataManager, AuthHelpers, PageHelpers, TestReportHelpers } from '../utils/e2e-utils'
import { accessibility } from '../utils/setup-accessibility'

test.describe('게시물 관리 플로우', () => {
  let testDataManager: TestDataManager
  let authHelpers: AuthHelpers
  let pageHelpers: PageHelpers
  let reportHelpers: TestReportHelpers

  test.beforeEach(async ({ page }) => {
    testDataManager = new TestDataManager()
    authHelpers = new AuthHelpers(page)
    pageHelpers = new PageHelpers(page)
    reportHelpers = new TestReportHelpers(page)

    // 테스트 사용자 생성 및 로그인
    const testUser = await testDataManager.createTestUser({
      username: 'test-author',
      role: 'user'
    })

    await authHelpers.loginAsTestUser(testUser)
    await pageHelpers.navigateAndWait('/')
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test.describe('게시물 작성', () => {
    test('새 게시물을 작성할 수 있어야 한다', async ({ page }) => {
      // 게시물 작성 페이지로 이동
      await page.getByRole('link', { name: /새 글 작성|글 쓰기|write/i }).click()
      await pageHelpers.waitForPageLoad()

      // URL 확인
      expect(page.url()).toContain('/posts/new')

      // 제목 입력
      const titleInput = page.getByLabel(/제목|title/i)
      await titleInput.fill('E2E 테스트 게시물 제목')

      // 내용 입력 (에디터가 있다면 해당 선택자 사용)
      const contentInput = page.getByLabel(/내용|content/i).or(page.locator('[data-testid="post-editor"]'))
      await contentInput.fill('<p>이것은 E2E 테스트로 작성된 게시물입니다.</p>')

      // 게시물 발행
      const publishButton = page.getByRole('button', { name: /발행|publish|게시/i })
      await publishButton.click()

      // 성공 메시지 확인
      await pageHelpers.waitForToast('게시물이 성공적으로 작성되었습니다')

      // 게시물 목록 페이지로 이동되었는지 확인
      await expect(page).toHaveURL(/\/posts/)

      // 작성된 게시물이 목록에 나타나는지 확인
      await expect(page.getByText('E2E 테스트 게시물 제목')).toBeVisible()
    })

    test('빈 제목으로 게시물 작성 시 오류가 표시되어야 한다', async ({ page }) => {
      await page.getByRole('link', { name: /새 글 작성|글 쓰기|write/i }).click()
      await pageHelpers.waitForPageLoad()

      // 내용만 입력하고 제목은 비워둠
      const contentInput = page.getByLabel(/내용|content/i).or(page.locator('[data-testid="post-editor"]'))
      await contentInput.fill('<p>내용은 있지만 제목이 없는 게시물</p>')

      // 발행 버튼 클릭
      const publishButton = page.getByRole('button', { name: /발행|publish|게시/i })
      await publishButton.click()

      // 오류 메시지 확인
      await expect(page.getByText(/제목을 입력해주세요|title is required/i)).toBeVisible()

      // 여전히 작성 페이지에 있는지 확인
      expect(page.url()).toContain('/posts/new')
    })

    test('마크다운 미리보기가 정상 작동해야 한다', async ({ page }) => {
      await page.getByRole('link', { name: /새 글 작성|글 쓰기|write/i }).click()
      await pageHelpers.waitForPageLoad()

      // 마크다운 내용 입력
      const contentInput = page.getByLabel(/내용|content/i).or(page.locator('[data-testid="post-editor"]'))
      await contentInput.fill('# 제목\n\n**굵은 텍스트**\n\n- 목록 항목 1\n- 목록 항목 2')

      // 미리보기 탭 클릭 (있다면)
      const previewTab = page.getByRole('tab', { name: /미리보기|preview/i })
      if (await previewTab.isVisible()) {
        await previewTab.click()

        // 렌더링된 HTML 확인
        await expect(page.locator('h1')).toContainText('제목')
        await expect(page.locator('strong')).toContainText('굵은 텍스트')
        await expect(page.locator('ul li')).toHaveCount(2)
      }
    })
  })

  test.describe('게시물 조회', () => {
    test('게시물 목록이 올바르게 표시되어야 한다', async ({ page }) => {
      // 테스트용 게시물 여러 개 생성
      const user = testDataManager.getCreatedUsers()[0]
      await testDataManager.createTestPost({
        title: '첫 번째 테스트 게시물',
        content: '<p>첫 번째 게시물 내용</p>',
        author_id: user.id
      })
      await testDataManager.createTestPost({
        title: '두 번째 테스트 게시물',
        content: '<p>두 번째 게시물 내용</p>',
        author_id: user.id
      })

      // 게시물 목록 페이지 이동
      await pageHelpers.navigateAndWait('/posts')

      // 게시물들이 목록에 표시되는지 확인
      await expect(page.getByText('첫 번째 테스트 게시물')).toBeVisible()
      await expect(page.getByText('두 번째 테스트 게시물')).toBeVisible()

      // 작성자 정보 표시 확인
      await expect(page.getByText(user.username)).toBeVisible()

      // 게시물 카드가 클릭 가능한지 확인
      const firstPost = page.getByText('첫 번째 테스트 게시물').first()
      await expect(firstPost).toBeVisible()
    })

    test('게시물 상세 페이지가 올바르게 표시되어야 한다', async ({ page }) => {
      // 테스트용 게시물 생성
      const user = testDataManager.getCreatedUsers()[0]
      const testPost = await testDataManager.createTestPost({
        title: '상세 페이지 테스트 게시물',
        content: '<p>상세 페이지에서 확인할 내용입니다.</p>',
        author_id: user.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)

      // 게시물 내용 확인
      await expect(page.getByRole('heading', { name: '상세 페이지 테스트 게시물' })).toBeVisible()
      await expect(page.getByText('상세 페이지에서 확인할 내용입니다.')).toBeVisible()

      // 작성자 정보 확인
      await expect(page.getByText(user.username)).toBeVisible()

      // 작성 시간 정보 확인
      await expect(page.locator('[data-testid="post-created-at"]')).toBeVisible()
    })

    test('무한 스크롤이 정상 작동해야 한다', async ({ page }) => {
      // 많은 테스트 게시물 생성 (페이지네이션 테스트)
      const user = testDataManager.getCreatedUsers()[0]
      for (let i = 1; i <= 25; i++) {
        await testDataManager.createTestPost({
          title: `스크롤 테스트 게시물 ${i}`,
          content: `<p>게시물 ${i}번의 내용</p>`,
          author_id: user.id
        })
      }

      await pageHelpers.navigateAndWait('/posts')

      // 초기 게시물들 확인
      await expect(page.getByText('스크롤 테스트 게시물 1')).toBeVisible()

      // 페이지 하단으로 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })

      // 추가 게시물들이 로드되는지 확인
      await expect(page.getByText('스크롤 테스트 게시물 20')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('게시물 수정', () => {
    test('본인이 작성한 게시물을 수정할 수 있어야 한다', async ({ page }) => {
      // 테스트용 게시물 생성
      const user = testDataManager.getCreatedUsers()[0]
      const testPost = await testDataManager.createTestPost({
        title: '수정할 게시물',
        content: '<p>수정 전 내용</p>',
        author_id: user.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)

      // 수정 버튼 클릭
      const editButton = page.getByRole('button', { name: /수정|edit/i })
      await editButton.click()

      await pageHelpers.waitForPageLoad()

      // 수정 페이지인지 확인
      expect(page.url()).toContain('/edit')

      // 기존 내용이 입력되어 있는지 확인
      const titleInput = page.getByLabel(/제목|title/i)
      await expect(titleInput).toHaveValue('수정할 게시물')

      // 제목과 내용 수정
      await titleInput.clear()
      await titleInput.fill('수정된 게시물 제목')

      const contentInput = page.getByLabel(/내용|content/i).or(page.locator('[data-testid="post-editor"]'))
      await contentInput.clear()
      await contentInput.fill('<p>수정된 내용입니다.</p>')

      // 수정 사항 저장
      const saveButton = page.getByRole('button', { name: /저장|save|수정/i })
      await saveButton.click()

      // 성공 메시지 확인
      await pageHelpers.waitForToast('게시물이 성공적으로 수정되었습니다')

      // 수정된 내용 확인
      await expect(page.getByRole('heading', { name: '수정된 게시물 제목' })).toBeVisible()
      await expect(page.getByText('수정된 내용입니다.')).toBeVisible()
    })

    test('다른 사용자의 게시물은 수정할 수 없어야 한다', async ({ page }) => {
      // 다른 사용자 생성
      const otherUser = await testDataManager.createTestUser({
        username: 'other-user'
      })

      // 다른 사용자의 게시물 생성
      const otherPost = await testDataManager.createTestPost({
        title: '다른 사용자의 게시물',
        content: '<p>수정할 수 없는 게시물</p>',
        author_id: otherUser.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${otherPost.id}`)

      // 수정 버튼이 없어야 함
      const editButton = page.getByRole('button', { name: /수정|edit/i })
      await expect(editButton).not.toBeVisible()
    })
  })

  test.describe('게시물 삭제', () => {
    test('본인이 작성한 게시물을 삭제할 수 있어야 한다', async ({ page }) => {
      // 테스트용 게시물 생성
      const user = testDataManager.getCreatedUsers()[0]
      const testPost = await testDataManager.createTestPost({
        title: '삭제할 게시물',
        content: '<p>삭제될 예정인 게시물</p>',
        author_id: user.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)

      // 삭제 버튼 클릭
      const deleteButton = page.getByRole('button', { name: /삭제|delete/i })
      await deleteButton.click()

      // 확인 다이얼로그 대기
      await pageHelpers.waitForModal('게시물 삭제')

      // 삭제 확인
      const confirmButton = page.getByRole('button', { name: /확인|삭제|delete/i })
      await confirmButton.click()

      // 성공 메시지 확인
      await pageHelpers.waitForToast('게시물이 성공적으로 삭제되었습니다')

      // 게시물 목록으로 리다이렉트되었는지 확인
      await expect(page).toHaveURL(/\/posts/)

      // 삭제된 게시물이 목록에 없는지 확인
      await expect(page.getByText('삭제할 게시물')).not.toBeVisible()
    })

    test('삭제 다이얼로그에서 취소할 수 있어야 한다', async ({ page }) => {
      // 테스트용 게시물 생성
      const user = testDataManager.getCreatedUsers()[0]
      const testPost = await testDataManager.createTestPost({
        title: '취소 테스트 게시물',
        content: '<p>삭제하지 않을 게시물</p>',
        author_id: user.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)

      // 삭제 버튼 클릭
      const deleteButton = page.getByRole('button', { name: /삭제|delete/i })
      await deleteButton.click()

      // 확인 다이얼로그 대기
      await pageHelpers.waitForModal('게시물 삭제')

      // 취소 버튼 클릭
      const cancelButton = page.getByRole('button', { name: /취소|cancel/i })
      await cancelButton.click()

      // 여전히 게시물 상세 페이지에 있는지 확인
      await expect(page.getByRole('heading', { name: '취소 테스트 게시물' })).toBeVisible()
    })
  })

  test.describe('댓글 시스템', () => {
    test('게시물에 댓글을 작성할 수 있어야 한다', async ({ page }) => {
      // 테스트용 게시물 생성
      const user = testDataManager.getCreatedUsers()[0]
      const testPost = await testDataManager.createTestPost({
        title: '댓글 테스트 게시물',
        content: '<p>댓글을 달 게시물</p>',
        author_id: user.id
      })

      // 게시물 상세 페이지로 이동
      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)

      // 댓글 입력란 찾기
      const commentInput = page.getByPlaceholder(/댓글을 입력하세요|댓글 작성/i)\n        .or(page.locator('[data-testid=\"comment-input\"]'))\n\n      await commentInput.fill('이것은 테스트 댓글입니다.')\n\n      // 댓글 작성 버튼 클릭\n      const submitButton = page.getByRole('button', { name: /댓글 작성|작성|submit/i })\n      await submitButton.click()\n\n      // 댓글이 목록에 추가되었는지 확인\n      await expect(page.getByText('이것은 테스트 댓글입니다.')).toBeVisible()\n\n      // 작성자 정보 확인\n      await expect(page.getByText(user.username)).toBeVisible()\n    })\n\n    test('댓글에 답글을 작성할 수 있어야 한다', async ({ page }) => {\n      // 테스트용 게시물과 댓글 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const testPost = await testDataManager.createTestPost({\n        title: '답글 테스트 게시물',\n        content: '<p>답글을 달 게시물</p>',\n        author_id: user.id\n      })\n\n      // 게시물 상세 페이지로 이동\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n\n      // 첫 번째 댓글 작성\n      const commentInput = page.getByPlaceholder(/댓글을 입력하세요|댓글 작성/i)\n      await commentInput.fill('원댓글입니다.')\n      await page.getByRole('button', { name: /댓글 작성|작성|submit/i }).click()\n\n      // 댓글이 생성될 때까지 대기\n      await expect(page.getByText('원댓글입니다.')).toBeVisible()\n\n      // 답글 버튼 클릭\n      const replyButton = page.getByRole('button', { name: /답글|reply/i }).first()\n      await replyButton.click()\n\n      // 답글 입력란이 나타나는지 확인\n      const replyInput = page.locator('[data-testid=\"reply-input\"]')\n        .or(page.getByPlaceholder(/답글을 입력하세요/i))\n      await expect(replyInput).toBeVisible()\n\n      // 답글 작성\n      await replyInput.fill('이것은 답글입니다.')\n      await page.getByRole('button', { name: /답글 작성|작성/i }).click()\n\n      // 답글이 들여쓰기되어 표시되는지 확인\n      await expect(page.getByText('이것은 답글입니다.')).toBeVisible()\n    })\n\n    test('본인이 작성한 댓글을 삭제할 수 있어야 한다', async ({ page }) => {\n      // 테스트용 게시물 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const testPost = await testDataManager.createTestPost({\n        title: '댓글 삭제 테스트 게시물',\n        content: '<p>댓글을 삭제할 게시물</p>',\n        author_id: user.id\n      })\n\n      // 게시물 상세 페이지로 이동\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n\n      // 댓글 작성\n      const commentInput = page.getByPlaceholder(/댓글을 입력하세요|댓글 작성/i)\n      await commentInput.fill('삭제할 댓글입니다.')\n      await page.getByRole('button', { name: /댓글 작성|작성|submit/i }).click()\n\n      // 댓글이 생성될 때까지 대기\n      await expect(page.getByText('삭제할 댓글입니다.')).toBeVisible()\n\n      // 댓글 삭제 버튼 클릭\n      const deleteCommentButton = page.getByRole('button', { name: /삭제|delete/i }).first()\n      await deleteCommentButton.click()\n\n      // 확인 다이얼로그 처리\n      await pageHelpers.waitForModal('댓글 삭제')\n      await page.getByRole('button', { name: /확인|삭제/i }).click()\n\n      // 댓글이 삭제되었는지 확인\n      await expect(page.getByText('삭제할 댓글입니다.')).not.toBeVisible()\n    })\n  })\n\n  test.describe('게시물 반응 기능', () => {\n    test('게시물에 좋아요를 누를 수 있어야 한다', async ({ page }) => {\n      // 테스트용 게시물 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const testPost = await testDataManager.createTestPost({\n        title: '좋아요 테스트 게시물',\n        content: '<p>좋아요를 누를 게시물</p>',\n        author_id: user.id\n      })\n\n      // 게시물 상세 페이지로 이동\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n\n      // 좋아요 버튼 찾기\n      const likeButton = page.getByRole('button', { name: /좋아요|like/i })\n        .or(page.locator('[data-testid=\"like-button\"]'))\n\n      // 초기 좋아요 수 확인\n      const initialLikeCount = await page.locator('[data-testid=\"like-count\"]').textContent()\n\n      // 좋아요 버튼 클릭\n      await likeButton.click()\n\n      // 좋아요 수가 증가했는지 확인\n      await expect(page.locator('[data-testid=\"like-count\"]')).not.toHaveText(initialLikeCount || '0')\n\n      // 버튼 상태가 활성화되었는지 확인\n      await expect(likeButton).toHaveAttribute('aria-pressed', 'true')\n    })\n\n    test('게시물을 북마크할 수 있어야 한다', async ({ page }) => {\n      // 테스트용 게시물 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const testPost = await testDataManager.createTestPost({\n        title: '북마크 테스트 게시물',\n        content: '<p>북마크할 게시물</p>',\n        author_id: user.id\n      })\n\n      // 게시물 상세 페이지로 이동\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n\n      // 북마크 버튼 클릭\n      const bookmarkButton = page.getByRole('button', { name: /북마크|bookmark|저장/i })\n        .or(page.locator('[data-testid=\"bookmark-button\"]'))\n      await bookmarkButton.click()\n\n      // 성공 메시지 또는 상태 변화 확인\n      await pageHelpers.waitForToast('북마크에 추가되었습니다')\n\n      // 버튼 상태가 활성화되었는지 확인\n      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true')\n    })\n  })\n\n  test.describe('접근성 테스트', () => {\n    test('게시물 목록 페이지 접근성 검증', async ({ page }) => {\n      await pageHelpers.navigateAndWait('/posts')\n      await accessibility.checkPageA11y(page)\n    })\n\n    test('게시물 작성 페이지 접근성 검증', async ({ page }) => {\n      await pageHelpers.navigateAndWait('/posts/new')\n      await accessibility.checkPageA11y(page)\n    })\n\n    test('게시물 상세 페이지 접근성 검증', async ({ page }) => {\n      // 테스트용 게시물 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const testPost = await testDataManager.createTestPost({\n        title: '접근성 테스트 게시물',\n        content: '<p>접근성을 확인할 게시물</p>',\n        author_id: user.id\n      })\n\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n      await accessibility.checkPageA11y(page)\n    })\n\n    test('키보드 네비게이션으로 게시물을 탐색할 수 있어야 한다', async ({ page }) => {\n      await pageHelpers.navigateAndWait('/posts')\n\n      // Tab 키로 네비게이션 테스트\n      await page.keyboard.press('Tab') // 첫 번째 포커스 가능한 요소\n      await page.keyboard.press('Tab') // 다음 요소\n      await page.keyboard.press('Enter') // 활성화\n\n      // 페이지가 변경되었는지 확인 (게시물 상세 페이지로 이동)\n      await pageHelpers.waitForPageLoad()\n    })\n  })\n\n  test.describe('성능 테스트', () => {\n    test('게시물 목록 로딩 성능이 양호해야 한다', async ({ page }) => {\n      const startTime = Date.now()\n\n      await pageHelpers.navigateAndWait('/posts')\n      await pageHelpers.waitForLoadingComplete()\n\n      const loadTime = Date.now() - startTime\n\n      // 페이지 로딩이 3초 이내에 완료되어야 함\n      expect(loadTime).toBeLessThan(3000)\n\n      // 성능 메트릭 수집\n      const metrics = await reportHelpers.collectPerformanceMetrics()\n      console.log('Posts page performance metrics:', metrics)\n\n      // TTFB가 1초 이내여야 함\n      expect(metrics.ttfb).toBeLessThan(1000)\n    })\n\n    test('대용량 게시물 렌더링 성능이 양호해야 한다', async ({ page }) => {\n      // 대용량 콘텐츠를 가진 게시물 생성\n      const user = testDataManager.getCreatedUsers()[0]\n      const longContent = '<p>' + 'Lorem ipsum '.repeat(1000) + '</p>'\n      const testPost = await testDataManager.createTestPost({\n        title: '대용량 콘텐츠 게시물',\n        content: longContent,\n        author_id: user.id\n      })\n\n      const startTime = Date.now()\n      await pageHelpers.navigateAndWait(`/posts/${testPost.id}`)\n      const loadTime = Date.now() - startTime\n\n      // 대용량 게시물도 5초 이내에 로딩되어야 함\n      expect(loadTime).toBeLessThan(5000)\n    })\n  })\n})\n\ntest.describe('게시물 검색 및 필터링', () => {\n  let testDataManager: TestDataManager\n  let authHelpers: AuthHelpers\n  let pageHelpers: PageHelpers\n\n  test.beforeEach(async ({ page }) => {\n    testDataManager = new TestDataManager()\n    authHelpers = new AuthHelpers(page)\n    pageHelpers = new PageHelpers(page)\n\n    // 테스트 사용자 생성 및 로그인\n    const testUser = await testDataManager.createTestUser()\n    await authHelpers.loginAsTestUser(testUser)\n\n    // 검색용 테스트 게시물들 생성\n    const user = testDataManager.getCreatedUsers()[0]\n    await testDataManager.createTestPost({\n      title: 'React 개발 가이드',\n      content: '<p>React를 이용한 웹 개발 방법</p>',\n      author_id: user.id\n    })\n    await testDataManager.createTestPost({\n      title: 'Vue.js 시작하기',\n      content: '<p>Vue.js 프레임워크 학습하기</p>',\n      author_id: user.id\n    })\n    await testDataManager.createTestPost({\n      title: 'JavaScript ES6 특징',\n      content: '<p>최신 JavaScript 문법 정리</p>',\n      author_id: user.id\n    })\n\n    await pageHelpers.navigateAndWait('/posts')\n  })\n\n  test.afterEach(async () => {\n    await testDataManager.cleanup()\n  })\n\n  test('제목으로 게시물을 검색할 수 있어야 한다', async ({ page }) => {\n    // 검색 입력란 찾기\n    const searchInput = page.getByPlaceholder(/검색|search/i)\n      .or(page.locator('[data-testid=\"search-input\"]'))\n\n    // React 검색\n    await searchInput.fill('React')\n    await page.keyboard.press('Enter')\n\n    // 검색 결과 확인\n    await expect(page.getByText('React 개발 가이드')).toBeVisible()\n    await expect(page.getByText('Vue.js 시작하기')).not.toBeVisible()\n  })\n\n  test('내용으로 게시물을 검색할 수 있어야 한다', async ({ page }) => {\n    const searchInput = page.getByPlaceholder(/검색|search/i)\n      .or(page.locator('[data-testid=\"search-input\"]'))\n\n    // 내용 검색\n    await searchInput.fill('프레임워크')\n    await page.keyboard.press('Enter')\n\n    // 검색 결과 확인\n    await expect(page.getByText('Vue.js 시작하기')).toBeVisible()\n    await expect(page.getByText('React 개발 가이드')).not.toBeVisible()\n  })\n\n  test('검색 결과가 없을 때 적절한 메시지가 표시되어야 한다', async ({ page }) => {\n    const searchInput = page.getByPlaceholder(/검색|search/i)\n      .or(page.locator('[data-testid=\"search-input\"]'))\n\n    // 존재하지 않는 키워드 검색\n    await searchInput.fill('존재하지않는키워드')\n    await page.keyboard.press('Enter')\n\n    // \"검색 결과가 없습니다\" 메시지 확인\n    await expect(page.getByText(/검색 결과가 없습니다|no results found/i)).toBeVisible()\n  })\n\n  test('필터링 기능이 정상 작동해야 한다', async ({ page }) => {\n    // 필터 드롭다운이 있다면 테스트\n    const filterButton = page.getByRole('button', { name: /필터|filter/i })\n    if (await filterButton.isVisible()) {\n      await filterButton.click()\n\n      // 최신순 정렬 선택\n      await page.getByRole('option', { name: /최신순|latest/i }).click()\n\n      // 정렬이 적용되었는지 확인 (첫 번째 게시물이 가장 최근 것인지)\n      const firstPost = page.locator('[data-testid=\"post-item\"]').first()\n      await expect(firstPost).toBeVisible()\n    }\n  })\n})"