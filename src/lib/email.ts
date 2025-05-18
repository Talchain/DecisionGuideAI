// src/lib/email.ts
import { supabase } from './supabase';

export interface EmailResponse {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
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
    return { success: false, error: err.message || 'Failed to send invitation email' };
  }
}

// Export under both names so your imports all resolve:
export const sendInvitationEmail = _sendInvitationEmail;
export const sendTeamInvitationEmail = _sendInvitationEmail;