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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      anomalies: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          type: string
          user_id: string | null
          user_id_hashed: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          type: string
          user_id?: string | null
          user_id_hashed: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          type?: string
          user_id?: string | null
          user_id_hashed?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arrivals: {
        Row: {
          actor_id: string
          arrival_time: string | null
          arrived: boolean
          created_at: string | null
          driver_id: string
          id: string
          reservation_id: string
        }
        Insert: {
          actor_id: string
          arrival_time?: string | null
          arrived?: boolean
          created_at?: string | null
          driver_id: string
          id?: string
          reservation_id: string
        }
        Update: {
          actor_id?: string
          arrival_time?: string | null
          arrived?: boolean
          created_at?: string | null
          driver_id?: string
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrivals_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          capacity: number | null
          created_at: string | null
          driver_id: string | null
          id: string
          owner_id: string | null
          route: string | null
          title: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          owner_id?: string | null
          route?: string | null
          title: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          owner_id?: string | null
          route?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cars_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          checksum: string | null
          created_at: string
          driver_id: string
          file_key: string
          id: string
          mime_type: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uploaded_by: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          driver_id: string
          file_key: string
          id?: string
          mime_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          driver_id?: string
          file_key?: string
          id?: string
          mime_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          avg_rating: number | null
          completed_trips: number | null
          created_at: string | null
          id: string
          license_doc_url: string | null
          status: Database["public"]["Enums"]["driver_status"] | null
          vehicle_plate: string | null
        }
        Insert: {
          avg_rating?: number | null
          completed_trips?: number | null
          created_at?: string | null
          id: string
          license_doc_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          vehicle_plate?: string | null
        }
        Update: {
          avg_rating?: number | null
          completed_trips?: number | null
          created_at?: string | null
          id?: string
          license_doc_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_confirmed: boolean | null
          admin_id: string | null
          admin_note: string | null
          ai_confidence: number | null
          created_at: string | null
          extracted_fields: Json | null
          id: string
          image_url: string
          ocr_text: string | null
          payment_status: string | null
          reservation_id: string
        }
        Insert: {
          admin_confirmed?: boolean | null
          admin_id?: string | null
          admin_note?: string | null
          ai_confidence?: number | null
          created_at?: string | null
          extracted_fields?: Json | null
          id?: string
          image_url: string
          ocr_text?: string | null
          payment_status?: string | null
          reservation_id: string
        }
        Update: {
          admin_confirmed?: boolean | null
          admin_id?: string | null
          admin_note?: string | null
          ai_confidence?: number | null
          created_at?: string | null
          extracted_fields?: Json | null
          id?: string
          image_url?: string
          ocr_text?: string | null
          payment_status?: string | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          endpoint: string
          id: string
          request_count: number
          subject: string
          window_start: string
        }
        Insert: {
          endpoint: string
          id?: string
          request_count?: number
          subject: string
          window_start?: string
        }
        Update: {
          endpoint?: string
          id?: string
          request_count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          driver_id: string
          id: string
          passenger_hash: string | null
          passenger_id: string
          rating: number | null
          trip_window_id: string | null
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          driver_id: string
          id?: string
          passenger_hash?: string | null
          passenger_id: string
          rating?: number | null
          trip_window_id?: string | null
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          driver_id?: string
          id?: string
          passenger_hash?: string | null
          passenger_id?: string
          rating?: number | null
          trip_window_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          car_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          low_confidence: boolean | null
          multi_seat: boolean | null
          order_number: number
          paid_unallocated: boolean | null
          passenger_id: string
          payment_tx_id: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
        }
        Insert: {
          car_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          low_confidence?: boolean | null
          multi_seat?: boolean | null
          order_number: number
          paid_unallocated?: boolean | null
          passenger_id: string
          payment_tx_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Update: {
          car_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          low_confidence?: boolean | null
          multi_seat?: boolean | null
          order_number?: number
          paid_unallocated?: boolean | null
          passenger_id?: string
          payment_tx_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_registrations: {
        Row: {
          attempts: number | null
          consumed: boolean | null
          created_at: string | null
          device_fingerprint: string | null
          email: string | null
          error_reason: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          name: string | null
          phone: string | null
          requested_role: string | null
          source: string | null
          verification_code_email: string | null
          verification_code_sms: string | null
        }
        Insert: {
          attempts?: number | null
          consumed?: boolean | null
          created_at?: string | null
          device_fingerprint?: string | null
          email?: string | null
          error_reason?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          name?: string | null
          phone?: string | null
          requested_role?: string | null
          source?: string | null
          verification_code_email?: string | null
          verification_code_sms?: string | null
        }
        Update: {
          attempts?: number | null
          consumed?: boolean | null
          created_at?: string | null
          device_fingerprint?: string | null
          email?: string | null
          error_reason?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          name?: string | null
          phone?: string | null
          requested_role?: string | null
          source?: string | null
          verification_code_email?: string | null
          verification_code_sms?: string | null
        }
        Relationships: []
      }
      upload_tokens: {
        Row: {
          bucket: string
          consumed: boolean | null
          created_at: string
          expires_at: string
          file_key: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          bucket: string
          consumed?: boolean | null
          created_at?: string
          expires_at: string
          file_key: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          bucket?: string
          consumed?: boolean | null
          created_at?: string
          expires_at?: string
          file_key?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes_for_extra_cars: {
        Row: {
          consumed: boolean | null
          created_at: string | null
          id: string
          passenger_id: string
          route: string
          travel_date: string
        }
        Insert: {
          consumed?: boolean | null
          created_at?: string | null
          id?: string
          passenger_id: string
          route: string
          travel_date: string
        }
        Update: {
          consumed?: boolean | null
          created_at?: string | null
          id?: string
          passenger_id?: string
          route?: string
          travel_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_for_extra_cars_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_rating_aggregates: {
        Row: {
          avg_rating: number | null
          day: string | null
          driver_id: string | null
          ratings_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_target_user_id: string
        }
        Returns: boolean
      }
      admin_set_role_v2: {
        Args: {
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_limit?: number
          p_subject: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_expired_tokens: { Args: never; Returns: number }
      cleanup_expired_votes: { Args: never; Returns: number }
      cleanup_temp_registrations: { Args: never; Returns: number }
      clear_failed_logins: { Args: { p_email: string }; Returns: undefined }
      consume_upload_token: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: {
          bucket: string
          file_key: string
          valid: boolean
        }[]
      }
      create_anonymous_rating: {
        Args: { p_anonymous?: boolean; p_driver_id: string; p_rating: number }
        Returns: string
      }
      create_upload_token: {
        Args: {
          p_bucket: string
          p_expires_minutes?: number
          p_file_key: string
          p_user_id: string
        }
        Returns: string
      }
      detect_anomalies: { Args: never; Returns: number }
      driver_queue_for_car: {
        Args: { p_car_id: string }
        Returns: {
          arrival_time: string
          arrived: boolean
          order_number: number
          passenger_phone: string
          reservation_id: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      expire_temporary_holds: { Args: never; Returns: number }
      get_car_seat_count: { Args: { car_uuid: string }; Returns: number }
      get_driver_ratings: {
        Args: { p_driver_id: string }
        Returns: {
          avg_rating: number
          day: string
          ratings_count: number
        }[]
      }
      get_next_order_number: { Args: { car_uuid: string }; Returns: number }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_role_v2: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_vote_summary: {
        Args: { p_route: string; p_travel_date: string }
        Returns: {
          remaining_to_trigger: number
          total_needed: number
          votes_count: number
        }[]
      }
      has_active_reservation: { Args: { user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_locked: {
        Args: {
          p_email: string
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_driver: { Args: { user_id: string }; Returns: boolean }
      is_owner: { Args: { user_id: string }; Returns: boolean }
      log_action: {
        Args: { p_action: string; p_actor_id: string; p_payload?: Json }
        Returns: string
      }
      log_document_access: {
        Args: { p_action?: string; p_actor_id: string; p_doc_id: string }
        Returns: undefined
      }
      mark_passenger_arrival: {
        Args: { p_arrived: boolean; p_reservation_id: string }
        Returns: boolean
      }
      owner_accept_extra_car: {
        Args: { p_car_title: string; p_route: string; p_travel_date: string }
        Returns: string
      }
      passenger_queue_for_car: {
        Args: { p_car_id: string }
        Returns: {
          order_number: number
          passenger_name: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      record_failed_login: {
        Args: { p_email: string; p_ip_address?: string }
        Returns: undefined
      }
      refresh_rating_aggregates: { Args: never; Returns: undefined }
      reserve_seat: {
        Args: { p_car_id: string; p_passenger_id: string }
        Returns: {
          message: string
          order_number: number
          reservation_id: string
          success: boolean
        }[]
      }
      vote_for_extra_car: {
        Args: { p_route: string; p_travel_date: string }
        Returns: {
          remaining_to_trigger: number
          votes_count: number
        }[]
      }
    }
    Enums: {
      app_role: "passenger" | "driver" | "owner" | "admin"
      driver_status: "pending" | "approved" | "blocked"
      payment_status:
        | "paid_unuploaded"
        | "pending_verification"
        | "verified"
        | "rejected"
      reservation_status:
        | "temporary"
        | "confirmed"
        | "cancelled"
        | "rejected"
        | "completed"
      user_role: "passenger" | "driver" | "admin"
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
      app_role: ["passenger", "driver", "owner", "admin"],
      driver_status: ["pending", "approved", "blocked"],
      payment_status: [
        "paid_unuploaded",
        "pending_verification",
        "verified",
        "rejected",
      ],
      reservation_status: [
        "temporary",
        "confirmed",
        "cancelled",
        "rejected",
        "completed",
      ],
      user_role: ["passenger", "driver", "admin"],
    },
  },
} as const
