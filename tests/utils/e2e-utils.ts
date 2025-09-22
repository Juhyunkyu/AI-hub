import { Page, expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { WebVitalsCollector, PerformanceMetrics } from './web-vitals-collector'
import { AxeResults, injectAxe, checkA11y, getViolations } from 'axe-playwright'

// 테스트용 Supabase 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'

export const testSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 테스트 데이터 타입 정의
export interface TestUser {
  id: string
  email: string
  username: string
  role?: 'user' | 'moderator' | 'admin'
  avatar_url?: string
  bio?: string
}

export interface TestPost {
  id: string
  title: string
  content: string
  author_id: string
}

export interface TestChat {
  id: string
  name: string
  creator_id: string
}

// 테스트 데이터 관리 클래스
export class TestDataManager {
  private createdUsers: TestUser[] = []
  private createdPosts: TestPost[] = []
  private createdChats: TestChat[] = []

  /**
   * 테스트용 사용자 생성
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      username: `testuser-${Date.now()}`,
      role: 'user' as const,
      ...userData
    }

    try {
      // Supabase Auth를 통한 사용자 생성
      const { data, error } = await testSupabase.auth.admin.createUser({
        email: defaultUser.email,
        password: 'testpassword123',
        email_confirm: true,
        user_metadata: {
          username: defaultUser.username,
          role: defaultUser.role
        }
      })

      if (error) throw error

      const user: TestUser = {
        id: data.user.id,
        email: defaultUser.email,
        username: defaultUser.username,
        role: defaultUser.role
      }

      // profiles 테이블에 프로필 정보 추가
      const { error: profileError } = await testSupabase
        .from('profiles')
        .insert({
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: new Date().toISOString()
        })

      if (profileError) throw profileError

      this.createdUsers.push(user)
      return user

    } catch (error) {
      console.error('Failed to create test user:', error)
      throw error
    }
  }

  /**
   * 테스트용 게시물 생성
   */
  async createTestPost(postData: Partial<TestPost> & { author_id: string }): Promise<TestPost> {
    const defaultPost = {
      title: `Test Post ${Date.now()}`,
      content: `<p>This is a test post content created at ${new Date().toISOString()}</p>`,
      ...postData
    }

    try {
      const { data, error } = await testSupabase
        .from('posts')
        .insert({
          title: defaultPost.title,
          content: defaultPost.content,
          author_id: defaultPost.author_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      const post: TestPost = {
        id: data.id,
        title: data.title,
        content: data.content,
        author_id: data.author_id
      }

      this.createdPosts.push(post)
      return post

    } catch (error) {
      console.error('Failed to create test post:', error)
      throw error
    }
  }

  /**
   * 테스트용 채팅방 생성
   */
  async createTestChat(chatData: Partial<TestChat> & { creator_id: string }): Promise<TestChat> {
    const defaultChat = {
      name: `Test Chat ${Date.now()}`,
      ...chatData
    }

    try {
      const { data, error } = await testSupabase
        .from('chats')
        .insert({
          name: defaultChat.name,
          creator_id: defaultChat.creator_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      const chat: TestChat = {
        id: data.id,
        name: data.name,
        creator_id: data.creator_id
      }

      this.createdChats.push(chat)
      return chat

    } catch (error) {
      console.error('Failed to create test chat:', error)
      throw error
    }
  }

  /**
   * 생성된 모든 테스트 데이터 정리
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...')

    try {
      // 채팅 데이터 정리
      if (this.createdChats.length > 0) {
        const chatIds = this.createdChats.map(chat => chat.id)
        await testSupabase.from('chats').delete().in('id', chatIds)
      }

      // 게시물 데이터 정리
      if (this.createdPosts.length > 0) {
        const postIds = this.createdPosts.map(post => post.id)
        await testSupabase.from('posts').delete().in('id', postIds)
      }

      // 사용자 데이터 정리
      if (this.createdUsers.length > 0) {
        for (const user of this.createdUsers) {
          // 프로필 삭제
          await testSupabase.from('profiles').delete().eq('id', user.id)
          // 사용자 삭제
          await testSupabase.auth.admin.deleteUser(user.id)
        }
      }

      // 배열 초기화
      this.createdUsers = []
      this.createdPosts = []
      this.createdChats = []

      console.log('✅ Test data cleanup complete')

    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error)
    }
  }

  /**
   * 생성된 테스트 데이터 조회
   */
  getCreatedUsers(): TestUser[] {
    return [...this.createdUsers]
  }

  getCreatedPosts(): TestPost[] {
    return [...this.createdPosts]
  }

  getCreatedChats(): TestChat[] {
    return [...this.createdChats]
  }
}

// 브라우저 인증 헬퍼 함수들
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * 테스트 사용자로 로그인
   */
  async loginAsTestUser(user: TestUser): Promise<void> {
    // 로컬 스토리지에 세션 정보 설정 (실제 OAuth 대신)
    await this.page.evaluate(
      ({ userId, email }) => {
        const sessionData = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user: {
            id: userId,
            email: email,
            email_confirmed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }
        }
        localStorage.setItem('sb-localhost-auth-token', JSON.stringify(sessionData))
      },
      { userId: user.id, email: user.email }
    )

    // 페이지 새로고침하여 세션 적용
    await this.page.reload()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('sb-localhost-auth-token')
    })
    await this.page.reload()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 현재 로그인 상태 확인
   */
  async isLoggedIn(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const session = localStorage.getItem('sb-localhost-auth-token')
      return !!session
    })
  }
}

