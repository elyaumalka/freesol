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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_settings: {
        Row: {
          created_at: string
          first_alert_minutes: number
          id: string
          second_alert_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_alert_minutes?: number
          id?: string
          second_alert_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_alert_minutes?: number
          id?: string
          second_alert_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          link: string
          name: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          link: string
          name: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          link?: string
          name?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      clubs: {
        Row: {
          coupon_code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          name: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          coupon_code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          name: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          coupon_code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          name?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      customer_hours: {
        Row: {
          created_at: string
          id: string
          total_hours: number
          updated_at: string
          used_hours: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          total_hours?: number
          updated_at?: string
          used_hours?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          total_hours?: number
          updated_at?: string
          used_hours?: number
          user_id?: string
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          content: string
          created_at: string
          customer_name: string
          id: string
          inquiry_type: string
          rating: number
          responded_at: string | null
          response: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          customer_name: string
          id?: string
          inquiry_type: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          customer_name?: string
          id?: string
          inquiry_type?: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          display_settings: string[]
          id: string
          is_recommended: boolean
          name: string
          price: number
          recording_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_settings?: string[]
          id?: string
          is_recommended?: boolean
          name: string
          price: number
          recording_hours: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_settings?: string[]
          id?: string
          is_recommended?: boolean
          name?: string
          price?: number
          recording_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      playback_purchases: {
        Row: {
          amount: number
          created_at: string
          document_id: string | null
          document_number: string | null
          document_url: string | null
          id: string
          playback_id: string
          status: string
          sumit_customer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          document_id?: string | null
          document_number?: string | null
          document_url?: string | null
          id?: string
          playback_id: string
          status?: string
          sumit_customer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          document_id?: string | null
          document_number?: string | null
          document_url?: string | null
          id?: string
          playback_id?: string
          status?: string
          sumit_customer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_purchases_playback_id_fkey"
            columns: ["playback_id"]
            isOneToOne: false
            referencedRelation: "playbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbacks: {
        Row: {
          artist_id: string | null
          audio_url: string | null
          cost: number
          created_at: string
          duration: string
          id: string
          instrumental_url: string | null
          original_audio_url: string | null
          processing_status: string | null
          sections: Json | null
          song_name: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          artist_id?: string | null
          audio_url?: string | null
          cost?: number
          created_at?: string
          duration?: string
          id?: string
          instrumental_url?: string | null
          original_audio_url?: string | null
          processing_status?: string | null
          sections?: Json | null
          song_name: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          artist_id?: string | null
          audio_url?: string | null
          cost?: number
          created_at?: string
          duration?: string
          id?: string
          instrumental_url?: string | null
          original_audio_url?: string | null
          processing_status?: string | null
          sections?: Json | null
          song_name?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbacks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          customer_number: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_number?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_number?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          playback_id: string | null
          project_type: string
          song_name: string
          status: string
          updated_at: string
          user_id: string
          verses: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          playback_id?: string | null
          project_type?: string
          song_name: string
          status?: string
          updated_at?: string
          user_id: string
          verses?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          playback_id?: string | null
          project_type?: string
          song_name?: string
          status?: string
          updated_at?: string
          user_id?: string
          verses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_playback_id_fkey"
            columns: ["playback_id"]
            isOneToOne: false
            referencedRelation: "playbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          campaign_id: string | null
          club_id: string | null
          coupon_id: string | null
          created_at: string
          document_id: string | null
          document_number: string | null
          document_url: string | null
          hours_purchased: number
          id: string
          package_id: string | null
          status: string
          sumit_customer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          club_id?: string | null
          coupon_id?: string | null
          created_at?: string
          document_id?: string | null
          document_number?: string | null
          document_url?: string | null
          hours_purchased: number
          id?: string
          package_id?: string | null
          status?: string
          sumit_customer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          club_id?: string | null
          coupon_id?: string | null
          created_at?: string
          document_id?: string | null
          document_number?: string | null
          document_url?: string | null
          hours_purchased?: number
          id?: string
          package_id?: string | null
          status?: string
          sumit_customer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          audio_url: string | null
          created_at: string
          duration: string
          id: string
          project_id: string | null
          song_name: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration?: string
          id?: string
          project_id?: string | null
          song_name: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration?: string
          id?: string
          project_id?: string | null
          song_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roex_tasks: {
        Row: {
          created_at: string
          error: string | null
          id: string
          mode: string
          output_url: string | null
          project_name: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
          webhook_data: Json | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          mode?: string
          output_url?: string | null
          project_name?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
          webhook_data?: Json | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          mode?: string
          output_url?: string | null
          project_name?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
          webhook_data?: Json | null
        }
        Relationships: []
      }
      studios: {
        Row: {
          activity_time: string
          created_at: string
          id: string
          name: string
          password: string
          status: boolean
          unique_id: string
          updated_at: string
        }
        Insert: {
          activity_time?: string
          created_at?: string
          id?: string
          name: string
          password: string
          status?: boolean
          unique_id: string
          updated_at?: string
        }
        Update: {
          activity_time?: string
          created_at?: string
          id?: string
          name?: string
          password?: string
          status?: boolean
          unique_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suno_tasks: {
        Row: {
          audio_url: string | null
          callback_data: Json | null
          created_at: string
          error: string | null
          id: string
          image_url: string | null
          status: string
          stream_audio_url: string | null
          tags: string | null
          task_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          callback_data?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          status?: string
          stream_audio_url?: string | null
          tags?: string | null
          task_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          callback_data?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          status?: string
          stream_audio_url?: string | null
          tags?: string | null
          task_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_customer_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { coupon_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "office_worker" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
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
      app_role: ["admin", "office_worker", "customer"],
    },
  },
} as const
