// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { authLogger } from './auth/authLogger'

// —————————————————————————————————————————————————————————————————————————————
// Environment variables - declare first before any usage
// —————————————————————————————————————————————————————————————————————————————
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

// —————————————————————————————————————————————————————————————————————————————
// DEV-only env logging
// —————————————————————————————————————————————————————————————————————————————
if (import.meta.env.DEV) {
  console.log(
    '[Supabase ENV] URL=',
    supabaseUrl,
    'ANON_KEY_PREFIX=',
    supabaseAnonKey?.slice(0, 8)
  )
}

// —————————————————————————————————————————————————————————————————————————————
// Validate environment variables
// —————————————————————————————————————————————————————————————————————————————
if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch {
  throw new Error('Invalid VITE_SUPABASE_URL format')
}

console.log('Supabase configuration:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
})

// —————————————————————————————————————————————————————————————————————————————
// Network diagnostics and error handling
// —————————————————————————————————————————————————————————————————————————————

function getNetworkErrorMessage(error: any): string {
  if (error?.name === 'TypeError' && error?.message?.includes('Failed to fetch')) {
    return `Network connection failed. This could be due to:
    • Internet connectivity issues
    • Supabase project is paused or unavailable
    • CORS configuration problems
    • VPN or firewall blocking the connection
    
    Please check:
    1. Your internet connection
    2. Supabase project status at https://supabase.com/dashboard
    3. Browser developer tools Network tab for more details`
  }
  
  if (error?.message?.includes('CORS')) {
    return 'Cross-origin request blocked. Please check your Supabase project CORS settings.'
  }
  
  if (error?.message?.includes('DNS')) {
    return 'DNS resolution failed. Please check your internet connection and try again.'
  }
  
  return error?.message || 'Unknown network error occurred'
}

async function withNetworkErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await operation()
    return { data: result, error: null }
  } catch (err) {
    console.error(`[Supabase] ${context} failed:`, err)
    
    const errorMessage = getNetworkErrorMessage(err)
    const enhancedError = new Error(`${context}: ${errorMessage}`)
    
    return { data: null, error: enhancedError }
  }
}
// —————————————————————————————————————————————————————————————————————————————
// Create Supabase client
//  • disable auto token-refresh  (avoids background-tab stalls)
//  • disable multi-tab sync      (prevents SW broadcasts)
//  • force fetchOptions: keepalive & no-store
// —————————————————————————————————————————————————————————————————————————————
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      multiTab: false,
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
  }
)

// —————————————————————————————————————————————————————————————————————————————
// Connection test function
// —————————————————————————————————————————————————————————————————————————————

export async function testSupabaseConnection() {
  console.log('[Supabase] Testing connection...')
  
  return withNetworkErrorHandling(async () => {
    // First test basic API connectivity
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Supabase API unreachable: ${response.status} ${response.statusText}`);
    }
    
    // Then test a simple query
    const { data, error } = await supabase
      .from('organisations')
      .select('count')
      .limit(1)
    
    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`)
    }
    
    console.log('[Supabase] Connection test successful')
    return { success: true, data }
  }, 'Connection test')
}
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
  
  return withNetworkErrorHandling(async () => {
    const { data, error, status } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error && status !== 406) throw error
    return data
  }, 'Get profile')
}

export async function updateProfile(
  userId: string,
  updates: Partial<Database['public']['Tables']['user_profiles']['Update']>
) {
  if (!userId) return { data: null, error: new Error('User ID is required') }
  if (!updates || Object.keys(updates).length === 0) {
    return { data: null, error: new Error('No updates provided') }
  }
  
  return withNetworkErrorHandling(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }, 'Update profile')
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
      .insert([decision])
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
      .eq('user_id', userId)
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
      })
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
      .eq('id', collabRowId)

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

    const { error: anaErr } = await supabase
      .from('decision_analysis')
      .upsert(
        {
          decision_id: decisionId,
          analysis_data: payload,
          status,
          version: 1,
          metadata: { ...metadata, lastUpdated: timestamp },
        },
        { onConflict: 'decision_id' }
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
    })
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

export async function fetchUserDirectory(searchTerm: string = '', organisationId: string | null = null) {
  try {
    const { data, error } = await supabase.rpc(
      'get_user_directory_with_organisation',
      { search_term: searchTerm, organisation_id: organisationId }
    );
    
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
    );
    
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
    );
    
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
    const { data, error } = await supabase.rpc('get_my_invitations');
    
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
    );
    
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
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'expired' })
      .eq('id', invitationId);
      
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
    );
    
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
    
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email,
        status: 'pending',
        invited_by: userId
      })
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

// ---------------- Organisation Management ----------------

export async function getUserOrganisations() {
  try {
    const { data, error } = await supabase.rpc('get_user_organisations');
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getUserOrganisations exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching organisations')
    };
  }
}

export async function getOrganisationDetails(id: string) {
  try {
    const { data, error } = await supabase.rpc(
      'get_organisation_details',
      { org_id: id }
    );
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getOrganisationDetails exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching organisation details')
    };
  }
}

export async function getOrganisationMembers(id: string) {
  try {
    const { data, error } = await supabase.rpc(
      'get_organisation_members',
      { org_id: id }
    );
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getOrganisationMembers exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching organisation members')
    };
  }
}

export async function getOrganisationTeams(id: string) {
  try {
    const { data, error } = await supabase.rpc(
      'get_organisation_teams',
      { org_id: id }
    );
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('getOrganisationTeams exception:', err);
    return {
      data: null,
      error: err instanceof Error
        ? err
        : new Error('Unknown error fetching organisation teams')
    };
  }
}

// ---------------- testSupabaseConnection ----------------
