export interface ChatRoom {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  created_at: string;
  updated_at: string;
}

export interface ChatRoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_admin: boolean;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  reply_to?: ChatMessage;
  read_by: string[];
}

// 향후 메시지 읽음 기능을 위한 타입 (현재 미사용)
// export interface ChatMessageRead {
//   id: string;
//   message_id: string;
//   user_id: string;
//   read_at: string;
// }

// 향후 타이핑 상태 기능을 위한 타입 (현재 미사용)
// export interface ChatTypingStatus {
//   id: string;
//   room_id: string;
//   user_id: string;
//   is_typing: boolean;
//   last_activity: string;
//   user?: {
//     id: string;
//     username: string;
//     avatar_url?: string;
//   };
// }

export interface ChatRoomWithParticipants extends ChatRoom {
  participants: ChatRoomParticipant[];
  last_message?: ChatMessage;
  unread_count: number;
}

export interface CreateChatRoomData {
  name?: string;
  type: 'direct' | 'group';
  participant_ids: string[];
}

export interface SendMessageData {
  room_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'file';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  reply_to_id?: string;
}

export interface TypingStatusData {
  room_id: string;
  is_typing: boolean;
}

// 향후 실시간 이벤트 기능을 위한 타입 (현재 미사용)
// export interface RealtimeMessage {
//   type: 'INSERT' | 'UPDATE' | 'DELETE';
//   table: string;
//   record: any;
//   old_record?: any;
// }

// 향후 타이핑 표시 기능을 위한 타입 (현재 미사용)
// export interface TypingIndicator {
//   user_id: string;
//   username: string;
//   is_typing: boolean;
//   last_activity: string;
// }


