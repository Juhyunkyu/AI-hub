import { ChatRoomWithParticipants } from '@/types/chat';

export function getChatRoomDisplayName(room: ChatRoomWithParticipants, currentUserId?: string): string {
  // 진짜 self 타입 채팅방 (본인과의 채팅방)
  if (room.type === 'self') {
    return "나에게";
  }

  // 이미 이름이 설정된 경우 (그룹 채팅방 등)
  if (room.name && room.name.trim()) {
    return room.name;
  }

  // 참여자가 없는 경우
  if (!room.participants || room.participants.length === 0) {
    return "채팅방";
  }

  // 현재 사용자를 제외한 참여자들
  const otherParticipants = room.participants.filter(p => p.user_id !== currentUserId);

  // 혼자만 남은 경우 (다른 사람이 나간 상황)
  if (otherParticipants.length === 0 && room.participants.length === 1) {
    // self 타입이 아닌데 혼자 남은 경우 (다른 사람과 채팅하다가 상대방이 나간 경우)
    if (room.type !== 'self') {
      return "대화할 상대방이 없습니다";
    }
    // self 타입인데 혼자 있는 경우 (타입 설정 오류 등)
    return "나에게";
  }

  // 1:1 채팅인 경우
  if (otherParticipants.length === 1) {
    return otherParticipants[0].user?.username || `사용자${otherParticipants[0].user_id?.slice(-4) || ''}`;
  }

  // 그룹 채팅인 경우
  if (otherParticipants.length >= 2) {
    const names = otherParticipants
      .slice(0, 3) // 최대 3명까지만 이름 표시
      .map(p => p.user?.username || `사용자${p.user_id?.slice(-4) || ''}`);

    if (otherParticipants.length > 3) {
      return `${names.join(", ")} 외 ${otherParticipants.length - 3}명`;
    } else {
      return names.join(", ");
    }
  }

  return "채팅방";
}

