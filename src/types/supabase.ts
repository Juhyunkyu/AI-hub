export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          added_at: string
          collection_id: string
          post_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          post_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["comment_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_user_id: string | null
          id: string
          tag_id: string | null
          topic_id: string | null
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_user_id?: string | null
          id?: string
          tag_id?: string | null
          topic_id?: string | null
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_user_id?: string | null
          id?: string
          tag_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_user_id_fkey"
            columns: ["following_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_by_receiver: boolean | null
          deleted_by_sender: boolean | null
          from_user_id: string
          id: string
          read: boolean | null
          subject: string
          to_user_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_by_receiver?: boolean | null
          deleted_by_sender?: boolean | null
          from_user_id: string
          id?: string
          read?: boolean | null
          subject: string
          to_user_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_by_receiver?: boolean | null
          deleted_by_sender?: boolean | null
          from_user_id?: string
          id?: string
          read?: boolean | null
          subject?: string
          to_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_topics: {
        Row: {
          post_id: string
          topic_id: string
        }
        Insert: {
          post_id: string
          topic_id: string
        }
        Update: {
          post_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_topics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          id: string
          post_type: Database["public"]["Enums"]["post_type"]
          source: string | null
          status: Database["public"]["Enums"]["post_status"]
          thumbnail: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          id?: string
          post_type?: Database["public"]["Enums"]["post_type"]
          source?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          id?: string
          post_type?: Database["public"]["Enums"]["post_type"]
          source?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          follower_count: number
          following_count: number
          id: string
          links: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          id: string
          links?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          id?: string
          links?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          type?: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["reaction_target"]
          type?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      make_admin: {
        Args: { user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      comment_status: "active" | "hidden" | "deleted"
      post_status: "draft" | "published" | "archived"
      post_type: "general" | "notice" | "anonymous"
      reaction_target: "post" | "comment"
      reaction_type: "like"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
  : PublicTableNameOrOptions extends keyof DatabaseWithoutInternals["public"]["Tables"]
    ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
  : PublicTableNameOrOptions extends keyof DatabaseWithoutInternals["public"]["Tables"]
    ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Tables"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Tables"] },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
    ? keyof DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Tables"] }
  ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions["schema"]]
  : PublicTableNameOrOptions extends keyof DatabaseWithoutInternals["public"]["Tables"]
    ? DatabaseWithoutInternals["public"]["Tables"][PublicTableNameOrOptions]
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof (DatabaseWithoutInternals["public"]["Enums"])
    | { schema: keyof DatabaseWithoutInternals["public"]["Enums"] },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Enums"] }
    ? keyof DatabaseWithoutInternals["public"]["Enums"][PublicEnumNameOrOptions["schema"]]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals["public"]["Enums"] }
  ? DatabaseWithoutInternals["public"]["Enums"][PublicEnumNameOrOptions["schema"]]
  : PublicEnumNameOrOptions extends keyof DatabaseWithoutInternals["public"]["Enums"]
    ? PublicEnumNameOrOptions
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      comment_status: ["active", "hidden", "deleted"],
      post_status: ["draft", "published", "archived"],
      post_type: ["general", "notice", "anonymous"],
      reaction_target: ["post", "comment"],
      reaction_type: ["like"],
      user_role: ["admin", "user"],
    },
  },
} as const

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]