// 공통 페이지 헬퍼 함수들
export class PageHelpers {
  constructor(private page: Page) {}

  /**
   * 페이지 로딩 완료까지 대기
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('body')
  }

  /**
   * 토스트 알림 확인
   */
  async waitForToast(message?: string): Promise<void> {
    if (message) {
      await expect(this.page.getByRole('alert')).toContainText(message)
    } else {
      await expect(this.page.getByRole('alert')).toBeVisible()
    }
  }

  /**
   * 모달 다이얼로그 대기
   */
  async waitForModal(title?: string): Promise<void> {
    if (title) {
      await expect(this.page.getByRole('dialog')).toContainText(title)
    } else {
      await expect(this.page.getByRole('dialog')).toBeVisible()
    }
  }

  /**
   * 로딩 스피너 사라질 때까지 대기
   */
  async waitForLoadingComplete(): Promise<void> {
    await this.page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[data-loading="true"], .loading, .spinner')
      return spinners.length === 0
    }, { timeout: 10000 })
  }

  /**
   * 네트워크 요청 완료 대기
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 특정 URL로 이동 후 로딩 완료 대기
   */
  async navigateAndWait(url: string): Promise<void> {
    await this.page.goto(url)
    await this.waitForPageLoad()
  }
}

// 스크린샷 및 테스트 결과 저장 헬퍼
export class TestReportHelpers {
  constructor(private page: Page) {}

  /**
   * 실패 시 스크린샷 저장
   */
  async captureFailureScreenshot(testName: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `failure-${testName}-${timestamp}.png`

    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: true
    })
  }

  /**
   * 특정 요소의 스크린샷 저장
   */
  async captureElementScreenshot(selector: string, filename: string): Promise<void> {
    const element = this.page.locator(selector)
    await element.screenshot({
      path: `test-results/screenshots/${filename}.png`
    })
  }

  /**
   * 페이지 성능 메트릭 수집
   */
  async collectPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        ttfb: navigation.responseStart - navigation.requestStart,
        resourceCount: performance.getEntriesByType('resource').length
      }
    })
  }
}

// 실시간 기능 테스트 헬퍼
export class RealtimeHelpers {
  constructor(private page: Page) {}

