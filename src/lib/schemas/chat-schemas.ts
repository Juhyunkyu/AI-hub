/**
 * Chat System Validation Schemas
 *
 * Comprehensive Zod schemas for chat functionality including:
 * - Chat rooms (direct, group, self)
 * - Chat messages with file attachments
 * - Real-time features (typing, read status)
 * - Security and validation enhancements
 */

import { z } from 'zod';
import { UUIDSchema, TimestampSchema, URLSchema } from './index';

// ============================================================================
// Chat Enum Schemas
// ============================================================================

/**
 * Chat Room Type Schema
 */
export const ChatRoomTypeSchema = z.enum(['direct', 'group', 'self'], {
  errorMap: () => ({ message: '채팅방 타입은 direct, group, self 중 하나여야 합니다' })
});

/**
 * Chat Message Type Schema
 */
export const ChatMessageTypeSchema = z.enum(['text', 'file', 'image', 'system'], {
  errorMap: () => ({ message: '메시지 타입은 text, file, image, system 중 하나여야 합니다' })
});

/**
 * File Type Schema for message attachments
 */
export const FileTypeSchema = z.enum([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'application/json',
  'application/zip', 'application/x-zip-compressed'
], {
  errorMap: () => ({ message: '지원하지 않는 파일 형식입니다' })
});

// ============================================================================
// Base Chat Schemas
// ============================================================================

/**
 * Chat Room Schema
 */
export const ChatRoomSchema = z.object({
  id: UUIDSchema,
  name: z.string()
    .max(100, '채팅방 이름은 100글자 이하여야 합니다')
    .nullable()
    .refine((name) => {
      // direct와 self 타입은 이름이 없어야 함
      return true; // 비즈니스 로직은 별도 검증에서 처리
    }),
  type: ChatRoomTypeSchema,
  description: z.string()
    .max(500, '채팅방 설명은 500글자 이하여야 합니다')
    .nullable(),
  avatar_url: URLSchema.nullable(),
  is_private: z.boolean().default(false),
  max_participants: z.number()
    .int('참여자 수는 정수여야 합니다')
    .min(2, '최소 2명의 참여자가 필요합니다')
    .max(1000, '최대 1000명까지 참여 가능합니다')
    .nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Chat Room Participant Schema
 */
export const ChatRoomParticipantSchema = z.object({
  id: UUIDSchema,
  room_id: UUIDSchema,
  user_id: UUIDSchema,
  joined_at: TimestampSchema,
  last_read_at: TimestampSchema.nullable(),
  is_admin: z.boolean().default(false),
  is_muted: z.boolean().default(false),
  nickname: z.string()
    .max(50, '닉네임은 50글자 이하여야 합니다')
    .nullable(),
});

/**
 * Chat Message Schema
 */
export const ChatMessageSchema = z.object({
  id: UUIDSchema,
  room_id: UUIDSchema,
  sender_id: UUIDSchema,
  content: z.string()
    .max(10000, '메시지는 10,000글자 이하여야 합니다')
    .refine((content) => content.trim().length > 0, {
      message: '메시지 내용은 비워둘 수 없습니다'
    }),
  message_type: ChatMessageTypeSchema.default('text'),
  reply_to_id: UUIDSchema.nullable(),
  file_url: URLSchema.nullable(),
  file_name: z.string()
    .max(255, '파일명은 255글자 이하여야 합니다')
    .nullable(),
  file_size: z.number()
    .int('파일 크기는 정수여야 합니다')
    .min(0, '파일 크기는 0 이상이어야 합니다')
    .max(50 * 1024 * 1024, '파일 크기는 50MB 이하여야 합니다') // 50MB limit
    .nullable(),
  file_type: FileTypeSchema.nullable(),
  metadata: z.record(z.any()).nullable(), // JSON field for additional data
  is_edited: z.boolean().default(false),
  edited_at: TimestampSchema.nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Chat Message Read Status Schema
 */
export const ChatMessageReadSchema = z.object({
  id: UUIDSchema,
  message_id: UUIDSchema,
  user_id: UUIDSchema,
  read_at: TimestampSchema,
});

/**
 * Chat Typing Status Schema
 */
export const ChatTypingStatusSchema = z.object({
  id: UUIDSchema,
  room_id: UUIDSchema,
  user_id: UUIDSchema,
  is_typing: z.boolean(),
  last_activity: TimestampSchema,
});

// ============================================================================
// Input/Creation Schemas
// ============================================================================

/**
 * Create Chat Room Schema
 */
export const CreateChatRoomSchema = ChatRoomSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  participant_ids: z.array(UUIDSchema)
    .min(1, '최소 1명의 참여자가 필요합니다')
    .max(1000, '최대 1000명까지 초대 가능합니다')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: '중복된 참여자 ID가 있습니다'
    }),
}).superRefine((data, ctx) => {
  // Business logic validation
  if (data.type === 'direct' && data.participant_ids.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '1:1 채팅방은 정확히 1명의 상대방이 필요합니다',
      path: ['participant_ids'],
    });
  }

  if (data.type === 'self' && data.participant_ids.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '개인 채팅방은 자기 자신만 참여 가능합니다',
      path: ['participant_ids'],
    });
  }

  if (data.type === 'group' && data.participant_ids.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '그룹 채팅방은 최소 2명의 참여자가 필요합니다',
      path: ['participant_ids'],
    });
  }

  if ((data.type === 'direct' || data.type === 'self') && data.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '1:1 채팅방과 개인 채팅방은 이름을 가질 수 없습니다',
      path: ['name'],
    });
  }
});

