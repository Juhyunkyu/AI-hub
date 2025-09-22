import { test, expect } from '@playwright/test'
import { E2ETestHelpers, TestDataManager, TestUser, TestPost } from '../utils/e2e-utils'

test.describe('📝 Core Features - Posts, Comments & Search', () => {
  let helpers: E2ETestHelpers
  let testDataManager: TestDataManager
  let testUser: TestUser
  let testPost: TestPost

  test.beforeAll(async () => {
    testDataManager = new TestDataManager()

    // 테스트용 사용자 생성
    testUser = await testDataManager.createTestUser({
      username: 'testauthor',
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

  test.describe('📄 Post Management', () => {
    test('should create a new post successfully', async ({ page }) => {
      await page.goto('/posts/create')
      await helpers.page.waitForPageLoad()

      const postTitle = `Test Post ${Date.now()}`
      const postContent = `<h2>Test Content</h2><p>This is a comprehensive test post with <strong>rich text</strong> content.</p>`

      // 제목 입력
      await page.fill('[data-testid="post-title-input"]', postTitle)

      // 콘텐츠 입력 (Rich Text Editor)
      const contentEditor = page.locator('[data-testid="post-content-editor"]')
      await contentEditor.click()
      await contentEditor.fill(postContent)

      // 카테고리 선택 (있는 경우)
      const categorySelect = page.locator('[data-testid="post-category-select"]')
      if (await categorySelect.isVisible()) {
        await categorySelect.click()
        await page.locator('[data-testid="category-option"]').first().click()
      }

      // 태그 추가 (있는 경우)
      const tagInput = page.locator('[data-testid="post-tags-input"]')
      if (await tagInput.isVisible()) {
        await tagInput.fill('테스트,자동화')
        await page.keyboard.press('Enter')
      }

      // 게시물 발행
      await page.click('[data-testid="publish-post-button"]')

      // 성공 메시지 확인
      await helpers.page.waitForToast('게시물이 성공적으로 작성되었습니다')

      // 게시물 상세 페이지로 리다이렉션 확인
      await expect(page).toHaveURL(/\/posts\/[^\/]+$/)

      // 생성된 게시물 내용 확인
      await expect(page.getByTestId('post-title')).toContainText(postTitle)
      await expect(page.getByTestId('post-content')).toContainText('Test Content')
      await expect(page.getByTestId('post-author')).toContainText(testUser.username)

      // 접근성 검증
      const a11yResults = await helpers.accessibility.runAccessibilityCheck()
      expect(a11yResults.violations.filter(v => v.impact === 'critical').length).toBe(0)
    })

    test('should edit existing post', async ({ page }) => {
      // 테스트용 게시물 생성
      testPost = await testDataManager.createTestPost({
        title: 'Original Title',
        content: '<p>Original content</p>',
        author_id: testUser.id
      })

      await page.goto(`/posts/${testPost.id}/edit`)
      await helpers.page.waitForPageLoad()

      const newTitle = `Updated Title ${Date.now()}`
      const newContent = '<h2>Updated Content</h2><p>This content has been updated!</p>'

      // 기존 내용이 폼에 로드되었는지 확인
      await expect(page.getByTestId('post-title-input')).toHaveValue('Original Title')

      // 제목 수정
      await page.fill('[data-testid="post-title-input"]', newTitle)

      // 콘텐츠 수정
      const contentEditor = page.locator('[data-testid="post-content-editor"]')
      await contentEditor.click()
      await contentEditor.fill(newContent)

      // 변경사항 저장
      await page.click('[data-testid="update-post-button"]')

      // 성공 메시지 확인
      await helpers.page.waitForToast('게시물이 성공적으로 수정되었습니다')

      // 수정된 내용 확인
      await expect(page.getByTestId('post-title')).toContainText(newTitle)
      await expect(page.getByTestId('post-content')).toContainText('Updated Content')
    })

    test('should delete post with confirmation', async ({ page }) => {
      testPost = await testDataManager.createTestPost({
        title: 'Post to Delete',
        content: '<p>This post will be deleted</p>',
        author_id: testUser.id
      })

      await page.goto(`/posts/${testPost.id}`)
      await helpers.page.waitForPageLoad()

      // 삭제 버튼 클릭
      await page.click('[data-testid="delete-post-button"]')

      // 확인 모달 대기
      await helpers.page.waitForModal('게시물 삭제')

      // 확인 버튼 클릭
      await page.click('[data-testid="confirm-delete-button"]')

      // 성공 메시지 확인
      await helpers.page.waitForToast('게시물이 성공적으로 삭제되었습니다')

      // 게시물 목록으로 리다이렉션 확인
      await expect(page).toHaveURL('/posts')

      // 삭제된 게시물에 접근하면 404 페이지 확인
      await page.goto(`/posts/${testPost.id}`)
      await expect(page.getByText('404')).toBeVisible()
    })

    test('should handle rich text editor features', async ({ page }) => {
      await page.goto('/posts/create')
      await helpers.page.waitForPageLoad()

      const contentEditor = page.locator('[data-testid="post-content-editor"]')
      await contentEditor.click()

      // 다양한 서식 테스트
      const formattingTests = [
        { button: 'bold', text: 'Bold text', expected: '<strong>Bold text</strong>' },
        { button: 'italic', text: 'Italic text', expected: '<em>Italic text</em>' },
        { button: 'heading', text: 'Heading text', expected: '<h2>Heading text</h2>' }
      ]

      for (const test of formattingTests) {
        await contentEditor.fill(test.text)
        await contentEditor.selectText()

        // 서식 버튼 클릭
        await page.click(`[data-testid="editor-${test.button}"]`)

        // HTML 출력 확인 (에디터가 HTML을 지원하는 경우)
        const htmlContent = await page.evaluate(() => {
          const editor = document.querySelector('[data-testid="post-content-editor"]') as any
          return editor?.innerHTML || editor?.value || ''
        })

        expect(htmlContent).toContain(test.text)
      }
    })

    test('should validate post form inputs', async ({ page }) => {
      await page.goto('/posts/create')
      await helpers.page.waitForPageLoad()

      // 빈 폼으로 제출 시도
      await page.click('[data-testid="publish-post-button"]')

      // 검증 메시지 확인
      await expect(page.getByText('제목을 입력해주세요')).toBeVisible()
      await expect(page.getByText('내용을 입력해주세요')).toBeVisible()

      // 너무 짧은 제목
      await page.fill('[data-testid="post-title-input"]', 'ab')
      await page.click('[data-testid="publish-post-button"]')
      await expect(page.getByText('제목은 최소 3자 이상')).toBeVisible()

      // 너무 긴 제목
      const longTitle = 'a'.repeat(201)
      await page.fill('[data-testid="post-title-input"]', longTitle)
      await page.click('[data-testid="publish-post-button"]')
      await expect(page.getByText('제목은 최대 200자')).toBeVisible()
    })
  })

  test.describe('💬 Comment System', () => {
    test.beforeEach(async () => {
      // 댓글 테스트용 게시물 생성
      testPost = await testDataManager.createTestPost({
        title: 'Post for Comments',
        content: '<p>This post is for testing comments</p>',
        author_id: testUser.id
      })
    })

    test('should add comment to post', async ({ page }) => {
      await page.goto(`/posts/${testPost.id}`)
      await helpers.page.waitForPageLoad()

      const commentText = `Test comment ${Date.now()}`

      // 댓글 입력
      const commentInput = page.locator('[data-testid="comment-input"]')
      await commentInput.fill(commentText)

      // 댓글 제출
      await page.click('[data-testid="submit-comment-button"]')

      // 댓글이 즉시 표시되는지 확인
      await expect(page.getByTestId('comment-list')).toContainText(commentText)
      await expect(page.getByTestId('comment-author')).toContainText(testUser.username)

      // 댓글 개수 업데이트 확인
      const commentCount = await page.locator('[data-testid="comment-count"]').textContent()
      expect(parseInt(commentCount || '0')).toBeGreaterThan(0)
    })

    test('should add nested reply to comment', async ({ page }) => {
      await page.goto(`/posts/${testPost.id}`)

      // 첫 번째 댓글 작성
      const parentComment = `Parent comment ${Date.now()}`
      await page.fill('[data-testid="comment-input"]', parentComment)
      await page.click('[data-testid="submit-comment-button"]')

      // 댓글에 답글 달기
      await page.click('[data-testid="reply-button"]')

      const replyText = `Reply comment ${Date.now()}`
      await page.fill('[data-testid="reply-input"]', replyText)
      await page.click('[data-testid="submit-reply-button"]')

      // 답글이 중첩되어 표시되는지 확인
      await expect(page.getByTestId('comment-replies')).toContainText(replyText)

      // 답글이 부모 댓글 아래에 들여쓰기되어 있는지 확인
      const replyElement = page.getByTestId('comment-reply').first()
      const marginLeft = await replyElement.evaluate(el => {
        return window.getComputedStyle(el).marginLeft
      })
      expect(parseInt(marginLeft)).toBeGreaterThan(0)
    })

    test('should edit own comment', async ({ page }) => {
      await page.goto(`/posts/${testPost.id}`)

      const originalText = `Original comment ${Date.now()}`
      await page.fill('[data-testid="comment-input"]', originalText)
      await page.click('[data-testid="submit-comment-button"]')

      // 댓글 편집 버튼 클릭
      await page.hover('[data-testid="comment-item"]')
      await page.click('[data-testid="edit-comment-button"]')

      // 편집 모드 확인
      const editInput = page.locator('[data-testid="edit-comment-input"]')
      await expect(editInput).toBeVisible()
      await expect(editInput).toHaveValue(originalText)

      // 댓글 수정
      const updatedText = `Updated comment ${Date.now()}`
      await editInput.fill(updatedText)
      await page.click('[data-testid="save-comment-button"]')

      // 수정된 댓글 확인
      await expect(page.getByTestId('comment-list')).toContainText(updatedText)
      await expect(page.getByTestId('comment-list')).not.toContainText(originalText)

      // '편집됨' 표시 확인
      await expect(page.getByText('편집됨')).toBeVisible()
    })

    test('should delete own comment', async ({ page }) => {
      await page.goto(`/posts/${testPost.id}`)

      const commentText = `Comment to delete ${Date.now()}`
      await page.fill('[data-testid="comment-input"]', commentText)
      await page.click('[data-testid="submit-comment-button"]')

      // 댓글 삭제 버튼 클릭
      await page.hover('[data-testid="comment-item"]')
      await page.click('[data-testid="delete-comment-button"]')

      // 확인 모달
      await helpers.page.waitForModal('댓글 삭제')
      await page.click('[data-testid="confirm-delete-comment-button"]')

      // 댓글이 삭제되었는지 확인
      await expect(page.getByTestId('comment-list')).not.toContainText(commentText)

      // 댓글 개수 감소 확인
      const commentCount = await page.locator('[data-testid="comment-count"]').textContent()
      expect(parseInt(commentCount || '0')).toBe(0)
    })

    test('should validate comment input', async ({ page }) => {
      await page.goto(`/posts/${testPost.id}`)

      // 빈 댓글 제출 시도
      await page.click('[data-testid="submit-comment-button"]')
      await expect(page.getByText('댓글을 입력해주세요')).toBeVisible()

      // 너무 긴 댓글
      const longComment = 'a'.repeat(1001)
      await page.fill('[data-testid="comment-input"]', longComment)
      await page.click('[data-testid="submit-comment-button"]')
      await expect(page.getByText('댓글은 최대 1000자')).toBeVisible()
    })

    test('should load more comments with pagination', async ({ page }) => {
      // 많은 댓글 생성 (테스트 데이터)
      for (let i = 0; i < 15; i++) {
        await testDataManager.createTestComment({
          body: `Test comment ${i}`,
          author_id: testUser.id,
          post_id: testPost.id
        })
      }

      await page.goto(`/posts/${testPost.id}`)
      await helpers.page.waitForPageLoad()

      // 초기 댓글 로딩 확인 (예: 10개)
      const initialComments = await page.locator('[data-testid="comment-item"]').count()
      expect(initialComments).toBeLessThanOrEqual(10)

      // "더 보기" 버튼 클릭
      if (await page.locator('[data-testid="load-more-comments"]').isVisible()) {
        await page.click('[data-testid="load-more-comments"]')

        // 추가 댓글 로딩 확인
        await expect(page.locator('[data-testid="comment-item"]')).toHaveCount(15)
      }
    })
  })

  test.describe('🔍 Search & Filtering', () => {
    test.beforeEach(async () => {
      // 검색 테스트용 게시물들 생성
      await testDataManager.createTestPost({
        title: 'React Tutorial Guide',
        content: '<p>This is a comprehensive React tutorial</p>',
        author_id: testUser.id
      })

      await testDataManager.createTestPost({
        title: 'Vue.js Best Practices',
        content: '<p>Learn Vue.js development best practices</p>',
        author_id: testUser.id
      })

      await testDataManager.createTestPost({
        title: 'JavaScript Performance Tips',
        content: '<p>Optimize your JavaScript performance</p>',
        author_id: testUser.id
      })
    })

    test('should search posts by title', async ({ page }) => {
      await page.goto('/posts')
      await helpers.page.waitForPageLoad()

      // 검색어 입력
      const searchInput = page.locator('[data-testid="search-input"]')
      await searchInput.fill('React')
      await page.keyboard.press('Enter')

      // 검색 결과 로딩 대기
      await helpers.page.waitForLoadingComplete()

      // React가 포함된 게시물만 표시되는지 확인
      await expect(page.getByTestId('post-item')).toContainText('React Tutorial Guide')
      await expect(page.getByTestId('post-item')).not.toContainText('Vue.js Best Practices')

      // 검색 결과 개수 표시 확인
      await expect(page.getByTestId('search-results-count')).toContainText('1개의 검색 결과')
    })

    test('should search posts by content', async ({ page }) => {
      await page.goto('/posts')

      const searchInput = page.locator('[data-testid="search-input"]')
      await searchInput.fill('performance')
      await page.keyboard.press('Enter')

      await helpers.page.waitForLoadingComplete()

      // 콘텐츠에 'performance'가 포함된 게시물 확인
      await expect(page.getByTestId('post-item')).toContainText('JavaScript Performance Tips')
    })

    test('should filter posts by category', async ({ page }) => {
      await page.goto('/posts')

      // 카테고리 필터 클릭
      const categoryFilter = page.locator('[data-testid="category-filter"]')
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click()
        await page.locator('[data-testid="category-option-javascript"]').click()

        await helpers.page.waitForLoadingComplete()

        // JavaScript 카테고리 게시물만 표시되는지 확인
        const posts = await page.locator('[data-testid="post-item"]').all()
        for (const post of posts) {
          await expect(post.locator('[data-testid="post-category"]')).toContainText('JavaScript')
        }
      }
    })

    test('should sort posts by different criteria', async ({ page }) => {
      await page.goto('/posts')

      const sortOptions = [
        { value: 'latest', testId: 'sort-latest' },
        { value: 'popular', testId: 'sort-popular' },
        { value: 'oldest', testId: 'sort-oldest' }
      ]

      for (const sort of sortOptions) {
        // 정렬 옵션 선택
        await page.click('[data-testid="sort-dropdown"]')
        await page.click(`[data-testid="${sort.testId}"]`)

        await helpers.page.waitForLoadingComplete()

        // 게시물이 로드되었는지 확인
        await expect(page.locator('[data-testid="post-item"]').first()).toBeVisible()

        // URL에 정렬 매개변수가 포함되었는지 확인
        await expect(page).toHaveURL(new RegExp(`sort=${sort.value}`))
      }
    })

    test('should handle empty search results', async ({ page }) => {
      await page.goto('/posts')

      const searchInput = page.locator('[data-testid="search-input"]')
      await searchInput.fill('nonexistentterm123')
      await page.keyboard.press('Enter')

      await helpers.page.waitForLoadingComplete()

      // 검색 결과 없음 메시지 표시
      await expect(page.getByTestId('no-results-message')).toBeVisible()
      await expect(page.getByTestId('no-results-message')).toContainText('검색 결과가 없습니다')

      // 다른 검색어 제안 또는 모든 게시물 보기 링크 확인
      await expect(page.getByTestId('view-all-posts-link')).toBeVisible()
    })

    test('should implement search suggestions/autocomplete', async ({ page }) => {
      await page.goto('/posts')

      const searchInput = page.locator('[data-testid="search-input"]')
      await searchInput.fill('Rea')

      // 자동완성 드롭다운 표시 확인
      await expect(page.getByTestId('search-suggestions')).toBeVisible()
      await expect(page.getByTestId('search-suggestion-item')).toContainText('React')

      // 제안 항목 클릭
      await page.click('[data-testid="search-suggestion-item"]')

      // 검색어가 자동으로 완성되는지 확인
      await expect(searchInput).toHaveValue('React')
    })

    test('should maintain search state in URL', async ({ page }) => {
      await page.goto('/posts')

      // 검색 실행
      await page.fill('[data-testid="search-input"]', 'React')
      await page.keyboard.press('Enter')

      // URL에 검색어가 포함되는지 확인
      await expect(page).toHaveURL(/search=React/)

      // 페이지 새로고침 후에도 검색 상태 유지
      await page.reload()
      await expect(page.locator('[data-testid="search-input"]')).toHaveValue('React')
      await expect(page.getByTestId('post-item')).toContainText('React Tutorial Guide')
    })

    test('should search with multiple filters combined', async ({ page }) => {
      await page.goto('/posts')

      // 검색어 + 카테고리 + 정렬 조합
      await page.fill('[data-testid="search-input"]', 'JavaScript')

      const categoryFilter = page.locator('[data-testid="category-filter"]')
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click()
        await page.click('[data-testid="category-option-tutorial"]')
      }

      await page.click('[data-testid="sort-dropdown"]')
      await page.click('[data-testid="sort-popular"]')

      await page.keyboard.press('Enter')
      await helpers.page.waitForLoadingComplete()

      // 복합 필터 결과 확인
      const url = page.url()
      expect(url).toContain('search=JavaScript')
      expect(url).toContain('category=tutorial')
      expect(url).toContain('sort=popular')
    })
  })

  test.describe('⚡ Performance & Optimization', () => {
    test('should load posts efficiently with infinite scroll', async ({ page }) => {
      await page.goto('/posts')

      // 초기 게시물 로딩 확인
      const initialPosts = await page.locator('[data-testid="post-item"]').count()
      expect(initialPosts).toBeGreaterThan(0)

      // 스크롤하여 추가 게시물 로딩
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })

      // 새로운 게시물이 로딩되는지 확인
      await page.waitForFunction(
        (initial) => {
          return document.querySelectorAll('[data-testid="post-item"]').length > initial
        },
        initialPosts
      )

      const newPostCount = await page.locator('[data-testid="post-item"]').count()
      expect(newPostCount).toBeGreaterThan(initialPosts)
    })

    test('should optimize image loading in posts', async ({ page }) => {
      // 이미지가 포함된 게시물 생성
      const postWithImage = await testDataManager.createTestPost({
        title: 'Post with Images',
        content: '<p>Post content</p><img src="/test-image.jpg" alt="Test image" />',
        author_id: testUser.id
      })

      await page.goto(`/posts/${postWithImage.id}`)

      // 이미지 지연 로딩 확인
      const images = await page.locator('img').all()
      for (const img of images) {
        const loading = await img.getAttribute('loading')
        expect(loading).toBe('lazy')
      }

      // 성능 메트릭 확인
      const performanceMetrics = await helpers.performance.measureWebVitals()

      // LCP가 합리적인지 확인 (이미지가 있어도 빠르게 로딩)
      if (performanceMetrics.lcp) {
        expect(performanceMetrics.lcp).toBeLessThan(4000) // 4초 이내
      }
    })

    test('should handle large content efficiently', async ({ page }) => {
      // 대용량 콘텐츠가 있는 게시물 생성
      const largeContent = '<p>' + 'Large content paragraph. '.repeat(100) + '</p>'
      const largePost = await testDataManager.createTestPost({
        title: 'Large Content Post',
        content: largeContent,
        author_id: testUser.id
      })

      const startTime = Date.now()
      await page.goto(`/posts/${largePost.id}`)
      await helpers.page.waitForPageLoad()
      const loadTime = Date.now() - startTime

      // 대용량 콘텐츠도 빠르게 로딩되어야 함
      expect(loadTime).toBeLessThan(5000)

      // 콘텐츠가 올바르게 표시되는지 확인
      await expect(page.getByTestId('post-content')).toContainText('Large content paragraph')
    })
  })
})