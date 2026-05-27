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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "companies_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          owner_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "deal_activities_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "deals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "deals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "email_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "import_jobs_started_by_user_id_fkey"
            columns: ["started_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "intake_messages_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      main_project_resources: {
        Row: {
          created_at: string
          display_name: string
          file_name: string | null
          file_path: string | null
          id: string
          main_project_id: string
          resource_type: string
          sort_order: number
          url: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          main_project_id: string
          resource_type: string
          sort_order?: number
          url?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          main_project_id?: string
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
            foreignKeyName: "projects_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "task_attachments_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "task_links_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          created_at: string
          email: string
          first_name: string
          id: string
          invited_at: string | null
          is_active: boolean | null
          last_name: string
          last_sign_in_at: string | null
          onboarding_completed_at: string | null
          password_set_at: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          last_name: string
          last_sign_in_at?: string | null
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          last_name?: string
          last_sign_in_at?: string | null
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          role?: string
          updated_at?: string
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
          {
            foreignKeyName: "workspace_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "companies_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "deals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "deals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "projects_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
      users_public: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_project_from_deal: { Args: { p_deal_id: string }; Returns: string }
      get_activity_stats: { Args: never; Returns: Json }
      get_public_user_id: { Args: { _auth_user_id: string }; Returns: string }
      get_user_profile_image: { Args: { p_user_id: string }; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      list_team_members: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          role: string
        }[]
      }
      set_deal_lost: {
        Args: { p_deal_id: string; p_lost_stage_id?: string; p_reason: string }
        Returns: undefined
      }
      set_deal_won_and_create_project: {
        Args: { p_deal_id: string; p_winning_user_id: string }
        Returns: string
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
