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
      activity_logs: {
        Row: {
          action: string
          church_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          church_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          church_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "activity_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          church_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_pinned: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          church_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_pinned?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_pinned?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_documents: {
        Row: {
          appointment_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          requirement_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          requirement_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          requirement_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_documents_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "sacrament_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          church_id: string
          created_at: string | null
          id: string
          notes: string | null
          service_type: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          church_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          service_type: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          church_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          service_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "appointments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      church_announcements: {
        Row: {
          church_id: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_pinned: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          church_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          church_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "church_announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      church_images: {
        Row: {
          church_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          uploaded_by: string | null
        }
        Insert: {
          church_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          uploaded_by?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_images_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "church_images_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string
          contact_number: string | null
          created_at: string | null
          description: string | null
          donation_qr_url: string | null
          email: string | null
          facebook_url: string | null
          gcash_number: string | null
          gcash_qr_url: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          livestream_url: string | null
          longitude: number | null
          maya_number: string | null
          maya_qr_url: string | null
          name: string
          operating_hours: Json | null
          panorama_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          contact_number?: string | null
          created_at?: string | null
          description?: string | null
          donation_qr_url?: string | null
          email?: string | null
          facebook_url?: string | null
          gcash_number?: string | null
          gcash_qr_url?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          livestream_url?: string | null
          longitude?: number | null
          maya_number?: string | null
          maya_qr_url?: string | null
          name: string
          operating_hours?: Json | null
          panorama_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          contact_number?: string | null
          created_at?: string | null
          description?: string | null
          donation_qr_url?: string | null
          email?: string | null
          facebook_url?: string | null
          gcash_number?: string | null
          gcash_qr_url?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          livestream_url?: string | null
          longitude?: number | null
          maya_number?: string | null
          maya_qr_url?: string | null
          name?: string
          operating_hours?: Json | null
          panorama_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          church_id: string
          created_at: string | null
          id: string
          notes: string | null
          proof_url: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["donation_status"] | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          church_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["donation_status"] | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          church_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["donation_status"] | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "donations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_schedules: {
        Row: {
          church_id: string
          created_at: string | null
          day_of_week: string
          id: string
          language: string | null
          time: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          day_of_week: string
          id?: string
          language?: string | null
          time: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          day_of_week?: string
          id?: string
          language?: string | null
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "mass_schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
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
      priest_availability: {
        Row: {
          available_date: string
          church_id: string
          created_at: string | null
          end_time: string
          id: string
          is_blocked: boolean | null
          notes: string | null
          priest_id: string
          start_time: string
        }
        Insert: {
          available_date: string
          church_id: string
          created_at?: string | null
          end_time: string
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          priest_id: string
          start_time: string
        }
        Update: {
          available_date?: string
          church_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          priest_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "priest_availability_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "priest_availability_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priest_availability_priest_id_fkey"
            columns: ["priest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_church_id: string | null
          avatar_url: string | null
          church_id: string | null
          created_at: string | null
          email: string | null
          fcm_token: string | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          assigned_church_id?: string | null
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          assigned_church_id?: string | null
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_church_id_fkey"
            columns: ["assigned_church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "profiles_assigned_church_id_fkey"
            columns: ["assigned_church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      sacrament_requirements: {
        Row: {
          allowed_file_types: string[] | null
          church_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          requirement_name: string
          service_type: Database["public"]["Enums"]["sacrament_type"]
        }
        Insert: {
          allowed_file_types?: string[] | null
          church_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          requirement_name: string
          service_type: Database["public"]["Enums"]["sacrament_type"]
        }
        Update: {
          allowed_file_types?: string[] | null
          church_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          requirement_name?: string
          service_type?: Database["public"]["Enums"]["sacrament_type"]
        }
        Relationships: [
          {
            foreignKeyName: "sacrament_requirements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "sacrament_requirements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_durations: {
        Row: {
          church_id: string
          duration_minutes: number
          id: string
          max_per_day: number | null
          service_type: Database["public"]["Enums"]["sacrament_type"]
        }
        Insert: {
          church_id: string
          duration_minutes?: number
          id?: string
          max_per_day?: number | null
          service_type: Database["public"]["Enums"]["sacrament_type"]
        }
        Update: {
          church_id?: string
          duration_minutes?: number
          id?: string
          max_per_day?: number | null
          service_type?: Database["public"]["Enums"]["sacrament_type"]
        }
        Relationships: [
          {
            foreignKeyName: "service_durations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "church_stats"
            referencedColumns: ["church_id"]
          },
          {
            foreignKeyName: "service_durations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      church_stats: {
        Row: {
          appointments_last_30_days: number | null
          approved_appointments: number | null
          church_id: string | null
          church_name: string | null
          church_status: string | null
          completed_appointments: number | null
          last_updated: string | null
          pending_appointments: number | null
          staff_count: number | null
          total_appointments: number | null
          upcoming_appointments: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_church_stats: { Args: never; Returns: undefined }
    }
    Enums: {
      appt_status:
      | "pending"
      | "approved"
      | "rejected"
      | "rescheduled"
      | "completed"
      | "cancelled"
      donation_status: "pending" | "verified" | "rejected"
      sacrament_type:
      | "baptism"
      | "wedding"
      | "funeral"
      | "confirmation"
      | "counseling"
      | "mass_intention"
      | "confession"
      | "anointing"
      user_role:
      | "super_admin"
      | "admin"
      | "priest"
      | "volunteer"
      | "user"
      | "church_admin"
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
      appt_status: [
        "pending",
        "approved",
        "rejected",
        "rescheduled",
        "completed",
        "cancelled",
      ],
      donation_status: ["pending", "verified", "rejected"],
      sacrament_type: [
        "baptism",
        "wedding",
        "funeral",
        "confirmation",
        "counseling",
        "mass_intention",
        "confession",
        "anointing",
      ],
      user_role: [
        "super_admin",
        "admin",
        "priest",
        "volunteer",
        "user",
        "church_admin",
      ],
    },
  },
} as const

// Custom type aliases for convenience
export type ChurchAnnouncement = Tables<"church_announcements">
export type SystemAnnouncement = Tables<"system_announcements">
export type Profile = Tables<"profiles">
export type Church = Tables<"churches">
export type Appointment = Tables<"appointments">
export type Donation = Tables<"donations">
export type MassSchedule = Tables<"mass_schedules">
