/**
 * 채팅 가상화 시스템 - 통합 export
 *
 * React 19 + Next.js 15 호환
 * 고성능 메시지 가상화 컴포넌트들
 */

export { VirtualizedMessageList } from './VirtualizedMessageList';
export type { VirtualizedMessageListRef } from './VirtualizedMessageList';

export { MessageRenderer } from './MessageRenderer';

export { useMessageHeight } from './useMessageHeight';

// 타입 재export (편의성을 위해)
export type { ChatMessage } from '@/types/chat';