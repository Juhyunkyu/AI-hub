"use client";

import {
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
  useState
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessage } from "@/types/chat";
import { MessageRenderer } from "./MessageRenderer";
import { useMessageHeight } from "./useMessageHeight";
import { TypingIndicatorMessage } from "../TypingIndicatorMessage";

interface VirtualizedMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  containerHeight: number;
  onLoadMore?: (startIndex: number, stopIndex: number) => Promise<void>;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  scrollToBottom?: boolean;
  searchQuery?: string;
  highlightIndices?: number[];
  className?: string;
  // 타이핑 인디케이터 props 추가
  typingUsers?: string[];
  participants?: {
    id: string;
    user_id: string;
    user?: {
      id: string;
      username: string;
      avatar_url?: string | null;
    };
  }[];
}

export interface VirtualizedMessageListRef {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToIndex: (index: number, align?: "auto" | "center" | "end" | "start") => void;
  scrollToItem: (messageId: string) => void;
}

/**
 * 고성능 가상화 메시지 리스트 컴포넌트
 * TanStack Virtual 기반으로 React 19 + Next.js 15 완전 호환
 *
 * 주요 기능:
 * - useVirtualizer 훅 기반 가상화
 * - 동적 높이 계산 및 캐싱
 * - 무한 스크롤 내장
 * - 스크롤 위치 관리
 * - 검색 결과 하이라이트
 */
export const VirtualizedMessageList = forwardRef<
  VirtualizedMessageListRef,
  VirtualizedMessageListProps
