/**
 * ✅ 전역 Realtime 채널 레지스트리
 *
 * React Strict Mode와 HMR로 인한 중복 구독 방지
 *
 * 문제:
 * - React Strict Mode: useEffect가 2번 실행 (개발 환경)
 * - HMR: 코드 변경 시 이전 구독이 정리되기 전에 새 구독 생성
 * - 비동기 cleanup: removeChannel이 완료되기 전에 새 구독 시작
 *
 * 해결:
 * - 전역 싱글톤 레지스트리로 채널 이름 기반 중복 방지
 * - 동기적 락 메커니즘으로 경쟁 조건 제거
 * - Supabase 클라이언트 레벨에서 채널 관리
 */

import { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();

interface ChannelEntry {
  channel: RealtimeChannel;
  refCount: number;
  topic: string;
}

class RealtimeChannelRegistry {
  private channels: Map<string, ChannelEntry> = new Map();
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * 채널 가져오기 또는 생성
   * - 이미 존재하면 기존 채널 반환 (참조 카운트 증가)
   * - 없으면 새로 생성
   */
  async getOrCreateChannel(
    channelName: string,
    config?: {
      broadcast?: { self?: boolean };
      presence?: { key?: string };
    }
  ): Promise<RealtimeChannel> {
    // 락 대기 (다른 스레드가 같은 채널 생성 중이면 대기)
    while (this.locks.has(channelName)) {
      await this.locks.get(channelName);
    }

    const existing = this.channels.get(channelName);
    if (existing) {
      existing.refCount++;
      if (process.env.NODE_ENV === 'development') {
        console.log(`♻️ [Registry] Reusing channel: ${channelName} (refs: ${existing.refCount})`);
      }
      return existing.channel;
    }

    // 락 설정
    let resolveLock: () => void;
    const lock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(channelName, lock);

    try {
      // 새 채널 생성
      const channel = supabase.channel(channelName, { config });

      this.channels.set(channelName, {
        channel,
        refCount: 1,
        topic: channelName
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`✨ [Registry] Created channel: ${channelName}`);
      }

      return channel;
    } finally {
      // 락 해제
      this.locks.delete(channelName);
      resolveLock!();
    }
  }

  /**
   * 채널 해제
   * - 참조 카운트 감소
   * - 참조 카운트가 0이 되면 실제로 채널 제거
   * - 음수 방지: 이미 제거 중인 채널은 중복 제거하지 않음
   */
  async releaseChannel(channelName: string): Promise<void> {
    const entry = this.channels.get(channelName);
    if (!entry) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [Registry] Attempted to release non-existent channel: ${channelName}`);
      }
      return;
    }

    // ✅ 음수 방지: 이미 0이면 더 이상 감소시키지 않음
    if (entry.refCount <= 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [Registry] Channel ${channelName} already released (refs: ${entry.refCount}), skipping duplicate cleanup`);
      }
      return;
    }

    entry.refCount--;

    if (process.env.NODE_ENV === 'development') {
      console.log(`➖ [Registry] Released channel: ${channelName} (refs: ${entry.refCount})`);
    }

    if (entry.refCount <= 0) {
      try {
        await supabase.removeChannel(entry.channel);
        this.channels.delete(channelName);
        if (process.env.NODE_ENV === 'development') {
          console.log(`🗑️ [Registry] Removed channel: ${channelName}`);
        }
      } catch (error) {
        console.error(`❌ [Registry] Failed to remove channel ${channelName}:`, error);
        // 에러가 나도 맵에서는 제거
        this.channels.delete(channelName);
      }
    }
  }

  /**
   * 특정 채널 강제 제거 (긴급 상황용)
   */
  async forceRemoveChannel(channelName: string): Promise<void> {
    const entry = this.channels.get(channelName);
    if (entry) {
      try {
        await supabase.removeChannel(entry.channel);
        this.channels.delete(channelName);
        if (process.env.NODE_ENV === 'development') {
          console.log(`💥 [Registry] Force removed channel: ${channelName}`);
        }
      } catch (error) {
        console.error(`❌ [Registry] Failed to force remove channel ${channelName}:`, error);
        this.channels.delete(channelName);
      }
    }
  }

  /**
   * 모든 채널 정리 (테스트 또는 앱 종료 시)
   */
  async clearAll(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧹 [Registry] Clearing all channels (${this.channels.size} total)`);
    }

    const promises = Array.from(this.channels.values()).map(entry =>
      supabase.removeChannel(entry.channel).catch(err => {
        console.error(`Failed to remove channel ${entry.topic}:`, err);
      })
    );

    await Promise.all(promises);
    this.channels.clear();
    this.locks.clear();
  }

  /**
   * 현재 등록된 채널 목록 (디버깅용)
   */
  getChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * 채널 상태 확인 (디버깅용)
   */
  getChannelInfo(channelName: string): { exists: boolean; refCount?: number } {
    const entry = this.channels.get(channelName);
    return {
      exists: !!entry,
      refCount: entry?.refCount
    };
  }
}

// 전역 싱글톤 인스턴스
export const channelRegistry = new RealtimeChannelRegistry();

// 개발 환경에서 window에 노출 (디버깅용)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__channelRegistry = channelRegistry;
}
