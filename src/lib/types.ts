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
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      username_available: {
        Args: { u: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Film = Database["public"]["Tables"]["films"]["Row"];
export type Perspective = Database["public"]["Tables"]["perspectives"]["Row"];
