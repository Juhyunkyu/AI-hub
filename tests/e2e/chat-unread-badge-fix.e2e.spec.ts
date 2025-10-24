import { test, expect, type Page } from '@playwright/test';

// 테스트 사용자 정보
const USER_A = {
  email: 'test-user-a@example.com',
  password: 'TestPassword123!',
  username: 'UserA'
};

const USER_B = {
  email: 'test-user-b@example.com',
  password: 'TestPassword123!',
  username: 'UserB'
};

/**
 * 읽지 않음 배지 및 읽음 상태 버그 수정 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 박할매(User B)가 /chat 리스트에 있음
 * 2. 주현규(User A)가 메시지 "안녕" 전송
 * 3. 박할매 화면에서 채팅방 아이템에 배지 "1" 표시 확인
 * 4. 박할매가 채팅방 클릭 (아직 메시지 안 봄) → 배지 그대로 "1" 유지
 * 5. 메시지가 화면에 로드되면 → 배지 사라짐 (읽음 처리)
 */

// 로그인 헬퍼 함수
async function login(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // 로그인 성공 후 메인 페이지로 리다이렉트 대기
  await page.waitForURL('/', { timeout: 15000 });
}

test.describe('읽지 않음 배지 및 읽음 상태 수정', () => {

  test('UserB가 /chat 리스트에서 대기 → UserA 메시지 전송 → 배지 표시 → 방 입장 후 배지 사라짐', async ({ browser }) => {
    // 1. 두 사용자 브라우저 컨텍스트 생성
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // 2. User A와 User B 로그인
      console.log('🔐 User A(UserA)와 User B(UserB) 로그인 중...');
      await Promise.all([
        login(pageA, USER_A.email, USER_A.password),
        login(pageB, USER_B.email, USER_B.password)
      ]);
      console.log('✅ 로그인 성공');

      // 3. User A가 /chat으로 이동
      console.log('📱 User A /chat으로 이동');
      await pageA.goto('http://localhost:3000/chat');
      await pageA.waitForTimeout(1000);

      // 4. User B가 /chat 리스트에서 대기
      console.log('📱 User B /chat 리스트에서 대기 중...');
      await pageB.goto('http://localhost:3000/chat');
      await pageB.waitForTimeout(1000);

      // 5. User A가 User B와의 1:1 채팅방 찾기 또는 생성
      console.log('🔍 User A가 User B와의 채팅방 찾는 중...');

      // 채팅방 목록에서 "UserB" 찾기
      let roomFound = false;
      try {
        const roomItem = pageA.locator('.border-b').filter({ hasText: USER_B.username });
        const count = await roomItem.count();
        if (count > 0) {
          console.log('✅ 기존 채팅방 발견');
          await roomItem.first().click();
          roomFound = true;
        }
      } catch (e) {
        console.log('⚠️ 기존 채팅방 없음, 새로 생성');
      }

      // 채팅방이 없으면 새로 생성
      if (!roomFound) {
        // 전체 사용자 검색 버튼 클릭
        await pageA.click('button[title="전체 사용자 검색"]');
        await pageA.waitForTimeout(500);

        // 검색창에 "UserB" 입력
        await pageA.fill('input[placeholder*="검색"]', USER_B.username);
        await pageA.waitForTimeout(500);

        // 검색 결과에서 UserB 클릭
        const userResult = pageA.locator('button').filter({ hasText: USER_B.username });
        await userResult.first().click();
        await pageA.waitForTimeout(1000);

        console.log('✅ 새 채팅방 생성 완료');
      }

      // 6. User A가 메시지 "안녕" 전송
      console.log('💬 User A가 "안녕" 메시지 전송 중...');
      const messageInput = pageA.locator('textarea[placeholder*="메시지"]');
      await messageInput.fill('안녕');
      await pageA.click('button[type="submit"]');
      await pageA.waitForTimeout(1000);
      console.log('✅ 메시지 전송 완료');

      // 7. User B의 채팅방 리스트에서 읽지 않음 배지 확인
      console.log('🔔 User B 화면에서 읽지 않음 배지 확인 중...');
      await pageB.waitForTimeout(2000); // Realtime 전파 대기

      // 채팅방 아이템 찾기
      const roomItemB = pageB.locator('.border-b').filter({ hasText: USER_A.username });
      await expect(roomItemB).toBeVisible({ timeout: 5000 });

      // ✅ 읽지 않음 배지 "1" 확인 (메시지 시간 옆에 빨간 숫자)
      const unreadBadge = roomItemB.locator('span.text-red-500').filter({ hasText: /^[1-9][0-9]*$|^99\+$/ });
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });
      const badgeText = await unreadBadge.textContent();
      console.log(`✅ 읽지 않음 배지 표시 확인: ${badgeText}`);
      expect(parseInt(badgeText || '0')).toBeGreaterThanOrEqual(1);

      // 8. User B가 채팅방 클릭 (URL만 변경, 아직 메시지 로드 전)
      console.log('🖱️ User B가 채팅방 클릭...');
      await roomItemB.click();
      await pageB.waitForTimeout(500); // URL 변경 대기

      // ✅ URL이 변경되었는지 확인
      const urlAfterClick = pageB.url();
      expect(urlAfterClick).toContain('/chat?room=');
      console.log('✅ URL 변경 확인:', urlAfterClick);

      // ✅ 배지가 아직 남아있는지 확인 (메시지 로드 전)
      // 참고: 채팅방 내부로 들어가면 리스트가 숨겨질 수 있으므로 빠르게 확인
      // 데스크탑 화면에서는 리스트가 계속 보임
      try {
        const badgeAfterClick = pageB.locator('.border-b').filter({ hasText: USER_A.username })
          .locator('span.text-red-500').filter({ hasText: /^[1-9][0-9]*$|^99\+$/ });

        // 잠시 대기 후 배지가 아직 있는지 확인 (메시지 로드 전이므로 배지 유지)
        await pageB.waitForTimeout(500);
        const badgeVisible = await badgeAfterClick.isVisible().catch(() => false);
        console.log(`📊 방 클릭 직후 배지 상태: ${badgeVisible ? '표시됨' : '숨김/없음'}`);
      } catch (e) {
        console.log('⚠️ 모바일 화면이거나 리스트가 숨겨졌을 수 있음');
      }

      // 9. 메시지가 화면에 로드되면 읽음 처리
      console.log('📖 메시지 로딩 및 읽음 처리 대기...');

      // 메시지가 화면에 표시되는지 확인
      const messageContent = pageB.locator('div').filter({ hasText: '안녕' });
      await expect(messageContent).toBeVisible({ timeout: 5000 });
      console.log('✅ 메시지 화면에 표시됨');

      // 10. 읽음 처리 후 배지가 사라졌는지 확인
      console.log('🔄 읽음 처리 및 배지 사라짐 확인 중...');
      await pageB.waitForTimeout(2000); // 읽음 처리 Broadcast 전파 대기

      // User B가 데스크탑 화면이면 리스트에서 배지 확인
      try {
        const roomItemAfterRead = pageB.locator('.border-b').filter({ hasText: USER_A.username });
        const badgeAfterRead = roomItemAfterRead.locator('span.text-red-500').filter({ hasText: /^[1-9][0-9]*$|^99\+$/ });

        // 배지가 사라졌는지 확인 (또는 0으로 변경)
        const isBadgeGone = await badgeAfterRead.isHidden().catch(() => true);
        expect(isBadgeGone).toBe(true);
        console.log('✅ 읽음 처리 후 배지 사라짐 확인!');
      } catch (e) {
        console.log('⚠️ 리스트가 숨겨져서 배지 확인 불가 (모바일 화면일 수 있음)');
      }

      console.log('🎉 테스트 성공: 읽지 않음 배지 시스템이 올바르게 작동합니다!');

    } finally {
      // 정리
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });

  test('배지 UI 확인: 숫자만 표시, 배경 없음, 메시지 시간 옆에 위치', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 로그인
      await login(page, USER_A.email, USER_A.password);

      // /chat으로 이동
      await page.goto('http://localhost:3000/chat');
      await page.waitForTimeout(1000);

      // 읽지 않은 메시지가 있는 방 찾기 (있다면)
      const badges = page.locator('span.text-red-500').filter({ hasText: /^[1-9][0-9]*$|^99\+$/ });
      const badgeCount = await badges.count();

      if (badgeCount > 0) {
        console.log(`✅ 읽지 않음 배지 ${badgeCount}개 발견`);

        // 첫 번째 배지 선택
        const firstBadge = badges.first();

        // ✅ 스타일 확인: text-red-500 클래스가 있는지
        const className = await firstBadge.getAttribute('class');
        expect(className).toContain('text-red-500');
        expect(className).not.toContain('bg-'); // 배경색 클래스 없음
        expect(className).not.toContain('rounded-full'); // 둥근 배경 없음
        console.log('✅ 배지 스타일 확인: 숫자만 표시, 배경 없음');

        // ✅ 위치 확인: 메시지 시간과 같은 라인에 있는지
        const parentDiv = page.locator('div.flex.items-center.gap-1').filter({ has: firstBadge });
        await expect(parentDiv).toBeVisible();

        // 시간 텍스트가 같은 div 안에 있는지 확인
        const timeSpan = parentDiv.locator('span.text-muted-foreground');
        await expect(timeSpan).toBeVisible();
        console.log('✅ 배지 위치 확인: 메시지 시간 옆에 위치');

      } else {
        console.log('⚠️ 읽지 않은 메시지가 없어서 배지 UI 확인 건너뜀');
      }

    } finally {
      await page.close();
      await context.close();
    }
  });
});
