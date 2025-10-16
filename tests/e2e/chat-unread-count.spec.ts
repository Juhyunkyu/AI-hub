/**
 * 채팅 읽지 않은 메시지 카운트 테스트
 *
 * 테스트 시나리오:
 * 1. 두 명의 사용자 (주현규, 박할매)가 동시에 채팅
 * 2. 채팅방 안에 있을 때는 카운트가 증가하지 않아야 함
 * 3. 채팅방 밖에 있을 때만 카운트가 증가해야 함
 */

import { test, expect } from '@playwright/test';

// 테스트용 사용자 정보
const USER1 = {
  email: 'test-user1@example.com',
  password: 'TestPassword123!',
  name: '주현규'
};

const USER2 = {
  email: 'test-user2@example.com',
  password: 'TestPassword123!',
  name: '박할매'
};

// 헬퍼 함수: 로그인
async function login(page: any, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3000', { timeout: 10000 });
}

// 헬퍼 함수: 채팅방 진입
async function openChatRoom(page: any, roomName: string) {
  await page.goto('http://localhost:3000/chat');
  await page.waitForLoadState('networkidle');

  // 채팅방 리스트에서 특정 방 클릭
  const roomSelector = `text="${roomName}"`;
  await page.click(roomSelector);

  // 메시지 영역이 로드될 때까지 대기
  await page.waitForSelector('[data-testid="message-list"]', { timeout: 5000 });
}

test.describe('채팅 읽지 않은 메시지 카운트', () => {
  test('채팅방 안에서 메시지를 주고받을 때 카운트가 증가하지 않아야 함', async ({ browser }) => {
    // 두 개의 브라우저 컨텍스트 생성 (주현규, 박할매)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Step 1: 두 사용자 로그인
      await login(page1, USER1.email, USER1.password);
      await login(page2, USER2.email, USER2.password);

      console.log('✅ 두 사용자 로그인 완료');

      // Step 2: 두 사용자 모두 같은 채팅방 진입
      const chatRoomName = '테스트 채팅방';
      await openChatRoom(page1, chatRoomName);
      await openChatRoom(page2, chatRoomName);

      console.log('✅ 두 사용자 모두 채팅방 진입 완료');

      // Step 3: 주현규가 메시지 전송
      await page1.fill('textarea[placeholder*="메시지"]', '안녕하세요!');
      await page1.press('textarea[placeholder*="메시지"]', 'Enter');

      // 메시지 전송 대기
      await page1.waitForTimeout(1000);

      console.log('✅ 주현규 메시지 전송 완료');

      // Step 4: 박할매의 채팅방 리스트에서 카운트 확인 (채팅방 안에 있음)
      // 채팅방 리스트로 잠시 이동
      await page2.click('button[title="뒤로가기"]', { timeout: 1000 }).catch(() => {
        // 모바일 뷰가 아니면 무시
      });

      await page2.waitForTimeout(500);

      // 읽지 않은 메시지 배지 확인
      const unreadBadge = await page2.locator(`text="${chatRoomName}"`).locator('..').locator('[class*="badge"]').count();

      console.log(`📊 박할매의 읽지 않은 메시지 카운트: ${unreadBadge}`);

      // ❌ 채팅방 안에 있었으므로 카운트가 0이어야 함
      expect(unreadBadge).toBe(0);

      console.log('✅ 채팅방 안에서는 카운트가 증가하지 않음 - 통과!');

    } finally {
      // 정리
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('채팅방 밖에 있을 때 메시지를 받으면 카운트가 증가해야 함', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Step 1: 두 사용자 로그인
      await login(page1, USER1.email, USER1.password);
      await login(page2, USER2.email, USER2.password);

      // Step 2: 주현규만 채팅방 진입, 박할매는 채팅 리스트에 있음
      const chatRoomName = '테스트 채팅방';
      await openChatRoom(page1, chatRoomName);
      await page2.goto('http://localhost:3000/chat'); // 박할매는 채팅 리스트만 봄

      console.log('✅ 주현규 채팅방 진입, 박할매 리스트 대기');

      // Step 3: 주현규가 메시지 전송
      await page1.fill('textarea[placeholder*="메시지"]', '박할매님 계세요?');
      await page1.press('textarea[placeholder*="메시지"]', 'Enter');

      // 실시간 업데이트 대기 (Supabase Realtime)
      await page2.waitForTimeout(1500);

      console.log('✅ 주현규 메시지 전송 완료');

      // Step 4: 박할매의 채팅방 리스트에서 카운트 확인 (채팅방 밖에 있음)
      const unreadBadgeText = await page2.locator(`text="${chatRoomName}"`).locator('..').locator('[class*="badge"]').textContent().catch(() => '0');
      const unreadCount = parseInt(unreadBadgeText || '0');

      console.log(`📊 박할매의 읽지 않은 메시지 카운트: ${unreadCount}`);

      // ✅ 채팅방 밖에 있었으므로 카운트가 1 이상이어야 함
      expect(unreadCount).toBeGreaterThan(0);

      console.log('✅ 채팅방 밖에서는 카운트가 증가함 - 통과!');

      // Step 5: 박할매가 채팅방 진입 후 카운트 확인
      await openChatRoom(page2, chatRoomName);
      await page2.waitForTimeout(1000);

      // 채팅방 리스트로 다시 이동
      await page2.click('button[title="뒤로가기"]', { timeout: 1000 }).catch(() => {});
      await page2.waitForTimeout(500);

      // 카운트가 0으로 초기화되었는지 확인
      const unreadBadgeAfter = await page2.locator(`text="${chatRoomName}"`).locator('..').locator('[class*="badge"]').count();

      console.log(`📊 박할매가 채팅방 진입 후 카운트: ${unreadBadgeAfter}`);

      expect(unreadBadgeAfter).toBe(0);

      console.log('✅ 채팅방 진입 후 카운트 초기화됨 - 통과!');

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('헤더 네비게이션바의 채팅 아이콘에 빨간 점이 올바르게 표시됨', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await login(page1, USER1.email, USER1.password);
      await login(page2, USER2.email, USER2.password);

      // 박할매는 메인 페이지에 있음
      await page2.goto('http://localhost:3000');

      // 주현규가 채팅 메시지 전송
      const chatRoomName = '테스트 채팅방';
      await openChatRoom(page1, chatRoomName);
      await page1.fill('textarea[placeholder*="메시지"]', '새 메시지입니다!');
      await page1.press('textarea[placeholder*="메시지"]', 'Enter');

      await page2.waitForTimeout(1500);

      // 박할매의 네비게이션 바 채팅 아이콘 확인
      const chatIconBadge = await page2.locator('[data-testid="chat-notification-badge"]').isVisible();

      console.log(`📊 네비게이션 바 채팅 알림 표시: ${chatIconBadge}`);

      // ✅ 빨간 점이 표시되어야 함
      expect(chatIconBadge).toBe(true);

      console.log('✅ 네비게이션 바 알림 표시 - 통과!');

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