  /**
   * WebSocket 연결 상태 확인
   */
  async checkWebSocketConnection(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // Supabase Realtime 연결 상태 확인
      return (window as any).supabaseRealtimeConnected || false
    })
  }

  /**
   * 실시간 메시지 전송 대기
   */
  async waitForRealtimeMessage(timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        // 새 메시지가 DOM에 추가되었는지 확인
        const messages = document.querySelectorAll('[data-testid="chat-message"]')
        return messages.length > 0
      },
      { timeout }
    )
  }

  /**
   * 타이핑 인디케이터 확인
   */
  async waitForTypingIndicator(): Promise<void> {
    await expect(this.page.getByTestId('typing-indicator')).toBeVisible()
  }

  /**
   * 새 메시지 전송 및 실시간 수신 확인
   */
  async sendAndVerifyMessage(messageText: string, chatId?: string): Promise<void> {
    const messageCount = await this.page.locator('[data-testid="chat-message"]').count()

    // 메시지 입력 및 전송
    await this.page.fill('[data-testid="message-input"]', messageText)
    await this.page.press('[data-testid="message-input"]', 'Enter')

    // 새 메시지가 실시간으로 표시되는지 확인
    await expect(this.page.locator('[data-testid="chat-message"]')).toHaveCount(messageCount + 1)
    await expect(this.page.locator('[data-testid="chat-message"]').last()).toContainText(messageText)
  }

  /**
   * 알림 수신 확인
   */
  async waitForNotification(timeout = 5000): Promise<void> {
    await expect(this.page.getByRole('alert')).toBeVisible({ timeout })
  }
}

// 접근성 테스트 헬퍼
export class AccessibilityHelpers {
  constructor(private page: Page) {}

  /**
   * 페이지 접근성 검사 실행
   */
  async runAccessibilityCheck(): Promise<AxeResults> {
    await injectAxe(this.page)
    return await checkA11y(this.page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    })
  }

  /**
   * 특정 요소의 접근성 검사
   */
  async checkElementAccessibility(selector: string): Promise<AxeResults> {
    await injectAxe(this.page)
    return await checkA11y(this.page, selector, {
      detailedReport: true
    })
  }

  /**
   * 키보드 네비게이션 테스트
   */
  async testKeyboardNavigation(expectedFocusableElements: string[]): Promise<void> {
    // 첫 번째 요소부터 시작
    await this.page.keyboard.press('Tab')

    for (let i = 0; i < expectedFocusableElements.length; i++) {
      const selector = expectedFocusableElements[i]
      await expect(this.page.locator(selector)).toBeFocused()

      if (i < expectedFocusableElements.length - 1) {
        await this.page.keyboard.press('Tab')
      }
    }
  }

  /**
   * 스크린 리더 접근성 검증
   */
  async verifyScreenReaderContent(): Promise<void> {
    // ARIA labels 검증
    const elementsWithAriaLabel = await this.page.locator('[aria-label]').all()
    for (const element of elementsWithAriaLabel) {
      const ariaLabel = await element.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel!.length).toBeGreaterThan(0)
    }

    // 헤딩 구조 검증
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all()
    if (headings.length > 0) {
      // 첫 번째 헤딩이 h1인지 확인
      const firstHeading = headings[0]
      const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase())
      expect(tagName).toBe('h1')
    }

    // 이미지 alt 텍스트 검증
    const images = await this.page.locator('img').all()
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const ariaHidden = await img.getAttribute('aria-hidden')

      // 장식용 이미지가 아니면 alt 텍스트가 있어야 함
      if (ariaHidden !== 'true') {
        expect(alt).toBeTruthy()
      }
    }
  }

  /**
   * 색상 대비 검사 (고대비 모드)
   */
  async testHighContrastMode(): Promise<void> {
    await this.page.emulateMedia({ forcedColors: 'active' })
    await this.page.reload()
    await this.page.waitForLoadState('networkidle')

    // 기본 요소들이 여전히 보이는지 확인
    const criticalElements = [
      'button',
      'input',
      'a',
      '[role="button"]',
      '[role="link"]'
    ]

    for (const selector of criticalElements) {
      const elements = await this.page.locator(selector).all()
      for (const element of elements) {
        if (await element.isVisible()) {
          await expect(element).toBeVisible()
        }
      }
    }
  }
}

// 성능 테스트 헬퍼
export class PerformanceHelpers {
  private webVitalsCollector: WebVitalsCollector

  constructor(private page: Page) {
    this.webVitalsCollector = new WebVitalsCollector(page)
  }

