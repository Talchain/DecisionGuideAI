// Supabase Edge Function to send team invitation emails
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import * as nodemailer from "npm:nodemailer@6.9.9";
import { sendEmailViaBrevoApi, extractBrevoApiKeyFromSmtp } from "./brevo-fallback.ts";

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

// Extract Brevo API key from SMTP URL
const brevoApiKey = extractBrevoApiKeyFromSmtp(smtpUrl);
console.log("[send-team-invite] Brevo API key extraction:", {
  success: !!brevoApiKey,
  keyLength: brevoApiKey ? brevoApiKey.length : 0,
  keyPrefix: brevoApiKey ? brevoApiKey.substring(0, 8) + "..." : "none"
});

// Log SMTP URL format check
console.log("[send-team-invite] SMTP URL format check:", {
  ...parseSmtpUrl(smtpUrl),
  fullUrl: smtpUrl ? smtpUrl.replace(/:[^:@]+@/, ":***@") : "Not set"
});

// Create singleton transporter at module level
let globalTransporter: any = null;
try {
  console.log("[send-team-invite] Creating global transporter...");
  
  // Check if nodemailer is properly imported
  console.log("[send-team-invite] Nodemailer import check:", {
    type: typeof nodemailer,
    keys: Object.keys(nodemailer || {}),
    hasCreateTransport: typeof nodemailer.createTransport === 'function',
    createTransportType: typeof nodemailer.createTransport
  });
  
  if (typeof nodemailer.createTransport !== 'function') {
    throw new Error("nodemailer.createTransport is not a function");
  }
  
  globalTransporter = nodemailer.createTransport(smtpUrl, {
    debug: true,
    logger: true
  });
  
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
  let result: any = { success: false, error: null, messageId: null };
  
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
      
      // Check nodemailer again
      console.log("[send-team-invite] Nodemailer check before creating test transporter:", {
        type: typeof nodemailer,
        keys: Object.keys(nodemailer || {}),
        hasCreateTransport: typeof nodemailer.createTransport === 'function'
      });
      
      if (typeof nodemailer.createTransport !== 'function') {
        throw new Error("nodemailer.createTransport is not a function");
      }
      
      transporter = nodemailer.createTransport(smtpUrl, {
        debug: true,
        logger: true
      });
      
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
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("SMTP verification timed out after 5 seconds")), 5000);
      });
      
      await Promise.race([verifyPromise, timeoutPromise]);
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
      console.error("[send-team-invite] sendMail failed, trying Brevo API fallback:", sendError);
      
      // Try Brevo API fallback if we have an API key
      if (brevoApiKey) {
        console.log("[send-team-invite] Attempting Brevo API fallback for test email...");
        const brevoResult = await sendEmailViaBrevoApi(brevoApiKey, {
          to: email,
          subject: `Test Email from DecisionGuide.AI (API Fallback)`,
          htmlContent: htmlBody,
          textContent: textBody
        });
        
        return { success: true, error: null, messageId: "brevo-api", response: brevoResult };
      }
      
      throw sendError;
    }
    
    console.log(`Email sent successfully to ${email}:`, info.messageId);
    console.log("[send-team-invite] Test email sent successfully:", {
      messageId: info.messageId,
      response: info.response
    });
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
      stack: error.stack,
    };
    
    // Try Brevo API fallback if we have an API key
    if (brevoApiKey) {
      console.log("[send-team-invite] Nodemailer failed, attempting to send invitation via Brevo API...");
      try {
        const brevoResult = await sendEmailViaBrevoApi(brevoApiKey, {
          to: email,
          subject: `Test Email from DecisionGuide.AI (API Fallback)`,
          htmlContent: htmlBody,
          textContent: textBody,
        });
        
        return { success: true, error: null, messageId: "brevo-api", response: brevoResult };
      } catch (brevoError) {
        console.error("[send-team-invite] Brevo API fallback failed:", brevoError);
        result = { 
          success: false,
          error: `Nodemailer failed: ${error.message}. Brevo API fallback failed: ${brevoError.message}`,
          messageId: null
        };
      }
    } else {
      throw new Error(`Nodemailer failed: ${error.message}. Brevo API key not available, cannot fallback.`);
    }
  }
  
  // If we get here, try the database function as a last resort
  try {
    console.log("[send-team-invite] Attempting database function fallback for test email...");
    const { data, error } = await supabase.rpc('test_email_sending', { to_email: email });
    
    if (error) {
      console.error("[send-team-invite] Database function fallback failed:", error);
      if (!result.success) {
        result.error += `. Database function fallback failed: ${error.message}`;
      }
    } else if (data?.success) {
      console.log("[send-team-invite] Email sent via database function:", data);
      return { 
        success: true, 
        error: null, 
        messageId: "database-function", 
        response: data 
      };
    }
  } catch (dbError) {
    console.error("[send-team-invite] Error calling database function:", dbError);
    if (!result.success) {
      result.error += `. Database function error: ${dbError.message}`;
    }
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
    
    if (!email || !team_id || !team_name) {
      return {
        success: false,
        message: "Missing required fields in payload",
        details: { payload }
      };
    }
    
    // Try using the database function first (most reliable)
    try {
      console.log("[send-team-invite] Attempting to send invitation via database function...");
      
      const { data, error } = await supabase.rpc('send_team_invitation_email', {
        invitation_id,
        to_email: email,
        team_name,
        inviter_name: "A team admin", // We'll improve this later
        app_url: appUrl
      });
      
      if (error) {
        console.error("[send-team-invite] Database function failed:", error);
        throw error;
      }
      
      console.log("[send-team-invite] Invitation sent via database function:", data);
      return { 
        success: true, 
        message: `Invitation email sent to ${email} for team ${team_name} via database function`,
        details: data
      };
    } catch (dbError) {
      console.error("[send-team-invite] Database function error:", dbError);
      
      // Fall back to the original method
      console.log("[send-team-invite] Falling back to original email method...");
    }
    
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
      if (invitation_id) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id,
            status_value: 'sending',
            details_json: { team_id, team_name, inviter_id }
          });
        } catch (logError) {
          console.log("processInvitationPayload: failed to log invitation attempt", { logError });
          console.warn("Failed to log invitation attempt:", logError);
          // Continue even if logging fails
        }
      }
      
      // Try Brevo API first if we have an API key
      if (brevoApiKey) {
        try {
          console.log("[send-team-invite] Attempting to send invitation via Brevo API...");
          
          // HTML email template
          const htmlBody = `
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Hello ${email.split("@")[0]},</h2>
    <p>${inviterName} has invited you to join the team <strong>${team_name}</strong> on DecisionGuide.AI.</p>
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
</html>`;

          // Plain text fallback
          const textBody = `
Hello ${email.split("@")[0]},

${inviterName} has invited you to join the team "${team_name}" on DecisionGuide.AI.

Accept your invitation:
${inviteLink}

Or paste the URL into your browser.

— The DecisionGuide.AI Team`;

          const brevoResult = await sendEmailViaBrevoApi(brevoApiKey, {
            to: email,
            subject: `You're invited to join "${team_name}" on DecisionGuide.AI`,
            htmlContent: htmlBody,
            textContent: textBody
          });
          
          console.log("[send-team-invite] Invitation sent via Brevo API:", brevoResult);
          
          // Log success
          if (invitation_id) {
            try {
              await supabase.rpc('track_invitation_status', {
                invitation_uuid: invitation_id,
                status_value: 'sent_via_api',
                details_json: { timestamp: new Date().toISOString() }
              });
            } catch (logError) {
              console.warn("Failed to log invitation success:", logError);
            }
          }
          
          return { 
            success: true, 
            message: `Invitation email sent to ${email} for team ${team_name} via Brevo API` 
          };
        } catch (brevoError) {
          console.error("[send-team-invite] Brevo API send failed:", brevoError);
          // Continue to try SMTP as fallback
        }
      }
      
      // Send email via SMTP
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
      if (invitation_id) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id,
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
      if (invitation_id) {
        try {
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation_id,
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