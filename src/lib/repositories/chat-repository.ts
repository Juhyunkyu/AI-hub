import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import {
  MessageSchema,
  CreateMessageSchema,
  UpdateMessageSchema,
  type Message,
  type CreateMessage,
  type UpdateMessage,
  type ApiResponse,
  type PaginatedResponse
} from '@/lib/schemas';

// Simple filter type for chat messages
interface ChatMessageFilter {
  room_id?: string;
  sender_id?: string;
  message_type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * 채팅 Repository 클래스
 * 채팅 메시지 및 채팅방 관련 데이터 접근
 */
export class ChatRepository extends BaseRepository<Message, CreateMessage, UpdateMessage, ChatMessageFilter> {
  protected tableName = 'messages';
  protected entitySchema = MessageSchema;
  protected createSchema = CreateMessageSchema;
  protected updateSchema = UpdateMessageSchema;
  protected filterSchema = undefined; // Simple filter without validation for now

  /**
   * 필터를 적용하는 구체적인 구현
   */
  protected buildFilters(
    query: PostgrestFilterBuilder<any, any, any[], any>,
    filters: ChatMessageFilter
  ): PostgrestFilterBuilder<any, any, any[], any> {
    const { room_id, sender_id, message_type, dateFrom, dateTo } = filters;

    if (room_id) {
      query = query.eq('to_user_id', room_id); // Assuming to_user_id is used for room context
    }

    if (sender_id) {
      query = query.eq('from_user_id', sender_id);
    }

    if (message_type) {
      query = query.eq('message_type', message_type);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    return query;
  }

  // ============================================================================
  // Chat-specific Methods
  // ============================================================================

  /**
   * 사용자 간 대화 메시지 조회
   */
  async getConversation(
    userId1: string,
    userId2: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Message & { sender: any }>>> {
    try {
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 49, limit: 50, page: 1 };

      const { data, error, count } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          sender:profiles!from_user_id(
            id,
            username,
            avatar_url
          )
        `, { count: 'exact' })
        .or(`and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`)
        .order('created_at', { ascending: false })
        .range(paginationParams.from, paginationParams.to);

      if (error) {
        this.handleError(error, 'getConversation');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, MessageSchema.extend({
          sender: MessageSchema.shape.from_user_id.optional()
        }), 'getConversation item')
      ) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData as any,
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'getConversation');
    }
  }

  /**
   * 사용자의 최근 대화 목록 조회
   */
  async getRecentConversations(
    userId: string,
    limit: number = 20
  ): Promise<ApiResponse<Array<{
    otherUser: any;
    lastMessage: Message;
    unreadCount: number;
  }>>> {
    try {
      // 최근 메시지를 기준으로 대화 상대 조회
      const { data: conversations, error } = await this.supabase
        .from(this.tableName)
        .select(`
          from_user_id,
          to_user_id,
          content,
          created_at,
          read,
          sender:profiles!from_user_id(id, username, avatar_url),
          receiver:profiles!to_user_id(id, username, avatar_url)
        `)
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit * 5); // Get more to process unique conversations

      if (error) {
        this.handleError(error, 'getRecentConversations');
      }

      // Process conversations to get unique users and their last messages
      const conversationMap = new Map();

      conversations?.forEach(msg => {
        const otherUserId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id;

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUser: msg.from_user_id === userId ? msg.receiver : msg.sender,
            lastMessage: this.validateResponse(msg, MessageSchema, 'conversation message'),
            unreadCount: 0
          });
        }
      });

      // Get unread counts
      for (const [otherUserId, conversation] of conversationMap.entries()) {
        const { count } = await this.supabase
          .from(this.tableName)
          .select('id', { count: 'exact', head: true })
          .eq('from_user_id', otherUserId)
          .eq('to_user_id', userId)
          .eq('read', false);

        conversation.unreadCount = count || 0;
      }

      const result = Array.from(conversationMap.values()).slice(0, limit);
      return { data: result, error: null };

    } catch (error) {
      this.handleError(error, 'getRecentConversations');
    }
  }

  /**
   * 메시지 읽음 처리
   */
  async markAsRead(messageId: string): Promise<ApiResponse<Message>> {
    return this.update(messageId, { read: true });
  }

  /**
   * 대화의 모든 메시지 읽음 처리
   */
  async markConversationAsRead(
    fromUserId: string,
    toUserId: string
  ): Promise<ApiResponse<{ success: boolean; updatedCount: number }>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({ read: true })
        .eq('from_user_id', fromUserId)
        .eq('to_user_id', toUserId)
        .eq('read', false)
        .select('id');

      if (error) {
        this.handleError(error, 'markConversationAsRead');
      }

      return {
        data: {
          success: true,
          updatedCount: data?.length || 0
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'markConversationAsRead');
    }
  }

  /**
   * 사용자의 읽지 않은 메시지 수 조회
   */
  async getUnreadCount(userId: string): Promise<ApiResponse<number>> {
    try {
      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', userId)
        .eq('read', false);

      if (error) {
        this.handleError(error, 'getUnreadCount');
      }

      return { data: count || 0, error: null };
    } catch (error) {
      this.handleError(error, 'getUnreadCount');
    }
  }

  /**
   * 메시지 검색
   */
  async searchMessages(
    userId: string,
    searchQuery: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Message & { sender: any; receiver: any }>>> {
    try {
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 19, limit: 20, page: 1 };

      const { data, error, count } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          sender:profiles!from_user_id(id, username, avatar_url),
          receiver:profiles!to_user_id(id, username, avatar_url)
        `, { count: 'exact' })
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .range(paginationParams.from, paginationParams.to);

      if (error) {
        this.handleError(error, 'searchMessages');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, MessageSchema.extend({
          sender: MessageSchema.shape.from_user_id.optional(),
          receiver: MessageSchema.shape.to_user_id.optional()
        }), 'searchMessages item')
      ) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData as any,
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'searchMessages');
    }
  }

  /**
   * 메시지 전송 (create의 별칭)
   */
  async sendMessage(messageData: CreateMessage): Promise<ApiResponse<Message>> {
    return this.create(messageData);
  }

  /**
   * 메시지 삭제 (소프트 삭제)
   */
  async deleteMessage(messageId: string, userId: string): Promise<ApiResponse<Message>> {
    try {
      // 메시지 소유자 확인
      const message = await this.findById(messageId);
      if (message.error || !message.data) {
        throw new Error('메시지를 찾을 수 없습니다');
      }

      if (message.data.from_user_id !== userId) {
        throw new Error('메시지를 삭제할 권한이 없습니다');
      }

      // 소프트 삭제 (deleted_at 필드가 있다고 가정)
      return this.update(messageId, {
        content: '삭제된 메시지입니다',
        deleted_at: new Date().toISOString()
      } as any);

    } catch (error) {
      this.handleError(error, 'deleteMessage');
    }
  }

  /**
   * 대화 통계 조회
   */
  async getConversationStats(userId1: string, userId2: string): Promise<ApiResponse<{
    totalMessages: number;
    unreadCount: number;
    lastActivity: string | null;
  }>> {
    try {
      const [totalResult, unreadResult, lastActivityResult] = await Promise.all([
        // 전체 메시지 수
        this.supabase
          .from(this.tableName)
          .select('id', { count: 'exact', head: true })
          .or(`and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`),

        // 읽지 않은 메시지 수 (userId1이 받은 것 중)
        this.supabase
          .from(this.tableName)
          .select('id', { count: 'exact', head: true })
          .eq('from_user_id', userId2)
          .eq('to_user_id', userId1)
          .eq('read', false),

        // 마지막 활동 시간
        this.supabase
          .from(this.tableName)
          .select('created_at')
          .or(`and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (totalResult.error) {
        this.handleError(totalResult.error, 'getConversationStats - total');
      }

      if (unreadResult.error) {
        this.handleError(unreadResult.error, 'getConversationStats - unread');
      }

      if (lastActivityResult.error && lastActivityResult.error.code !== 'PGRST116') {
        this.handleError(lastActivityResult.error, 'getConversationStats - lastActivity');
      }

      const stats = {
        totalMessages: totalResult.count || 0,
        unreadCount: unreadResult.count || 0,
        lastActivity: lastActivityResult.data?.created_at || null
      };

      return { data: stats, error: null };
    } catch (error) {
      this.handleError(error, 'getConversationStats');
    }
  }

  /**
   * 사용자 차단 확인 (차단된 사용자로부터의 메시지 필터링)
   */
  async getConversationWithBlockCheck(
    userId1: string,
    userId2: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Message & { sender: any }>>> {
    // 차단 확인 로직은 별도 테이블이 있다고 가정
    try {
      const { data: blockCheck } = await this.supabase
        .from('user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
        .maybeSingle();

      if (blockCheck) {
        // 차단된 경우 빈 결과 반환
        return {
          data: {
            data: [],
            total: 0,
            page: pagination?.page || 1,
            limit: pagination?.limit || 50,
            totalPages: 0
          },
          error: null
        };
      }

      // 차단되지 않은 경우 일반 대화 조회
      return this.getConversation(userId1, userId2, pagination);

    } catch (error) {
      this.handleError(error, 'getConversationWithBlockCheck');
    }
  }
}

// 싱글톤 인스턴스 생성
export const chatRepository = new ChatRepository();