// Hand-maintained Database type, kept in lockstep with supabase/migrations/.
// When the schema gets larger, switch to the Supabase CLI:
//   supabase gen types typescript --project-id <REF> --schema public

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          signature_lenses: string[];
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          signature_lenses?: string[];
          is_private?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          signature_lenses?: string[];
          is_private?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      films: {
        Row: {
          id: string;
          tmdb_id: number;
          title: string;
          year: number | null;
          director: string | null;
          runtime_minutes: number | null;
          overview: string | null;
          poster_path: string | null;
          backdrop_path: string | null;
          original_language: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tmdb_id: number;
          title: string;
          year?: number | null;
          director?: string | null;
          runtime_minutes?: number | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          original_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tmdb_id?: number;
          title?: string;
          year?: number | null;
          director?: string | null;
          runtime_minutes?: number | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          original_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      perspectives: {
        Row: {
          id: string;
          user_id: string;
          film_id: string;
          title: string;
          subtitle: string | null;
          body: string;
          body_plaintext: string;
          lens_tags: string[];
          word_count: number;
          reading_time_minutes: number;
          is_draft: boolean;
          is_private: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          film_id: string;
          title: string;
          subtitle?: string | null;
          body?: string;
          body_plaintext?: string;
          lens_tags?: string[];
          word_count?: number;
          reading_time_minutes?: number;
          is_draft?: boolean;
          is_private?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          film_id?: string;
          title?: string;
          subtitle?: string | null;
          body?: string;
          body_plaintext?: string;
          lens_tags?: string[];
          word_count?: number;
          reading_time_minutes?: number;
          is_draft?: boolean;
          is_private?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        // Foreign keys matter for PostgREST's embed syntax: `film:films!inner`
        // and `profiles!inner` fail type inference unless the relationship is
        // declared. These must match the actual FK names in the 0002
        // migration — see perspectives_film_id_fkey, perspectives_user_id_fkey.
        Relationships: [
          {
            foreignKeyName: "perspectives_film_id_fkey";
            columns: ["film_id"];
            isOneToOne: false;
            referencedRelation: "films";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perspectives_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // -----------------------------------------------------------------
      // Social layer (0004_social.sql)
      // -----------------------------------------------------------------
      reactions: {
        Row: {
          id: string;
          user_id: string;
          perspective_id: string;
          reaction_type:
            | "moved"
            | "changed_my_mind"
            | "recognized_myself"
            | "saw_it_differently"
            | "stayed_with_me";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          perspective_id: string;
          reaction_type:
            | "moved"
            | "changed_my_mind"
            | "recognized_myself"
            | "saw_it_differently"
            | "stayed_with_me";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          perspective_id?: string;
          reaction_type?:
            | "moved"
            | "changed_my_mind"
            | "recognized_myself"
            | "saw_it_differently"
            | "stayed_with_me";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_perspective_id_fkey";
            columns: ["perspective_id"];
            isOneToOne: false;
            referencedRelation: "perspectives";
            referencedColumns: ["id"];
          },
        ];
      };
      responses: {
        Row: {
          id: string;
          perspective_id: string;
          user_id: string;
          parent_response_id: string | null;
          body: string;
          body_plaintext: string;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          perspective_id: string;
          user_id: string;
          parent_response_id?: string | null;
          body: string;
          body_plaintext: string;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          perspective_id?: string;
          user_id?: string;
          parent_response_id?: string | null;
          body?: string;
          body_plaintext?: string;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "responses_perspective_id_fkey";
            columns: ["perspective_id"];
            isOneToOne: false;
            referencedRelation: "perspectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "responses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "responses_parent_response_id_fkey";
            columns: ["parent_response_id"];
            isOneToOne: false;
            referencedRelation: "responses";
            referencedColumns: ["id"];
          },
        ];
      };
      response_resonances: {
        Row: {
          response_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          response_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          response_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "response_resonances_response_id_fkey";
            columns: ["response_id"];
            isOneToOne: false;
            referencedRelation: "responses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "response_resonances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          type: "reaction" | "response" | "follow" | "mention";
          perspective_id: string | null;
          response_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type: "reaction" | "response" | "follow" | "mention";
          perspective_id?: string | null;
          response_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string;
          type?: "reaction" | "response" | "follow" | "mention";
          perspective_id?: string | null;
          response_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_perspective_id_fkey";
            columns: ["perspective_id"];
            isOneToOne: false;
            referencedRelation: "perspectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_response_id_fkey";
            columns: ["response_id"];
            isOneToOne: false;
            referencedRelation: "responses";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: "perspective" | "response";
          target_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: "perspective" | "response";
          target_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: "perspective" | "response";
          target_id?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      username_available: {
        Args: { u: string };
        Returns: boolean;
      };
      get_perspective_reaction_summary: {
        Args: { p_perspective_id: string };
        // Always shaped as { moved, changed_my_mind, recognized_myself,
        // saw_it_differently, stayed_with_me, total } — see the RPC body.
        Returns: {
          moved: number;
          changed_my_mind: number;
          recognized_myself: number;
          saw_it_differently: number;
          stayed_with_me: number;
          total: number;
        };
      };
      get_feed_for_user: {
        Args: {
          p_user_id: string;
          p_cursor_published_at?: string | null;
          p_cursor_id?: string | null;
          p_page_size?: number;
        };
        Returns: Array<{
          id: string;
          title: string;
          subtitle: string | null;
          body_plaintext: string;
          reading_time_minutes: number;
          lens_tags: string[];
          published_at: string;
          film_tmdb_id: number;
          film_title: string;
          film_year: number | null;
          film_poster_path: string | null;
          author_username: string;
          author_display_name: string;
          author_avatar_url: string | null;
          reaction_summary: {
            moved: number;
            changed_my_mind: number;
            recognized_myself: number;
            saw_it_differently: number;
            stayed_with_me: number;
            total: number;
          };
          response_count: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Film = Database["public"]["Tables"]["films"]["Row"];
export type Perspective = Database["public"]["Tables"]["perspectives"]["Row"];
export type Reaction = Database["public"]["Tables"]["reactions"]["Row"];
export type Response = Database["public"]["Tables"]["responses"]["Row"];
export type Follow = Database["public"]["Tables"]["follows"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
