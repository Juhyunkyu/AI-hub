import { createClient } from '@supabase/supabase-js';

/**
 * 배치 Broadcast 헬퍼 - 여러 사용자에게 효율적으로 Broadcast 전송
 *
 * **사용 예시**:
 * ```typescript
 * await sendBatchBroadcast({
 *   userIds: ['user1', 'user2', 'user3'],
 *   channelPrefix: 'global:user',
 *   event: 'room_joined',
 *   getPayload: (userId) => ({ user_id: userId, room_id: roomId })
 * });
 * ```
 *
 * **최적화**:
 * - Promise.allSettled로 병렬 전송 (일부 실패해도 계속 진행)
 * - for loop 대신 병렬 처리로 성능 향상
 * - 개별 채널 생성/제거로 메모리 관리
 */
export async function sendBatchBroadcast(params: {
  userIds: string[];
  channelPrefix: string; // 예: 'global:user'
  event: string;
  getPayload: (userId: string) => Record<string, any>;
}): Promise<void> {
  const { userIds, channelPrefix, event, getPayload } = params;

  // userIds가 비어있으면 early return
  if (!userIds || userIds.length === 0) {
    return;
  }

  // Admin Client 생성 (Broadcast 전송용)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 모든 사용자에게 병렬로 Broadcast 전송
  const broadcasts = userIds.map(async (userId) => {
    const channel = supabaseAdmin.channel(`${channelPrefix}:${userId}:rooms`);

    try {
      await channel.send({
        type: 'broadcast',
        event,
        payload: getPayload(userId)
      });

      // 채널 정리
      await supabaseAdmin.removeChannel(channel);

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Broadcast sent to user ${userId}: ${event}`);
      }
    } catch (error) {
      // 개별 실패는 로그만 출력하고 계속 진행
      if (process.env.NODE_ENV === 'development') {
        console.error(`⚠️ Broadcast failed for user ${userId}:`, error);
      }
    }
  });

  // 모든 Broadcast 완료 대기 (일부 실패해도 무시)
  await Promise.allSettled(broadcasts);

  if (process.env.NODE_ENV === 'development') {
    console.log(`📢 Batch broadcast completed: ${userIds.length} users, event: ${event}`);
  }
}
