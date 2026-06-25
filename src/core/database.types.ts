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
    PostgrestVersion: "14.5"
  }
  core: {
    Tables: {
      capabilities: {
        Row: {
          capability: string
          created_at: string
          id: string
          module: string
          roles: string[]
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          module: string
          roles: string[]
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          module?: string
          roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_module_fkey"
            columns: ["module"]
            isOneToOne: false
            referencedRelation: "module_registry"
            referencedColumns: ["module"]
          },
        ]
      }
      events: {
        Row: {
          actor_user_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          module: string
          occurred_at: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          module: string
          occurred_at?: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          module?: string
          occurred_at?: string
          payload?: Json
        }
        Relationships: []
      }
      module_registry: {
        Row: {
          display_name: string
          installed_at: string
          manifest: Json
          module: string
          status: string
          version: string
        }
        Insert: {
          display_name: string
          installed_at?: string
          manifest?: Json
          module: string
          status?: string
          version?: string
        }
        Update: {
          display_name?: string
          installed_at?: string
          manifest?: Json
          module?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_company: {
        Row: {
          city: string | null
          company_id: string | null
          country: string | null
          name: string | null
          postal_code: string | null
          street: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          company_id?: string | null
          country?: string | null
          name?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string | null
          country?: string | null
          name?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_contact: {
        Row: {
          contact_id: string | null
          email: string | null
          first_name: string | null
          job_title: string | null
          last_name: string | null
          mobile: string | null
          phone: string | null
          salutation: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          email?: string | null
          first_name?: string | null
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          phone?: string | null
          salutation?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          email?: string | null
          first_name?: string | null
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          phone?: string | null
          salutation?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_deal: {
        Row: {
          company_id: string | null
          currency: string | null
          deal_id: string | null
          description: string | null
          expected_close_date: string | null
          primary_contact_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          value_amount: number | null
          won_at: string | null
        }
        Insert: {
          company_id?: string | null
          currency?: string | null
          deal_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          primary_contact_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          value_amount?: number | null
          won_at?: string | null
        }
        Update: {
          company_id?: string | null
          currency?: string | null
          deal_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          primary_contact_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          value_amount?: number | null
          won_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      emit_event: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_module: string
          p_payload?: Json
        }
        Returns: string
      }
      has_capability: {
        Args: { p_capability: string; p_module: string }
        Returns: boolean
      }
      register_module: {
        Args: {
          p_display_name: string
          p_manifest?: Json
          p_module: string
          p_version?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  core: {
    Enums: {},
  },
} as const
