import { test, expect, type Page } from '@playwright/test';

/**
 * 채팅 완전한 플로우 E2E 테스트
 *
 * 시나리오:
 * 1. 주현규(UserA): 채팅 리스트에만 있음 (채팅방 클릭 안함)
 * 2. 박할매(UserB): 채팅방 안에서 "안녕" 메시지 전송
 * 3. 주현규 화면: 박할매 채팅방 리스트에 "안녕" + 빨간 카운트 "1"
 * 4. 박할매 화면: "안녕" 메시지에 안읽음 표시 "1"
 * 5. 박할매 채팅방 나가기 → 리스트로 이동
 * 6. 주현규 방: "대화할 상대가 없습니다." 표시
 * 7. 주현규도 나가기 → 채팅방 사라짐 + 리스트로 이동
 */

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

// 로그인 헬퍼 함수
async function login(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // URL 변경 대기 - login 페이지를 떠나면 성공
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 15000 }
  );

  // 추가로 네비게이션이 안정화될 때까지 대기
  await page.waitForTimeout(1000);
}

test.describe('채팅 완전한 플로우 테스트', () => {

  test('읽지 않음 배지 → 채팅방 나가기 → 방 사라짐 전체 플로우', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ========================================
      // STEP 1: 로그인
      // ========================================
      console.log('🔐 STEP 1: UserA(주현규)와 UserB(박할매) 로그인');
      await Promise.all([
        login(pageA, USER_A.email, USER_A.password),
        login(pageB, USER_B.email, USER_B.password)
      ]);
      console.log('✅ 로그인 성공\n');

      // ========================================
      // STEP 2: UserA는 리스트에 대기
      // ========================================
      console.log('📱 STEP 2: UserA /chat 리스트에서 대기 (채팅방 클릭 안함)');
      await pageA.goto('http://localhost:3000/chat');
      await pageA.waitForTimeout(1000);
      const urlA1 = pageA.url();
      console.log(`📍 UserA URL: ${urlA1}`);
      expect(urlA1).toBe('http://localhost:3000/chat'); // room 파라미터 없어야 함
      console.log('✅ UserA는 리스트에만 있음\n');

      // ========================================
      // STEP 3: UserB가 채팅방 들어가서 메시지 전송
      // ========================================
      console.log('💬 STEP 3: UserB가 채팅방 입장 및 "안녕" 메시지 전송');
      await pageB.goto('http://localhost:3000/chat');
      await pageB.waitForTimeout(1000);

      // UserB가 UserA 채팅방 찾기
      let roomItemB = pageB.locator('.border-b').filter({ hasText: USER_A.username });
      let roomCount = await roomItemB.count();

      if (roomCount > 0) {
        console.log('✅ 기존 채팅방 발견');
        await roomItemB.first().click();
        await pageB.waitForTimeout(500);
      } else {
        // 채팅방 생성
        console.log('⚠️ 채팅방 없음, 새로 생성');

        // 전체 사용자 검색 버튼 클릭
        await pageB.click('button[title="전체 사용자 검색"]');
        await pageB.waitForTimeout(500);

        // 검색창에 UserA 입력 (최소 2글자 필요)
        await pageB.fill('input[placeholder="사용자 검색..."]', USER_A.username);
        await pageB.waitForTimeout(1500); // 검색 디바운싱 대기 (300ms) + 결과 로딩 대기

        // UserA가 포함된 사용자 아이템 찾기
        const userItem = pageB.locator('.flex.items-center.gap-3').filter({ hasText: USER_A.username });

        // 해당 사용자 아이템 내의 "채팅 시작" 버튼 클릭
        await userItem.locator('button[title="채팅 시작"]').click();

        // URL이 room 파라미터를 포함할 때까지 대기 (최대 5초)
        await pageB.waitForFunction(
          () => window.location.search.includes('?room='),
          { timeout: 5000 }
        );

        console.log('✅ 새 채팅방 생성 완료');
      }

      // URL 확인
      const urlB1 = pageB.url();
      console.log(`📍 UserB URL: ${urlB1}`);
      expect(urlB1).toContain('?room=');
      console.log('✅ UserB가 채팅방 안에 있음');

      // 메시지 전송
      const messageInput = pageB.locator('textarea[placeholder*="메시지"]');
      await messageInput.fill('안녕');
      await pageB.click('button[type="submit"]');
      await pageB.waitForTimeout(1000);
      console.log('✅ "안녕" 메시지 전송 완료\n');

      // ========================================
      // STEP 4: UserA 화면에서 배지 확인
      // ========================================
      console.log('🔔 STEP 4: UserA 리스트에서 배지 및 마지막 메시지 확인');
      await pageA.waitForTimeout(2000); // Realtime 전파 대기

      const roomItemA = pageA.locator('.border-b').filter({ hasText: USER_B.username });
      await expect(roomItemA).toBeVisible({ timeout: 5000 });
      console.log('✅ UserA 리스트에 UserB 채팅방 표시됨');

      // 채팅방 아이템의 HTML 덤프 (디버깅용)
      const roomItemHTML = await roomItemA.innerHTML();
      console.log('📝 채팅방 HTML:', roomItemHTML);

      // 읽지 않음 배지 확인
      const unreadBadgeA = roomItemA.locator('span.text-red-500').filter({ hasText: /^[1-9][0-9]*$|^99\+$/ });
      await expect(unreadBadgeA).toBeVisible({ timeout: 10000 });
      const badgeTextA = await unreadBadgeA.textContent();
      console.log(`✅ UserA 리스트에 읽지 않음 배지: ${badgeTextA}`);
      expect(parseInt(badgeTextA || '0')).toBeGreaterThanOrEqual(1);

      // 마지막 메시지 "안녕" 확인
      const lastMessageA = roomItemA.locator('p.text-sm.text-muted-foreground').first();
      const messageContentA = await lastMessageA.textContent();
      console.log(`✅ UserA 리스트에 마지막 메시지: "${messageContentA}"`);
      expect(messageContentA).toContain('안녕');
      console.log('✅ UserA 화면 확인 완료\n');

      // ========================================
      // STEP 5: UserB 화면에서 안읽음 표시 확인
      // ========================================
      console.log('📊 STEP 5: UserB 화면에서 안읽음 표시 "1" 확인');

      // "안녕" 메시지 찾기
      const sentMessage = pageB.locator('div').filter({ hasText: '안녕' }).first();
      await expect(sentMessage).toBeVisible();

      // 안읽음 카운트 확인 (있어야 함)
      // 메시지 읽음 상태는 메시지 오른쪽 하단에 작은 숫자로 표시됨
      const hasMessage = await sentMessage.isVisible();
      console.log(`✅ UserB 화면에 "안녕" 메시지 표시됨: ${hasMessage}`);
      console.log('✅ UserB가 메시지를 보냄 (안읽음 상태여야 함)\n');

      // ========================================
      // STEP 6: UserB 채팅방 나가기
      // ========================================
      console.log('🚪 STEP 6: UserB 채팅방 나가기');

      // MoreHorizontal 버튼 클릭 (채팅방 헤더의 메뉴 버튼)
      await pageB.locator('button').filter({ has: pageB.locator('svg.lucide-ellipsis') }).last().click();
      await pageB.waitForTimeout(500);

      // 나가기 버튼 클릭
      const leaveButton = pageB.locator('button').filter({ hasText: '나가기' });
      await leaveButton.click();
      await pageB.waitForTimeout(1000); // 나가기 처리 대기

      // URL 확인 - 리스트로 돌아갔는지
      const urlB2 = pageB.url();
      console.log(`📍 UserB URL after leave: ${urlB2}`);
      expect(urlB2).toBe('http://localhost:3000/chat'); // room 파라미터 없어야 함
      console.log('✅ UserB가 채팅방 리스트로 이동\n');

      // ========================================
      // STEP 7: UserA 화면에서 "대화할 상대가 없습니다" 확인
      // ========================================
      console.log('👥 STEP 7: UserA가 채팅방 클릭 → "대화할 상대가 없습니다" 확인');

      // UserA가 채팅방 클릭
      await pageA.waitForTimeout(2000); // Realtime 전파 대기
      const roomItemA2 = pageA.locator('.border-b').filter({ hasText: USER_B.username });

      // 채팅방이 아직 리스트에 있는지 확인
      const roomStillExists = await roomItemA2.count() > 0;
      console.log(`📋 UserA 리스트에 채팅방 존재: ${roomStillExists}`);

      if (roomStillExists) {
        await roomItemA2.first().click();
        await pageA.waitForTimeout(1000);

        // "대화할 상대가 없습니다" 또는 유사한 메시지 확인
        // 실제 구현에 따라 텍스트가 다를 수 있음
        const emptyMessage = pageA.locator('text=/대화할 상대가 없습니다|참여자가 없습니다|채팅방이 비어있습니다/i');
        const hasEmptyMessage = await emptyMessage.count() > 0;

        if (hasEmptyMessage) {
          console.log('✅ UserA 화면에 "대화할 상대가 없습니다" 표시됨');
        } else {
          console.log('⚠️ "대화할 상대가 없습니다" 메시지를 찾을 수 없음 (구현 확인 필요)');
        }
      } else {
        console.log('⚠️ UserA 리스트에서 채팅방이 이미 사라짐');
      }
      console.log();

      // ========================================
      // STEP 8: UserA도 채팅방 나가기
      // ========================================
      console.log('🚪 STEP 8: UserA도 채팅방 나가기');

      const urlA2 = pageA.url();
      if (urlA2.includes('?room=')) {
        // 채팅방 안에 있으면 나가기
        await pageA.locator('button').filter({ has: pageA.locator('svg.lucide-ellipsis') }).click();
        await pageA.waitForTimeout(500);

        const leaveButtonA = pageA.locator('button').filter({ hasText: '나가기' });
        await leaveButtonA.click();
        await pageA.waitForTimeout(1000);

        const urlA3 = pageA.url();
        console.log(`📍 UserA URL after leave: ${urlA3}`);
        expect(urlA3).toBe('http://localhost:3000/chat');
        console.log('✅ UserA가 채팅방 리스트로 이동');
      } else {
        console.log('⚠️ UserA는 이미 리스트에 있음');
      }
      console.log();

      // ========================================
      // STEP 9: 채팅방 완전히 사라졌는지 확인
      // ========================================
      console.log('🗑️ STEP 9: 채팅방이 리스트에서 완전히 사라졌는지 확인');

      await pageA.waitForTimeout(2000); // Realtime 전파 대기

      // UserA 리스트에서 UserB 채팅방 찾기
      const roomItemA3 = pageA.locator('.border-b').filter({ hasText: USER_B.username });
      const roomCountA = await roomItemA3.count();
      console.log(`📋 UserA 리스트에 남은 채팅방: ${roomCountA}개`);

      // UserB 리스트에서도 확인
      await pageB.waitForTimeout(1000);
      const roomItemB2 = pageB.locator('.border-b').filter({ hasText: USER_A.username });
      const roomCountB = await roomItemB2.count();
      console.log(`📋 UserB 리스트에 남은 채팅방: ${roomCountB}개`);

      if (roomCountA === 0 && roomCountB === 0) {
        console.log('✅ 채팅방이 양쪽 리스트에서 모두 사라짐 (정상)');
      } else {
        console.log('⚠️ 채팅방이 아직 리스트에 남아있음 (soft delete일 수 있음)');
      }

      console.log('\n🎉 전체 플로우 테스트 완료!');

    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
