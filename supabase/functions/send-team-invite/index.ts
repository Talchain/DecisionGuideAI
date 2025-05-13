// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { SmtpClient } from "npm:smtp@1.0.0";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL")!;
const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://app.decisionguide.ai";

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create SMTP client
const smtp = new SmtpClient(smtpUrl);

// Listen for database changes
Deno.serve(async (req) => {
  try {
    // Set up Supabase Realtime client to listen for invitations
    const subscription = supabase
      .channel('send-team-invite')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitations',
        },
        async (payload) => {
          try {
            console.log('New invitation detected:', payload);
            await processInvitation(payload.new);
          } catch (error) {
            console.error('Error processing invitation:', error);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'send_invite' },
        async (payload) => {
          try {
            console.log('Received send_invite broadcast:', payload);
            await processInvitationPayload(payload);
          } catch (error) {
            console.error('Error processing broadcast:', error);
          }
        }
      )
      .subscribe();

    // Also listen for pg_notify events
    supabase.channel('send_invite')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations' },
        async (payload) => {
          console.log('Postgres notification received:', payload);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Keep the function alive to continue listening
    await new Promise((resolve) => setTimeout(resolve, 60 * 60 * 1000)); // 1 hour timeout

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Process invitation from database record
async function processInvitation(invitation: any) {
  try {
    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name')
      .eq('id', invitation.team_id)
      .single();

    if (teamError) throw teamError;

    // Get inviter details
    const { data: inviter, error: inviterError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, auth.users!inner(email)')
      .eq('id', invitation.invited_by)
      .single();

    if (inviterError) throw inviterError;

    // Generate accept link with token
    const acceptLink = `${appUrl}/accept-invite?token=${invitation.id}`;

    // Send email
    await sendInvitationEmail({
      to: invitation.email,
      teamName: team.name,
      inviterName: `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() || inviter.auth.users.email,
      inviterEmail: inviter.auth.users.email,
      role: invitation.role,
      acceptLink,
    });

    // Update invitation status to 'sent'
    await supabase
      .from('invitations')
      .update({ status: 'sent' })
      .eq('id', invitation.id);

    console.log(`Invitation email sent to ${invitation.email} for team ${team.name}`);
  } catch (error) {
    console.error('Error processing invitation:', error);
    throw error;
  }
}

// Process invitation from broadcast payload
async function processInvitationPayload(payload: any) {
  try {
    const { invitation_id, email, team_id, team_name, role } = payload;
    
    // Get inviter details
    const { data: inviter, error: inviterError } = await supabase.auth.getUser();

    if (inviterError) throw inviterError;

    // Generate accept link with token
    const acceptLink = `${appUrl}/accept-invite?token=${invitation_id}`;

    // Send email
    await sendInvitationEmail({
      to: email,
      teamName: team_name,
      inviterName: inviter.user.email,
      inviterEmail: inviter.user.email,
      role: role,
      acceptLink,
    });

    console.log(`Invitation email sent to ${email} for team ${team_name}`);
  } catch (error) {
    console.error('Error processing invitation payload:', error);
    throw error;
  }
}

// Send invitation email
async function sendInvitationEmail({
  to,
  teamName,
  inviterName,
  inviterEmail,
  role,
  acceptLink,
}: {
  to: string;
  teamName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  acceptLink: string;
}) {
  try {
    // Connect to SMTP server
    await smtp.connect();

    // Send email
    await smtp.send({
      from: fromEmail,
      to: [to],
      subject: `You've been invited to join ${teamName} on DecisionGuide.AI`,
      content: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4f46e5;">Team Invitation</h2>
              <p>Hello,</p>
              <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>
              <p>Click the button below to accept this invitation:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${acceptLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
              </p>
              <p>If you don't have an account yet, you'll be able to create one after accepting the invitation.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              <p>Best regards,<br>The DecisionGuide.AI Team</p>
            </div>
          </body>
        </html>
      `,
      html: true,
    });

    // Close connection
    await smtp.close();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}