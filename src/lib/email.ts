// src/lib/email.ts
import { supabase } from './supabase';

export interface EmailResponse {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
}

 * Send a test email via the send-team-invite Edge Function.
 */
export async function sendTestEmail(email: string): Promise<EmailResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'send-team-invite/test-email',
      { body: { email } }
    );
    if (error) throw error;
    return data as EmailResponse;
  } catch (err: any) {
    console.error('Failed to send test email:', err);
    return { success: false, error: err.message || 'Failed to send test email' };
  }
}

/**
export async function sendInvitationEmail(
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
