// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL")!;
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create SMTP transporter
const transporter = nodemailer.createTransport(smtpUrl);

// Listen for database changes
Deno.serve(async (req) => {
  try {
    console.log("Edge Function started with environment:", {
      hasSmtpUrl: !!smtpUrl,
      hasFromEmail: !!fromEmail,
      hasAppUrl: !!appUrl,
      appUrl
    });

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

    // Generate invitation token
    const { data: token, error: tokenError } = await supabase
      .rpc('create_invite_link', { decision_id: invitation.team_id });

    if (tokenError) throw tokenError;

    // Generate accept link with token
    const inviteLink = `${appUrl}/decision?inviteToken=${token || invitation.id}`;

    // Send email
    await sendInvitationEmail({
      to: invitation.email,
      teamName: team.name,
      inviteeName: invitation.email.split('@')[0],
      inviterName: `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() || inviter.auth.users.email,
      inviteLink,
    });

    console.log(`Invitation email sent to ${invitation.email} for team ${team.name}`);
  } catch (error) {
    console.error('Error processing invitation:', error);
    throw error;
  }
}

// Process invitation from broadcast payload
async function processInvitationPayload(payload: any) {
  try {
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    
    // Get inviter details
    const { data: inviter, error: inviterError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, auth.users!inner(email)')
      .eq('id', inviter_id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      throw inviterError;
    }

    // Generate invitation token
    const { data: token, error: tokenError } = await supabase
      .rpc('create_invite_link', { decision_id: team_id });

    if (tokenError) {
      console.error('Error creating invite link:', tokenError);
    }

    // Generate accept link with token
    const inviteLink = `${appUrl}/decision?inviteToken=${token || invitation_id}`;

    // Send email
    await sendInvitationEmail({
      to: email,
      teamName: team_name,
      inviteeName: email.split('@')[0],
      inviterName: `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() || inviter.auth.users.email,
      inviteLink,
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
  inviteeName,
  inviterName,
  inviteLink,
}: {
  to: string;
  teamName: string;
  inviteeName: string;
  inviterName: string;
  inviteLink: string;
}) {
  try {
    console.log(`Sending email to ${to} with link ${inviteLink}`);
    
    // HTML email template
    const htmlBody = `
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Hello ${inviteeName},</h2>
    <p>${inviterName} has invited you to join the team <strong>${teamName}</strong> on DecisionGuide.AI.</p>
    <p style="text-align:center; margin:40px 0;">
      <a href="${inviteLink}"
         style="background:#6366F1; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">
        Accept Your Invitation
      </a>
    </p>
    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai/decision">Make better decisions together</a>
    </footer>
  </body>
</html>
    `;

    // Plain text fallback
    const textBody = `
Hello ${inviteeName},

${inviterName} has invited you to join the team "${teamName}" on DecisionGuide.AI.

Accept your invitation:
${inviteLink}

Or paste the URL into your browser.

— The DecisionGuide.AI Team
    `;

    // Verify SMTP connection
    await transporter.verify();

    // Send email
    await transporter.sendMail({
      from: fromEmail,
      to: to,
      subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
      html: htmlBody,
      text: textBody
    });
    
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}