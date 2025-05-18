import { supabase } from './supabase';

interface EmailResponse {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
}

export async function sendTestEmail(email: string): Promise<EmailResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-team-invite/test-email', {
      body: { email }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to send test email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send test email'
    };
  }
}

export async function sendInvitationEmail(
  invitationId: string,
  email: string,
  teamName: string,
  inviterName: string
): Promise<EmailResponse> {
  try {
    const { data, error } = await supabase.rpc('send_team_invitation_email', {
      invitation_uuid: invitationId,
      to_email: email,
      team_name: teamName,
      inviter_name: inviterName
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation email'
    };
  }
}