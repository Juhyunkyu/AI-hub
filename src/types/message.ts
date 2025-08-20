export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  content: string;
  read: boolean;
  deleted_by_sender: boolean;
  deleted_by_receiver: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageWithUsers extends Message {
  from_user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  to_user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

export interface CreateMessageData {
  to_user_id: string;
  subject: string;
  content: string;
}

export interface MessageStats {
  unread_count: number;
  total_received: number;
  total_sent: number;
}
