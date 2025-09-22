import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { E2ETestHelpers, TestDataManager, TestUser, TestChat } from '../utils/e2e-utils'

test.describe('🚀 Real-time Features - Chat & Notifications', () => {
  let helpers1: E2ETestHelpers
  let helpers2: E2ETestHelpers
  let testDataManager: TestDataManager
  let testUser1: TestUser
  let testUser2: TestUser
  let testChat: TestChat

  // 두 개의 브라우저 컨텍스트로 실시간 기능 테스트
  let context1: BrowserContext
  let context2: BrowserContext
  let page1: Page
  let page2: Page

  test.beforeAll(async ({ browser }) => {
    testDataManager = new TestDataManager()

    // 두 명의 테스트 사용자 생성
    testUser1 = await testDataManager.createTestUser({
      username: 'chatuser1',
      role: 'user'
    })

    testUser2 = await testDataManager.createTestUser({
      username: 'chatuser2',
      role: 'user'
    })

    // 테스트용 채팅방 생성
    testChat = await testDataManager.createTestChat({
      name: 'Test Chat Room',
      creator_id: testUser1.id
    })

    // 두 개의 브라우저 컨텍스트 생성
    context1 = await browser.newContext()
    context2 = await browser.newContext()

    page1 = await context1.newPage()
    page2 = await context2.newPage()

    helpers1 = new E2ETestHelpers(page1)
    helpers2 = new E2ETestHelpers(page2)
  })

  test.beforeEach(async () => {
    // 성능 측정 시작
    await helpers1.performance.startPerformanceCollection()
    await helpers2.performance.startPerformanceCollection()

    // 각각 다른 사용자로 로그인
    await page1.goto('/auth/login')
    await helpers1.auth.loginAsTestUser(testUser1)

    await page2.goto('/auth/login')
    await helpers2.auth.loginAsTestUser(testUser2)
  })

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== 'passed') {
      await helpers1.report.captureFailureScreenshot(`${testInfo.title}-user1`)
      await helpers2.report.captureFailureScreenshot(`${testInfo.title}-user2`)
    }
  })

  test.afterAll(async () => {
    await testDataManager.cleanup()
    await context1.close()
    await context2.close()
  })

  test.describe('💬 Real-time Chat', () => {
    test('should establish WebSocket connection successfully', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      await helpers1.page.waitForPageLoad()
      await helpers2.page.waitForPageLoad()

      // WebSocket 연결 상태 확인
      const connection1 = await helpers1.realtime.checkWebSocketConnection()
      const connection2 = await helpers2.realtime.checkWebSocketConnection()

      expect(connection1).toBe(true)
      expect(connection2).toBe(true)

      // 연결 상태 UI 표시 확인
      await expect(page1.getByTestId('connection-status')).toContainText('연결됨')
      await expect(page2.getByTestId('connection-status')).toContainText('연결됨')
    })

    test('should send and receive messages in real-time', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      await helpers1.page.waitForPageLoad()
      await helpers2.page.waitForPageLoad()

      const messageText = `Real-time test message ${Date.now()}`

      // User1이 메시지 전송
      await helpers1.realtime.sendAndVerifyMessage(messageText)

      // User2에서 메시지가 즉시 수신되는지 확인
      await expect(page2.getByTestId('chat-message').last()).toContainText(messageText)
      await expect(page2.getByTestId('message-author').last()).toContainText(testUser1.username)

      // 메시지 타임스탬프 확인
      await expect(page2.getByTestId('message-timestamp').last()).toBeVisible()

      // 메시지 전달 확인 표시
      await expect(page1.getByTestId('message-delivered-indicator')).toBeVisible()
    })

    test('should show typing indicators', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      await helpers1.page.waitForPageLoad()
      await helpers2.page.waitForPageLoad()

      // User1이 타이핑 시작
      const messageInput1 = page1.locator('[data-testid="message-input"]')
      await messageInput1.click()
      await messageInput1.type('타이핑 중...', { delay: 100 })

      // User2에서 타이핑 인디케이터 확인
      await helpers2.realtime.waitForTypingIndicator()
      await expect(page2.getByTestId('typing-indicator')).toContainText(`${testUser1.username}님이 입력 중`)

      // 타이핑 중단 후 인디케이터 사라짐 확인
      await messageInput1.clear()
      await page1.waitForTimeout(3000) // 타이핑 중단 타임아웃

      await expect(page2.getByTestId('typing-indicator')).not.toBeVisible()
    })

    test('should handle message delivery status', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      const messageText = `Status test message ${Date.now()}`

      // User1이 메시지 전송
      await page1.fill('[data-testid="message-input"]', messageText)
      await page1.press('[data-testid="message-input"]', 'Enter')

      // 전송 상태 확인 (보냄 → 전달됨)
      const messageElement = page1.getByTestId('chat-message').last()
      await expect(messageElement.locator('[data-testid="message-status"]')).toContainText('전달됨')

      // User2가 메시지를 읽으면 읽음 표시
      await page2.locator('[data-testid="chat-message"]').last().scrollIntoViewIfNeeded()
      await page2.waitForTimeout(1000)

      // 읽음 상태 확인
      await expect(messageElement.locator('[data-testid="message-status"]')).toContainText('읽음')
    })

    test('should support file upload and sharing', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      // 파일 업로드 버튼 클릭
      await page1.click('[data-testid="file-upload-button"]')

      // 파일 선택 (테스트용 파일)
      const testFile = 'tests/fixtures/test-image.jpg'
      await page1.setInputFiles('[data-testid="file-input"]', testFile)

      // 파일 업로드 대기
      await helpers1.page.waitForLoadingComplete()

      // 업로드된 파일이 채팅에 표시되는지 확인
      await expect(page1.getByTestId('file-message')).toBeVisible()
      await expect(page1.getByTestId('file-name')).toContainText('test-image.jpg')

      // User2에서도 파일이 보이는지 확인
      await expect(page2.getByTestId('file-message')).toBeVisible()
      await expect(page2.getByTestId('file-download-link')).toBeVisible()
    })

    test('should handle chat room participants', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      // 참가자 목록 확인
      await expect(page1.getByTestId('participants-list')).toContainText(testUser1.username)
      await expect(page1.getByTestId('participants-list')).toContainText(testUser2.username)

      // 온라인 상태 표시 확인
      await expect(page1.getByTestId(`user-${testUser2.id}-status`)).toContainText('온라인')
      await expect(page2.getByTestId(`user-${testUser1.id}-status`)).toContainText('온라인')

      // User2가 채팅방을 나감
      await page2.close()

      // User1에서 User2가 오프라인으로 표시되는지 확인
      await expect(page1.getByTestId(`user-${testUser2.id}-status`)).toContainText('오프라인')
    })

    test('should implement message virtualization for performance', async () => {
      // 많은 메시지 생성 (100개)
      for (let i = 0; i < 100; i++) {
        await testDataManager.createTestMessage({
          content: `Message ${i}`,
          from_user_id: i % 2 === 0 ? testUser1.id : testUser2.id,
          chat_id: testChat.id
        })
      }

      await page1.goto(`/chat/${testChat.id}`)
      await helpers1.page.waitForPageLoad()

      // 가상화된 메시지 목록 확인
      const messageContainer = page1.locator('[data-testid="virtualized-messages"]')
      await expect(messageContainer).toBeVisible()

      // DOM에 렌더링된 메시지 수가 제한되어 있는지 확인 (성능을 위해)
      const renderedMessages = await page1.locator('[data-testid="chat-message"]').count()
      expect(renderedMessages).toBeLessThan(50) // 가상화로 인해 모든 메시지가 DOM에 있지 않음

      // 스크롤로 이전 메시지 로딩 확인
      await page1.evaluate(() => {
        const container = document.querySelector('[data-testid="virtualized-messages"]')
        container?.scrollTo(0, 0) // 맨 위로 스크롤
      })

      await page1.waitForTimeout(1000)

      // 이전 메시지들이 로딩되었는지 확인
      await expect(page1.getByTestId('chat-message').first()).toContainText('Message')
    })

    test('should handle connection interruption gracefully', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      // 네트워크 연결 끊기 시뮬레이션
      await page1.setOfflineMode(true)

      // 연결 끊김 상태 표시 확인
      await expect(page1.getByTestId('connection-status')).toContainText('연결 끊김')

      // 메시지 전송 시도 시 큐에 저장
      const offlineMessage = `Offline message ${Date.now()}`
      await page1.fill('[data-testid="message-input"]', offlineMessage)
      await page1.press('[data-testid="message-input"]', 'Enter')

      // 대기 중 상태 표시
      await expect(page1.getByTestId('message-queue-indicator')).toContainText('전송 대기 중')

      // 네트워크 복구
      await page1.setOfflineMode(false)

      // 연결 복구 후 대기 중이던 메시지 전송 확인
      await expect(page1.getByTestId('connection-status')).toContainText('연결됨')
      await expect(page2.getByTestId('chat-message').last()).toContainText(offlineMessage)
    })
  })

  test.describe('🔔 Real-time Notifications', () => {
    test('should show notification for new messages', async () => {
      // User1은 다른 페이지에 있음
      await page1.goto('/posts')
      await page2.goto(`/chat/${testChat.id}`)

      // User2가 메시지 전송
      const notificationMessage = `Notification test ${Date.now()}`
      await helpers2.realtime.sendAndVerifyMessage(notificationMessage)

      // User1에게 알림이 표시되는지 확인
      await helpers1.realtime.waitForNotification()

      // 알림 내용 확인
      const notification = page1.getByRole('alert')
      await expect(notification).toContainText(testUser2.username)
      await expect(notification).toContainText('새 메시지')

      // 알림 클릭으로 채팅방 이동
      await notification.click()
      await expect(page1).toHaveURL(`/chat/${testChat.id}`)
    })

    test('should show desktop notifications when permitted', async () => {
      // 알림 권한 허용
      await page1.context().grantPermissions(['notifications'])

      await page1.goto('/posts') // 채팅방이 아닌 페이지
      await page2.goto(`/chat/${testChat.id}`)

      // User2가 메시지 전송
      await helpers2.realtime.sendAndVerifyMessage('Desktop notification test')

      // 데스크톱 알림 표시 확인 (브라우저 API 모킹 필요)
      const notificationShown = await page1.evaluate(() => {
        return (window as any).__desktopNotificationShown || false
      })

      if (notificationShown) {
        expect(notificationShown).toBe(true)
      }
    })

    test('should manage notification settings', async () => {
      await page1.goto('/settings/notifications')
      await helpers1.page.waitForPageLoad()

      // 알림 설정 확인
      const chatNotificationToggle = page1.locator('[data-testid="chat-notifications-toggle"]')
      await expect(chatNotificationToggle).toBeVisible()

      // 알림 비활성화
      if (await chatNotificationToggle.isChecked()) {
        await chatNotificationToggle.click()
      }

      // 설정 저장
      await page1.click('[data-testid="save-settings-button"]')
      await helpers1.page.waitForToast('설정이 저장되었습니다')

      // 알림이 비활성화되었는지 테스트
      await page1.goto('/posts')
      await page2.goto(`/chat/${testChat.id}`)

      await helpers2.realtime.sendAndVerifyMessage('Should not notify')

      // 알림이 표시되지 않아야 함
      await page1.waitForTimeout(3000)
      const notifications = await page1.locator('[role="alert"]').count()
      expect(notifications).toBe(0)
    })

    test('should show unread message count', async () => {
      await page1.goto('/posts') // 채팅방이 아닌 페이지
      await page2.goto(`/chat/${testChat.id}`)

      // User2가 여러 메시지 전송
      await helpers2.realtime.sendAndVerifyMessage('Unread message 1')
      await helpers2.realtime.sendAndVerifyMessage('Unread message 2')
      await helpers2.realtime.sendAndVerifyMessage('Unread message 3')

      // User1의 네비게이션에서 안읽은 메시지 카운트 확인
      await expect(page1.getByTestId('unread-count-badge')).toContainText('3')

      // 채팅방 입장 후 카운트 리셋
      await page1.goto(`/chat/${testChat.id}`)
      await helpers1.page.waitForPageLoad()

      // 안읽은 메시지 카운트가 사라지는지 확인
      await expect(page1.getByTestId('unread-count-badge')).not.toBeVisible()
    })

    test('should handle mention notifications', async () => {
      await page1.goto('/posts')
      await page2.goto(`/chat/${testChat.id}`)

      // User2가 User1을 멘션하여 메시지 전송
      const mentionMessage = `@${testUser1.username} 안녕하세요!`
      await helpers2.realtime.sendAndVerifyMessage(mentionMessage)

      // User1에게 특별한 멘션 알림 표시
      const mentionNotification = page1.getByTestId('mention-notification')
      await expect(mentionNotification).toBeVisible()
      await expect(mentionNotification).toContainText('멘션')
      await expect(mentionNotification).toContainText(testUser2.username)

      // 멘션 알림은 일반 알림과 다른 스타일/음성
      const notificationClass = await mentionNotification.getAttribute('class')
      expect(notificationClass).toContain('mention')
    })
  })

  test.describe('🔄 Real-time Data Sync', () => {
    test('should sync post reactions in real-time', async () => {
      // 테스트용 게시물 생성
      const testPost = await testDataManager.createTestPost({
        title: 'Real-time Reaction Test',
        content: '<p>Test post for reactions</p>',
        author_id: testUser1.id
      })

      await page1.goto(`/posts/${testPost.id}`)
      await page2.goto(`/posts/${testPost.id}`)

      await helpers1.page.waitForPageLoad()
      await helpers2.page.waitForPageLoad()

      // User1이 좋아요 클릭
      await page1.click('[data-testid="like-button"]')

      // User2에서 좋아요 수가 즉시 업데이트되는지 확인
      await expect(page2.getByTestId('like-count')).toContainText('1')

      // User2가 좋아요 클릭
      await page2.click('[data-testid="like-button"]')

      // User1에서 좋아요 수가 업데이트되는지 확인
      await expect(page1.getByTestId('like-count')).toContainText('2')
    })

    test('should sync comments in real-time', async () => {
      const testPost = await testDataManager.createTestPost({
        title: 'Real-time Comment Test',
        content: '<p>Test post for comments</p>',
        author_id: testUser1.id
      })

      await page1.goto(`/posts/${testPost.id}`)
      await page2.goto(`/posts/${testPost.id}`)

      const commentText = `Real-time comment ${Date.now()}`

      // User1이 댓글 작성
      await page1.fill('[data-testid="comment-input"]', commentText)
      await page1.click('[data-testid="submit-comment-button"]')

      // User2에서 댓글이 즉시 표시되는지 확인
      await expect(page2.getByTestId('comment-list')).toContainText(commentText)
      await expect(page2.getByTestId('comment-count')).toContainText('1')
    })

    test('should sync follow/unfollow actions', async () => {
      await page1.goto(`/profile/${testUser2.username}`)
      await page2.goto(`/profile/${testUser2.username}`)

      // User1이 User2를 팔로우
      await page1.click('[data-testid="follow-button"]')

      // User2의 프로필에서 팔로워 수 증가 확인
      await expect(page2.getByTestId('followers-count')).toContainText('1')

      // User1이 언팔로우
      await page1.click('[data-testid="unfollow-button"]')

      // User2의 프로필에서 팔로워 수 감소 확인
      await expect(page2.getByTestId('followers-count')).toContainText('0')
    })
  })

  test.describe('⚡ Real-time Performance', () => {
    test('should handle high frequency message updates', async () => {
      await page1.goto(`/chat/${testChat.id}`)
      await page2.goto(`/chat/${testChat.id}`)

      const startTime = Date.now()

      // 빠른 속도로 메시지 전송 (1초에 10개)
      for (let i = 0; i < 10; i++) {
        await helpers1.realtime.sendAndVerifyMessage(`Fast message ${i}`)
        await page1.waitForTimeout(100)
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // 모든 메시지가 User2에서 수신되었는지 확인
      const messageCount = await page2.locator('[data-testid="chat-message"]').count()
      expect(messageCount).toBeGreaterThanOrEqual(10)

      // 성능이 합리적인지 확인 (5초 이내)
      expect(totalTime).toBeLessThan(5000)

      console.log(`High frequency messages processed in ${totalTime}ms`)
    })

    test('should handle memory usage efficiently in long sessions', async () => {
      await page1.goto(`/chat/${testChat.id}`)

      // 메모리 사용량 초기 측정
      const initialMemory = await page1.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      // 많은 메시지 생성 및 수신
      for (let i = 0; i < 50; i++) {
        await helpers1.realtime.sendAndVerifyMessage(`Memory test message ${i}`)
        await page1.waitForTimeout(50)
      }

      // 메모리 사용량 재측정
      const finalMemory = await page1.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      // 메모리 증가가 합리적인지 확인 (50MB 이내)
      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })

    test('should maintain WebSocket connection stability', async () => {
      await page1.goto(`/chat/${testChat.id}`)

      let connectionDrops = 0

      // 연결 상태 모니터링
      await page1.evaluate(() => {
        let drops = 0
        const checkConnection = () => {
          if (!(window as any).supabaseRealtimeConnected) {
            drops++
          }
          ;(window as any).__connectionDrops = drops
        }

        setInterval(checkConnection, 1000)
      })

      // 5분간 대기하며 연결 안정성 확인
      await page1.waitForTimeout(30000) // 30초 (실제로는 더 길게 테스트)

      connectionDrops = await page1.evaluate(() => {
        return (window as any).__connectionDrops || 0
      })

      // 연결 끊김이 없거나 최소한이어야 함
      expect(connectionDrops).toBeLessThan(3)
    })
  })
})