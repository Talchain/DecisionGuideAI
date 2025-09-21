// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { authLogger } from './auth/authLogger'

// —————————————————————————————————————————————————————————————————————————————
// DEV-only env logging
// —————————————————————————————————————————————————————————————————————————————
if (import.meta.env.DEV) {
  console.log(
    '[Supabase ENV] URL=',
    import.meta.env.VITE_SUPABASE_URL,
    'ANON_KEY_PREFIX=',
    import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 8)
  )
}

// —————————————————————————————————————————————————————————————————————————————
// Validate environment variables
// —————————————————————————————————————————————————————————————————————————————
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!
if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing Supabase environment variables')
  throw new Error('Missing Supabase environment variables')
}

// —————————————————————————————————————————————————————————————————————————————
// Create Supabase client
//  • disable auto token-refresh  (avoids background-tab stalls)
//  • disable multi-tab sync      (prevents SW broadcasts)
//  • force fetchOptions: keepalive & no-store
// —————————————————————————————————————————————————————————————————————————————
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      multiTab: true,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-Client-Info': 'decision-guide-ai',
        'X-Client-Version': '1.0.0',
      },
      fetchOptions: {
        keepalive: true,
        cache: 'no-store',
      },
    },
  } as any // typing-only: cast options to satisfy SDK type shape without altering runtime
)

// ---------------- Auth Helpers ----------------

export async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  console.debug('[getUserId] supabase.auth.getSession →', { data, error })
  const userId = data?.session?.user?.id
  if (error || !userId) {
    if (import.meta.env.DEV) console.error('[Supabase] getSession error:', error)
    return null
  }
  return userId
}

// ---------------- Profile Management ----------------

export async function getProfile(userId: string) {
  if (!userId) return { data: null, error: new Error('User ID is required') }
  try {
    const { data, error, status } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId as any) // typing-only: branded id cast
      .returns<Database['public']['Tables']['user_profiles']['Row']>()
      .single()
    if (error && status !== 406) throw error
    return { data, error: null }
  } catch (err) {
    console.error('getProfile exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching profile'),
    }
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Database['public']['Tables']['user_profiles']['Update']>
) {
  if (!userId) return { data: null, error: new Error('User ID is required') }
  if (!updates || Object.keys(updates).length === 0) {
    return { data: null, error: new Error('No updates provided') }
  }
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates as Database['public']['Tables']['user_profiles']['Update'])
      .eq('id', userId as any) // typing-only: branded id cast
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('updateProfile exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error updating profile'),
    }
  }
}

// ---------------- Decision Management ----------------

// 1) strict TypeScript union
export type DecisionType =
  | 'professional'
  | 'financial'
  | 'health'
  | 'career'
  | 'relationships'
  | 'other'

// 2) runtime-validation array
export const VALID_DECISION_TYPES: DecisionType[] = [
  'professional',
  'financial',
  'health',
  'career',
  'relationships',
  'other',
]

// 3) guard for DecisionDetails
export function isValidDecisionType(value: string): value is DecisionType {
  return VALID_DECISION_TYPES.includes(value as DecisionType)
}

// 4) guard for insert payload
type DecisionInsert = Database['public']['Tables']['decisions']['Insert']
function isValidDecisionInsert(obj: any): obj is DecisionInsert {
  return (
    obj &&
    typeof obj.user_id === 'string' &&
    typeof obj.title === 'string' &&
    VALID_DECISION_TYPES.includes(obj.type)
  )
}

// ---------------- createDecision ----------------

export async function createDecision(
  decision: Omit<DecisionInsert, 'id' | 'created_at' | 'updated_at'>
) {
  console.log('[Supabase] ▶️ createDecision called with', decision)

  if (!isValidDecisionInsert(decision)) {
    const msg = 'Invalid decision data: type must be one of ' + VALID_DECISION_TYPES.join(', ')
    console.error('[Supabase] ❌ Invalid payload:', msg, decision)
    return { data: null, error: new Error(msg) }
  }

  try {
    console.log('[Supabase] ⏳ inserting via supabase-js…')
    const { data, error } = await supabase
      .from('decisions')
      .insert([decision] as Database['public']['Tables']['decisions']['Insert'][])
      .select()
      .single()
    console.log('[Supabase] ⏪ insert response', { data, error })

    if (!data && !error) {
      throw new Error(
        '[Supabase] 🧨 insert returned no data and no error — something is blocking silently'
      )
    }
    if (error) {
      console.error('[Supabase] ❌ Decision creation failed:', error)
      return { data: null, error }
    }
    return { data, error: null }
  } catch (err) {
    console.error('[Supabase] 🔥 createDecision exception', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error creating decision'),
    }
  }
}

// ---------------- getDecisions ----------------

export async function getDecisions(userId: string) {
  if (!userId) return { data: null, error: new Error('User ID is required') }
  try {
    const { data, error } = await supabase
      .from('decisions')
      .select(
        'id, title, type, reversibility, importance, created_at, updated_at, user_id, description'
      )
      .eq('user_id', userId as any) // typing-only: branded id cast
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('getDecisions exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching decisions'),
    }
  }
}

// ---------------- Collaboration Management ----------------

export async function inviteCollaborator(
  decisionId: string,
  userId: string,
  role: 'owner' | 'contributor' | 'viewer'
) {
  if (!decisionId || !userId) {
    return { data: null, error: new Error('Decision ID and User ID are required') }
  }

  try {
    const { data, error } = await supabase
      .from('decision_collaborators')
      .insert({
        decision_id: decisionId,
        user_id: userId,
        role,
        status: 'invited',
        permissions: {
          can_comment: role !== 'viewer',
          can_suggest: role !== 'viewer',
          can_rate: role !== 'viewer'
        }
      } as any) // typing-only: Insert union + branded IDs
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('inviteCollaborator exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error inviting collaborator')
    }
  }
}

