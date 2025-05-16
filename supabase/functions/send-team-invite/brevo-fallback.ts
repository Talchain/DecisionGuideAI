// Brevo API fallback for sending emails when SMTP fails
// This module provides a direct API integration with Brevo's transactional email API

// Define types for better type safety
interface BrevoEmailOptions {
  to: string | string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  from?: { name?: string; email: string };
  replyTo?: { name?: string; email: string };
  tags?: string[];
}

/**
 * Send an email using Brevo's API directly
 * @param apiKey Brevo API key
 * @param options Email options
 * @returns API response
 */
export async function sendEmailViaBrevoApi(
  apiKey: string,
  options: BrevoEmailOptions
): Promise<any> {
  if (!apiKey) {
    throw new Error("Brevo API key is required");
  }

  // Format recipients
  const recipients = Array.isArray(options.to)
    ? options.to.map(email => ({ email }))
    : [{ email: options.to }];

  // Prepare request body
  const body = {
    sender: options.from || { email: "noreply@decisionguide.ai", name: "DecisionGuide.AI" },
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent,
    replyTo: options.replyTo,
    tags: options.tags
  };

  try {
    console.log("[brevo-fallback] Sending email via Brevo API:", {
      to: options.to,
      subject: options.subject.substring(0, 30) + (options.subject.length > 30 ? "..." : ""),
      apiKeyPrefix: apiKey.substring(0, 8) + "..."
    });

    // Make API request
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("[brevo-fallback] Email sent successfully via Brevo API:", data);
    return data;
  } catch (error) {
    console.error("[brevo-fallback] Failed to send email via Brevo API:", error);
    console.error("[brevo-fallback] Error details:", {
      message: error.message,
      status: error.status,
      response: error.response
    });
    throw error;
  }
}

/**
 * Extract Brevo API key from SMTP URL
 * @param smtpUrl SMTP URL containing Brevo credentials
 * @returns API key if found, null otherwise
 */
export function extractBrevoApiKeyFromSmtp(smtpUrl: string): string | null {
  try {
    // Brevo SMTP URLs contain the API key in the format:
    // smtps://username:xsmtpsib-{api-key}-{random}@smtp-relay.brevo.com
    if (!smtpUrl) return null;
    
    // First try the standard format
    let match = smtpUrl.match(/xsmtpsib-([a-f0-9]+)-/i);
    
    if (!match) {
      // Try an alternative format where the API key might be the password directly
      match = smtpUrl.match(/:([a-f0-9]{32,})/i);
    }
    
    if (match && match[1]) {
      const key = match[1];
      console.log("[brevo-fallback] Extracted API key:", {
        keyLength: key.length,
        keyPrefix: key.substring(0, 8) + "..."
      });
      return key;
    }
    
    console.warn("[brevo-fallback] Could not extract API key from SMTP URL");
    return null;
  } catch (e) {
    console.warn("[brevo-fallback] Could not extract API key from SMTP URL:", e);
    return null;
  }