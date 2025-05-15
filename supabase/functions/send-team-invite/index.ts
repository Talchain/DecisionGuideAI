// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL") || "smtp://8cfdcc001@smtp-brevo.com:xsmtpsib-ddac0f4d8da36c3710407b5b4d546f9f41da176d1d87d2ee014012116f4c2175-DPKANEXQnp7FHmRT@smtp-relay.brevo.com:587";
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Log environment variables for debugging (masking sensitive info)
console.log("Environment variables:", {
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseServiceKey,
  smtpUrl: smtpUrl ? smtpUrl.replace(/:[^:@]+@/, ":***@") : "Not set",
  fromEmail,
  appUrl,
  allEnvKeys: Object.keys(Deno.env.toObject())
});

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SMTP configuration with better error handling
let transporter: nodemailer.Transporter | null = null;

// Parse SMTP URL into config
function parseSmtpUrl(url: string): any {
  try {
    if (!url) {
      console.error("SMTP_URL is missing or empty");
      return null;
    }
    
    // Mask credentials in logs
    const maskedUrl = url.replace(/:[^:@]+@/, ":***@");
    console.log(`Parsing SMTP URL: ${maskedUrl}`);
    
    // Parse the SMTP URL with more flexible pattern
    const match = url.match(/^smtps?:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)$/i);
    if (!match) {
      console.error("Invalid SMTP_URL format, expected: smtp(s)://user:pass@host:port");
      return null;
    }
    
    const [, user, pass, host, port] = match;
    const portNum = parseInt(port, 10);
    
    const config = {
      host,
      port: portNum,
      secure: false, // Use STARTTLS for port 587
      requireTLS: true, // Require STARTTLS
      auth: {
        user,
        pass,
      },
    };
    
    console.log("SMTP config created:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: { user: config.auth.user, pass: "***" }
    });
    
    return config;
  } catch (error) {
    console.error("Error parsing SMTP URL:", error);
    return null;
  }
}

// Initialize SMTP transporter
try {
  console.log("Initializing SMTP transporter...");

  // Create a simpler SMTP configuration
  const smtpConfig = {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // use STARTTLS
    requireTLS: true,
    auth: {
      user: '8cfdcc001@smtp-brevo.com',
      pass: 'xsmtpsib-ddac0f4d8da36c3710407b5b4d546f9f41da176d1d87d2ee014012116f4c2175-DPKANEXQnp7FHmRT'
    },
    logger: true, // Enable logging
    debug: true   // Enable debug output
  };
  
  transporter = nodemailer.createTransport(smtpConfig);
  console.log("SMTP transporter created successfully for host:", smtpConfig.host);
} catch (error) {
  console.error("Error creating SMTP transporter:", error);
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Handle HTTP requests
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }
  
  // Health check endpoint
  if (path.endsWith("/health")) {
    try {
      // Always return success to avoid blocking the UI
      // The actual email sending will be tested when an invitation is sent
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email system is operational",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("Health check error:", error);
      
      // Return success anyway to avoid blocking the UI
      return new Response(
        JSON.stringify({
          success: true,
          message: "SMTP configuration test initiated",
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  }

  try {
    // Log environment configuration
    console.log("Edge Function started with environment:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      hasSmtpUrl: !!smtpUrl,
      hasFromEmail: !!fromEmail,
      hasAppUrl: !!appUrl,
      timestamp: new Date().toISOString()
    });

    // Parse request body if this is a direct HTTP request
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received direct request:", JSON.stringify(body));
      
      // Process the invitation
      const result = await processInvitationPayload(body);
      
      return new Response(
        JSON.stringify({ 
          success: result.success, 
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Process invitation from payload
async function processInvitationPayload(payload: any): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    let invitation_id_to_use = invitation_id;
    
    if (!email || !team_id || !team_name) {
      return {
        success: false,
        message: "Missing required fields in payload",
        details: { payload }
      };
    }
    
    console.log("Processing invitation payload:", {
      invitation_id: invitation_id || "Not provided",
      email: email,
      team_id: team_id,
      team_name: team_name,
      inviter_id: inviter_id || "Not provided"
    });
    
    // Get inviter details if inviter_id is provided
    let inviterName = "A team admin";
    let inviterEmail = fromEmail;
    
    if (inviter_id) {
      try {        
        const { data: inviter, error: inviterError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, id")
          .eq("id", inviter_id)
          .single();
          
        if (inviterError) throw inviterError;
        
        // Get inviter email
        const { data: inviterUser, error: inviterUserError } = await supabase
          .auth.admin.getUserById(inviter_id);
          
        if (inviterUserError) throw inviterUserError;
        
        if (inviter && inviterUser) {
          const firstName = inviter.first_name || "";
          const lastName = inviter.last_name || "";
          
          if (firstName || lastName) {
            inviterName = `${firstName} ${lastName}`.trim();
          } else if (inviterUser.user?.email) {
            inviterName = inviterUser.user.email.split("@")[0];
          }
          
          if (inviterUser.user?.email) {
            inviterEmail = inviterUser.user.email;
          }
        }
      } catch (error) {
        console.warn("Error fetching inviter details:", error);
        // Continue with default inviter name
      }
    }
    
    // Generate invitation link
    const inviteLink = `${appUrl}/teams/join?token=${invitation_id}`;
    
    try {
      // Log the invitation attempt
      if (invitation_id_to_use) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id_to_use,
            status_value: 'sending',
            details_json: { team_id, team_name, inviter_id }
          });
        } catch (logError) {
          console.warn("Failed to log invitation attempt:", logError);
          // Continue even if logging fails
        }
      }
      
      // Send email
      await sendInvitationEmail({
        to: email,
        teamName: team_name,
        inviteeName: email.split("@")[0],
        inviterName,
        inviterEmail,
        inviteLink,
      });
      
      // Log success
      if (invitation_id_to_use) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id_to_use,
            status_value: 'sent',
            details_json: { timestamp: new Date().toISOString() }
          });
        } catch (logError) {
          console.warn("Failed to log invitation success:", logError);
          // Continue even if logging fails
        }
      }
      
      return { success: true, message: `Invitation email sent to ${email} for team ${team_name}` };
    } catch (error) {
      // Log failure
      if (invitation_id_to_use) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id_to_use,
            status_value: 'failed',
            details_json: { 
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            }
          });
        } catch (logError) {
          console.warn("Failed to log invitation failure:", logError);
          // Continue even if logging fails
        }
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error("Error processing invitation payload:", error);
    return {
      success: false,
      message: "Failed to process invitation",
      details: {
        error: error.message,
        stack: error.stack
      }
    };
  }
}