/**
 * Create Chat Message Schema
 */
export const CreateChatMessageSchema = ChatMessageSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  is_edited: true,
  edited_at: true,
}).superRefine((data, ctx) => {
  // File message validation
  if (data.message_type === 'file' || data.message_type === 'image') {
    if (!data.file_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '파일 메시지는 파일 URL이 필요합니다',
        path: ['file_url'],
      });
    }
    if (!data.file_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '파일 메시지는 파일명이 필요합니다',
        path: ['file_name'],
      });
    }
    if (!data.file_size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '파일 메시지는 파일 크기 정보가 필요합니다',
        path: ['file_size'],
      });
    }
  }

  // Text message validation
  if (data.message_type === 'text' && !data.content.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '텍스트 메시지는 내용이 필요합니다',
      path: ['content'],
    });
  }
});

/**
 * Join Chat Room Schema
 */
export const JoinChatRoomSchema = z.object({
  room_id: UUIDSchema,
  user_ids: z.array(UUIDSchema)
    .min(1, '최소 1명의 사용자가 필요합니다')
    .max(100, '한 번에 최대 100명까지 초대 가능합니다'),
  invite_message: z.string()
    .max(500, '초대 메시지는 500글자 이하여야 합니다')
    .optional(),
});

// ============================================================================
// Update Schemas
// ============================================================================

/**
 * Update Chat Room Schema
 */
export const UpdateChatRoomSchema = CreateChatRoomSchema.partial().omit({
  participant_ids: true,
  type: true, // 채팅방 타입은 변경 불가
});

/**
 * Update Chat Message Schema
 */
export const UpdateChatMessageSchema = z.object({
  content: z.string()
    .max(10000, '메시지는 10,000글자 이하여야 합니다')
    .refine((content) => content.trim().length > 0, {
      message: '메시지 내용은 비워둘 수 없습니다'
    }),
}).strict(); // Only content can be updated

/**
 * Update Participant Schema
 */
export const UpdateParticipantSchema = ChatRoomParticipantSchema.partial().pick({
  last_read_at: true,
  is_muted: true,
  nickname: true,
});

/**
 * Update Typing Status Schema
 */
export const UpdateTypingStatusSchema = z.object({
  room_id: UUIDSchema,
  is_typing: z.boolean(),
});

// ============================================================================
// Query/Filter Schemas
// ============================================================================

/**
 * Chat Room Filter Schema
 */
