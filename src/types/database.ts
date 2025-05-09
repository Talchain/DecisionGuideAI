type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          phone_number: string | null
          address: string | null
          age_bracket: string | null
          gender: string | null
          contact_consent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          phone_number?: string | null
          address?: string | null
          age_bracket?: string | null
          gender?: string | null
          contact_consent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          phone_number?: string | null
          address?: string | null
          age_bracket?: string | null
          gender?: string | null
          contact_consent?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      decisions: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          type: 'professional' | 'financial' | 'health' | 'career' | 'relationships' | 'other'
          reversibility: string
          importance: string
          status: string
          is_archived: boolean
          is_collaborative: boolean
          collaboration_settings: Json
          created_at: string
          updated_at: string
          due_date: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          type: 'professional' | 'financial' | 'health' | 'career' | 'relationships' | 'other'
          reversibility: string
          importance: string
          status?: string
          is_archived?: boolean
          is_collaborative?: boolean
          collaboration_settings?: Json
          created_at?: string
          updated_at?: string
          due_date?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          type?: 'professional' | 'financial' | 'health' | 'career' | 'relationships' | 'other'
          reversibility?: string
          importance?: string
          status?: string
          is_archived?: boolean
          is_collaborative?: boolean
          collaboration_settings?: Json
          created_at?: string
          updated_at?: string
          due_date?: string | null
        }
      }
      decision_collaborators: {
        Row: {
          id: string
          decision_id: string
          user_id: string
          role: 'owner' | 'collaborator' | 'viewer'
          status: 'invited' | 'active' | 'removed'
          permissions: Json
          email: string | null
          invited_at: string
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          decision_id: string
          user_id: string
          role?: 'owner' | 'collaborator' | 'viewer'
          status?: 'invited' | 'active' | 'removed'
          permissions?: Json
          email?: string | null
          invited_at?: string
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          decision_id?: string
          user_id?: string
          role?: 'owner' | 'collaborator' | 'viewer'
          status?: 'invited' | 'active' | 'removed'
          permissions?: Json
          email?: string | null
          invited_at?: string
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      decision_comments: {
        Row: {
          id: string
          decision_id: string
          user_id: string
          parent_id: string | null
          content: string
          context: Json
          mentions: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          decision_id: string
          user_id: string
          parent_id?: string | null
          content: string
          context?: Json
          mentions?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          decision_id?: string
          user_id?: string
          parent_id?: string | null
          content?: string
          context?: Json
          mentions?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      decision_suggestions: {
        Row: {
          id: string
          decision_id: string
          user_id: string
          type: 'option' | 'pro' | 'con'
          content: Json
          status: 'pending' | 'approved' | 'rejected'
          feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          decision_id: string
          user_id: string
          type: 'option' | 'pro' | 'con'
          content: Json
          status?: 'pending' | 'approved' | 'rejected'
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          decision_id?: string
          user_id?: string
          type?: 'option' | 'pro' | 'con'
          content?: Json
          status?: 'pending' | 'approved' | 'rejected'
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      decision_activities: {
        Row: {
          id: string
          decision_id: string
          user_id: string
          activity_type: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          decision_id: string
          user_id: string
          activity_type: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          decision_id?: string
          user_id?: string
          activity_type?: string
          details?: Json
          created_at?: string
        }
      }
    }
    Functions: {
      is_decision_owner: {
        Args: { decision_id: string }
        Returns: boolean
      }
      is_decision_collaborator: {
        Args: { decision_id: string }
        Returns: boolean
      }
      has_collaboration_permission: {
        Args: { decision_id: string; permission: string }
        Returns: boolean
      }
    }
    Enums: {
      collaborator_role: 'owner' | 'collaborator' | 'viewer'
      collaborator_status: 'invited' | 'active' | 'removed'
      suggestion_type: 'option' | 'pro' | 'con'
      suggestion_status: 'pending' | 'approved' | 'rejected'
    }
  }
}

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Convenience types
export type UserProfile = Tables<'user_profiles'>
export type Decision = Tables<'decisions'>
type DecisionCollaborator = Tables<'decision_collaborators'>
type DecisionComment = Tables<'decision_comments'>
type DecisionSuggestion = Tables<'decision_suggestions'>
type DecisionActivity = Tables<'decision_activities'>

// Enum types
type CollaboratorRole = Enums<'collaborator_role'>
type CollaboratorStatus = Enums<'collaborator_status'> 
type SuggestionType = Enums<'suggestion_type'>
type SuggestionStatus = Enums<'suggestion_status'>