>(({
  messages,
  currentUserId,
  containerHeight,
  onLoadMore,
  hasNextPage = false,
  isNextPageLoading = false,
  scrollToBottom = false,
  searchQuery,
  highlightIndices = [],
  className = "",
  typingUsers = [],
  participants = []
}, ref) => {
  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  const wasAtBottomRef = useRef(true);

  // 상태
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 높이 관리 훅 (단순화됨)
  const { estimateSize } = useMessageHeight();

  // 타이핑 중인 사용자 필터링 (현재 사용자 제외)
  const otherTypingUsers = useMemo(() => {
    return typingUsers.filter(userId => userId !== currentUserId);
  }, [typingUsers, currentUserId]);

  // 타이핑 인디케이터 아이템 수 (각 타이핑 사용자당 하나씩)
  const typingItemCount = otherTypingUsers.length;

  // 무한 스크롤을 위한 총 아이템 수 (메시지 + 타이핑 인디케이터 + 로딩 아이템)
  const itemCount = messages.length + typingItemCount + (hasNextPage ? 1 : 0);

  // TanStack Virtual 설정 (메시지 겹침 방지 및 안정적인 높이 계산)
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      // 로딩 아이템인 경우 (가장 마지막)
      if (hasNextPage && index === itemCount - 1) {
        return 60; // 로딩 인디케이터 현실적 높이
      }

      // 타이핑 인디케이터인 경우 (메시지 다음, 로딩 전)
      if (index >= messages.length && index < messages.length + typingItemCount) {
        return 70; // 타이핑 인디케이터 높이
      }

      // 일반 메시지인 경우
      if (index < messages.length) {
        const size = estimateSize(index, messages);
        return Math.max(size, 40);
      }

      // 기본값
      return 40;
    }, [messages, estimateSize, itemCount, typingItemCount, hasNextPage]),
    overscan: 3, // 부드러운 스크롤을 위해 증가
    // 스크롤 위치 조정 비활성화 (겹침과 무한 루프 방지)
    shouldAdjustScrollPositionOnItemSizeChange: () => false,
    // 안정적인 키 관리
    getItemKey: useCallback((index: number) => {
      // 로딩 아이템인 경우
      if (hasNextPage && index === itemCount - 1) {
        return `loading-${index}`;
      }

      // 타이핑 인디케이터인 경우
      if (index >= messages.length && index < messages.length + typingItemCount) {
        const typingIndex = index - messages.length;
        const userId = otherTypingUsers[typingIndex];
        return `typing-${userId}`;
      }

      // 일반 메시지인 경우
      if (index < messages.length) {
        return messages[index]?.id || `msg-${index}`;
      }

      return `item-${index}`;
    }, [messages, hasNextPage, itemCount, typingItemCount, otherTypingUsers]),
    // 디버그 모드 비활성화 (성능 문제 방지)
    debug: false
  });

  // 가상 아이템 목록
  const virtualItems = virtualizer.getVirtualItems();

  // 메시지 데이터 (MessageRenderer에 전달) - 단순화됨
  const itemData = useMemo(() => ({
    messages,
    currentUserId,
    searchQuery,
    highlightIndices
  }), [messages, currentUserId, searchQuery, highlightIndices]);

  /**
   * 스크롤을 맨 아래로 이동
   */
  const scrollToBottomImpl = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!virtualizer || itemCount === 0) return;

    try {
      // 마지막 아이템으로 스크롤 (타이핑 인디케이터 또는 마지막 메시지)
      const lastIndex = itemCount - 1;

      // TanStack Virtual의 동적 크기 제한으로 인해 auto behavior 사용
      virtualizer.scrollToIndex(lastIndex, {
        align: 'end',
        behavior: "auto" // smooth 대신 auto 사용하여 경고 제거
      });
    } catch (error) {
      // 가상화 스크롤 실패 시 DOM 직접 조작으로 폴백
      if (parentRef.current) {
        // 렌더링 완료를 위한 짧은 지연 후 재시도
        requestAnimationFrame(() => {
          if (parentRef.current) {
            parentRef.current.scrollTo({
              top: parentRef.current.scrollHeight,
              behavior: behavior === "smooth" ? "smooth" : "auto"
            });
          }
        });
      }
    }
  }, [virtualizer, itemCount]);

  /**
   * 특정 인덱스로 스크롤
   */
  const scrollToIndex = useCallback((
    index: number,
    align: "auto" | "center" | "end" | "start" = "auto"
  ) => {
    if (!virtualizer) return;
    virtualizer.scrollToIndex(index, { align, behavior: "smooth" });
  }, [virtualizer]);

  /**
   * 메시지 ID로 스크롤
   */
  const scrollToItem = useCallback((messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      scrollToIndex(index, "center");
    }
  }, [messages, scrollToIndex]);

  // 외부 참조 노출
  useImperativeHandle(ref, () => ({
    scrollToBottom: scrollToBottomImpl,
    scrollToIndex,
    scrollToItem
  }), [scrollToBottomImpl, scrollToIndex, scrollToItem]);

  /**
   * 무한 스크롤 처리
   */
  const handleLoadMore = useCallback(async () => {
    if (isNextPageLoading || !onLoadMore || !hasNextPage) return;

    // 상위 20개 아이템이 보이기 시작하면 로드 시작
    const firstVisibleIndex = virtualItems[0]?.index ?? 0;

    if (firstVisibleIndex <= 20) {
      try {
        await onLoadMore(0, firstVisibleIndex + 20);
      } catch (error) {
        console.error('Failed to load more messages:', error);
      }
    }
  }, [virtualItems, isNextPageLoading, onLoadMore, hasNextPage]);

  /**
   * 스크롤 이벤트 핸들러
   */
  const handleScroll = useCallback((event: Event) => {
    const element = event.target as HTMLElement;

    // 사용자가 스크롤 중인지 감지
    if (!isScrollingRef.current) {
      setIsUserScrolling(true);
      isScrollingRef.current = true;

      // 스크롤 종료 감지를 위한 디바운스
      setTimeout(() => {
        setIsUserScrolling(false);
        isScrollingRef.current = false;
      }, 150);
    }

    // 맨 아래에 있는지 확인 (여유분 10px)
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    wasAtBottomRef.current = isAtBottom;

    // 무한 스크롤 처리
    handleLoadMore();
  }, [handleLoadMore]);

  /**
   * 스크롤 이벤트 리스너 등록
   */
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  /**
   * 컴포넌트 마운트 시 맨 아래로 스크롤 (간단한 시작 로직)
   */
  useEffect(() => {
    if (messages.length > 0 && virtualizer) {
      // 초기 렌더링 완료 후 맨 아래로 스크롤
      requestAnimationFrame(() => {
        scrollToBottomImpl("instant");
      });
    }
  }, [virtualizer]); // virtualizer가 준비되면 실행

  /**
   * 새 메시지나 타이핑 상태 변경 시 자동 스크롤 처리
   */
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousMessageCount = lastMessageCountRef.current;
    const hasTypingUsers = typingItemCount > 0;

    // 새 메시지가 추가되었거나, 타이핑 사용자가 변경되었고, 맨 아래에 있거나 자동 스크롤이 요청된 경우
    if (
      (currentMessageCount > previousMessageCount || hasTypingUsers) &&
      (wasAtBottomRef.current || scrollToBottom) &&
      !isUserScrolling
    ) {
      // 가상화 리스트 렌더링 완료를 기다린 후 스크롤
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottomImpl("instant"); // smooth 대신 instant 사용
        });
      });
    }

    lastMessageCountRef.current = currentMessageCount;
  }, [messages.length, typingItemCount, scrollToBottom, scrollToBottomImpl, isUserScrolling]);

  // 메시지 목록 변경 시 TanStack Virtual이 자동으로 처리

  /**
   * 검색 결과 변경 시 처리
   */
  useEffect(() => {
    if (highlightIndices.length > 0 && virtualizer) {
      // 첫 번째 검색 결과로 스크롤
      const firstIndex = Math.min(...highlightIndices);
      setTimeout(() => {
        scrollToIndex(firstIndex, "center");
      }, 100);
    }
  }, [highlightIndices, scrollToIndex, virtualizer]);

  // 로딩 인디케이터 컴포넌트
  const LoadingIndicator = useCallback(() => (
    <div className="flex justify-center items-center p-4 min-h-[60px]">
      <div className="text-sm text-muted-foreground animate-pulse">
        이전 메시지를 불러오는 중...
      </div>
    </div>
  ), []);

  // 빈 상태 렌더링
  if (messages.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-sm">아직 메시지가 없습니다.</p>
          <p className="text-xs mt-1">첫 메시지를 보내보세요!</p>
        </div>
      </div>
    );
  }

  // 가상 컨테이너 총 높이 계산
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      className={`w-full overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        ref={parentRef}
        className="h-full w-full overflow-auto scrollbar-thin"
      >
        <div
          style={{
            // 안전한 높이 계산 - getTotalSize가 0이면 최소 높이 사용
            height: `${Math.max(totalSize, containerHeight)}px`,
            width: '100%',
            position: 'relative',
            // 성능 최적화
            contain: 'layout'
          }}
        >
          {virtualItems.map((virtualItem) => {
            const { index, start, size } = virtualItem;

            // 로딩 아이템인 경우 (가장 마지막)
            if (hasNextPage && index === itemCount - 1) {
              return (
                <div
                  key={`loading-${index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${size}px`,
                    transform: `translateY(${start}px)`,
                  }}
                >
                  <LoadingIndicator />
                </div>
              );
            }

            // 타이핑 인디케이터인 경우
            if (index >= messages.length && index < messages.length + typingItemCount) {
              const typingIndex = index - messages.length;
              const userId = otherTypingUsers[typingIndex];

              return (
                <div
                  key={`typing-${userId}`}
                  data-index={index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${start}px)`,
                    contain: 'layout',
                  }}
                >
                  <TypingIndicatorMessage
                    userId={userId}
                    participants={participants}
                  />
                </div>
              );
            }

            // 일반 메시지 아이템 - 안정적인 높이 계산
            return (
              <div
                key={virtualItem.key}
                data-index={index} // measureElement용 인덱스
                ref={virtualizer.measureElement} // TanStack Virtual 자동 높이 측정
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  // height 제거 - measureElement가 자연스러운 높이 측정
                  transform: `translateY(${start}px)`,
                  // 텍스트 래핑 지원을 위한 최적화
                  contain: 'layout',
                }}
              >
                {/* MessageRenderer - 자연스러운 높이로 텍스트 래핑 허용 */}
                <MessageRenderer
                  index={index}
                  style={{
                    width: '100%',
                    // height와 minHeight 제거 - 자연스러운 텍스트 래핑
                  }}
                  data={itemData}
                />
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
});

VirtualizedMessageList.displayName = 'VirtualizedMessageList';