export async function fetchCollaborators(decisionId: string) {
  if (!decisionId) {
    return { data: null, error: new Error('Decision ID is required') }
  }

  try {
    // Use the RPC function to avoid RLS recursion
    const { data, error } = await supabase
      .rpc('get_decision_collaborators', {
        decision_id_param: decisionId
      })
      .returns<any[]>()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('fetchCollaborators exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching collaborators')
    }
  }
}

export async function removeCollaborator(collabRowId: string) {
  if (!collabRowId) {
    return { error: new Error('Collaborator ID is required') }
  }

  try {
    const { error } = await supabase
      .from('decision_collaborators')
      .delete()
      .eq('id', collabRowId as any) // typing-only: branded id cast

    if (error) throw error
    return { error: null }
  } catch (err) {
    console.error('removeCollaborator exception:', err)
    return {
      error: err instanceof Error
        ? err
        : new Error('Unknown error removing collaborator')
    }
  }
}

// ---------------- saveDecisionAnalysis ----------------

export async function saveDecisionAnalysis(
  decisionId: string,
  analysisData: any,
  status = 'draft',
  metadata = {}
): Promise<{ error: any }> {
  try {
    if (!decisionId) throw new Error('Valid decision ID required')
    const timestamp = new Date().toISOString()

    await supabase
      .from('decisions')
      .update({ updated_at: timestamp, status })
      .eq('id', decisionId)

    const payload =
      JSON.stringify(analysisData).length > 500_000
        ? JSON.parse(
            JSON.stringify(analysisData, (k, v) =>
              typeof v === 'string' && v.length > 10000
                ? v.slice(0, 10000) + '…'
                : v
            )
          )
        : analysisData

    const { error: anaErr } = await (supabase as any)
      .from('decision_analysis')
      .upsert(
        {
          decision_id: decisionId,
          analysis_data: payload,
          status,
          version: 1,
          metadata: { ...metadata, lastUpdated: timestamp },
        } as any,
        { onConflict: 'decision_id' } as any
      )

    if (anaErr) throw anaErr
    return { error: null }
  } catch (err) {
    console.error('saveDecisionAnalysis exception:', err)
    return {
      error: err instanceof Error
        ? err
        : new Error('Unknown error saving analysis'),
    }
  }
}

// ---------------- fetchDecisionCollaborators ----------------

export async function fetchDecisionCollaborators(decisionId: string) {
  try {
    const { data, error } = await supabase.rpc('get_decision_collaborators', {
      decision_id_param: decisionId,
    }).returns<any[]>()
    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('fetchDecisionCollaborators exception:', err)
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching collaborators'),
    }
  }
}

// ---------------- Directory Management ----------------

export async function fetchUserDirectory(searchTerm: string = '') {
  try {
    const { data, error } = await supabase.rpc(
      'get_user_directory',
      { search_term: searchTerm }
    ).returns<any[]>();
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('fetchUserDirectory exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching user directory')
    };
  }
}

// ---------------- Team Invitations Management ----------------

export async function inviteTeamMember(
  teamId: string,
  email: string,
  role: string = 'member',
  decisionRole: string = 'contributor'
) {
  try {
    const { data, error } = await supabase.rpc(
      'manage_team_invite',
      {
        team_uuid: teamId,
        email_address: email,
        member_role: role,
        decision_role: decisionRole
      }
    ).returns<any>();
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('inviteTeamMember exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error inviting team member')
    };
  }
}

export async function getTeamInvitations(teamId: string) {
  try {
    const { data, error } = await supabase.rpc(
      'manage_team_invite',
      { team_uuid: teamId }
    ).returns<any[]>();
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getTeamInvitations exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching team invitations')
    };
  }
}

export async function getMyInvitations() {
  try {
    const { data, error } = await supabase.rpc('get_my_invitations').returns<any[]>();
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getMyInvitations exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching user invitations')
    };
  }
}

export async function acceptTeamInvitation(invitationId: string) {
  try {
    const { data, error } = await supabase.rpc(
      'accept_team_invitation',
      { invitation_id: invitationId }
    ).returns<any>();
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('acceptTeamInvitation exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error accepting invitation')
    };
  }
}

export async function revokeTeamInvitation(invitationId: string) {
  try {
    const { error } = await (supabase as any)
      .from('invitations')
      .update({ status: 'expired' } as any)
      .eq('id', invitationId as any);
      
    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error('revokeTeamInvitation exception:', err);
    return {
      error: err instanceof Error
        ? err
        : new Error('Unknown error revoking invitation')
    };
  }
}

export async function resendTeamInvitation(invitationId: string) {
  try {
    // Use the RPC function to resend invitation
    const { data, error } = await supabase.rpc(
      'resend_team_invitation',
      { invitation_id: invitationId }
    ).returns<any>();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (err) {
    console.error('resendTeamInvitation exception:', err);
    return {
      error: err instanceof Error
        ? err
        : new Error('Unknown error resending invitation')
    };
  }
}

export async function createInvitation(email: string) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return { data: null, error: new Error('User not authenticated') };
    }
    
    const { data, error } = await (supabase as any)
      .from('invitations')
      .insert({
        email,
        status: 'pending',
        invited_by: userId
      } as any)
      .select()
      .single();
      
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('createInvitation exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error creating invitation')
    };
  }
}

// ---------------- testSupabaseConnection ----------------

export async function testSupabaseConnection() {
  try {
    await supabase.from('decisions').select('id', { head: true }).limit(1)
    console.log('Supabase connection OK.')
    return { success: true }
  } catch (err) {
    console.error('testSupabaseConnection failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}