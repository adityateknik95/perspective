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
