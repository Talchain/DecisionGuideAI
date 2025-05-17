/**
 * Email service using Brevo API
 * This module provides a direct API integration with Brevo's transactional email API
 */

// Define types for better type safety
interface EmailOptions {
  to: string | string[];
  subject: string;
  templateName: string;
  templateData?: Record<string, any>;
}

interface BrevoEmailResponse {
  messageId?: string;
  code?: string;
  message?: string;
}

/**
 * Send an email using Brevo's API
 * @param options Email options including recipient, subject, and template
 * @returns API response with success status and message ID or error
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Get API key from environment
    const apiKey = import.meta.env.VITE_BREVO_API_KEY;
    if (!apiKey) {
      console.error("Missing Brevo API key");
      return { 
        success: false, 
        error: "Email service configuration error: Missing API key" 
      };
    }

    // Get from email from environment or use default
    const fromEmail = import.meta.env.VITE_FROM_EMAIL || "noreply@decisionguide.ai";
    
    // Format recipients
    const recipients = Array.isArray(options.to)
      ? options.to.map(email => ({ email }))
      : [{ email: options.to }];

    // Call Supabase RPC function to send email
    const { data, error } = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/send_email_with_template`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          p_to: Array.isArray(options.to) ? options.to[0] : options.to,
          p_subject: options.subject,
          p_template_name: options.templateName,
          p_template_data: options.templateData || {}
        })
      }
    ).then(res => res.json());

    if (error) {
      console.error("Error sending email via RPC:", error);
      return { 
        success: false, 
        error: error.message || "Failed to send email" 
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Unknown error sending email"
      };
    }

    return {
      success: true,
      messageId: data.message_id
    };
  } catch (error) {
    console.error("Error in sendEmail:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error sending email" 
    };
  }
}

/**
 * Send a test email
 * @param email Recipient email address
 * @returns API response
 */
export async function sendTestEmail(email: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Call Supabase RPC function to send test email
    const { data, error } = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/test_email_sending`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          to_email: email
        })
      }
    ).then(res => res.json());

    if (error) {
      console.error("Error sending test email via RPC:", error);
      return { 
        success: false, 
        error: error.message || "Failed to send test email" 
      };
    }

    return {
      success: data.success,
      messageId: data.message_id,
      error: data.error
    };
  } catch (error) {
    console.error("Error in sendTestEmail:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error sending test email" 
    };
  }
}

/**
 * Send a team invitation email
 * @param invitationId Invitation UUID
 * @param email Recipient email address
 * @param teamName Team name
 * @param inviterName Name of the person sending the invitation
 * @returns API response
 */
export async function sendTeamInvitationEmail(
  invitationId: string,
  email: string,
  teamName: string,
  inviterName: string = "A team admin"
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Call Supabase RPC function to send team invitation
    const { data, error } = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/send_team_invitation_email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          invitation_uuid: invitationId,
          to_email: email,
          team_name: teamName,
          inviter_name: inviterName
        })
      }
    ).then(res => res.json());

    if (error) {
      console.error("Error sending team invitation via RPC:", error);
      return { 
        success: false, 
        error: error.message || "Failed to send team invitation" 
      };
    }

    return {
      success: data.success,
      messageId: data.message_id,
      error: data.error
    };
  } catch (error) {
    console.error("Error in sendTeamInvitationEmail:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error sending team invitation" 
    };
  }
}