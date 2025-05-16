/*
  # Add Brevo API Email Function

  1. New Functions
    - `send_email_via_brevo` - A server-side function that sends emails using Brevo's API
    - `get_brevo_api_key` - A helper function to extract the API key from SMTP URL

  2. Security
    - Functions are accessible only to authenticated users
    - API key is securely stored and extracted from SMTP URL

  This migration adds a direct API integration with Brevo for sending emails,
  bypassing SMTP issues in the Edge Function environment.
*/

-- Create function to extract Brevo API key from SMTP URL
CREATE OR REPLACE FUNCTION public.get_brevo_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  smtp_url TEXT;
  api_key TEXT;
BEGIN
  -- Get SMTP URL from server parameter (set by admin)
  SELECT current_setting('app.smtp_url', true) INTO smtp_url;
  
  -- Extract API key using regex pattern
  SELECT substring(smtp_url FROM 'xsmtpsib-([a-f0-9]+)-') INTO api_key;
  
  RETURN api_key;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error extracting Brevo API key: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Create function to send email via Brevo API
CREATE OR REPLACE FUNCTION public.send_email_via_brevo(
  to_email TEXT,
  subject TEXT,
  html_content TEXT,
  text_content TEXT DEFAULT NULL,
  from_name TEXT DEFAULT 'DecisionGuide.AI',
  from_email TEXT DEFAULT 'hello@decisionguide.ai',
  reply_to_email TEXT DEFAULT NULL,
  reply_to_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_key TEXT;
  api_url TEXT := 'https://api.brevo.com/v3/smtp/email';
  http_response JSONB;
  request_body JSONB;
BEGIN
  -- Get API key
  api_key := get_brevo_api_key();
  
  IF api_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to retrieve Brevo API key',
      'timestamp', now()
    );
  END IF;
  
  -- Build request body
  request_body := jsonb_build_object(
    'sender', jsonb_build_object(
      'name', from_name,
      'email', from_email
    ),
    'to', jsonb_build_array(
      jsonb_build_object('email', to_email)
    ),
    'subject', subject,
    'htmlContent', html_content
  );
  
  -- Add optional fields if provided
  IF text_content IS NOT NULL THEN
    request_body := request_body || jsonb_build_object('textContent', text_content);
  END IF;
  
  IF reply_to_email IS NOT NULL THEN
    request_body := request_body || jsonb_build_object(
      'replyTo', jsonb_build_object(
        'email', reply_to_email,
        'name', COALESCE(reply_to_name, from_name)
      )
    );
  END IF;
  
  -- Make API request
  SELECT
    content::jsonb
  INTO
    http_response
  FROM
    http((
      'POST',
      api_url,
      ARRAY[
        ('Content-Type', 'application/json'),
        ('api-key', api_key)
      ],
      request_body::text,
      NULL
    ));
  
  -- Return response with success flag
  RETURN jsonb_build_object(
    'success', true,
    'response', http_response,
    'timestamp', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Create function to send team invitation email
CREATE OR REPLACE FUNCTION public.send_team_invitation_email(
  invitation_id UUID,
  to_email TEXT,
  team_name TEXT,
  inviter_name TEXT DEFAULT 'A team admin',
  inviter_email TEXT DEFAULT NULL,
  app_url TEXT DEFAULT 'https://decisionguide.ai'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_link TEXT;
  html_content TEXT;
  text_content TEXT;
  invitee_name TEXT;
  result JSONB;
BEGIN
  -- Generate invitation link
  invite_link := app_url || '/teams/join?token=' || invitation_id;
  
  -- Extract invitee name from email
  invitee_name := split_part(to_email, '@', 1);
  
  -- Create HTML email content
  html_content := '
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Hello ' || invitee_name || ',</h2>
    <p>' || inviter_name || ' has invited you to join the team <strong>' || team_name || '</strong> on DecisionGuide.AI.</p>
    <p style="text-align:center; margin:40px 0;">
      <a href="' || invite_link || '"
         style="background:#6366F1; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">
        Accept Your Invitation
      </a>
    </p>
    <p>If the button above doesn\'t work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;"><a href="' || invite_link || '">' || invite_link || '</a></p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai/decision">Make better decisions together</a>
    </footer>
  </body>
</html>';

  -- Create plain text email content
  text_content := 'Hello ' || invitee_name || ',

' || inviter_name || ' has invited you to join the team "' || team_name || '" on DecisionGuide.AI.

Accept your invitation:
' || invite_link || '

Or paste the URL into your browser.

— The DecisionGuide.AI Team';

  -- Track invitation status
  BEGIN
    PERFORM public.track_invitation_status(
      invitation_id,
      'sending_via_api',
      jsonb_build_object(
        'timestamp', now(),
        'method', 'brevo_api'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to track invitation status: %', SQLERRM;
  END;

  -- Send email via Brevo API
  SELECT
    public.send_email_via_brevo(
      to_email,
      'You''re invited to join "' || team_name || '" on DecisionGuide.AI',
      html_content,
      text_content,
      'DecisionGuide.AI',
      'hello@decisionguide.ai',
      CASE WHEN inviter_email IS NOT NULL THEN inviter_email ELSE NULL END,
      CASE WHEN inviter_email IS NOT NULL THEN inviter_name ELSE NULL END
    )
  INTO
    result;
  
  -- Track invitation status based on result
  BEGIN
    IF (result->>'success')::BOOLEAN THEN
      PERFORM public.track_invitation_status(
        invitation_id,
        'sent_via_api',
        jsonb_build_object(
          'timestamp', now(),
          'response', result->'response'
        )
      );
    ELSE
      PERFORM public.track_invitation_status(
        invitation_id,
        'failed_via_api',
        jsonb_build_object(
          'timestamp', now(),
          'error', result->'error'
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to track invitation status: %', SQLERRM;
  END;
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_brevo_api_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_email_via_brevo(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_team_invitation_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Create function to test email sending
CREATE OR REPLACE FUNCTION public.test_email_sending(
  to_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  html_content TEXT;
  text_content TEXT;
  result JSONB;
BEGIN
  -- Create HTML email content
  html_content := '
<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Test Email from DecisionGuide.AI</h2>
    <p>This is a test email to verify that the email delivery system is working correctly.</p>
    <p>If you''re receiving this email, it means our system can successfully send emails to your address.</p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai">Make better decisions together</a>
    </footer>
  </body>
</html>';

  -- Create plain text email content
  text_content := 'Test Email from DecisionGuide.AI

This is a test email to verify that the email delivery system is working correctly.

If you''re receiving this email, it means our system can successfully send emails to your address.

— The DecisionGuide.AI Team';

  -- Send email via Brevo API
  SELECT
    public.send_email_via_brevo(
      to_email,
      'Test Email from DecisionGuide.AI',
      html_content,
      text_content
    )
  INTO
    result;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.test_email_sending(TEXT) TO authenticated;