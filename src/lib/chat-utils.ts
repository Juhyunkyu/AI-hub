import { ChatRoomWithParticipants } from '@/types/chat';

export function getChatRoomDisplayName(room: ChatRoomWithParticipants, currentUserId?: string): string {
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

  // 1:1 채팅인 경우
  if (otherParticipants.length === 1) {
    return otherParticipants[0].user?.username || "알 수 없는 사용자";
  }

  // 그룹 채팅인 경우
  if (otherParticipants.length >= 2) {
    const names = otherParticipants
      .slice(0, 3) // 최대 3명까지만 이름 표시
      .map(p => p.user?.username || "알 수 없는 사용자");
    
    if (otherParticipants.length > 3) {
      return `${names.join(", ")} 외 ${otherParticipants.length - 3}명`;
    } else {
      return names.join(", ");
    }
  }

  return "채팅방";
}