export const ChatRoomFilterSchema = z.object({
  type: ChatRoomTypeSchema.optional(),
  search: z.string()
    .min(2, '검색어는 2글자 이상이어야 합니다')
    .max(100, '검색어는 100글자 이하여야 합니다')
    .optional(),
  participant_id: UUIDSchema.optional(),
  created_after: TimestampSchema.optional(),
  created_before: TimestampSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Chat Message Filter Schema
 */
export const ChatMessageFilterSchema = z.object({
  room_id: UUIDSchema,
  message_type: ChatMessageTypeSchema.optional(),
  sender_id: UUIDSchema.optional(),
  search: z.string()
    .min(2, '검색어는 2글자 이상이어야 합니다')
    .max(100, '검색어는 100글자 이하여야 합니다')
    .optional(),
  before_message_id: UUIDSchema.optional(), // For pagination
  after_message_id: UUIDSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

/**
 * File Upload Schema
 */
export const FileUploadSchema = z.object({
  file: z.any().refine((file) => file instanceof File, {
    message: '유효한 파일이 아닙니다'
  }),
  room_id: UUIDSchema,
  message_content: z.string()
    .max(1000, '파일과 함께 보낼 메시지는 1000글자 이하여야 합니다')
    .optional(),
}).superRefine((data, ctx) => {
  const file = data.file as File;

  // File size validation
  if (file.size > 50 * 1024 * 1024) { // 50MB
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '파일 크기는 50MB 이하여야 합니다',
      path: ['file'],
    });
  }

  // File type validation
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/json',
    'application/zip', 'application/x-zip-compressed'
  ];

  if (!allowedTypes.includes(file.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '지원하지 않는 파일 형식입니다',
      path: ['file'],
    });
  }
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Chat Room with Participants Schema
 */
export const ChatRoomWithParticipantsSchema = ChatRoomSchema.extend({
  participants: z.array(ChatRoomParticipantSchema.extend({
    user: z.object({
      id: UUIDSchema,
      username: z.string(),
      avatar_url: URLSchema.nullable(),
    }),
  })),
  last_message: ChatMessageSchema.extend({
    sender: z.object({
      id: UUIDSchema,
      username: z.string(),
      avatar_url: URLSchema.nullable(),
    }),
  }).nullable(),
  unread_count: z.number().int().min(0),
});

/**
 * Chat Message with Sender Schema
 */
export const ChatMessageWithSenderSchema = ChatMessageSchema.extend({
  sender: z.object({
    id: UUIDSchema,
    username: z.string(),
    avatar_url: URLSchema.nullable(),
  }),
  reply_to: ChatMessageSchema.pick({
    id: true,
    content: true,
    sender_id: true,
  }).extend({
    sender: z.object({
      username: z.string(),
    }),
  }).nullable(),
  read_by: z.array(z.object({
    user_id: UUIDSchema,
    read_at: TimestampSchema,
    user: z.object({
      username: z.string(),
    }),
  })).optional(),
});

/**
 * PostgreSQL Function Response Schema
 */
export const PostgreSQLFunctionResponseSchema = z.object({
  success: z.boolean(),
  room_id: UUIDSchema.nullable().optional(),
  is_new: z.boolean().optional(),
  error: z.string().nullable().optional(),
});

// ============================================================================
// Real-time Event Schemas
// ============================================================================

/**
 * Real-time Message Event Schema
 */
export const RealtimeMessageEventSchema = z.object({
  type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  table: z.literal('chat_messages'),
  record: ChatMessageWithSenderSchema,
  old_record: ChatMessageSchema.partial().optional(),
});

/**
 * Real-time Typing Event Schema
 */
export const RealtimeTypingEventSchema = z.object({
  type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  table: z.literal('chat_typing_status'),
  record: ChatTypingStatusSchema.extend({
    user: z.object({
      id: UUIDSchema,
      username: z.string(),
    }),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

// Core Entity Types
export type ChatRoom = z.infer<typeof ChatRoomSchema>;
export type ChatRoomParticipant = z.infer<typeof ChatRoomParticipantSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatMessageRead = z.infer<typeof ChatMessageReadSchema>;
export type ChatTypingStatus = z.infer<typeof ChatTypingStatusSchema>;

// Input Types
export type CreateChatRoom = z.infer<typeof CreateChatRoomSchema>;
export type CreateChatMessage = z.infer<typeof CreateChatMessageSchema>;
export type JoinChatRoom = z.infer<typeof JoinChatRoomSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;

// Update Types
export type UpdateChatRoom = z.infer<typeof UpdateChatRoomSchema>;
export type UpdateChatMessage = z.infer<typeof UpdateChatMessageSchema>;
export type UpdateParticipant = z.infer<typeof UpdateParticipantSchema>;
export type UpdateTypingStatus = z.infer<typeof UpdateTypingStatusSchema>;

// Filter Types
export type ChatRoomFilter = z.infer<typeof ChatRoomFilterSchema>;
export type ChatMessageFilter = z.infer<typeof ChatMessageFilterSchema>;

// Response Types
export type ChatRoomWithParticipants = z.infer<typeof ChatRoomWithParticipantsSchema>;
export type ChatMessageWithSender = z.infer<typeof ChatMessageWithSenderSchema>;
export type PostgreSQLFunctionResponse = z.infer<typeof PostgreSQLFunctionResponseSchema>;

// Real-time Event Types
export type RealtimeMessageEvent = z.infer<typeof RealtimeMessageEventSchema>;
export type RealtimeTypingEvent = z.infer<typeof RealtimeTypingEventSchema>;

// Enum Types
export type ChatRoomType = z.infer<typeof ChatRoomTypeSchema>;
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;
export type FileType = z.infer<typeof FileTypeSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate direct chat room creation
 */
export const validateDirectChatRoom = (currentUserId: string, targetUserId: string) => {
  return z.object({
    current_user_id: UUIDSchema,
    target_user_id: UUIDSchema,
  }).refine((data) => data.current_user_id !== data.target_user_id, {
    message: '자기 자신과는 채팅방을 생성할 수 없습니다',
  }).parse({
    current_user_id: currentUserId,
    target_user_id: targetUserId,
  });
};

/**
 * Validate file upload security
 */
export const validateFileUploadSecurity = (file: File) => {
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs'];
  const fileName = file.name.toLowerCase();

  const hasDangerousExtension = dangerousExtensions.some(ext =>
    fileName.endsWith(ext)
  );

  if (hasDangerousExtension) {
    throw new Error('보안상 위험한 파일 형식입니다');
  }

  return FileUploadSchema.parse({ file });
};