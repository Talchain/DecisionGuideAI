// src/lib/email.ts

import { supabase } from './supabase';

export interface EmailResponse {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
}

export interface EdgeResult {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
}

/**
 * Send a team invitation via the Supabase Edge Function.
 */
export async function sendInviteViaEdge(payload: {
  invitation_id: string;
  email:         string;
  team_id:       string;
  team_name:     string;
  inviter_id:    string;
}): Promise<EdgeResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'send-team-invite',
      { body: payload }
    );
    if (error) throw error;
    return data as EdgeResult;
  } catch (err: any) {
    // Log the full error for debugging
    console.error('sendInviteViaEdge exception:', err);
    
    // Handle network errors specifically
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      return {
        success: false,
        error: 'Unable to reach the invitation service. Please check your network connection and try again.'
      };
    }
    
    // Handle other errors with a fallback message if none provided
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Core implementation for sending an invitation email via RPC.
 */
async function _sendInvitationEmail(
  invitationId: string,
  toEmail: string,
  teamName: string,
  inviterName: string
): Promise<EmailResponse> {
  try {
    const { data, error } = await supabase.rpc('send_team_invitation_email', {
      invitation_uuid: invitationId,
      to_email: toEmail,
      team_name: teamName,
      inviter_name: inviterName,
    });
    if (error) throw error;
    return data as EmailResponse;
  } catch (err: any) {
    console.error('Failed to send invitation email:', err);
    return {
      success: false,
      error: err.message || 'Failed to send invitation email'
    };
  }
}

// Re-export the RPC helper under both names for backward compatibility
export { _sendInvitationEmail as sendInvitationEmail };
// Legacy alias
export { sendInvitationEmail as sendTeamInvitationEmail };