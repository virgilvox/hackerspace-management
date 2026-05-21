export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      space_role_permissions: {
        Row: { id: string; space_id: string; subject: string; permission: string; created_at: string }
        Insert: { id?: string; space_id: string; subject: string; permission: string; created_at?: string }
        Update: { id?: string; space_id?: string; subject?: string; permission?: string; created_at?: string }
        Relationships: []
      }
      ops_acl: {
        Row: { id: string; space_id: string; entity_type: string; entity_id: string; role: string; created_at: string }
        Insert: { id?: string; space_id: string; entity_type: string; entity_id: string; role: string; created_at?: string }
        Update: { id?: string; space_id?: string; entity_type?: string; entity_id?: string; role?: string; created_at?: string }
        Relationships: []
      }
      forum_threads: {
        Row: { id: string; space_id: string; author_id: string | null; title: string; body: string | null; category: string; pinned: boolean; locked: boolean; comment_count: number; last_comment_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; author_id?: string | null; title: string; body?: string | null; category?: string; pinned?: boolean; locked?: boolean; comment_count?: number; last_comment_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; author_id?: string | null; title?: string; body?: string | null; category?: string; pinned?: boolean; locked?: boolean; comment_count?: number; last_comment_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      comments: {
        Row: { id: string; space_id: string; entity_type: Database['public']['Enums']['comment_entity_type']; entity_id: string; author_id: string | null; parent_id: string | null; body: string; edited_at: string | null; created_at: string }
        Insert: { id?: string; space_id: string; entity_type: Database['public']['Enums']['comment_entity_type']; entity_id: string; author_id?: string | null; parent_id?: string | null; body: string; edited_at?: string | null; created_at?: string }
        Update: { id?: string; space_id?: string; entity_type?: Database['public']['Enums']['comment_entity_type']; entity_id?: string; author_id?: string | null; parent_id?: string | null; body?: string; edited_at?: string | null; created_at?: string }
        Relationships: []
      }
      space_tiers: {
        Row: { id: string; space_id: string; slug: string; name: string; description: string | null; monthly_price_cents: number; billing_cadence: string; is_system: boolean; is_archived: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; slug: string; name: string; description?: string | null; monthly_price_cents?: number; billing_cadence?: string; is_system?: boolean; is_archived?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; slug?: string; name?: string; description?: string | null; monthly_price_cents?: number; billing_cadence?: string; is_system?: boolean; is_archived?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      space_invites: {
        Row: { id: string; space_id: string; code: string; label: string | null; expires_at: string | null; max_uses: number | null; uses_count: number; is_enabled: boolean; role: Database["public"]["Enums"]["member_role"]; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; code: string; label?: string | null; expires_at?: string | null; max_uses?: number | null; uses_count?: number; is_enabled?: boolean; role?: Database["public"]["Enums"]["member_role"]; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; code?: string; label?: string | null; expires_at?: string | null; max_uses?: number | null; uses_count?: number; is_enabled?: boolean; role?: Database["public"]["Enums"]["member_role"]; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      space_onboarding_steps: {
        Row: { id: string; space_id: string; step_key: string; step_type: string; title: string; body: string | null; config: Json; is_enabled: boolean; is_required: boolean; is_system: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; step_key: string; step_type: string; title: string; body?: string | null; config?: Json; is_enabled?: boolean; is_required?: boolean; is_system?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; step_key?: string; step_type?: string; title?: string; body?: string | null; config?: Json; is_enabled?: boolean; is_required?: boolean; is_system?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      space_role_labels: {
        Row: { id: string; space_id: string; role: string; display_name: string | null; description: string | null; color: string | null; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; role: string; display_name?: string | null; description?: string | null; color?: string | null; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; role?: string; display_name?: string | null; description?: string | null; color?: string | null; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      space_custom_roles: {
        Row: { id: string; space_id: string; slug: string; name: string; description: string | null; color: string | null; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; slug: string; name: string; description?: string | null; color?: string | null; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; slug?: string; name?: string; description?: string | null; color?: string | null; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      space_member_custom_roles: {
        Row: { member_id: string; custom_role_id: string; assigned_at: string }
        Insert: { member_id: string; custom_role_id: string; assigned_at?: string }
        Update: { member_id?: string; custom_role_id?: string; assigned_at?: string }
        Relationships: []
      }
      forms: {
        Row: { id: string; space_id: string; slug: string; title: string; description: string | null; kind: string; visibility: string; status: string; schema: Json; legal_text: string | null; version: number; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; slug: string; title: string; description?: string | null; kind?: string; visibility?: string; status?: string; schema?: Json; legal_text?: string | null; version?: number; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; slug?: string; title?: string; description?: string | null; kind?: string; visibility?: string; status?: string; schema?: Json; legal_text?: string | null; version?: number; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      form_submissions: {
        Row: { id: string; form_id: string; space_id: string; member_id: string | null; submitter_email: string | null; answers: Json; form_snapshot: Json; legal_text_snapshot: string | null; form_version: number; ip: string | null; user_agent: string | null; created_at: string }
        Insert: { id?: string; form_id: string; space_id: string; member_id?: string | null; submitter_email?: string | null; answers?: Json; form_snapshot: Json; legal_text_snapshot?: string | null; form_version: number; ip?: string | null; user_agent?: string | null; created_at?: string }
        Update: { id?: string; form_id?: string; space_id?: string; member_id?: string | null; submitter_email?: string | null; answers?: Json; form_snapshot?: Json; legal_text_snapshot?: string | null; form_version?: number; ip?: string | null; user_agent?: string | null; created_at?: string }
        Relationships: []
      }
      certifications: {
        Row: { id: string; space_id: string; name: string; description: string | null; validity_months: number | null; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; name: string; description?: string | null; validity_months?: number | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; name?: string; description?: string | null; validity_months?: number | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      member_certifications: {
        Row: { id: string; space_id: string; member_id: string; certification_id: string; granted_by: string | null; granted_at: string; expires_at: string | null; revoked_at: string | null; revoked_by: string | null; revoked_reason: string | null; note: string | null; created_at: string }
        Insert: { id?: string; space_id: string; member_id: string; certification_id: string; granted_by?: string | null; granted_at?: string; expires_at?: string | null; revoked_at?: string | null; revoked_by?: string | null; revoked_reason?: string | null; note?: string | null; created_at?: string }
        Update: { id?: string; space_id?: string; member_id?: string; certification_id?: string; granted_by?: string | null; granted_at?: string; expires_at?: string | null; revoked_at?: string | null; revoked_by?: string | null; revoked_reason?: string | null; note?: string | null; created_at?: string }
        Relationships: []
      }
      classes: {
        Row: { id: string; space_id: string; title: string; description: string | null; payment_link: string | null; capacity: number | null; is_active: boolean; grants_certification_id: string | null; required_form_id: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; title: string; description?: string | null; payment_link?: string | null; capacity?: number | null; is_active?: boolean; grants_certification_id?: string | null; required_form_id?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; title?: string; description?: string | null; payment_link?: string | null; capacity?: number | null; is_active?: boolean; grants_certification_id?: string | null; required_form_id?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      class_sessions: {
        Row: { id: string; class_id: string; space_id: string; starts_at: string; ends_at: string | null; location: string | null; capacity: number | null; status: string; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; class_id: string; space_id: string; starts_at: string; ends_at?: string | null; location?: string | null; capacity?: number | null; status?: string; notes?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; class_id?: string; space_id?: string; starts_at?: string; ends_at?: string | null; location?: string | null; capacity?: number | null; status?: string; notes?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      class_signups: {
        Row: { id: string; session_id: string; space_id: string; member_id: string; status: string; attended: boolean; signed_up_at: string; created_at: string }
        Insert: { id?: string; session_id: string; space_id: string; member_id: string; status?: string; attended?: boolean; signed_up_at?: string; created_at?: string }
        Update: { id?: string; session_id?: string; space_id?: string; member_id?: string; status?: string; attended?: boolean; signed_up_at?: string; created_at?: string }
        Relationships: []
      }
      equipment: {
        Row: { id: string; space_id: string; name: string; description: string | null; location: string | null; status: string; required_certification_id: string | null; asset_tag: string | null; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; name: string; description?: string | null; location?: string | null; status?: string; required_certification_id?: string | null; asset_tag?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; name?: string; description?: string | null; location?: string | null; status?: string; required_certification_id?: string | null; asset_tag?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      equipment_reservations: {
        Row: { id: string; equipment_id: string; space_id: string; member_id: string; starts_at: string; ends_at: string; status: string; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; equipment_id: string; space_id: string; member_id: string; starts_at: string; ends_at: string; status?: string; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; equipment_id?: string; space_id?: string; member_id?: string; starts_at?: string; ends_at?: string; status?: string; notes?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      member_cards: {
        Row: { id: string; space_id: string; member_id: string; card_uid: string; card_type: string; label: string | null; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; member_id: string; card_uid: string; card_type?: string; label?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; member_id?: string; card_uid?: string; card_type?: string; label?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      door_connections: {
        Row: { id: string; space_id: string; name: string; adapter: string; base_url: string; pinned_host: string; auth_mode: string; auth_param: string | null; secret_ref: string | null; verbs: Json; allow_member_self_entry: boolean; is_enabled: boolean; inbound_enabled: boolean; inbound_secret_ref: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; name: string; adapter?: string; base_url: string; pinned_host: string; auth_mode?: string; auth_param?: string | null; secret_ref?: string | null; verbs?: Json; allow_member_self_entry?: boolean; is_enabled?: boolean; inbound_enabled?: boolean; inbound_secret_ref?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; name?: string; adapter?: string; base_url?: string; pinned_host?: string; auth_mode?: string; auth_param?: string | null; secret_ref?: string | null; verbs?: Json; allow_member_self_entry?: boolean; is_enabled?: boolean; inbound_enabled?: boolean; inbound_secret_ref?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      door_access_log: {
        Row: { id: string; space_id: string; connection_id: string | null; actor_member_id: string | null; target_member_id: string | null; action: string; success: boolean; detail: string | null; dedupe_key: string | null; occurred_at: string }
        Insert: { id?: string; space_id: string; connection_id?: string | null; actor_member_id?: string | null; target_member_id?: string | null; action: string; success?: boolean; detail?: string | null; dedupe_key?: string | null; occurred_at?: string }
        Update: { id?: string; space_id?: string; connection_id?: string | null; actor_member_id?: string | null; target_member_id?: string | null; action?: string; success?: boolean; detail?: string | null; dedupe_key?: string | null; occurred_at?: string }
        Relationships: []
      }
      door_card_slots: {
        Row: { id: string; space_id: string; connection_id: string; card_id: string; slot: number; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; connection_id: string; card_id: string; slot: number; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; connection_id?: string; card_id?: string; slot?: number; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      api_buttons: {
        Row: { id: string; space_id: string; label: string; button_group: string; sort_order: number; method: string; base_url: string; pinned_host: string; url_template: string | null; headers: Json; body_template: string | null; auth_mode: string; auth_param: string | null; secret_ref: string | null; required_permission: string; confirm: boolean; is_enabled: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; label: string; button_group?: string; sort_order?: number; method?: string; base_url: string; pinned_host: string; url_template?: string | null; headers?: Json; body_template?: string | null; auth_mode?: string; auth_param?: string | null; secret_ref?: string | null; required_permission?: string; confirm?: boolean; is_enabled?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; label?: string; button_group?: string; sort_order?: number; method?: string; base_url?: string; pinned_host?: string; url_template?: string | null; headers?: Json; body_template?: string | null; auth_mode?: string; auth_param?: string | null; secret_ref?: string | null; required_permission?: string; confirm?: boolean; is_enabled?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      api_call_log: {
        Row: { id: string; space_id: string; button_id: string | null; actor_member_id: string | null; action: string; success: boolean; detail: string | null; occurred_at: string }
        Insert: { id?: string; space_id: string; button_id?: string | null; actor_member_id?: string | null; action: string; success?: boolean; detail?: string | null; occurred_at?: string }
        Update: { id?: string; space_id?: string; button_id?: string | null; actor_member_id?: string | null; action?: string; success?: boolean; detail?: string | null; occurred_at?: string }
        Relationships: []
      }
      space_visits: {
        Row: { id: string; space_id: string; member_id: string; checked_in_at: string; checked_out_at: string | null; is_host: boolean; check_in_note: string | null; check_out_note: string | null; created_at: string }
        Insert: { id?: string; space_id: string; member_id: string; checked_in_at?: string; checked_out_at?: string | null; is_host?: boolean; check_in_note?: string | null; check_out_note?: string | null; created_at?: string }
        Update: { id?: string; space_id?: string; member_id?: string; checked_in_at?: string; checked_out_at?: string | null; is_host?: boolean; check_in_note?: string | null; check_out_note?: string | null; created_at?: string }
        Relationships: []
      }
      member_billing: {
        Row: { id: string; space_id: string; member_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null; current_period_end: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; member_id: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; subscription_status?: string | null; current_period_end?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; member_id?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; subscription_status?: string | null; current_period_end?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: { event_id: string; space_id: string | null; type: string | null; received_at: string }
        Insert: { event_id: string; space_id?: string | null; type?: string | null; received_at?: string }
        Update: { event_id?: string; space_id?: string | null; type?: string | null; received_at?: string }
        Relationships: []
      }
      notifications: {
        Row: { id: string; space_id: string; member_id: string | null; type: string; channel: string; recipient: string; subject: string; body_html: string; body_text: string; status: string; attempts: number; last_error: string | null; dedupe_key: string; sent_at: string | null; read_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; member_id?: string | null; type: string; channel?: string; recipient: string; subject: string; body_html: string; body_text: string; status?: string; attempts?: number; last_error?: string | null; dedupe_key: string; sent_at?: string | null; read_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; member_id?: string | null; type?: string; channel?: string; recipient?: string; subject?: string; body_html?: string; body_text?: string; status?: string; attempts?: number; last_error?: string | null; dedupe_key?: string; sent_at?: string | null; read_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      notification_preferences: {
        Row: { space_id: string; member_id: string; category: string; enabled: boolean; created_at: string; updated_at: string }
        Insert: { space_id: string; member_id: string; category: string; enabled?: boolean; created_at?: string; updated_at?: string }
        Update: { space_id?: string; member_id?: string; category?: string; enabled?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      dues_payment_methods: {
        Row: { id: string; space_id: string; platform: string; url: string; instructions: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; space_id: string; platform: string; url: string; instructions?: string | null; is_active?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; space_id?: string; platform?: string; url?: string; instructions?: string | null; is_active?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          display_name: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          space_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          display_name?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          space_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          display_name?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          space_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      area_leads: {
        Row: {
          area_code: string | null
          area_name: string
          created_at: string
          description: string | null
          id: string
          lead_handle: string | null
          lead_id: string | null
          notes: string | null
          space_id: string
          status: Database["public"]["Enums"]["area_lead_status"]
          updated_at: string
        }
        Insert: {
          area_code?: string | null
          area_name: string
          created_at?: string
          description?: string | null
          id?: string
          lead_handle?: string | null
          lead_id?: string | null
          notes?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["area_lead_status"]
          updated_at?: string
        }
        Update: {
          area_code?: string | null
          area_name?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_handle?: string | null
          lead_id?: string | null
          notes?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["area_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_leads_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_channels: {
        Row: {
          area_reference: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          is_default: boolean
          member_count: number
          name: string
          space_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          area_reference?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          member_count?: number
          name: string
          space_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          area_reference?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          member_count?: number
          name?: string
          space_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_channels_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          deleted: boolean
          display_name: string | null
          edited: boolean
          handle: string | null
          id: string
          reply_to: string | null
          space_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          deleted?: boolean
          display_name?: string | null
          edited?: boolean
          handle?: string | null
          id?: string
          reply_to?: string | null
          space_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          deleted?: boolean
          display_name?: string | null
          edited?: boolean
          handle?: string | null
          id?: string
          reply_to?: string | null
          space_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "comms_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "comms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_messages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          code: string | null
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          created_by: string | null
          details: string | null
          email: string | null
          group_label: string | null
          id: string
          name: string
          note: string | null
          notes: string | null
          phone: string | null
          space_id: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          created_by?: string | null
          details?: string | null
          email?: string | null
          group_label?: string | null
          id?: string
          name: string
          note?: string | null
          notes?: string | null
          phone?: string | null
          space_id: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          created_by?: string | null
          details?: string | null
          email?: string | null
          group_label?: string | null
          id?: string
          name?: string
          note?: string | null
          notes?: string | null
          phone?: string | null
          space_id?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          incident_id: string
          visibility: Database["public"]["Enums"]["incident_update_visibility"]
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          incident_id: string
          visibility?: Database["public"]["Enums"]["incident_update_visibility"]
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          incident_id?: string
          visibility?: Database["public"]["Enums"]["incident_update_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          appeal_proposal_id: string | null
          body: string
          category: string
          closed_at: string | null
          created_at: string
          decided_at: string | null
          decision_maker_ids: string[]
          disposition: string | null
          id: string
          is_anonymous: boolean
          reporter_id: string | null
          reporter_token: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          sla_response_by: string | null
          space_id: string
          status: Database["public"]["Enums"]["incident_status"]
          subjects: string[]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          appeal_proposal_id?: string | null
          body: string
          category?: string
          closed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decision_maker_ids?: string[]
          disposition?: string | null
          id?: string
          is_anonymous?: boolean
          reporter_id?: string | null
          reporter_token?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          sla_response_by?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["incident_status"]
          subjects?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          appeal_proposal_id?: string | null
          body?: string
          category?: string
          closed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decision_maker_ids?: string[]
          disposition?: string | null
          id?: string
          is_anonymous?: boolean
          reporter_id?: string | null
          reporter_token?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          sla_response_by?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["incident_status"]
          subjects?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_appeal_proposal_fk"
            columns: ["appeal_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          credentials: Json | null
          description: string | null
          id: string
          is_connected: boolean
          last_sync_at: string | null
          name: string | null
          platform: string
          settings: Json | null
          space_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          credentials?: Json | null
          description?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          name?: string | null
          platform: string
          settings?: Json | null
          space_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          credentials?: Json | null
          description?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          name?: string | null
          platform?: string
          settings?: Json | null
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          access_level: string | null
          area: string | null
          category: string | null
          content: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_meeting_minutes: boolean
          is_pinned: boolean
          render_markdown: boolean
          meeting_date: string | null
          pinned: boolean
          space_id: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          visibility: Database["public"]["Enums"]["kb_visibility"]
        }
        Insert: {
          access_level?: string | null
          area?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_meeting_minutes?: boolean
          is_pinned?: boolean
          render_markdown?: boolean
          meeting_date?: string | null
          pinned?: boolean
          space_id: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          visibility?: Database["public"]["Enums"]["kb_visibility"]
        }
        Update: {
          access_level?: string | null
          area?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_meeting_minutes?: boolean
          is_pinned?: boolean
          render_markdown?: boolean
          meeting_date?: string | null
          pinned?: boolean
          space_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          visibility?: Database["public"]["Enums"]["kb_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          external_id: string | null
          from_identifier: string | null
          from_note: string | null
          id: string
          link_status: Database["public"]["Enums"]["payment_link_status"]
          member_id: string | null
          member_name: string | null
          payer_email: string | null
          payer_name: string | null
          payment_date: string | null
          platform: Database["public"]["Enums"]["payment_platform"]
          raw_data: Json | null
          space_id: string
          status: Database["public"]["Enums"]["payment_link_status"]
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          external_id?: string | null
          from_identifier?: string | null
          from_note?: string | null
          id?: string
          link_status?: Database["public"]["Enums"]["payment_link_status"]
          member_id?: string | null
          member_name?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_date?: string | null
          platform: Database["public"]["Enums"]["payment_platform"]
          raw_data?: Json | null
          space_id: string
          status?: Database["public"]["Enums"]["payment_link_status"]
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          external_id?: string | null
          from_identifier?: string | null
          from_note?: string | null
          id?: string
          link_status?: Database["public"]["Enums"]["payment_link_status"]
          member_id?: string | null
          member_name?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_date?: string | null
          platform?: Database["public"]["Enums"]["payment_platform"]
          raw_data?: Json | null
          space_id?: string
          status?: Database["public"]["Enums"]["payment_link_status"]
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          adopted_by_proposal_id: string | null
          body_formal: string
          body_plain: string | null
          created_at: string
          effective_at: string | null
          id: string
          parent_policy_id: string | null
          prior_version_id: string | null
          section_ref: string | null
          slug: string
          space_id: string
          status: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          adopted_by_proposal_id?: string | null
          body_formal?: string
          body_plain?: string | null
          created_at?: string
          effective_at?: string | null
          id?: string
          parent_policy_id?: string | null
          prior_version_id?: string | null
          section_ref?: string | null
          slug: string
          space_id: string
          status?: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          adopted_by_proposal_id?: string | null
          body_formal?: string
          body_plain?: string | null
          created_at?: string
          effective_at?: string | null
          id?: string
          parent_policy_id?: string | null
          prior_version_id?: string | null
          section_ref?: string | null
          slug?: string
          space_id?: string
          status?: Database["public"]["Enums"]["policy_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policies_adopted_by_proposal_fk"
            columns: ["adopted_by_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_prior_version_id_fkey"
            columns: ["prior_version_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area: string | null
          assignee_names: string[] | null
          assignees: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          name: string | null
          progress: number
          space_id: string
          status: Database["public"]["Enums"]["project_status"]
          tags: string[] | null
          task_count: number
          tasks_completed: number
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assignee_names?: string[] | null
          assignees?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          progress?: number
          space_id: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[] | null
          task_count?: number
          tasks_completed?: number
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assignee_names?: string[] | null
          assignees?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          progress?: number
          space_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[] | null
          task_count?: number
          tasks_completed?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_votes: {
        Row: {
          comment: string | null
          id: string
          member_id: string
          position: Database["public"]["Enums"]["vote_position"]
          proposal_id: string
          recusal_reason: string | null
          voted_at: string
        }
        Insert: {
          comment?: string | null
          id?: string
          member_id: string
          position: Database["public"]["Enums"]["vote_position"]
          proposal_id: string
          recusal_reason?: string | null
          voted_at?: string
        }
        Update: {
          comment?: string | null
          id?: string
          member_id?: string
          position?: Database["public"]["Enums"]["vote_position"]
          proposal_id?: string
          recusal_reason?: string | null
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          id: string
          outcome_abstain: number
          outcome_no: number
          outcome_recused: number
          outcome_yes: number
          parent_incident_id: string | null
          passed: boolean | null
          policy_ref_id: string | null
          proposal_type: Database["public"]["Enums"]["proposal_type"]
          proposer_id: string | null
          proposer_name: string | null
          quorum_floor: number
          quorum_met: boolean | null
          quorum_percent: number
          quorum_required: number
          space_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          threshold: Database["public"]["Enums"]["threshold_rule"]
          title: string
          total_voters: number
          updated_at: string
          voting_closes_at: string | null
          voting_opens_at: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          outcome_abstain?: number
          outcome_no?: number
          outcome_recused?: number
          outcome_yes?: number
          parent_incident_id?: string | null
          passed?: boolean | null
          policy_ref_id?: string | null
          proposal_type?: Database["public"]["Enums"]["proposal_type"]
          proposer_id?: string | null
          proposer_name?: string | null
          quorum_floor?: number
          quorum_met?: boolean | null
          quorum_percent?: number
          quorum_required?: number
          space_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          threshold?: Database["public"]["Enums"]["threshold_rule"]
          title: string
          total_voters?: number
          updated_at?: string
          voting_closes_at?: string | null
          voting_opens_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          outcome_abstain?: number
          outcome_no?: number
          outcome_recused?: number
          outcome_yes?: number
          parent_incident_id?: string | null
          passed?: boolean | null
          policy_ref_id?: string | null
          proposal_type?: Database["public"]["Enums"]["proposal_type"]
          proposer_id?: string | null
          proposer_name?: string | null
          quorum_floor?: number
          quorum_met?: boolean | null
          quorum_percent?: number
          quorum_required?: number
          space_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          threshold?: Database["public"]["Enums"]["threshold_rule"]
          title?: string
          total_voters?: number
          updated_at?: string
          voting_closes_at?: string | null
          voting_opens_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_parent_incident_fk"
            columns: ["parent_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_policy_ref_fk"
            columns: ["policy_ref_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      secrets: {
        Row: {
          area: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          label: string
          notes: string | null
          space_id: string
          title: string | null
          encrypted_value: string | null
          encryption_version: number
          updated_at: string
          value: string
        }
        Insert: {
          area?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          label: string
          notes?: string | null
          space_id: string
          title?: string | null
          encrypted_value?: string | null
          encryption_version?: number
          updated_at?: string
          value: string
        }
        Update: {
          area?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          label?: string
          notes?: string | null
          space_id?: string
          title?: string | null
          encrypted_value?: string | null
          encryption_version?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "secrets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_areas: {
        Row: {
          code: string
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          space_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          space_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_areas_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          affiliations: string[]
          approved: boolean
          avatar_url: string | null
          bio: string | null
          coi_last_disclosed_at: string | null
          created_at: string
          display_name: string | null
          dues_paid_until: string | null
          email: string | null
          handle: string | null
          has_card_access: boolean
          id: string
          interests: string[]
          joined_at: string | null
          last_paid_at: string | null
          last_payment_at: string | null
          payment_note: string | null
          payment_status: string | null
          phone: string | null
          role: Database["public"]["Enums"]["member_role"]
          skills: string[]
          space_id: string
          status: Database["public"]["Enums"]["member_status"]
          stripe_customer_id: string | null
          tier: Database["public"]["Enums"]["member_tier"]
          tier_id: string | null
          onboarding_completed_at: string | null
          onboarding_progress: Json
          updated_at: string
          user_id: string | null
          willing_to: string[]
        }
        Insert: {
          affiliations?: string[]
          approved?: boolean
          avatar_url?: string | null
          bio?: string | null
          coi_last_disclosed_at?: string | null
          created_at?: string
          display_name?: string | null
          dues_paid_until?: string | null
          email?: string | null
          handle?: string | null
          has_card_access?: boolean
          id?: string
          interests?: string[]
          joined_at?: string | null
          last_paid_at?: string | null
          last_payment_at?: string | null
          payment_note?: string | null
          payment_status?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          skills?: string[]
          space_id: string
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          tier?: Database["public"]["Enums"]["member_tier"]
          tier_id?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          updated_at?: string
          user_id?: string | null
          willing_to?: string[]
        }
        Update: {
          affiliations?: string[]
          approved?: boolean
          avatar_url?: string | null
          bio?: string | null
          coi_last_disclosed_at?: string | null
          created_at?: string
          display_name?: string | null
          dues_paid_until?: string | null
          email?: string | null
          handle?: string | null
          has_card_access?: boolean
          id?: string
          interests?: string[]
          joined_at?: string | null
          last_paid_at?: string | null
          last_payment_at?: string | null
          payment_note?: string | null
          payment_status?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          skills?: string[]
          space_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          tier?: Database["public"]["Enums"]["member_tier"]
          tier_id?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          updated_at?: string
          user_id?: string | null
          willing_to?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          default_quorum_floor: number
          default_quorum_percent: number
          default_threshold: Database["public"]["Enums"]["threshold_rule"]
          default_voting_window_hours: number
          description: string | null
          financial_visibility: Database["public"]["Enums"]["financial_visibility"]
          host_requires_card: boolean
          id: string
          incident_sla_hours: number
          invite_code: string | null
          logo_url: string | null
          member_directory_visibility: Database["public"]["Enums"]["directory_visibility"]
          mission_statement: string | null
          name: string
          public_member_directory: boolean | null
          require_approval: boolean | null
          settings: Json | null
          slug: string
          timezone: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          default_quorum_floor?: number
          default_quorum_percent?: number
          default_threshold?: Database["public"]["Enums"]["threshold_rule"]
          default_voting_window_hours?: number
          description?: string | null
          financial_visibility?: Database["public"]["Enums"]["financial_visibility"]
          host_requires_card?: boolean
          id?: string
          incident_sla_hours?: number
          invite_code?: string | null
          logo_url?: string | null
          member_directory_visibility?: Database["public"]["Enums"]["directory_visibility"]
          mission_statement?: string | null
          name: string
          public_member_directory?: boolean | null
          require_approval?: boolean | null
          settings?: Json | null
          slug: string
          timezone?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          default_quorum_floor?: number
          default_quorum_percent?: number
          default_threshold?: Database["public"]["Enums"]["threshold_rule"]
          default_voting_window_hours?: number
          description?: string | null
          financial_visibility?: Database["public"]["Enums"]["financial_visibility"]
          host_requires_card?: boolean
          id?: string
          incident_sla_hours?: number
          invite_code?: string | null
          logo_url?: string | null
          member_directory_visibility?: Database["public"]["Enums"]["directory_visibility"]
          mission_statement?: string | null
          name?: string
          public_member_directory?: boolean | null
          require_approval?: boolean | null
          settings?: Json | null
          slug?: string
          timezone?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          area: string | null
          assigned_to: string | null
          assigned_to_name: string | null
          claimed_by: string | null
          claimed_by_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          last_done_at: string | null
          priority: string | null
          progress: number
          project_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"] | null
          requested_by: string | null
          requested_by_name: string | null
          space_id: string
          status: Database["public"]["Enums"]["task_status"]
          subtask_completed: number
          subtask_total: number
          tags: string[] | null
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          claimed_by?: string | null
          claimed_by_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_done_at?: string | null
          priority?: string | null
          progress?: number
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          requested_by?: string | null
          requested_by_name?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["task_status"]
          subtask_completed?: number
          subtask_total?: number
          tags?: string[] | null
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          claimed_by?: string | null
          claimed_by_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_done_at?: string | null
          priority?: string | null
          progress?: number
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          requested_by?: string | null
          requested_by_name?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          subtask_completed?: number
          subtask_total?: number
          tags?: string[] | null
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inactive_members: {
        Row: {
          affiliations: string[] | null
          approved: boolean | null
          avatar_url: string | null
          bio: string | null
          coi_last_disclosed_at: string | null
          created_at: string | null
          display_name: string | null
          dues_paid_until: string | null
          email: string | null
          handle: string | null
          has_card_access: boolean | null
          id: string | null
          interests: string[] | null
          joined_at: string | null
          last_activity_at: string | null
          last_paid_at: string | null
          last_payment_at: string | null
          payment_note: string | null
          payment_status: string | null
          phone: string | null
          role: Database["public"]["Enums"]["member_role"] | null
          skills: string[] | null
          space_id: string | null
          status: Database["public"]["Enums"]["member_status"] | null
          stripe_customer_id: string | null
          tier: Database["public"]["Enums"]["member_tier"] | null
          updated_at: string | null
          user_id: string | null
          willing_to: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      expire_proposals: { Args: never; Returns: number }
      get_user_space_ids: { Args: { uid: string }; Returns: string[] }
      user_has_role_in_space: {
        Args: { allowed_roles: string[]; sid: string; uid: string }
        Returns: boolean
      }
      user_effective_roles: { Args: { uid: string; sid: string }; Returns: string[] }
      user_has_permission: {
        Args: { uid: string; sid: string; perm: string }
        Returns: boolean
      }
      members_with_permission: {
        Args: { sid: string; perm: string }
        Returns: { member_id: string }[]
      }
    }
    Enums: {
      area_lead_status: "active" | "vacant" | "handoff"
      channel_type: "general" | "area" | "ops" | "project"
      comment_entity_type: "forum_thread" | "proposal" | "incident" | "policy"
      contact_type: "vendor" | "supplier" | "partner" | "landlord" | "city"
      directory_visibility:
        | "board_only"
        | "member_count_visible"
        | "members_visible"
        | "public_members_visible"
      financial_visibility:
        | "treasurer_only"
        | "board_visible"
        | "all_members_visible"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "received"
        | "under_review"
        | "decided"
        | "appealed"
        | "closed"
      incident_update_visibility: "reporter_only" | "all_parties" | "board_only"
      kb_visibility: "all_members" | "board" | "admin_only"
      member_role: "admin" | "board" | "treasurer" | "member" | "associate"
      member_status: "current" | "late" | "inactive" | "unverified"
      member_tier: "plus" | "basic" | "associate"
      payment_link_status: "linked" | "unlinked"
      payment_platform: "paypal" | "zeffy" | "venmo" | "cash" | "stripe"
      policy_status: "draft" | "active" | "deprecated" | "superseded"
      project_status: "backlog" | "in_progress" | "review" | "done" | "blocked"
      proposal_status: "draft" | "open" | "decided" | "withdrawn" | "expired"
      proposal_type:
        | "bylaw_change"
        | "board_action"
        | "membership_vote"
        | "advisory_poll"
        | "recall"
        | "budget"
      recurrence_type: "daily" | "weekly" | "biweekly" | "monthly" | "none"
      task_status:
        | "open"
        | "claimed"
        | "in_progress"
        | "overdue"
        | "due_today"
        | "completed"
        | "done"
        | "blocked"
      task_type: "chore" | "task"
      threshold_rule:
        | "simple_majority"
        | "two_thirds"
        | "three_fourths"
        | "unanimous"
      vote_position: "yes" | "no" | "abstain" | "recused"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      area_lead_status: ["active", "vacant", "handoff"],
      channel_type: ["general", "area", "ops", "project"],
      comment_entity_type: ["forum_thread", "proposal", "incident", "policy"],
      contact_type: ["vendor", "supplier", "partner", "landlord", "city"],
      directory_visibility: [
        "board_only",
        "member_count_visible",
        "members_visible",
        "public_members_visible",
      ],
      financial_visibility: [
        "treasurer_only",
        "board_visible",
        "all_members_visible",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "received",
        "under_review",
        "decided",
        "appealed",
        "closed",
      ],
      incident_update_visibility: [
        "reporter_only",
        "all_parties",
        "board_only",
      ],
      kb_visibility: ["all_members", "board", "admin_only"],
      member_role: ["admin", "board", "treasurer", "member", "associate"],
      member_status: ["current", "late", "inactive", "unverified"],
      member_tier: ["plus", "basic", "associate"],
      payment_link_status: ["linked", "unlinked"],
      payment_platform: ["paypal", "zeffy", "venmo", "cash", "stripe"],
      policy_status: ["draft", "active", "deprecated", "superseded"],
      project_status: ["backlog", "in_progress", "review", "done", "blocked"],
      proposal_status: ["draft", "open", "decided", "withdrawn", "expired"],
      proposal_type: [
        "bylaw_change",
        "board_action",
        "membership_vote",
        "advisory_poll",
        "recall",
        "budget",
      ],
      recurrence_type: ["daily", "weekly", "biweekly", "monthly", "none"],
      task_status: [
        "open",
        "claimed",
        "in_progress",
        "overdue",
        "due_today",
        "completed",
        "done",
        "blocked",
      ],
      task_type: ["chore", "task"],
      threshold_rule: [
        "simple_majority",
        "two_thirds",
        "three_fourths",
        "unanimous",
      ],
      vote_position: ["yes", "no", "abstain", "recused"],
    },
  },
} as const

