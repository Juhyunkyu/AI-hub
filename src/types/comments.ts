/**
 * Shared Comment Types for React 19 useOptimistic Integration
 * 
 * This file contains all the shared interfaces and types used across the comment system
 * to ensure type safety and consistency between components.
 */

export interface Comment {
  id: string;
  body: string;
  author_id: string;
  post_id?: string;
  parent_id?: string | null;
  created_at: string;
  images?: string[];
  replies?: Comment[];
  isOptimistic?: boolean; // Flag to identify optimistic comments
  anonymous?: boolean;
  anonymous_number?: number | null;
}

export interface ProfileLite {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role?: string;
}

export interface OptimisticCommentData {
  body: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  images: string[];
}

export interface CommentAction {
  type: 'add' | 'remove' | 'update';
  comment?: Comment;
  commentId?: string;
  body?: string;
}