export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      api_buttons: {
        Row: {
          auth_mode: string
          auth_param: string | null
          base_url: string
          body_template: string | null
          button_group: string
          confirm: boolean
          created_at: string
          created_by: string | null
          headers: Json
          id: string
          is_enabled: boolean
          label: string
          method: string
          pinned_host: string
          required_permission: string
          secret_ref: string | null
          sort_order: number
          space_id: string
          updated_at: string
          url_template: string | null
        }
        Insert: {
          auth_mode?: string
          auth_param?: string | null
          base_url: string
          body_template?: string | null
          button_group?: string
          confirm?: boolean
          created_at?: string
          created_by?: string | null
          headers?: Json
          id?: string
          is_enabled?: boolean
          label: string
          method?: string
          pinned_host: string
          required_permission?: string
          secret_ref?: string | null
          sort_order?: number
          space_id: string
          updated_at?: string
          url_template?: string | null
        }
        Update: {
          auth_mode?: string
          auth_param?: string | null
          base_url?: string
          body_template?: string | null
          button_group?: string
          confirm?: boolean
          created_at?: string
          created_by?: string | null
          headers?: Json
          id?: string
          is_enabled?: boolean
          label?: string
          method?: string
          pinned_host?: string
          required_permission?: string
          secret_ref?: string | null
          sort_order?: number
          space_id?: string
          updated_at?: string
          url_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_buttons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_buttons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_buttons_secret_ref_fkey"
            columns: ["secret_ref"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_buttons_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_call_log: {
        Row: {
          action: string
          actor_member_id: string | null
          button_id: string | null
          detail: string | null
          id: string
          occurred_at: string
          space_id: string
          success: boolean
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          button_id?: string | null
          detail?: string | null
          id?: string
          occurred_at?: string
          space_id: string
          success?: boolean
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          button_id?: string | null
          detail?: string | null
          id?: string
          occurred_at?: string
          space_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "api_call_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_call_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_call_log_button_id_fkey"
            columns: ["button_id"]
            isOneToOne: false
            referencedRelation: "api_buttons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_call_log_space_id_fkey"
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
      certifications: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          space_id: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          space_id: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          space_id?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          capacity: number | null
          class_id: string
          created_at: string
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          space_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          class_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          space_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          class_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          space_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      class_signups: {
        Row: {
          attended: boolean
          created_at: string
          id: string
          member_id: string
          session_id: string
          signed_up_at: string
          space_id: string
          status: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          id?: string
          member_id: string
          session_id: string
          signed_up_at?: string
          space_id: string
          status?: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
          signed_up_at?: string
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_signups_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_signups_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_signups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_signups_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          grants_certification_id: string | null
          id: string
          is_active: boolean
          payment_link: string | null
          required_form_id: string | null
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grants_certification_id?: string | null
          id?: string
          is_active?: boolean
          payment_link?: string | null
          required_form_id?: string | null
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grants_certification_id?: string | null
          id?: string
          is_active?: boolean
          payment_link?: string | null
          required_form_id?: string | null
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_grants_certification_id_fkey"
            columns: ["grants_certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_required_form_id_fkey"
            columns: ["required_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          edited_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["comment_entity_type"]
          id: string
          parent_id: string | null
          space_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["comment_entity_type"]
          id?: string
          parent_id?: string | null
          space_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["comment_entity_type"]
          id?: string
          parent_id?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_space_id_fkey"
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
      door_access_log: {
        Row: {
          action: string
          actor_member_id: string | null
          connection_id: string | null
          dedupe_key: string | null
          detail: string | null
          id: string
          occurred_at: string
          space_id: string
          success: boolean
          target_member_id: string | null
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          connection_id?: string | null
          dedupe_key?: string | null
          detail?: string | null
          id?: string
          occurred_at?: string
          space_id: string
          success?: boolean
          target_member_id?: string | null
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          connection_id?: string | null
          dedupe_key?: string | null
          detail?: string | null
          id?: string
          occurred_at?: string
          space_id?: string
          success?: boolean
          target_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "door_access_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "door_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_log_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_log_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_log_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
        ]
      }
      door_card_slots: {
        Row: {
          card_id: string
          connection_id: string
          created_at: string
          created_by: string | null
          id: string
          slot: number
          space_id: string
          updated_at: string
        }
        Insert: {
          card_id: string
          connection_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          slot: number
          space_id: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          connection_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slot?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_card_slots_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "member_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_card_slots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "door_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_card_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_card_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_card_slots_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      door_connections: {
        Row: {
          adapter: string
          allow_member_self_entry: boolean
          auth_mode: string
          auth_param: string | null
          base_url: string
          created_at: string
          created_by: string | null
          id: string
          inbound_enabled: boolean
          inbound_secret_ref: string | null
          is_enabled: boolean
          name: string
          pinned_host: string
          secret_ref: string | null
          space_id: string
          updated_at: string
          verbs: Json
        }
        Insert: {
          adapter?: string
          allow_member_self_entry?: boolean
          auth_mode?: string
          auth_param?: string | null
          base_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_enabled?: boolean
          inbound_secret_ref?: string | null
          is_enabled?: boolean
          name: string
          pinned_host: string
          secret_ref?: string | null
          space_id: string
          updated_at?: string
          verbs?: Json
        }
        Update: {
          adapter?: string
          allow_member_self_entry?: boolean
          auth_mode?: string
          auth_param?: string | null
          base_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_enabled?: boolean
          inbound_secret_ref?: string | null
          is_enabled?: boolean
          name?: string
          pinned_host?: string
          secret_ref?: string | null
          space_id?: string
          updated_at?: string
          verbs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "door_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_connections_inbound_secret_ref_fkey"
            columns: ["inbound_secret_ref"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_connections_secret_ref_fkey"
            columns: ["secret_ref"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_connections_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dues_payment_methods: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          platform: Database["public"]["Enums"]["payment_platform"]
          sort_order: number
          space_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          platform: Database["public"]["Enums"]["payment_platform"]
          sort_order?: number
          space_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          platform?: Database["public"]["Enums"]["payment_platform"]
          sort_order?: number
          space_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dues_payment_methods_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          asset_tag: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          required_certification_id: string | null
          space_id: string
          status: string
          updated_at: string
        }
        Insert: {
          asset_tag?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          required_certification_id?: string | null
          space_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          asset_tag?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          required_certification_id?: string | null
          space_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_required_certification_id_fkey"
            columns: ["required_certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          equipment_id: string
          id: string
          member_id: string
          notes: string | null
          space_id: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          equipment_id: string
          id?: string
          member_id: string
          notes?: string | null
          space_id: string
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          equipment_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          space_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_reservations_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_reservations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_reservations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_reservations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers: Json
          created_at: string
          form_id: string
          form_snapshot: Json
          form_version: number
          id: string
          ip: unknown
          legal_text_snapshot: string | null
          member_id: string | null
          space_id: string
          submitter_email: string | null
          user_agent: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          form_id: string
          form_snapshot: Json
          form_version: number
          id?: string
          ip?: unknown
          legal_text_snapshot?: string | null
          member_id?: string | null
          space_id: string
          submitter_email?: string | null
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          form_id?: string
          form_snapshot?: Json
          form_version?: number
          id?: string
          ip?: unknown
          legal_text_snapshot?: string | null
          member_id?: string | null
          space_id?: string
          submitter_email?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          legal_text: string | null
          schema: Json
          slug: string
          space_id: string
          status: string
          title: string
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          legal_text?: string | null
          schema?: Json
          slug: string
          space_id: string
          status?: string
          title: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          legal_text?: string | null
          schema?: Json
          slug?: string
          space_id?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string | null
          body: string | null
          category: string
          comment_count: number
          created_at: string
          id: string
          last_comment_at: string | null
          locked: boolean
          pinned: boolean
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          id?: string
          last_comment_at?: string | null
          locked?: boolean
          pinned?: boolean
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          id?: string
          last_comment_at?: string | null
          locked?: boolean
          pinned?: boolean
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_threads_space_id_fkey"
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
          meeting_date: string | null
          pinned: boolean
          render_markdown: boolean
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
          meeting_date?: string | null
          pinned?: boolean
          render_markdown?: boolean
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
          meeting_date?: string | null
          pinned?: boolean
          render_markdown?: boolean
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
      member_billing: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          member_id: string
          space_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          member_id: string
          space_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          member_id?: string
          space_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_billing_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_billing_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_billing_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_cards: {
        Row: {
          card_type: string
          card_uid: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          member_id: string
          space_id: string
          updated_at: string
        }
        Insert: {
          card_type?: string
          card_uid: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          member_id: string
          space_id: string
          updated_at?: string
        }
        Update: {
          card_type?: string
          card_uid?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          member_id?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cards_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_certifications: {
        Row: {
          certification_id: string
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          member_id: string
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          space_id: string
        }
        Insert: {
          certification_id: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          space_id: string
        }
        Update: {
          certification_id?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          member_id: string
          space_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          member_id: string
          space_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          member_id?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body_html: string
          body_text: string
          channel: string
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          member_id: string | null
          read_at: string | null
          recipient: string
          sent_at: string | null
          space_id: string
          status: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body_html: string
          body_text: string
          channel?: string
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          member_id?: string | null
          read_at?: string | null
          recipient: string
          sent_at?: string | null
          space_id: string
          status?: string
          subject: string
          type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body_html?: string
          body_text?: string
          channel?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          member_id?: string | null
          read_at?: string | null
          recipient?: string
          sent_at?: string | null
          space_id?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_acl: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          role: string
          space_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          role: string
          space_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          role?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_acl_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
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
          encrypted_value: string | null
          encryption_version: number
          icon: string | null
          id: string
          label: string
          notes: string | null
          space_id: string
          title: string | null
          updated_at: string
          value: string
        }
        Insert: {
          area?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          encrypted_value?: string | null
          encryption_version?: number
          icon?: string | null
          id?: string
          label: string
          notes?: string | null
          space_id: string
          title?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          area?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          encrypted_value?: string | null
          encryption_version?: number
          icon?: string | null
          id?: string
          label?: string
          notes?: string | null
          space_id?: string
          title?: string | null
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
      space_custom_roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          space_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          space_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_custom_roles_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_enabled: boolean
          label: string | null
          max_uses: number | null
          role: Database["public"]["Enums"]["member_role"]
          space_id: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_enabled?: boolean
          label?: string | null
          max_uses?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          space_id: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_enabled?: boolean
          label?: string | null
          max_uses?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          space_id?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "space_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_member_custom_roles: {
        Row: {
          assigned_at: string
          custom_role_id: string
          member_id: string
        }
        Insert: {
          assigned_at?: string
          custom_role_id: string
          member_id: string
        }
        Update: {
          assigned_at?: string
          custom_role_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_member_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "space_custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_member_custom_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_member_custom_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
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
          onboarding_completed_at: string | null
          onboarding_progress: Json
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
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
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
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
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
          {
            foreignKeyName: "space_members_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "space_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      space_onboarding_steps: {
        Row: {
          body: string | null
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          is_required: boolean
          is_system: boolean
          sort_order: number
          space_id: string
          step_key: string
          step_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          is_system?: boolean
          sort_order?: number
          space_id: string
          step_key: string
          step_type: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          is_system?: boolean
          sort_order?: number
          space_id?: string
          step_key?: string
          step_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_onboarding_steps_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_role_labels: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["member_role"]
          sort_order: number
          space_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          sort_order?: number
          space_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          sort_order?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_role_labels_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          space_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          space_id: string
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          space_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_role_permissions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_tiers: {
        Row: {
          billing_cadence: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          is_system: boolean
          monthly_price_cents: number
          name: string
          slug: string
          sort_order: number
          space_id: string
          updated_at: string
        }
        Insert: {
          billing_cadence?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          monthly_price_cents?: number
          name: string
          slug: string
          sort_order?: number
          space_id: string
          updated_at?: string
        }
        Update: {
          billing_cadence?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          monthly_price_cents?: number
          name?: string
          slug?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_tiers_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_visits: {
        Row: {
          check_in_note: string | null
          check_out_note: string | null
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          id: string
          is_host: boolean
          member_id: string
          space_id: string
        }
        Insert: {
          check_in_note?: string | null
          check_out_note?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          is_host?: boolean
          member_id: string
          space_id: string
        }
        Update: {
          check_in_note?: string | null
          check_out_note?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          is_host?: boolean
          member_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "inactive_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_visits_space_id_fkey"
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
      stripe_webhook_events: {
        Row: {
          event_id: string
          received_at: string
          space_id: string | null
          type: string | null
        }
        Insert: {
          event_id: string
          received_at?: string
          space_id?: string | null
          type?: string | null
        }
        Update: {
          event_id?: string
          received_at?: string
          space_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
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
      class_cancel_tx: {
        Args: { p_member_id: string; p_session_id: string; p_space_id: string }
        Returns: {
          cancelled_id: string
          err: string
          promoted_id: string
        }[]
      }
      class_signup_tx: {
        Args: { p_member_id: string; p_session_id: string; p_space_id: string }
        Returns: {
          err: string
          signup_id: string
          signup_status: string
        }[]
      }
      expire_proposals: { Args: never; Returns: number }
      get_user_space_ids: { Args: { uid: string }; Returns: string[] }
      members_with_permission: {
        Args: { perm: string; sid: string }
        Returns: {
          member_id: string
        }[]
      }
      user_effective_roles: {
        Args: { sid: string; uid: string }
        Returns: string[]
      }
      user_has_permission: {
        Args: { perm: string; sid: string; uid: string }
        Returns: boolean
      }
      user_has_role_in_space: {
        Args: { allowed_roles: string[]; sid: string; uid: string }
        Returns: boolean
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