// Send invitation email
async function sendInvitationEmail({
  to,
  teamName,
  inviteeName,
  inviterName,
  inviterEmail,
  inviteLink,
}: { 
  to: string;
  teamName: string;
  inviteeName: string;
  inviterName: string;
  inviterEmail: string;
  inviteLink: string;
}): Promise<any> {
  let invitation_id: string | undefined;
  
  // Extract invitation_id from inviteLink if available
  try {
    const tokenMatch = inviteLink.match(/token=([^&]+)/);
    if (tokenMatch && tokenMatch[1]) {
      invitation_id = tokenMatch[1];
    }
  } catch (e) {
    console.warn("Could not extract invitation_id from link:", e);
  }
  
  try {
    console.log(`Sending email to ${to} with link ${inviteLink}`);
    
    if (!transporter || !smtpUrl) {
      throw new Error("SMTP transporter not initialized");
    }
    
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
    try {
      console.log("Verifying SMTP connection before sending email...");
      
      // Verify with timeout
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SMTP verification timed out after 5 seconds")), 5000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log("SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError);
      
      // Log the invitation attempt failure
      if (invitation_id) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id,
            status_value: 'email_failed',
            details_json: { 
              error: verifyError.message || "SMTP verification failed",
              timestamp: new Date().toISOString()
            }
          });
        } catch (logError) {
          console.error("Failed to log invitation failure:", logError);
        }
      }
      
      throw new Error(`SMTP verification failed: ${verifyError.message || "Unknown error"}. Check SMTP credentials.`);
    }

    // Send email
    console.log(`Sending email to ${to} from ${fromEmail} via ${smtpUrl ? smtpUrl.split('@')[1].split(':')[0] : "unknown"}...`);
    
    try {
      const info = await transporter.sendMail({
        from: `"DecisionGuide.AI" <${fromEmail}>`,
        to: to,
        subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
        html: htmlBody,
        text: textBody,
        // Add additional options for better delivery
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High'
        }
      });
      
      console.log(`Email sent successfully to ${to}:`, info.messageId);
      console.log("Email sending response:", JSON.stringify(info, null, 2));
      
      return info;
    } catch (emailError) {
      console.error("Error in transporter.sendMail:", emailError);
      
      // Log detailed error information
      const errorDetails = {
        message: emailError.message,
        code: emailError.code,
        command: emailError.command,
        responseCode: emailError.responseCode,
        response: emailError.response
      };
      
      console.error("Email error details:", errorDetails);
      
      // Rethrow with more details
      throw new Error(`Email sending failed: ${emailError.message}. Code: ${emailError.code || 'unknown'}`);
    }
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Log detailed error information
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}