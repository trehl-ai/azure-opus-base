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
  public: {
    Tables: {
      _internal_id_mapping: {
        Row: {
          created_at: string | null
          guest_id: string
          pseudo_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          guest_id: string
          pseudo_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          guest_id?: string
          pseudo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "_internal_id_mapping_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          aktion: string
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          aktion: string
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          aktion?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bi_dashboards: {
        Row: {
          framework: string | null
          id: string
          idea_id: string | null
          name: string
          status: string | null
          url: string | null
          views_config: Json | null
        }
        Insert: {
          framework?: string | null
          id?: string
          idea_id?: string | null
          name: string
          status?: string | null
          url?: string | null
          views_config?: Json | null
        }
        Update: {
          framework?: string | null
          id?: string
          idea_id?: string | null
          name?: string
          status?: string | null
          url?: string | null
          views_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_dashboards_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_dashboards_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_data_sources: {
        Row: {
          endpoint: string | null
          id: string
          idea_id: string | null
          last_sync_at: string | null
          license_status: string | null
          name: string
          refresh_cron: string | null
          source_type: string | null
          status: string | null
        }
        Insert: {
          endpoint?: string | null
          id?: string
          idea_id?: string | null
          last_sync_at?: string | null
          license_status?: string | null
          name: string
          refresh_cron?: string | null
          source_type?: string | null
          status?: string | null
        }
        Update: {
          endpoint?: string | null
          id?: string
          idea_id?: string | null
          last_sync_at?: string | null
          license_status?: string | null
          name?: string
          refresh_cron?: string | null
          source_type?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_data_sources_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_data_sources_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_dossiers: {
        Row: {
          citations: Json | null
          created_at: string | null
          docx_url: string | null
          full_md: string | null
          hallucination_score: number | null
          id: string
          idea_id: string | null
          pdf_url: string | null
          source_coverage_score: number | null
          status: string | null
          summary_md: string | null
          target_entity_id: string | null
          title: string
        }
        Insert: {
          citations?: Json | null
          created_at?: string | null
          docx_url?: string | null
          full_md?: string | null
          hallucination_score?: number | null
          id?: string
          idea_id?: string | null
          pdf_url?: string | null
          source_coverage_score?: number | null
          status?: string | null
          summary_md?: string | null
          target_entity_id?: string | null
          title: string
        }
        Update: {
          citations?: Json | null
          created_at?: string | null
          docx_url?: string | null
          full_md?: string | null
          hallucination_score?: number | null
          id?: string
          idea_id?: string | null
          pdf_url?: string | null
          source_coverage_score?: number | null
          status?: string | null
          summary_md?: string | null
          target_entity_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bi_dossiers_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_dossiers_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_dossiers_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "bi_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_entities: {
        Row: {
          attributes: Json | null
          canonical_name: string
          created_at: string | null
          embedding: string | null
          entity_type: string
          id: string
          idea_id: string | null
        }
        Insert: {
          attributes?: Json | null
          canonical_name: string
          created_at?: string | null
          embedding?: string | null
          entity_type: string
          id?: string
          idea_id?: string | null
        }
        Update: {
          attributes?: Json | null
          canonical_name?: string
          created_at?: string | null
          embedding?: string | null
          entity_type?: string
          id?: string
          idea_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_entities_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_entities_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_raw_records: {
        Row: {
          external_id: string | null
          fetched_at: string | null
          id: string
          payload: Json
          payload_hash: string | null
          source_id: string | null
        }
        Insert: {
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          payload: Json
          payload_hash?: string | null
          source_id?: string | null
        }
        Update: {
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          payload?: Json
          payload_hash?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_raw_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "bi_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_destinations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          license_fee_monthly_eur: number | null
          license_start_at: string | null
          license_status: string | null
          name: string
          slug: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          license_fee_monthly_eur?: number | null
          license_start_at?: string | null
          license_status?: string | null
          name: string
          slug: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          license_fee_monthly_eur?: number | null
          license_start_at?: string | null
          license_status?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blt_guest_events: {
        Row: {
          created_at: string | null
          event_type: string
          guest_id: string | null
          id: string
          metadata: Json | null
          mission_id: string | null
          poi_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          guest_id?: string | null
          id?: string
          metadata?: Json | null
          mission_id?: string | null
          poi_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          guest_id?: string | null
          id?: string
          metadata?: Json | null
          mission_id?: string | null
          poi_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_guest_events_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_guest_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "blt_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_guest_events_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "blt_pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_guest_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_guest_persona: {
        Row: {
          assigned_at: string | null
          confidence: number | null
          guest_id: string | null
          id: string
          persona_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          confidence?: number | null
          guest_id?: string | null
          id?: string
          persona_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          confidence?: number | null
          guest_id?: string | null
          id?: string
          persona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_guest_persona_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_guest_persona_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "blt_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_guests: {
        Row: {
          auth_user_id: string | null
          checkin_count: number | null
          checkin_date: string | null
          checkout_date: string | null
          created_at: string | null
          destination_id: string | null
          device_type: string | null
          display_name: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          metadata: Json | null
          persona_updated_at: string | null
          profile_embedding: string | null
          push_token: string | null
          stay_count: number | null
          tenant_id: string | null
          total_points: number | null
        }
        Insert: {
          auth_user_id?: string | null
          checkin_count?: number | null
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string | null
          destination_id?: string | null
          device_type?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          metadata?: Json | null
          persona_updated_at?: string | null
          profile_embedding?: string | null
          push_token?: string | null
          stay_count?: number | null
          tenant_id?: string | null
          total_points?: number | null
        }
        Update: {
          auth_user_id?: string | null
          checkin_count?: number | null
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string | null
          destination_id?: string | null
          device_type?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          metadata?: Json | null
          persona_updated_at?: string | null
          profile_embedding?: string | null
          push_token?: string | null
          stay_count?: number | null
          tenant_id?: string | null
          total_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_guests_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "blt_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_knowledge_base: {
        Row: {
          active: boolean | null
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          tenant_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          tenant_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_knowledge_base_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_loyalty_transactions: {
        Row: {
          created_at: string | null
          description: string | null
          destination_id: string | null
          guest_id: string | null
          id: string
          points: number
          reference_id: string | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          guest_id?: string | null
          id?: string
          points: number
          reference_id?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          guest_id?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_loyalty_transactions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "blt_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_loyalty_transactions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_loyalty_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_mission_progress: {
        Row: {
          answer_given: string | null
          completed_at: string | null
          completed_poi_ids: string[] | null
          created_at: string | null
          current_count: number | null
          guest_id: string | null
          id: string
          media_url: string | null
          mission_id: string | null
          photo_url: string | null
          qr_scanned_value: string | null
        }
        Insert: {
          answer_given?: string | null
          completed_at?: string | null
          completed_poi_ids?: string[] | null
          created_at?: string | null
          current_count?: number | null
          guest_id?: string | null
          id?: string
          media_url?: string | null
          mission_id?: string | null
          photo_url?: string | null
          qr_scanned_value?: string | null
        }
        Update: {
          answer_given?: string | null
          completed_at?: string | null
          completed_poi_ids?: string[] | null
          created_at?: string | null
          current_count?: number | null
          guest_id?: string | null
          id?: string
          media_url?: string | null
          mission_id?: string | null
          photo_url?: string | null
          qr_scanned_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_mission_progress_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "blt_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_missions: {
        Row: {
          active: boolean | null
          answers: Json | null
          created_at: string | null
          description: string | null
          destination_id: string | null
          icon: string | null
          id: string
          image_url: string | null
          location_lat: number | null
          location_lng: number | null
          location_radius_meters: number | null
          mission_type: string | null
          poi_category: string | null
          poi_ids: string[] | null
          qr_code_value: string | null
          question: string | null
          required_count: number | null
          reward_points: number | null
          sort_order: number | null
          tenant_id: string | null
          title: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          answers?: Json | null
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_radius_meters?: number | null
          mission_type?: string | null
          poi_category?: string | null
          poi_ids?: string[] | null
          qr_code_value?: string | null
          question?: string | null
          required_count?: number | null
          reward_points?: number | null
          sort_order?: number | null
          tenant_id?: string | null
          title: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          answers?: Json | null
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_radius_meters?: number | null
          mission_type?: string | null
          poi_category?: string | null
          poi_ids?: string[] | null
          qr_code_value?: string | null
          question?: string | null
          required_count?: number | null
          reward_points?: number | null
          sort_order?: number | null
          tenant_id?: string | null
          title?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_missions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "blt_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_missions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_notifications: {
        Row: {
          body: string
          data: Json | null
          destination_id: string | null
          guest_id: string | null
          id: string
          sent_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          body: string
          data?: Json | null
          destination_id?: string | null
          guest_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          body?: string
          data?: Json | null
          destination_id?: string | null
          guest_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blt_notifications_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "blt_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_notifications_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_offer_events: {
        Row: {
          created_at: string | null
          event_type: string
          guest_id: string | null
          id: string
          offer_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          guest_id?: string | null
          id?: string
          offer_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          guest_id?: string | null
          id?: string
          offer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_offer_events_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_offer_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "blt_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_offers: {
        Row: {
          active: boolean | null
          created_at: string | null
          cta_label: string | null
          cta_url: string | null
          description: string | null
          id: string
          image_url: string | null
          persona_id: string | null
          title: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          persona_id?: string | null
          title: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          persona_id?: string | null
          title?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_offers_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "blt_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_personas: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          upsell_triggers: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          upsell_triggers?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          upsell_triggers?: Json | null
        }
        Relationships: []
      }
      blt_pois: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          destination_id: string | null
          id: string
          image_url: string | null
          lat: number
          lng: number
          loyalty_points_on_visit: number | null
          metadata: Json | null
          name: string
          qr_code: string | null
          tenant_id: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          image_url?: string | null
          lat: number
          lng: number
          loyalty_points_on_visit?: number | null
          metadata?: Json | null
          name: string
          qr_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          image_url?: string | null
          lat?: number
          lng?: number
          loyalty_points_on_visit?: number | null
          metadata?: Json | null
          name?: string
          qr_code?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blt_pois_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "blt_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_pois_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_reward_redemptions: {
        Row: {
          guest_id: string | null
          id: string
          points_spent: number
          redeemed_at: string | null
          reward_id: string | null
          tenant_id: string | null
          used_at: string | null
          voucher_code: string
        }
        Insert: {
          guest_id?: string | null
          id?: string
          points_spent: number
          redeemed_at?: string | null
          reward_id?: string | null
          tenant_id?: string | null
          used_at?: string | null
          voucher_code: string
        }
        Update: {
          guest_id?: string | null
          id?: string
          points_spent?: number
          redeemed_at?: string | null
          reward_id?: string | null
          tenant_id?: string | null
          used_at?: string | null
          voucher_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "blt_reward_redemptions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "blt_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blt_reward_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blt_rewards: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          id: string
          points_required: number
          sort_order: number | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          points_required: number
          sort_order?: number | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          points_required?: number
          sort_order?: number | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blt_rewards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_systems: {
        Row: {
          accent_color: string | null
          background_color: string | null
          brand_principles: Json | null
          company_id: string | null
          created_at: string | null
          font_body: string | null
          font_heading: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          tone_of_voice: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          brand_principles?: Json | null
          company_id?: string | null
          created_at?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          tone_of_voice?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          brand_principles?: Json | null
          company_id?: string | null
          created_at?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          tone_of_voice?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_systems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_systems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          provider: string
          sender_account_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          provider?: string
          sender_account_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          provider?: string
          sender_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          id: string
          industry: string | null
          lead_score: number | null
          lead_score_reason: string | null
          name: string
          notes: string | null
          owner_user_id: string | null
          postal_code: string | null
          source: string | null
          status: string
          street: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          lead_score_reason?: string | null
          name: string
          notes?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          lead_score_reason?: string | null
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          relationship_type: string | null
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          relationship_type?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          abbinder: string | null
          anrede: string | null
          birthday: string | null
          birthday_research_done: boolean | null
          company: string | null
          connected_on: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          drive_link: string | null
          email: string | null
          embedding: string | null
          first_name: string
          id: string
          job_title: string | null
          kaufsignale: string | null
          last_contact_at: string | null
          last_name: string
          lead_score: number | null
          lead_score_details: Json | null
          lead_score_reason: string | null
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          owner_user_id: string | null
          pain_points: string | null
          personal_insights: string | null
          phone: string | null
          source: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          abbinder?: string | null
          anrede?: string | null
          birthday?: string | null
          birthday_research_done?: boolean | null
          company?: string | null
          connected_on?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          drive_link?: string | null
          email?: string | null
          embedding?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          kaufsignale?: string | null
          last_contact_at?: string | null
          last_name: string
          lead_score?: number | null
          lead_score_details?: Json | null
          lead_score_reason?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          pain_points?: string | null
          personal_insights?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          abbinder?: string | null
          anrede?: string | null
          birthday?: string | null
          birthday_research_done?: boolean | null
          company?: string | null
          connected_on?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          drive_link?: string | null
          email?: string | null
          embedding?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          kaufsignale?: string | null
          last_contact_at?: string | null
          last_name?: string
          lead_score?: number | null
          lead_score_details?: Json | null
          lead_score_reason?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          pain_points?: string | null
          personal_insights?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: string
          auto_generated: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by_user_id: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          duration_seconds: number | null
          id: string
          mail_entwurf: string | null
          metadata: Json | null
          owner_user_id: string | null
          sequence_type: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          auto_generated?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          duration_seconds?: number | null
          id?: string
          mail_entwurf?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          sequence_type?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          auto_generated?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          duration_seconds?: number | null
          id?: string
          mail_entwurf?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          sequence_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_roadshow_details: {
        Row: {
          aufmerksam_geworden_durch: string | null
          ausweichen_turnhalle: string
          ausweichen_turnhalle_notiz: string | null
          baustelle_aktionszeitraum: string
          created_at: string
          deal_id: string
          erstkontakt_datum: string | null
          hort_ganztag: string
          id: string
          intern_attraktivitaet_score: number | null
          intern_checkliste_ausgefuellt: string
          intern_tempo_kommunikation: string | null
          platzbedarf_details: string | null
          platzbedarf_erfuellt: string
          potential_notizen: string | null
          region: string | null
          roadshow_eignung: string
          schueler_kl23_ausreichend: string
          schueler_kl234_ausreichend: string
          stromanschluss_230v: string
          umzaeunung_aktionsflaeche: string
          untergrund: string
          untergrund_notiz: string | null
          updated_at: string
          zufahrt_fahrzeuge: string
          zufahrt_notiz: string | null
        }
        Insert: {
          aufmerksam_geworden_durch?: string | null
          ausweichen_turnhalle?: string
          ausweichen_turnhalle_notiz?: string | null
          baustelle_aktionszeitraum?: string
          created_at?: string
          deal_id: string
          erstkontakt_datum?: string | null
          hort_ganztag?: string
          id?: string
          intern_attraktivitaet_score?: number | null
          intern_checkliste_ausgefuellt?: string
          intern_tempo_kommunikation?: string | null
          platzbedarf_details?: string | null
          platzbedarf_erfuellt?: string
          potential_notizen?: string | null
          region?: string | null
          roadshow_eignung?: string
          schueler_kl23_ausreichend?: string
          schueler_kl234_ausreichend?: string
          stromanschluss_230v?: string
          umzaeunung_aktionsflaeche?: string
          untergrund?: string
          untergrund_notiz?: string | null
          updated_at?: string
          zufahrt_fahrzeuge?: string
          zufahrt_notiz?: string | null
        }
        Update: {
          aufmerksam_geworden_durch?: string | null
          ausweichen_turnhalle?: string
          ausweichen_turnhalle_notiz?: string | null
          baustelle_aktionszeitraum?: string
          created_at?: string
          deal_id?: string
          erstkontakt_datum?: string | null
          hort_ganztag?: string
          id?: string
          intern_attraktivitaet_score?: number | null
          intern_checkliste_ausgefuellt?: string
          intern_tempo_kommunikation?: string | null
          platzbedarf_details?: string | null
          platzbedarf_erfuellt?: string
          potential_notizen?: string | null
          region?: string | null
          roadshow_eignung?: string
          schueler_kl23_ausreichend?: string
          schueler_kl234_ausreichend?: string
          stromanschluss_230v?: string
          umzaeunung_aktionsflaeche?: string
          untergrund?: string
          untergrund_notiz?: string | null
          updated_at?: string
          zufahrt_fahrzeuge?: string
          zufahrt_notiz?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_roadshow_details_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_roadshow_details_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string | null
          created_at: string
          created_by_user_id: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          owner_user_id: string | null
          pipeline_id: string
          pipeline_stage_id: string
          primary_contact_id: string | null
          priority: string | null
          probability_percent: number | null
          source: string | null
          status: string
          title: string
          updated_at: string
          value_amount: number | null
          won_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          pipeline_id: string
          pipeline_stage_id: string
          primary_contact_id?: string | null
          priority?: string | null
          probability_percent?: number | null
          source?: string | null
          status?: string
          title: string
          updated_at?: string
          value_amount?: number | null
          won_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          pipeline_id?: string
          pipeline_stage_id?: string
          primary_contact_id?: string | null
          priority?: string | null
          probability_percent?: number | null
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
          value_amount?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          display_name: string | null
          email_address: string
          id: string
          is_default: boolean
          metadata_json: Json | null
          provider: string
          refresh_token_encrypted: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          display_name?: string | null
          email_address: string
          id?: string
          is_default?: boolean
          metadata_json?: Json | null
          provider: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          display_name?: string | null
          email_address?: string
          id?: string
          is_default?: boolean
          metadata_json?: Json | null
          provider?: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          created_at: string
          email_message_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_message_id: string
          file_name: string
          file_path: string
          file_size?: number
          file_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_message_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          account_id: string | null
          bcc_email: string[] | null
          body_html: string | null
          body_text: string | null
          cc_email: string[] | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string
          error_message: string | null
          external_message_id: string | null
          external_thread_id: string | null
          from_email: string
          id: string
          provider: string
          sent_at: string | null
          status: string
          subject: string | null
          to_email: string[]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bcc_email?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string[] | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          external_thread_id?: string | null
          from_email: string
          id?: string
          provider: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string[]
          user_id: string
        }
        Update: {
          account_id?: string | null
          bcc_email?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string[] | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          external_thread_id?: string | null
          from_email?: string
          id?: string
          provider?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_builds: {
        Row: {
          artifacts: Json | null
          completed_at: string | null
          created_at: string | null
          error_log: string | null
          id: string
          idea_id: string | null
          started_at: string | null
          status: string
          track: string
        }
        Insert: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          idea_id?: string | null
          started_at?: string | null
          status?: string
          track: string
        }
        Update: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          idea_id?: string | null
          started_at?: string | null
          status?: string
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_builds_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_builds_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_costs: {
        Row: {
          amount_usd: number
          category: string
          id: string
          idea_id: string | null
          metadata: Json | null
          phase: string
          recorded_at: string | null
          units: number | null
        }
        Insert: {
          amount_usd: number
          category: string
          id?: string
          idea_id?: string | null
          metadata?: Json | null
          phase: string
          recorded_at?: string | null
          units?: number | null
        }
        Update: {
          amount_usd?: number
          category?: string
          id?: string
          idea_id?: string | null
          metadata?: Json | null
          phase?: string
          recorded_at?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_costs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_costs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_decisions: {
        Row: {
          decided_at: string | null
          decided_by: string
          decision: string
          id: string
          idea_id: string | null
          phase: string
          reason: string | null
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string
          decision: string
          id?: string
          idea_id?: string | null
          phase: string
          reason?: string | null
        }
        Update: {
          decided_at?: string | null
          decided_by?: string
          decision?: string
          id?: string
          idea_id?: string | null
          phase?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_decisions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_decisions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_deployments: {
        Row: {
          app_store_url: string | null
          brand_system_id: string | null
          deployed_at: string | null
          deployment_type: string
          expo_project_id: string | null
          github_repo: string | null
          id: string
          idea_id: string | null
          play_store_url: string | null
          status: string | null
          track: string
          url: string | null
          vercel_project_id: string | null
        }
        Insert: {
          app_store_url?: string | null
          brand_system_id?: string | null
          deployed_at?: string | null
          deployment_type: string
          expo_project_id?: string | null
          github_repo?: string | null
          id?: string
          idea_id?: string | null
          play_store_url?: string | null
          status?: string | null
          track: string
          url?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          app_store_url?: string | null
          brand_system_id?: string | null
          deployed_at?: string | null
          deployment_type?: string
          expo_project_id?: string | null
          github_repo?: string | null
          id?: string
          idea_id?: string | null
          play_store_url?: string | null
          status?: string | null
          track?: string
          url?: string | null
          vercel_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_deployments_brand_system_id_fkey"
            columns: ["brand_system_id"]
            isOneToOne: false
            referencedRelation: "brand_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_deployments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_deployments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_research_briefs: {
        Row: {
          brief_md: string
          competitors: Json | null
          created_at: string | null
          data_sources: Json | null
          embedding: string | null
          icp_schema: Json
          id: string
          idea_id: string | null
          market_size_eur: number | null
        }
        Insert: {
          brief_md: string
          competitors?: Json | null
          created_at?: string | null
          data_sources?: Json | null
          embedding?: string | null
          icp_schema: Json
          id?: string
          idea_id?: string | null
          market_size_eur?: number | null
        }
        Update: {
          brief_md?: string
          competitors?: Json | null
          created_at?: string | null
          data_sources?: Json | null
          embedding?: string | null
          icp_schema?: Json
          id?: string
          idea_id?: string | null
          market_size_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_research_briefs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: true
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_research_briefs_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: true
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_tracks: {
        Row: {
          assigned_at: string | null
          combo_role: string | null
          id: string
          idea_id: string | null
          is_primary: boolean | null
          track: string
        }
        Insert: {
          assigned_at?: string | null
          combo_role?: string | null
          id?: string
          idea_id?: string | null
          is_primary?: boolean | null
          track: string
        }
        Update: {
          assigned_at?: string | null
          combo_role?: string | null
          id?: string
          idea_id?: string | null
          is_primary?: boolean | null
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_tracks_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_tracks_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_validations: {
        Row: {
          agent: string
          cost_usd: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          idea_id: string | null
          output_json: Json
          score: number | null
          verdict: string | null
        }
        Insert: {
          agent: string
          cost_usd?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          idea_id?: string | null
          output_json: Json
          score?: number | null
          verdict?: string | null
        }
        Update: {
          agent?: string
          cost_usd?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          idea_id?: string | null
          output_json?: Json
          score?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_validations_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_validations_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          landing_deployed_at: string | null
          landing_url: string | null
          raw_input: string
          slug: string
          source: string | null
          status: string
          title: string
          tower_verdict: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          landing_deployed_at?: string | null
          landing_url?: string | null
          raw_input: string
          slug: string
          source?: string | null
          status?: string
          title: string
          tower_verdict?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          landing_deployed_at?: string | null
          landing_url?: string | null
          raw_input?: string
          slug?: string
          source?: string | null
          status?: string
          title?: string
          tower_verdict?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ideen_matches: {
        Row: {
          begruendung: string | null
          created_at: string | null
          id: string
          idee: string
          matched_contact_id: string | null
          matched_deal_id: string | null
          score: number | null
        }
        Insert: {
          begruendung?: string | null
          created_at?: string | null
          id?: string
          idee: string
          matched_contact_id?: string | null
          matched_deal_id?: string | null
          score?: number | null
        }
        Update: {
          begruendung?: string | null
          created_at?: string | null
          id?: string
          idee?: string
          matched_contact_id?: string | null
          matched_deal_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ideen_matches_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideen_matches_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideen_matches_matched_deal_id_fkey"
            columns: ["matched_deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideen_matches_matched_deal_id_fkey"
            columns: ["matched_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          failed_rows: number | null
          file_name: string
          finished_at: string | null
          id: string
          import_type: string
          started_at: string | null
          started_by_user_id: string | null
          status: string
          success_rows: number | null
          total_rows: number | null
        }
        Insert: {
          created_at?: string
          failed_rows?: number | null
          file_name: string
          finished_at?: string | null
          id?: string
          import_type: string
          started_at?: string | null
          started_by_user_id?: string | null
          status?: string
          success_rows?: number | null
          total_rows?: number | null
        }
        Update: {
          created_at?: string
          failed_rows?: number | null
          file_name?: string
          finished_at?: string | null
          id?: string
          import_type?: string
          started_at?: string | null
          started_by_user_id?: string | null
          status?: string
          success_rows?: number | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_started_by_user_id_fkey"
            columns: ["started_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          created_entity_id: string | null
          created_entity_type: string | null
          error_message: string | null
          id: string
          import_job_id: string
          mapped_payload_json: Json | null
          raw_payload_json: Json | null
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          error_message?: string | null
          id?: string
          import_job_id: string
          mapped_payload_json?: Json | null
          raw_payload_json?: Json | null
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          error_message?: string | null
          id?: string
          import_job_id?: string
          mapped_payload_json?: Json | null
          raw_payload_json?: Json | null
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_messages: {
        Row: {
          created_at: string
          created_company_id: string | null
          created_contact_id: string | null
          created_deal_id: string | null
          id: string
          parsed_payload_json: Json | null
          raw_body: string | null
          received_at: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          sender_email: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          created_company_id?: string | null
          created_contact_id?: string | null
          created_deal_id?: string | null
          id?: string
          parsed_payload_json?: Json | null
          raw_body?: string | null
          received_at?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          created_company_id?: string | null
          created_contact_id?: string | null
          created_deal_id?: string | null
          id?: string
          parsed_payload_json?: Json | null
          raw_body?: string | null
          received_at?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_messages_created_company_id_fkey"
            columns: ["created_company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_created_company_id_fkey"
            columns: ["created_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_created_contact_id_fkey"
            columns: ["created_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_created_contact_id_fkey"
            columns: ["created_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_created_deal_id_fkey"
            columns: ["created_deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_created_deal_id_fkey"
            columns: ["created_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_messages_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          brand_system_id: string | null
          concept_id: string | null
          contact_id: string | null
          content: string
          created_at: string | null
          drive_link_konzept: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_version: number | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          pipeline_status: string | null
          project_refs: string[] | null
          research_sources: Json | null
          source: string | null
          source_ref: string | null
          summary: string | null
          tags: string[] | null
          title: string
          type: string
          unverified_count: number | null
          updated_at: string | null
        }
        Insert: {
          brand_system_id?: string | null
          concept_id?: string | null
          contact_id?: string | null
          content: string
          created_at?: string | null
          drive_link_konzept?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_version?: number | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          pipeline_status?: string | null
          project_refs?: string[] | null
          research_sources?: Json | null
          source?: string | null
          source_ref?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          type: string
          unverified_count?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_system_id?: string | null
          concept_id?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string | null
          drive_link_konzept?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_version?: number | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          pipeline_status?: string | null
          project_refs?: string[] | null
          research_sources?: Json | null
          source?: string | null
          source_ref?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          unverified_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_brand_system_id_fkey"
            columns: ["brand_system_id"]
            isOneToOne: false
            referencedRelation: "brand_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_links: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          knowledge_entry_id: string | null
          knowledge_ref: string
          knowledge_type: string
          link_type: string | null
          linked_entry_id: string | null
          relevance_score: number | null
          similarity_score: number | null
          source_id: string
          source_type: string
          title: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          knowledge_entry_id?: string | null
          knowledge_ref: string
          knowledge_type: string
          link_type?: string | null
          linked_entry_id?: string | null
          relevance_score?: number | null
          similarity_score?: number | null
          source_id: string
          source_type: string
          title?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          knowledge_entry_id?: string | null
          knowledge_ref?: string
          knowledge_type?: string
          link_type?: string | null
          linked_entry_id?: string | null
          relevance_score?: number | null
          similarity_score?: number | null
          source_id?: string
          source_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_links_knowledge_entry_id_fkey"
            columns: ["knowledge_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_links_linked_entry_id_fkey"
            columns: ["linked_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      konzept_projects: {
        Row: {
          concept_id: string | null
          created_at: string | null
          doc_business_case: string | null
          doc_competitive_landscape: string | null
          doc_developer_briefing: string | null
          doc_executive_summary: string | null
          doc_konzeptdokument: string | null
          doc_risiko_register: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          id: string
          knowledge_entry_id: string | null
          konzept_titel: string
          pitch_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          concept_id?: string | null
          created_at?: string | null
          doc_business_case?: string | null
          doc_competitive_landscape?: string | null
          doc_developer_briefing?: string | null
          doc_executive_summary?: string | null
          doc_konzeptdokument?: string | null
          doc_risiko_register?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string
          knowledge_entry_id?: string | null
          konzept_titel: string
          pitch_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          concept_id?: string | null
          created_at?: string | null
          doc_business_case?: string | null
          doc_competitive_landscape?: string | null
          doc_developer_briefing?: string | null
          doc_executive_summary?: string | null
          doc_konzeptdokument?: string | null
          doc_risiko_register?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string
          knowledge_entry_id?: string | null
          konzept_titel?: string
          pitch_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "konzept_projects_knowledge_entry_id_fkey"
            columns: ["knowledge_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "konzept_projects_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitch_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          session_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          slug?: string
        }
        Relationships: []
      }
      lfr_context_sources: {
        Row: {
          endpoint: string | null
          id: string
          idea_id: string | null
          last_pull_at: string | null
          name: string
          refresh_cron: string | null
        }
        Insert: {
          endpoint?: string | null
          id?: string
          idea_id?: string | null
          last_pull_at?: string | null
          name: string
          refresh_cron?: string | null
        }
        Update: {
          endpoint?: string | null
          id?: string
          idea_id?: string | null
          last_pull_at?: string | null
          name?: string
          refresh_cron?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lfr_context_sources_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfr_context_sources_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      lfr_knowledge: {
        Row: {
          content: string
          doc_type: string | null
          embedding: string | null
          id: string
          idea_id: string | null
          refreshed_at: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          content: string
          doc_type?: string | null
          embedding?: string | null
          id?: string
          idea_id?: string | null
          refreshed_at?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          content?: string
          doc_type?: string | null
          embedding?: string | null
          id?: string
          idea_id?: string | null
          refreshed_at?: string | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lfr_knowledge_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfr_knowledge_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      lfr_messages: {
        Row: {
          content: string
          cost_usd: number | null
          created_at: string | null
          embedding: string | null
          id: string
          retrieved_context: Json | null
          role: string | null
          session_id: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          cost_usd?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          retrieved_context?: Json | null
          role?: string | null
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          cost_usd?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          retrieved_context?: Json | null
          role?: string | null
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lfr_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lfr_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lfr_sessions: {
        Row: {
          device_metadata: Json | null
          ended_at: string | null
          id: string
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          device_metadata?: Json | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          device_metadata?: Json | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lfr_sessions_guest_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "blt_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      lfr_users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          device_type: string | null
          display_name: string | null
          email: string
          id: string
          idea_id: string | null
          metadata: Json | null
          push_token: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          device_type?: string | null
          display_name?: string | null
          email: string
          id?: string
          idea_id?: string | null
          metadata?: Json | null
          push_token?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          device_type?: string | null
          display_name?: string | null
          email?: string
          id?: string
          idea_id?: string | null
          metadata?: Json | null
          push_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lfr_users_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfr_users_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      main_project_resources: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          main_project_id: string
          mime_type: string | null
          resource_type: string
          sort_order: number
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          main_project_id: string
          mime_type?: string | null
          resource_type: string
          sort_order?: number
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          main_project_id?: string
          mime_type?: string | null
          resource_type?: string
          sort_order?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "main_project_resources_main_project_id_fkey"
            columns: ["main_project_id"]
            isOneToOne: false
            referencedRelation: "main_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      main_projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          image_url: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      outreach_sequences: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string
          created_at: string | null
          current_mail_step: number | null
          id: string
          last_sent_at: string | null
          metadata: Json | null
          next_send_at: string | null
          offer_url: string
          slug: string
          status: string
          updated_at: string | null
        }
        Insert: {
          company_name: string
          contact_email: string
          contact_name: string
          created_at?: string | null
          current_mail_step?: number | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          next_send_at?: string | null
          offer_url: string
          slug: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string
          created_at?: string | null
          current_mail_step?: number | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          next_send_at?: string | null
          offer_url?: string
          slug?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pharma_lead_dossiers: {
        Row: {
          clinical_trial_ref: string | null
          company_name: string
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          embedding: string | null
          fit_reasoning: string | null
          id: string
          offer_url: string | null
          project_refs: string[] | null
          rdb004_fit_score: number | null
          research_data: Json | null
          research_status: string | null
          source: string | null
          therapeutic_areas: string[] | null
          therapy_area: string | null
          updated_at: string | null
        }
        Insert: {
          clinical_trial_ref?: string | null
          company_name: string
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          embedding?: string | null
          fit_reasoning?: string | null
          id?: string
          offer_url?: string | null
          project_refs?: string[] | null
          rdb004_fit_score?: number | null
          research_data?: Json | null
          research_status?: string | null
          source?: string | null
          therapeutic_areas?: string[] | null
          therapy_area?: string | null
          updated_at?: string | null
        }
        Update: {
          clinical_trial_ref?: string | null
          company_name?: string
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          embedding?: string | null
          fit_reasoning?: string | null
          id?: string
          offer_url?: string | null
          project_refs?: string[] | null
          rdb004_fit_score?: number | null
          research_data?: Json | null
          research_status?: string | null
          source?: string | null
          therapeutic_areas?: string[] | null
          therapy_area?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharma_lead_dossiers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharma_lead_dossiers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_lost_stage: boolean | null
          is_won_stage: boolean | null
          name: string
          pipeline_id: string
          position: number
          probability_percent: number | null
          stage_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost_stage?: boolean | null
          is_won_stage?: boolean | null
          name: string
          pipeline_id: string
          position: number
          probability_percent?: number | null
          stage_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lost_stage?: boolean | null
          is_won_stage?: boolean | null
          name?: string
          pipeline_id?: string
          position?: number
          probability_percent?: number | null
          stage_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pitch_decks: {
        Row: {
          ai_summary: string | null
          ask_runway_score: number | null
          build_or_buy: Json | null
          concept_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          deep_dive_result: Json | null
          deep_dive_status: string | null
          devil_advocate: Json | null
          drive_link: string | null
          drive_link_konzept: string | null
          empfehlung: string | null
          file_path: string | null
          id: string
          knowledge_entry_id: string | null
          konzept_titel: string | null
          overall_score: number | null
          regulatory_score: number | null
          scoring_details: Json | null
          scoring_dimensions: Json | null
          status: string | null
          tam_score: number | null
          team_score: number | null
          traction_score: number | null
          watchlist_added_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          ask_runway_score?: number | null
          build_or_buy?: Json | null
          concept_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          deep_dive_result?: Json | null
          deep_dive_status?: string | null
          devil_advocate?: Json | null
          drive_link?: string | null
          drive_link_konzept?: string | null
          empfehlung?: string | null
          file_path?: string | null
          id?: string
          knowledge_entry_id?: string | null
          konzept_titel?: string | null
          overall_score?: number | null
          regulatory_score?: number | null
          scoring_details?: Json | null
          scoring_dimensions?: Json | null
          status?: string | null
          tam_score?: number | null
          team_score?: number | null
          traction_score?: number | null
          watchlist_added_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          ask_runway_score?: number | null
          build_or_buy?: Json | null
          concept_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          deep_dive_result?: Json | null
          deep_dive_status?: string | null
          devil_advocate?: Json | null
          drive_link?: string | null
          drive_link_konzept?: string | null
          empfehlung?: string | null
          file_path?: string | null
          id?: string
          knowledge_entry_id?: string | null
          konzept_titel?: string | null
          overall_score?: number | null
          regulatory_score?: number | null
          scoring_details?: Json | null
          scoring_dimensions?: Json | null
          status?: string | null
          tam_score?: number | null
          team_score?: number | null
          traction_score?: number | null
          watchlist_added_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_decks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_knowledge_entry_id_fkey"
            columns: ["knowledge_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          pii_accessed: boolean | null
          reason: string | null
          resource_id: string | null
          resource_type: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          pii_accessed?: boolean | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          pii_accessed?: boolean | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      platform_consent_log: {
        Row: {
          consent_type: string
          consent_value: boolean
          consent_version: string | null
          created_at: string | null
          guest_id: string
          id: string
          ip_address: unknown
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          consent_type: string
          consent_value: boolean
          consent_version?: string | null
          created_at?: string | null
          guest_id: string
          id?: string
          ip_address?: unknown
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          consent_type?: string
          consent_value?: boolean
          consent_version?: string | null
          created_at?: string | null
          guest_id?: string
          id?: string
          ip_address?: unknown
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_consent_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string | null
          pseudo_id: string
          tenant_id: string
        }
        Insert: {
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          pseudo_id: string
          tenant_id: string
        }
        Update: {
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          pseudo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_guests_behavior: {
        Row: {
          avg_checkin_hour: number | null
          avg_meal_spend_cents: number | null
          checkin_count: number | null
          created_at: string | null
          first_visit_date: string | null
          last_activity_at: string | null
          loyalty_points: number | null
          persona_confidence: number | null
          persona_id: string | null
          preferred_categories: string[] | null
          profile_embedding: string | null
          pseudo_id: string
          stay_duration_avg_days: number | null
          tenant_id: string
          total_bookings: number | null
          total_spend_cents: number | null
          updated_at: string | null
        }
        Insert: {
          avg_checkin_hour?: number | null
          avg_meal_spend_cents?: number | null
          checkin_count?: number | null
          created_at?: string | null
          first_visit_date?: string | null
          last_activity_at?: string | null
          loyalty_points?: number | null
          persona_confidence?: number | null
          persona_id?: string | null
          preferred_categories?: string[] | null
          profile_embedding?: string | null
          pseudo_id: string
          stay_duration_avg_days?: number | null
          tenant_id: string
          total_bookings?: number | null
          total_spend_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_checkin_hour?: number | null
          avg_meal_spend_cents?: number | null
          checkin_count?: number | null
          created_at?: string | null
          first_visit_date?: string | null
          last_activity_at?: string | null
          loyalty_points?: number | null
          persona_confidence?: number | null
          persona_id?: string | null
          preferred_categories?: string[] | null
          profile_embedding?: string | null
          pseudo_id?: string
          stay_duration_avg_days?: number | null
          tenant_id?: string
          total_bookings?: number | null
          total_spend_cents?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_guests_behavior_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_guests_identity: {
        Row: {
          consent_analytics: boolean | null
          consent_given_at: string | null
          consent_ip: unknown
          consent_marketing: boolean | null
          consent_necessary: boolean | null
          consent_personalization: boolean | null
          consent_third_party_share: boolean | null
          consent_user_agent: string | null
          consent_version: string | null
          created_at: string | null
          data_retention_until: string | null
          deletion_requested_at: string | null
          email: string | null
          email_hash: string | null
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          processing_restricted: boolean | null
          pseudo_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          consent_analytics?: boolean | null
          consent_given_at?: string | null
          consent_ip?: unknown
          consent_marketing?: boolean | null
          consent_necessary?: boolean | null
          consent_personalization?: boolean | null
          consent_third_party_share?: boolean | null
          consent_user_agent?: string | null
          consent_version?: string | null
          created_at?: string | null
          data_retention_until?: string | null
          deletion_requested_at?: string | null
          email?: string | null
          email_hash?: string | null
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          processing_restricted?: boolean | null
          pseudo_id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          consent_analytics?: boolean | null
          consent_given_at?: string | null
          consent_ip?: unknown
          consent_marketing?: boolean | null
          consent_necessary?: boolean | null
          consent_personalization?: boolean | null
          consent_third_party_share?: boolean | null
          consent_user_agent?: string | null
          consent_version?: string | null
          created_at?: string | null
          data_retention_until?: string | null
          deletion_requested_at?: string | null
          email?: string | null
          email_hash?: string | null
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          processing_restricted?: boolean | null
          pseudo_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_guests_identity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_personas: {
        Row: {
          active: boolean | null
          centroid_embedding: string | null
          characteristics: Json | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          recommended_offers: string[] | null
          slug: string
          tenant_id: string | null
        }
        Insert: {
          active?: boolean | null
          centroid_embedding?: string | null
          characteristics?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          recommended_offers?: string[] | null
          slug: string
          tenant_id?: string | null
        }
        Update: {
          active?: boolean | null
          centroid_embedding?: string | null
          characteristics?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          recommended_offers?: string[] | null
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_personas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_tenants: {
        Row: {
          active: boolean | null
          avv_document_url: string | null
          avv_signed_at: string | null
          created_at: string | null
          data_retention_days: number | null
          domain: string | null
          dpo_contact_email: string | null
          id: string
          name: string
          pricing_tier: string | null
          privacy_policy_updated_at: string | null
          privacy_policy_version: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avv_document_url?: string | null
          avv_signed_at?: string | null
          created_at?: string | null
          data_retention_days?: number | null
          domain?: string | null
          dpo_contact_email?: string | null
          id?: string
          name: string
          pricing_tier?: string | null
          privacy_policy_updated_at?: string | null
          privacy_policy_version?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avv_document_url?: string | null
          avv_signed_at?: string | null
          created_at?: string | null
          data_retention_days?: number | null
          domain?: string | null
          dpo_contact_email?: string | null
          id?: string
          name?: string
          pricing_tier?: string | null
          privacy_policy_updated_at?: string | null
          privacy_policy_version?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_super_admin: boolean | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
        }
        Relationships: []
      }
      project_resources: {
        Row: {
          created_at: string
          display_name: string
          file_name: string | null
          file_path: string | null
          id: string
          project_id: string
          resource_type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          project_id: string
          resource_type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          project_id?: string
          resource_type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          main_project_id: string | null
          originating_deal_id: string | null
          owner_user_id: string | null
          primary_contact_id: string | null
          priority: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          main_project_id?: string | null
          originating_deal_id?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          main_project_id?: string | null
          originating_deal_id?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_main_project_id_fkey"
            columns: ["main_project_id"]
            isOneToOne: false
            referencedRelation: "main_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_originating_deal_id_fkey"
            columns: ["originating_deal_id"]
            isOneToOne: true
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_originating_deal_id_fkey"
            columns: ["originating_deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          source: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          source?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          source?: string | null
          table_name?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          task_id: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type: string
          id?: string
          task_id: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          task_id?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          label: string
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label: string
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          position: number
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          position?: number
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: string | null
          project_id: string
          reminder_sent: boolean
          sort_order: number | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id: string
          reminder_sent?: boolean
          sort_order?: number | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string
          reminder_sent?: boolean
          sort_order?: number | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_signatures: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          linkedin_url: string | null
          phone: string | null
          profile_image_path: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          phone?: string | null
          profile_image_path?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          phone?: string | null
          profile_image_path?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          invited_at: string | null
          is_active: boolean | null
          job_title: string | null
          last_name: string
          last_sign_in_at: string | null
          linkedin_url: string | null
          onboarding_completed_at: string | null
          password_set_at: string | null
          phone: string | null
          role: string
          signature_active: boolean
          signature_full_name: string | null
          signature_image_url: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
          whatsapp_url: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_name: string
          last_sign_in_at?: string | null
          linkedin_url?: string | null
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          phone?: string | null
          role?: string
          signature_active?: boolean
          signature_full_name?: string | null
          signature_image_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string
          last_sign_in_at?: string | null
          linkedin_url?: string | null
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          phone?: string | null
          role?: string
          signature_active?: boolean
          signature_full_name?: string | null
          signature_image_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      video_curricula: {
        Row: {
          created_at: string | null
          duration_weeks: number | null
          id: string
          idea_id: string | null
          status: string | null
          target_persona: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          duration_weeks?: number | null
          id?: string
          idea_id?: string | null
          status?: string | null
          target_persona?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          duration_weeks?: number | null
          id?: string
          idea_id?: string | null
          status?: string | null
          target_persona?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_curricula_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_curricula_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      video_eval_scores: {
        Row: {
          dimension: string
          feedback: string | null
          id: string
          lesson_id: string | null
          score: number | null
        }
        Insert: {
          dimension: string
          feedback?: string | null
          id?: string
          lesson_id?: string | null
          score?: number | null
        }
        Update: {
          dimension?: string
          feedback?: string | null
          id?: string
          lesson_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_eval_scores_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_lessons: {
        Row: {
          duration_seconds: number | null
          embedding: string | null
          id: string
          module_id: string | null
          position: number
          script_md: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
          voiceover_url: string | null
        }
        Insert: {
          duration_seconds?: number | null
          embedding?: string | null
          id?: string
          module_id?: string | null
          position: number
          script_md?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
          voiceover_url?: string | null
        }
        Update: {
          duration_seconds?: number | null
          embedding?: string | null
          id?: string
          module_id?: string | null
          position?: number
          script_md?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
          voiceover_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "video_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      video_modules: {
        Row: {
          curriculum_id: string | null
          duration_minutes: number | null
          id: string
          learning_objectives: string[] | null
          position: number
          title: string
        }
        Insert: {
          curriculum_id?: string | null
          duration_minutes?: number | null
          id?: string
          learning_objectives?: string[] | null
          position: number
          title: string
        }
        Update: {
          curriculum_id?: string | null
          duration_minutes?: number | null
          id?: string
          learning_objectives?: string[] | null
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_modules_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "v_combo_pta_manager"
            referencedColumns: ["curriculum_id"]
          },
          {
            foreignKeyName: "video_modules_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "video_curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      video_subscriptions: {
        Row: {
          created_at: string | null
          customer_email: string
          customer_org: string | null
          id: string
          idea_id: string | null
          plan: string
          status: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          customer_org?: string | null
          id?: string
          idea_id?: string | null
          plan: string
          status?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          customer_org?: string | null
          id?: string
          idea_id?: string | null
          plan?: string
          status?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_subscriptions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_subscriptions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "v_idea_status"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_log: {
        Row: {
          event_type: string | null
          id: string
          payload: Json
          received_at: string | null
          source: string
        }
        Insert: {
          event_type?: string | null
          id?: string
          payload: Json
          received_at?: string | null
          source: string
        }
        Update: {
          event_type?: string | null
          id?: string
          payload?: Json
          received_at?: string | null
          source?: string
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by_user_id: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by_user_id?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by_user_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          created_by_user_id: string | null
          deleted_at: string | null
          id: string | null
          industry: string | null
          name: string | null
          notes: string | null
          owner_user_id: string | null
          postal_code: string | null
          source: string | null
          status: string | null
          street: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          notes?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          notes?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      active_contacts: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      active_deals: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string | null
          lost_at: string | null
          lost_reason: string | null
          owner_user_id: string | null
          pipeline_id: string | null
          pipeline_stage_id: string | null
          primary_contact_id: string | null
          priority: string | null
          probability_percent: number | null
          source: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          value_amount: number | null
          won_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          pipeline_id?: string | null
          pipeline_stage_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          probability_percent?: number | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          value_amount?: number | null
          won_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          pipeline_id?: string | null
          pipeline_stage_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          probability_percent?: number | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          value_amount?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_projects: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string | null
          originating_deal_id: string | null
          owner_user_id: string | null
          primary_contact_id: string | null
          priority: string | null
          start_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string | null
          originating_deal_id?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string | null
          originating_deal_id?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_originating_deal_id_fkey"
            columns: ["originating_deal_id"]
            isOneToOne: true
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_originating_deal_id_fkey"
            columns: ["originating_deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_consent_overview: {
        Row: {
          consent_type: string | null
          last_updated: string | null
          opt_in_rate_pct: number | null
          opted_in: number | null
          opted_out: number | null
        }
        Relationships: []
      }
      dashboard_daily_activity: {
        Row: {
          active_guests: number | null
          checkins: number | null
          day: string | null
          total_events: number | null
        }
        Relationships: []
      }
      dashboard_guest_intelligence: {
        Row: {
          aktiv_count: number | null
          avg_checkins: number | null
          avg_persona_confidence: number | null
          avg_points: number | null
          familien_count: number | null
          total_pseudonymized_guests: number | null
          wellness_count: number | null
        }
        Relationships: []
      }
      dashboard_knowledge_stats: {
        Row: {
          active_entries: number | null
          category: string | null
          entries_with_embedding: number | null
          last_updated: string | null
          total_entries: number | null
        }
        Relationships: []
      }
      dashboard_loyalty_stats: {
        Row: {
          avg_points_per_guest: number | null
          guests_level2_plus: number | null
          guests_with_points: number | null
          max_points_single_guest: number | null
          total_checkins_all_time: number | null
          total_points_outstanding: number | null
        }
        Relationships: []
      }
      dashboard_mission_stats: {
        Row: {
          completion_rate_pct: number | null
          icon: string | null
          mission_name: string | null
          total_completed: number | null
          total_started: number | null
        }
        Relationships: []
      }
      dashboard_poi_checkins: {
        Row: {
          avg_checkin_hour: number | null
          category: string | null
          checkins_this_week: number | null
          poi_name: string | null
          total_checkins: number | null
        }
        Relationships: []
      }
      dashboard_user_kpis: {
        Row: {
          dau: number | null
          mau: number | null
          new_this_week: number | null
          new_today: number | null
          total_guests: number | null
        }
        Relationships: []
      }
      v_combo_pta_manager: {
        Row: {
          curriculum: string | null
          curriculum_id: string | null
          idea_slug: string | null
        }
        Relationships: []
      }
      v_idea_status: {
        Row: {
          avg_score: number | null
          created_at: string | null
          deployments_count: number | null
          id: string | null
          slug: string | null
          status: string | null
          title: string | null
          total_cost_usd: number | null
          tracks: string[] | null
          validations_done: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_loyalty_points: {
        Args: { p_guest_id: string; p_points: number }
        Returns: number
      }
      create_project_from_deal: { Args: { p_deal_id: string }; Returns: string }
      dsar_delete: { Args: { p_guest_id: string }; Returns: Json }
      dsar_export: { Args: { p_guest_id: string }; Returns: Json }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_digest_data: { Args: never; Returns: Json }
      get_due_followups: {
        Args: never
        Returns: {
          activity_id: string
          deal_title: string
          due_date: string
          email: string
          first_name: string
          last_name: string
          pain_points: string
          personal_insights: string
          sequence_type: string
        }[]
      }
      get_guest_id_for_auth_user: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      get_public_user_id: { Args: { _auth_user_id: string }; Returns: string }
      get_reembedding_candidates: {
        Args: {
          batch_size?: number
          target_model?: string
          target_version?: number
        }
        Returns: {
          content: string
          current_model: string
          current_version: number
          embedded_at: string
          id: string
          title: string
        }[]
      }
      get_upcoming_birthdays: {
        Args: { days_ahead?: number }
        Returns: {
          birthday: string
          days_until: number
          email: string
          first_name: string
          id: string
          last_name: string
          mobile: string
          pain_points: string
          personal_insights: string
          phone: string
        }[]
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      increment_guest_points: {
        Args: { p_guest_id: string; p_points: number }
        Returns: undefined
      }
      list_team_members: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          role: string
        }[]
      }
      match_all: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          result_id: string
          result_type: string
          similarity: number
          summary: string
          title: string
        }[]
      }
      match_contacts: {
        Args: { match_count: number; query_embedding: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
          pain_points: string
          personal_insights: string
          similarity: number
        }[]
      }
      match_knowledge: {
        Args: {
          filter_concept_id?: string
          filter_tags?: string[]
          filter_type?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          concept_id: string
          id: string
          project_refs: string[]
          similarity: number
          summary: string
          tags: string[]
          title: string
          type: string
        }[]
      }
      match_lfr_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_idea_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          doc_type: string
          id: string
          similarity: number
          title: string
        }[]
      }
      search_knowledge_base: {
        Args: {
          match_count?: number
          p_tenant_id?: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      set_deal_lost: {
        Args: { p_deal_id: string; p_lost_stage_id: string; p_reason?: string }
        Returns: undefined
      }
      set_deal_reopen: {
        Args: { p_deal_id: string; p_target_stage_id?: string }
        Returns: Json
      }
      set_deal_won_and_create_project: {
        Args: { p_deal_id: string; p_winning_user_id: string }
        Returns: undefined
      }
      vault_secret_names: {
        Args: never
        Returns: {
          name: string
        }[]
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
  public: {
    Enums: {},
  },
} as const
