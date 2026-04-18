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
      admin_commission_settings: {
        Row: {
          admin_id: string
          id: string
          rate_per_student: number
          updated_at: string
        }
        Insert: {
          admin_id: string
          id?: string
          rate_per_student?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string
          id?: string
          rate_per_student?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_commission_tiers: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          max_students: number | null
          min_students: number
          rate_per_student: number
          tier_name: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          max_students?: number | null
          min_students?: number
          rate_per_student?: number
          tier_name: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          max_students?: number | null
          min_students?: number
          rate_per_student?: number
          tier_name?: string
        }
        Relationships: []
      }
      agent_card_settings: {
        Row: {
          accreditation: string | null
          ai_voice_enabled: boolean
          apply_url: string | null
          bio: string | null
          booking_url: string | null
          company_description: string | null
          company_name: string | null
          created_at: string
          id: string
          is_public: boolean
          job_title: string | null
          social_facebook: string | null
          social_google: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_trustpilot: string | null
          social_youtube: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
          working_hours: string | null
        }
        Insert: {
          accreditation?: string | null
          ai_voice_enabled?: boolean
          apply_url?: string | null
          bio?: string | null
          booking_url?: string | null
          company_description?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          job_title?: string | null
          social_facebook?: string | null
          social_google?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_trustpilot?: string | null
          social_youtube?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          working_hours?: string | null
        }
        Update: {
          accreditation?: string | null
          ai_voice_enabled?: boolean
          apply_url?: string | null
          bio?: string | null
          booking_url?: string | null
          company_description?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          job_title?: string | null
          social_facebook?: string | null
          social_google?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_trustpilot?: string | null
          social_youtube?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          working_hours?: string | null
        }
        Relationships: []
      }
      agent_promotions: {
        Row: {
          agent_id: string
          id: string
          personal_deadline: string
          promotion_id: string
          started_at: string
        }
        Insert: {
          agent_id: string
          id?: string
          personal_deadline: string
          promotion_id: string
          started_at?: string
        }
        Update: {
          agent_id?: string
          id?: string
          personal_deadline?: string
          promotion_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_promotions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_streaks: {
        Row: {
          current_streak: number
          id: string
          last_active_date: string | null
          level: number
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_xp_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id: string
          xp_amount?: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          title: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      billing_details: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          bank_name: string | null
          company_address: string | null
          company_name: string | null
          company_number: string | null
          created_at: string
          iban: string | null
          id: string
          is_company: boolean
          sort_code: string | null
          swift_bic: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          company_address?: string | null
          company_name?: string | null
          company_number?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_company?: boolean
          sort_code?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          company_address?: string | null
          company_name?: string | null
          company_number?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_company?: boolean
          sort_code?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          brand_prompt: string
          id: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          brand_prompt?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          brand_prompt?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campuses: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          university_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          university_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          created_at: string | null
          enrollment_id: string
          id: string
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          id?: string
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          id?: string
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          paid_by: string | null
          payment_type: string
          period_label: string | null
          recipient_id: string
          recipient_role: string
          snapshot_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_type?: string
          period_label?: string | null
          recipient_id: string
          recipient_role?: string
          snapshot_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_type?: string
          period_label?: string | null
          recipient_id?: string
          recipient_role?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_snapshots: {
        Row: {
          admin_id: string | null
          admin_rate: number
          agent_id: string
          agent_rate: number
          commission_tranches: number
          created_at: string
          eligible_at: string
          enrollment_id: string
          full_release_at: string | null
          id: string
          override_amount: number | null
          override_percentage: number | null
          rate_source: string
          snapshot_status: string
          university_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_rate?: number
          agent_id: string
          agent_rate?: number
          commission_tranches?: number
          created_at?: string
          eligible_at?: string
          enrollment_id: string
          full_release_at?: string | null
          id?: string
          override_amount?: number | null
          override_percentage?: number | null
          rate_source?: string
          snapshot_status?: string
          university_id: string
        }
        Update: {
          admin_id?: string | null
          admin_rate?: number
          agent_id?: string
          agent_rate?: number
          commission_tranches?: number
          created_at?: string
          eligible_at?: string
          enrollment_id?: string
          full_release_at?: string | null
          id?: string
          override_amount?: number | null
          override_percentage?: number | null
          rate_source?: string
          snapshot_status?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshots_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          commission_per_student: number
          id: string
          max_students: number | null
          min_students: number
          tier_name: string
          university_id: string | null
        }
        Insert: {
          commission_per_student?: number
          id?: string
          max_students?: number | null
          min_students?: number
          tier_name: string
          university_id?: string | null
        }
        Update: {
          commission_per_student?: number
          id?: string
          max_students?: number | null
          min_students?: number
          tier_name?: string
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_tiers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_signing_tokens: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string
          id: string
          signed_at: string | null
          status: string
          student_id: string
          token: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at?: string
          id?: string
          signed_at?: string | null
          status?: string
          student_id: string
          token?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          signed_at?: string | null
          status?: string
          student_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_signing_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_details: {
        Row: {
          additional_info: string | null
          admission_test_info: string | null
          course_id: string
          created_at: string
          documents_required: string | null
          entry_requirements: string | null
          id: string
          interview_info: string | null
          personal_statement_guidelines: string | null
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
          admission_test_info?: string | null
          course_id: string
          created_at?: string
          documents_required?: string | null
          entry_requirements?: string | null
          id?: string
          interview_info?: string | null
          personal_statement_guidelines?: string | null
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
          admission_test_info?: string | null
          course_id?: string
          created_at?: string
          documents_required?: string | null
          entry_requirements?: string | null
          id?: string
          interview_info?: string | null
          personal_statement_guidelines?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_details_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_timetable_groups: {
        Row: {
          campus_id: string | null
          course_id: string
          created_at: string
          id: string
          timetable_option_id: string
          university_id: string
        }
        Insert: {
          campus_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          timetable_option_id: string
          university_id: string
        }
        Update: {
          campus_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          timetable_option_id?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_timetable_groups_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetable_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetable_groups_timetable_option_id_fkey"
            columns: ["timetable_option_id"]
            isOneToOne: false
            referencedRelation: "timetable_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetable_groups_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          duration: string | null
          fees: string | null
          id: string
          is_active: boolean
          level: string
          name: string
          study_mode: string
          tuition_fee_percentage: number | null
          university_id: string
        }
        Insert: {
          created_at?: string
          duration?: string | null
          fees?: string | null
          id?: string
          is_active?: boolean
          level?: string
          name: string
          study_mode?: string
          tuition_fee_percentage?: number | null
          university_id: string
        }
        Update: {
          created_at?: string
          duration?: string | null
          fees?: string | null
          id?: string
          is_active?: boolean
          level?: string
          name?: string
          study_mode?: string
          tuition_fee_percentage?: number | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversations: {
        Row: {
          created_at: string
          id: string
          participant_1: string
          participant_2: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_1: string
          participant_2: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_1?: string
          participant_2?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folder_mappings: {
        Row: {
          created_at: string
          drive_folder_id: string
          entity_id: string
          entity_type: string
          folder_name: string | null
          id: string
          parent_drive_folder_id: string | null
        }
        Insert: {
          created_at?: string
          drive_folder_id: string
          entity_id: string
          entity_type: string
          folder_name?: string | null
          id?: string
          parent_drive_folder_id?: string | null
        }
        Update: {
          created_at?: string
          drive_folder_id?: string
          entity_id?: string
          entity_type?: string
          folder_name?: string | null
          id?: string
          parent_drive_folder_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          assessment_date: string | null
          assessment_time: string | null
          campus_id: string | null
          course_id: string
          created_at: string
          funding_notes: string | null
          funding_reference: string | null
          funding_status: string | null
          funding_type: string | null
          id: string
          intake_id: string | null
          notes: string | null
          status: string
          student_id: string
          university_id: string
          updated_at: string
        }
        Insert: {
          assessment_date?: string | null
          assessment_time?: string | null
          campus_id?: string | null
          course_id: string
          created_at?: string
          funding_notes?: string | null
          funding_reference?: string | null
          funding_status?: string | null
          funding_type?: string | null
          id?: string
          intake_id?: string | null
          notes?: string | null
          status?: string
          student_id: string
          university_id: string
          updated_at?: string
        }
        Update: {
          assessment_date?: string | null
          assessment_time?: string | null
          campus_id?: string | null
          course_id?: string
          created_at?: string
          funding_notes?: string | null
          funding_reference?: string | null
          funding_status?: string | null
          funding_type?: string | null
          id?: string
          intake_id?: string | null
          notes?: string | null
          status?: string
          student_id?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_path: string
          preset: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          preset?: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          preset?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      image_generation_jobs: {
        Row: {
          avatar_url: string | null
          created_at: string
          error_message: string | null
          id: string
          preset: string
          prompt: string
          remaining: number | null
          result_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          preset?: string
          prompt: string
          remaining?: number | null
          result_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          preset?: string
          prompt?: string
          remaining?: number | null
          result_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      intakes: {
        Row: {
          application_deadline: string | null
          created_at: string
          id: string
          label: string
          start_date: string
          university_id: string
        }
        Insert: {
          application_deadline?: string | null
          created_at?: string
          id?: string
          label: string
          start_date: string
          university_id: string
        }
        Update: {
          application_deadline?: string | null
          created_at?: string
          id?: string
          label?: string
          start_date?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intakes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_number: string | null
          notes: string | null
          owner_notes: string | null
          paid_at: string | null
          requester_id: string
          snapshot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          owner_notes?: string | null
          paid_at?: string | null
          requester_id: string
          snapshot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          owner_notes?: string | null
          paid_at?: string | null
          requester_id?: string
          snapshot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string
          campus_id: string | null
          course_id: string | null
          course_interest: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          intake_id: string | null
          last_name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          status: string
          timetable_option: string | null
          university_id: string | null
        }
        Insert: {
          agent_id: string
          campus_id?: string | null
          course_id?: string | null
          course_interest?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          intake_id?: string | null
          last_name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          timetable_option?: string | null
          university_id?: string | null
        }
        Update: {
          agent_id?: string
          campus_id?: string | null
          course_id?: string | null
          course_interest?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          intake_id?: string | null
          last_name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          timetable_option?: string | null
          university_id?: string | null
        }
        Relationships: []
      }
      learn_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "learn_lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_lesson_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          lesson_id: string
          parent_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          lesson_id: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          lesson_id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learn_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_lesson_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "learn_lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_lessons: {
        Row: {
          attachments: Json | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          module_id: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_duration: number | null
          video_url: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          module_id: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_duration?: number | null
          video_url?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          module_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_duration?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learn_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learn_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_modules: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learn_progress: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "learn_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learn_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          admin_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          postcode: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          postcode?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          postcode?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          bonus_amount: number
          bonus_percentage: number | null
          created_at: string
          created_by: string | null
          deadline: string
          description: string | null
          id: string
          is_active: boolean
          target_role: string
          target_students: number
          title: string
        }
        Insert: {
          bonus_amount?: number
          bonus_percentage?: number | null
          created_at?: string
          created_by?: string | null
          deadline: string
          description?: string | null
          id?: string
          is_active?: boolean
          target_role?: string
          target_students?: number
          title: string
        }
        Update: {
          bonus_amount?: number
          bonus_percentage?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string | null
          id?: string
          is_active?: boolean
          target_role?: string
          target_students?: number
          title?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_recipients: {
        Row: {
          agent_id: string
          id: string
          post_id: string
          seen_at: string | null
        }
        Insert: {
          agent_id: string
          id?: string
          post_id: string
          seen_at?: string | null
        }
        Update: {
          agent_id?: string
          id?: string
          post_id?: string
          seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_recipients_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption: string
          created_at: string
          created_by: string
          id: string
          image_url: string
          target_role: string
        }
        Insert: {
          caption?: string
          created_at?: string
          created_by: string
          id?: string
          image_url: string
          target_role?: string
        }
        Update: {
          caption?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string
          target_role?: string
        }
        Relationships: []
      }
      student_document_requests: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string
          id: string
          message: string | null
          requested_doc_types: string[]
          status: string
          student_id: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          requested_doc_types?: string[]
          status?: string
          student_id: string
          submitted_at?: string | null
          token?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          requested_doc_types?: string[]
          status?: string
          student_id?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_document_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          agent_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_current: boolean
          student_id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          agent_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          student_id: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          agent_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          student_id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_finance_forms: {
        Row: {
          address_history_1: string | null
          address_history_2: string | null
          address_history_3: string | null
          agent_id: string
          applied_before: string | null
          applied_before_details: string | null
          consent_date: string | null
          consent_full_name: string | null
          course_length_start: string | null
          course_name: string | null
          created_at: string
          crn: string | null
          current_address: string | null
          date_of_birth: string | null
          dependants_info: string | null
          email: string | null
          employment_type: string | null
          enrollment_id: string | null
          expiry_date: string | null
          family_name: string | null
          first_name: string | null
          id: string
          immigration_status: string | null
          job_title_company: string | null
          method: string
          nationality: string | null
          ni_number: string | null
          password: string | null
          phone: string | null
          relationship_status: string | null
          secret_answer: string | null
          share_code: string | null
          spouse_address: string | null
          spouse_dob: string | null
          spouse_email: string | null
          spouse_employment_status: string | null
          spouse_full_name: string | null
          spouse_has_income: string | null
          spouse_marriage_date: string | null
          spouse_ni_number: string | null
          spouse_phone: string | null
          spouse_place_of_birth: string | null
          student_id: string
          title: string | null
          town_of_birth: string | null
          uk_contact_1_address: string | null
          uk_contact_1_name: string | null
          uk_contact_1_phone: string | null
          uk_contact_1_relationship: string | null
          uk_contact_2_address: string | null
          uk_contact_2_name: string | null
          uk_contact_2_phone: string | null
          uk_contact_2_relationship: string | null
          university_name_address: string | null
          updated_at: string
          uploaded_file_path: string | null
          worked_last_3_months: string | null
          year_tuition_fee: string | null
        }
        Insert: {
          address_history_1?: string | null
          address_history_2?: string | null
          address_history_3?: string | null
          agent_id: string
          applied_before?: string | null
          applied_before_details?: string | null
          consent_date?: string | null
          consent_full_name?: string | null
          course_length_start?: string | null
          course_name?: string | null
          created_at?: string
          crn?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          dependants_info?: string | null
          email?: string | null
          employment_type?: string | null
          enrollment_id?: string | null
          expiry_date?: string | null
          family_name?: string | null
          first_name?: string | null
          id?: string
          immigration_status?: string | null
          job_title_company?: string | null
          method?: string
          nationality?: string | null
          ni_number?: string | null
          password?: string | null
          phone?: string | null
          relationship_status?: string | null
          secret_answer?: string | null
          share_code?: string | null
          spouse_address?: string | null
          spouse_dob?: string | null
          spouse_email?: string | null
          spouse_employment_status?: string | null
          spouse_full_name?: string | null
          spouse_has_income?: string | null
          spouse_marriage_date?: string | null
          spouse_ni_number?: string | null
          spouse_phone?: string | null
          spouse_place_of_birth?: string | null
          student_id: string
          title?: string | null
          town_of_birth?: string | null
          uk_contact_1_address?: string | null
          uk_contact_1_name?: string | null
          uk_contact_1_phone?: string | null
          uk_contact_1_relationship?: string | null
          uk_contact_2_address?: string | null
          uk_contact_2_name?: string | null
          uk_contact_2_phone?: string | null
          uk_contact_2_relationship?: string | null
          university_name_address?: string | null
          updated_at?: string
          uploaded_file_path?: string | null
          worked_last_3_months?: string | null
          year_tuition_fee?: string | null
        }
        Update: {
          address_history_1?: string | null
          address_history_2?: string | null
          address_history_3?: string | null
          agent_id?: string
          applied_before?: string | null
          applied_before_details?: string | null
          consent_date?: string | null
          consent_full_name?: string | null
          course_length_start?: string | null
          course_name?: string | null
          created_at?: string
          crn?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          dependants_info?: string | null
          email?: string | null
          employment_type?: string | null
          enrollment_id?: string | null
          expiry_date?: string | null
          family_name?: string | null
          first_name?: string | null
          id?: string
          immigration_status?: string | null
          job_title_company?: string | null
          method?: string
          nationality?: string | null
          ni_number?: string | null
          password?: string | null
          phone?: string | null
          relationship_status?: string | null
          secret_answer?: string | null
          share_code?: string | null
          spouse_address?: string | null
          spouse_dob?: string | null
          spouse_email?: string | null
          spouse_employment_status?: string | null
          spouse_full_name?: string | null
          spouse_has_income?: string | null
          spouse_marriage_date?: string | null
          spouse_ni_number?: string | null
          spouse_phone?: string | null
          spouse_place_of_birth?: string | null
          student_id?: string
          title?: string | null
          town_of_birth?: string | null
          uk_contact_1_address?: string | null
          uk_contact_1_name?: string | null
          uk_contact_1_phone?: string | null
          uk_contact_1_relationship?: string | null
          uk_contact_2_address?: string | null
          uk_contact_2_name?: string | null
          uk_contact_2_phone?: string | null
          uk_contact_2_relationship?: string | null
          university_name_address?: string | null
          updated_at?: string
          uploaded_file_path?: string | null
          worked_last_3_months?: string | null
          year_tuition_fee?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_finance_forms_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_finance_forms_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notes: {
        Row: {
          content: string
          created_at: string
          enrollment_id: string | null
          id: string
          is_agent_visible: boolean
          is_urgent: boolean
          note_type: string
          resolved_at: string | null
          student_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          is_agent_visible?: boolean
          is_urgent?: boolean
          note_type?: string
          resolved_at?: string | null
          student_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          is_agent_visible?: boolean
          is_urgent?: boolean
          note_type?: string
          resolved_at?: string | null
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          agent_id: string
          created_at: string
          crn: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          full_address: string | null
          gender: string | null
          id: string
          immigration_status: string | null
          last_name: string
          nationality: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          ni_number: string | null
          notes: string | null
          phone: string | null
          previous_funding_years: number | null
          qualifications: string | null
          share_code: string | null
          study_pattern: string | null
          title: string | null
          uk_entry_date: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          crn?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          full_address?: string | null
          gender?: string | null
          id?: string
          immigration_status?: string | null
          last_name: string
          nationality?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          ni_number?: string | null
          notes?: string | null
          phone?: string | null
          previous_funding_years?: number | null
          qualifications?: string | null
          share_code?: string | null
          study_pattern?: string | null
          title?: string | null
          uk_entry_date?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          crn?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          full_address?: string | null
          gender?: string | null
          id?: string
          immigration_status?: string | null
          last_name?: string
          nationality?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          ni_number?: string | null
          notes?: string | null
          phone?: string | null
          previous_funding_years?: number | null
          qualifications?: string | null
          share_code?: string | null
          study_pattern?: string | null
          title?: string | null
          uk_entry_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          priority: string
          source: string
          status: string
          student_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "conversation_partner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_upgrade_requests: {
        Row: {
          created_at: string
          current_rate: number
          current_tier_name: string
          id: string
          new_rate: number
          new_tier_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_count: number
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          current_rate?: number
          current_tier_name?: string
          id?: string
          new_rate?: number
          new_tier_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_count?: number
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          current_rate?: number
          current_tier_name?: string
          id?: string
          new_rate?: number
          new_tier_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_count?: number
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      timetable_options: {
        Row: {
          created_at: string
          id: string
          label: string
          university_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          university_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_options_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          code: string
          created_at: string
          enrollment_id: string
          id: string
          new_campus_id: string | null
          new_course_id: string
          new_intake_id: string | null
          new_university_id: string
          requested_by: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          code?: string
          created_at?: string
          enrollment_id: string
          id?: string
          new_campus_id?: string | null
          new_course_id: string
          new_intake_id?: string | null
          new_university_id: string
          requested_by: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          code?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          new_campus_id?: string | null
          new_course_id?: string
          new_intake_id?: string | null
          new_university_id?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_new_campus_id_fkey"
            columns: ["new_campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_new_course_id_fkey"
            columns: ["new_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_new_intake_id_fkey"
            columns: ["new_intake_id"]
            isOneToOne: false
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_new_university_id_fkey"
            columns: ["new_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          timetable_available: boolean
          timetable_message: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          timetable_available?: boolean
          timetable_message?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          timetable_available?: boolean
          timetable_message?: string | null
        }
        Relationships: []
      }
      university_commissions: {
        Row: {
          commission_per_student: number
          created_at: string
          highlight_text: string | null
          id: string
          is_highlighted: boolean
          label: string | null
          tier_id: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          commission_per_student?: number
          created_at?: string
          highlight_text?: string | null
          id?: string
          is_highlighted?: boolean
          label?: string | null
          tier_id?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          commission_per_student?: number
          created_at?: string
          highlight_text?: string | null
          id?: string
          is_highlighted?: boolean
          label?: string | null
          tier_id?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_commissions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "commission_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_commissions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passwords: {
        Row: {
          id: string
          password_plaintext: string
          set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          password_plaintext: string
          set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          password_plaintext?: string
          set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      conversation_partner_view: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          slug: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          slug?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      public_agent_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          slug: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          slug?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_admin_id: { Args: never; Returns: string }
      get_team_lead_counts: {
        Args: { _admin_id: string }
        Returns: {
          agent_id: string
          agent_name: string
          lead_count: number
        }[]
      }
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
      is_post_creator: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      is_post_recipient: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "agent"
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
      app_role: ["owner", "admin", "agent"],
    },
  },
} as const
