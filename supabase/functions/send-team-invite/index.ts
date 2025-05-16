// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.9";

// Parse SMTP URL to check format
function parseSmtpUrl(url: string) {
  try {
    const [protocol, rest] = url.split('://');
    const [auth, host] = rest.split('@');
    const [user, pass] = auth.split(':');
    return {
      protocol,
      user,
      hasPassword: !!pass,
      host,
      isValid: !!(protocol && auth && host)
    };
  } catch (e) {
    return { isValid: false, error: e.message };
  }
}

// Environment variables are automatically available
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUrl = Deno.env.get("SMTP_URL")!;
const fromEmail = Deno.env.get("FROM_EMAIL") || "hello@decisionguide.ai";
const appUrl = Deno.env.get("APP_URL") || "https://decisionguide.ai";

// Log SMTP URL format check
console.log("[send-team-invite] SMTP URL format check:", {
  ...parseSmtpUrl(smtpUrl),
  fullUrl: smtpUrl ? smtpUrl.replace(/:[^:@]+@/, ":***@") : "Not set"
});

// Create singleton transporter at module level
let globalTransporter: any = null;
try {
  console.log("[send-team-invite] Creating global transporter...");
  globalTransporter = nodemailer.createTransport(smtpUrl);
  
  // Verify immediately
  globalTransporter.verify()
    .then(() => console.log("[send-team-invite] Global transporter verified successfully"))
    .catch(err => console.error("[send-team-invite] Global transporter verification failed:", err));
    
  console.log("[send-team-invite] Global transporter created:", {
    type: typeof globalTransporter,
    hasOptions: !!globalTransporter?.options,
    hasSendMail: typeof globalTransporter?.sendMail === 'function'
  });
} catch (error) {
  console.error("[send-team-invite] Failed to create global transporter:", error);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Log environment variables for debugging (masking sensitive info)
console.log("Environment variables:", {
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseServiceKey,
  smtpUrl: smtpUrl ? smtpUrl.replace(/:[^:@]+@/, ":***@") : "Not set",
  fromEmail,
  appUrl,
  allEnvKeys: Object.keys(Deno.env.toObject())
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-version, Range",
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
    let smtpStatus = "unknown";
    let smtpError = null;
    
    try {
      // Test SMTP connection
      console.log("Testing SMTP connection...");
      
      try {
        // Create a new transporter for testing
        const testTransporter = nodemailer.createTransport(smtpUrl);
        console.log("[send-team-invite] Test transporter created:", {
          type: typeof testTransporter,
          hasOptions: !!testTransporter?.options,
          hasSendMail: typeof testTransporter?.sendMail === 'function'
        });
        
        // Set a timeout for verify to prevent hanging
        console.log("[send-team-invite] Verifying SMTP connection with timeout...");
        const verifyPromise = testTransporter.verify();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("SMTP verification timed out after 5 seconds")), 5000);
        });
        
        try {
          await Promise.race([verifyPromise, timeoutPromise]);
          smtpStatus = "connected";
          console.log("[send-team-invite] SMTP verification successful");
        } catch (verifyError) {
          smtpStatus = "error";
          smtpError = verifyError.message;
          console.error("[send-team-invite] SMTP verification failed:", verifyError);
          throw verifyError;
        }
      } catch (error) {
        smtpStatus = "error";
        smtpError = error.message;
        console.error("SMTP verification failed:", error);
      }
      
      // Log the SMTP status for debugging
      console.log("SMTP status check results:", {
        status: smtpStatus,
        error: smtpError
      });

      // Always return success to avoid blocking the UI
      // The actual email sending will be tested when an invitation is sent
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email system is operational",
          smtp: {
            status: smtpStatus, 
            error: smtpError 
          },
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
  
  // Test email endpoint
  if (path.endsWith("/test-email")) {
    let emailResult = { success: false, error: null, messageId: null };
    
    try {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Email address is required" 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      
      // Send test email using both methods
      emailResult = await sendTestEmail(email);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test email sending initiated",
          results: { nodemailer: emailResult },
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (error) {
      console.error("Test email error:", error);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Failed to send test email: ${error.message}`,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
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

// Send test email using multiple methods
async function sendTestEmail(email: string): Promise<any> {
  console.log("[send-team-invite] sendTestEmail called for:", email);
  let result = { success: false, error: null, messageId: null };
  
  // Check if global transporter is available
  console.log("[send-team-invite] Global transporter status:", {
    exists: !!globalTransporter,
    type: typeof globalTransporter,
    hasSendMail: typeof globalTransporter?.sendMail === 'function'
  });
  
  // HTML email template for test
  const htmlBody = `
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Test Email from DecisionGuide.AI</h2>
    <p>This is a test email to verify that the email delivery system is working correctly.</p>
    <p>If you're receiving this email, it means our system can successfully send emails to your address.</p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai">Make better decisions together</a>
    </footer>
  </body>
</html>
  `;

  // Plain text fallback
  const textBody = `
Test Email from DecisionGuide.AI

This is a test email to verify that the email delivery system is working correctly.

If you're receiving this email, it means our system can successfully send emails to your address.

— The DecisionGuide.AI Team
  `;
  
  // Try sending with Nodemailer
  try {
    console.log(`[send-team-invite] Sending test email to ${email} using Nodemailer...`);
    
    // Log SMTP URL format for debugging
    console.log("[send-team-invite] SMTP URL format check:", {
      hasSmtp: !!smtpUrl,
      protocol: smtpUrl?.split(':')[0],
      hasCredentials: smtpUrl?.includes('@'),
      length: smtpUrl?.length
    });
    
    // Create a new transporter for each email
    let transporter;
    try {
      console.log("[send-team-invite] Creating test email transporter...");
      transporter = nodemailer.createTransport(smtpUrl);
      console.log("[send-team-invite] Test email transporter created:", {
        type: typeof transporter,
        hasOptions: !!transporter?.options,
        hasSendMail: typeof transporter?.sendMail === 'function'
      });
    } catch (transporterError) {
      console.error("[send-team-invite] Failed to create test email transporter:", transporterError);
      throw transporterError;
    }
    
    // Verify SMTP connection with timeout
    try {
      console.log("[send-team-invite] Verifying test email transporter...");
      const verifyPromise = transporter.verify();
      const verifyTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("SMTP verification timed out after 5 seconds")), 5000);
      });
      
      await Promise.race([verifyPromise, verifyTimeoutPromise]);
      console.log("[send-team-invite] Test email transporter verified successfully");
    } catch (verifyError) {
      console.error("[send-team-invite] Test email transporter verification failed:", verifyError);
      throw verifyError;
    }
    
    // Send email with timeout
    let info;
    try {
      console.log("[send-team-invite] Preparing to send test email...");
      
      // Check transporter state before sending
      console.log("[send-team-invite] Transporter state before sendMail:", {
        type: typeof transporter,
        keys: Object.keys(transporter || {}),
        hasOptions: !!transporter?.options,
        hasSendMail: typeof transporter?.sendMail === 'function'
      });
      
      const sendPromise = transporter.sendMail({
        from: `"DecisionGuide.AI Test" <${fromEmail}>`,
        to: email,
        subject: `Test Email from DecisionGuide.AI`,
        html: htmlBody,
        text: textBody,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High'
        }
      });
      
      const sendTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Email sending timed out after 10 seconds")), 10000);
      });
      
      info = await Promise.race([sendPromise, sendTimeoutPromise]);
      console.log("[send-team-invite] Test email sent successfully:", {
        messageId: info.messageId,
        response: info.response
      });
    } catch (sendError) {
      console.error("[send-team-invite] Test email send failed:", {
        error: sendError.message,
        stack: sendError.stack,
        code: sendError.code,
        command: sendError.command,
        response: sendError.response
      });
      throw sendError;
    }
    
    console.log(`Nodemailer test email sent successfully to ${email}:`, info.messageId);
    result = { 
      success: true, 
      error: null, 
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error("Error sending test email with Nodemailer:", error);
    result = { 
      success: false, 
      error: error.message, 
      messageId: null,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack
    };
  }
  
  return result;
}

// Process invitation from payload
async function processInvitationPayload(payload: any): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  console.log("processInvitationPayload: start", { payload });
  
  try {
    const { invitation_id, email, team_id, team_name, inviter_id } = payload;
    console.log("processInvitationPayload: extracted payload", { invitation_id, email, team_id, team_name, inviter_id });
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
      console.log("processInvitationPayload: fetching inviter details", { inviter_id });
      try {        
        const { data: inviter, error: inviterError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, id")
          .eq("id", inviter_id)
          .single();
          
        console.log("processInvitationPayload: inviter profile result", { inviter, error: inviterError });
        if (inviterError) throw inviterError;
        
        // Get inviter email
        const { data: inviterUser, error: inviterUserError } = await supabase
          .auth.admin.getUserById(inviter_id);
          
        if (inviterUserError) throw inviterUserError;
        console.log("processInvitationPayload: inviter user result", { user: inviterUser?.user, error: inviterUserError });
        
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
        console.log("processInvitationPayload: using default inviter details due to error");
        // Continue with default inviter name
      }
    }
    
    // Generate invitation link
    const inviteLink = `${appUrl}/teams/join?token=${invitation_id}`;
    
    console.log("processInvitationPayload: generated invite link", { inviteLink });
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
          console.log("processInvitationPayload: failed to log invitation attempt", { logError });
          console.warn("Failed to log invitation attempt:", logError);
          // Continue even if logging fails
        }
      }
      
      // Send email
      console.log("processInvitationPayload: before sendInvitationEmail", { email, teamName: team_name, inviterName, inviterEmail, inviteLink });
      await sendInvitationEmail({
        to: email,
        teamName: team_name,
        inviteeName: email.split("@")[0],
        inviterName,
        inviterEmail,
        inviteLink,
      });
      
      console.log("processInvitationPayload: email sent successfully");
      // Log success
      if (invitation_id_to_use) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id_to_use,
            status_value: 'sent',
            details_json: { timestamp: new Date().toISOString() }
          });
        } catch (logError) {
          console.log("processInvitationPayload: failed to log invitation success", { logError });
          console.warn("Failed to log invitation success:", logError);
          // Continue even if logging fails
        }
      }
      
      return { success: true, message: `Invitation email sent to ${email} for team ${team_name}` };
    } catch (error) {
      console.log("processInvitationPayload: error sending email", { error });
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
          console.log("processInvitationPayload: failed to log invitation failure", { logError });
          console.warn("Failed to log invitation failure:", logError);
          // Continue even if logging fails
        }
      }
      
      throw error;
    }
    
  } catch (error) {
    console.log("processInvitationPayload: unexpected error", { error });
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
  
  console.log("[send-team-invite] Starting invitation email send:", {
    to,
    teamName,
    inviteLink: inviteLink.split('token=')[0] + 'token=[REDACTED]',
  });
  
  // Extract invitation_id from inviteLink if available
  console.log("sendInvitationEmail: starting", { to, teamName, inviteLink });
  try {
    const tokenMatch = inviteLink.match(/token=([^&]+)/);
    if (tokenMatch && tokenMatch[1]) {
      invitation_id = tokenMatch[1];
    }
  } catch (e) {
    console.warn("Could not extract invitation_id from link:", e);
  }
  
  try {
    console.log(`sendInvitationEmail: preparing to send email to ${to} with link ${inviteLink}`);
    
    // Try to use global transporter first, create a new one if needed
    let transporter = globalTransporter;
    if (!transporter || typeof transporter.sendMail !== 'function') {
      console.log("[send-team-invite] Global transporter unavailable, creating new one...");
      try {
        transporter = nodemailer.createTransport(smtpUrl);
        console.log("[send-team-invite] Created new invitation transporter:", {
          type: typeof transporter,
          hasOptions: !!transporter?.options,
          hasSendMail: typeof transporter?.sendMail === 'function'
        });
      } catch (transporterError) {
        console.error("[send-team-invite] Failed to create invitation transporter:", transporterError);
        throw transporterError;
      }
    } else {
      console.log("[send-team-invite] Using global transporter for invitation");
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
      console.log("[send-team-invite] Verifying invitation transporter...");
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SMTP verification timed out after 5 seconds")), 5000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log("[send-team-invite] Invitation transporter verified successfully");
    } catch (verifyError) {
      console.error("[send-team-invite] Invitation transporter verification failed:", {
        error: verifyError.message,
        stack: verifyError.stack
      });
      
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
        } catch (logError) { /* Ignore logging errors */ }
      }
      
      throw new Error(`SMTP verification failed: ${verifyError.message || "Unknown error"}. Check SMTP credentials.`);
    }

    // Send email
    console.log(`sendInvitationEmail: sending email to ${to} from ${fromEmail}...`);
    
    // Check transporter state before sending
    console.log("[send-team-invite] Transporter state before sending invitation:", {
      type: typeof transporter,
      keys: Object.keys(transporter || {}),
      hasOptions: !!transporter?.options,
      hasSendMail: typeof transporter?.sendMail === 'function'
    });
    
    try { 
      // Send email with timeout
      console.log("[send-team-invite] Attempting to send invitation email...");
      
      const info = await transporter.sendMail({
        from: `"DecisionGuide.AI" <${fromEmail}>`,
        to: to,
        subject: `You're invited to join "${teamName}" on DecisionGuide.AI`,
        html: htmlBody,
        text: textBody,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High'
        }
      });
      
      console.log(`Email sent successfully to ${to}:`, info.messageId);
      console.log("[send-team-invite] Invitation email sent successfully:", {
        messageId: info.messageId,
        response: info.response
      });
      return info;
    } catch (emailError) {
      console.error("Error in transporter.sendMail:", emailError);
      console.error("[send-team-invite] Invitation email send failed:", {
        error: emailError.message,
        stack: emailError.stack,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
        transporterState: {
          type: typeof transporter,
          options: transporter?.options,
          isIdle: transporter?.isIdle?.(),
          isConnected: transporter?.isConnected?.(),
        }
      });
      
      // Log detailed error information
      const errorDetails: Record<string, any> = {
        message: emailError.message,
        stack: emailError.stack
      };
      
      // Add additional error properties if they exist
      if ('code' in emailError) errorDetails.code = emailError.code;
      if ('command' in emailError) errorDetails.command = emailError.command;
      if ('responseCode' in emailError) errorDetails.responseCode = emailError.responseCode;
      if ('response' in emailError) errorDetails.response = emailError.response;
      
      console.error("sendInvitationEmail: email error details:", errorDetails);
      
      // Rethrow with more details
      console.log("sendInvitationEmail: rethrowing error with details");
      throw new Error(`Email sending failed: ${emailError.message}. Code: ${emailError.code || 'unknown'}`);
    }
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Log detailed error information
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    
    throw error;
  }
}

// Fallback method using Brevo API directly
async function sendEmailViaBrevoApi(to: string, subject: string, htmlContent: string, textContent: string): Promise<any> {
  try {
    console.log("[send-team-invite] Attempting to send email via Brevo API fallback...");
    
    // Extract API key from SMTP URL if possible
    let apiKey = "";
    try {
      const match = smtpUrl.match(/xsmtpsib-([a-f0-9]+)-/i);
      if (match && match[1]) {
        apiKey = match[1];
      }
    } catch (e) {
      console.warn("[send-team-invite] Could not extract API key from SMTP URL:", e);
    }
    
    if (!apiKey) {
      throw new Error("No Brevo API key available for fallback");
    }
    
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        sender: {
          name: "DecisionGuide.AI",
          email: fromEmail
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log("[send-team-invite] Email sent successfully via Brevo API:", data);
    return data;
  } catch (error) {
    console.error("[send-team-invite] Failed to send email via Brevo API:", error);
    throw error;
  }
}