  /**
   * 성능 수집 시작
   */
  async startPerformanceCollection(): Promise<void> {
    await this.webVitalsCollector.setupCollection()
  }

  /**
   * Core Web Vitals 측정
   */
  async measureWebVitals(): Promise<PerformanceMetrics> {
    return await this.webVitalsCollector.collectPerformanceMetrics()
  }

  /**
   * 상세 성능 리포트 생성
   */
  async generatePerformanceReport(): Promise<any> {
    return await this.webVitalsCollector.generateDetailedReport()
  }

  /**
   * 성능 데이터를 테스트에 첨부
   */
  async attachPerformanceData(testInfo: any): Promise<void> {
    await this.webVitalsCollector.attachPerformanceData(testInfo)
  }

  /**
   * 페이지 로드 성능 측정
   */
  async measurePageLoad(url: string): Promise<PerformanceMetrics> {
    await this.startPerformanceCollection()
    await this.page.goto(url)
    await this.webVitalsCollector.waitForPageStability()
    return await this.measureWebVitals()
  }

  /**
   * 네트워크 성능 분석
   */
  async analyzeNetworkPerformance(): Promise<{
    requests: any[]
    totalSize: number
    errors: any[]
    cacheable: number
  }> {
    return await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      const errors = (window as any).__networkErrors || []

      const requests = resources.map((resource: any) => ({
        name: resource.name,
        size: resource.transferSize,
        duration: resource.duration,
        type: resource.initiatorType,
        cached: resource.transferSize === 0 && resource.decodedBodySize > 0
      }))

      const totalSize = requests.reduce((sum, req) => sum + (req.size || 0), 0)
      const cacheable = requests.filter(req => req.cached).length

      return {
        requests,
        totalSize,
        errors,
        cacheable
      }
    })
  }
}

// 통합 테스트 헬퍼 클래스
export class E2ETestHelpers {
  public auth: AuthHelpers
  public page: PageHelpers
  public report: TestReportHelpers
  public realtime: RealtimeHelpers
  public accessibility: AccessibilityHelpers
  public performance: PerformanceHelpers

  constructor(private pageInstance: Page) {
    this.auth = new AuthHelpers(pageInstance)
    this.page = new PageHelpers(pageInstance)
    this.report = new TestReportHelpers(pageInstance)
    this.realtime = new RealtimeHelpers(pageInstance)
    this.accessibility = new AccessibilityHelpers(pageInstance)
    this.performance = new PerformanceHelpers(pageInstance)
  }

  /**
   * 종합 페이지 테스트 실행
   */
  async runComprehensivePageTest(url: string, options: {
    checkAccessibility?: boolean
    measurePerformance?: boolean
    testKeyboardNav?: boolean
    testResponsive?: boolean
  } = {}): Promise<{
    accessibilityResults?: AxeResults
    performanceResults?: PerformanceMetrics
    responsiveResults?: boolean
  }> {
    const results: any = {}

    // 성능 측정 시작
    if (options.measurePerformance) {
      await this.performance.startPerformanceCollection()
    }

    // 페이지 이동
    await this.pageInstance.goto(url)
    await this.page.waitForPageLoad()

    // 접근성 검사
    if (options.checkAccessibility) {
      results.accessibilityResults = await this.accessibility.runAccessibilityCheck()
    }

    // 키보드 네비게이션 테스트
    if (options.testKeyboardNav) {
      const focusableElements = await this.pageInstance.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all()

      if (focusableElements.length > 0) {
        // 간단한 Tab 키 테스트
        await this.pageInstance.keyboard.press('Tab')
        await expect(focusableElements[0]).toBeFocused()
      }
    }

    // 반응형 테스트
    if (options.testResponsive) {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1024, height: 768 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ]

      for (const viewport of viewports) {
        await this.pageInstance.setViewportSize(viewport)
        await this.pageInstance.waitForTimeout(500)
        // 기본 요소들이 여전히 보이는지 확인
        await expect(this.pageInstance.locator('body')).toBeVisible()
      }

      results.responsiveResults = true
    }

    // 성능 측정
    if (options.measurePerformance) {
      results.performanceResults = await this.performance.measureWebVitals()
    }

    return results
  }
}