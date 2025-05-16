/*
  # Add Email Functions
  
  1. New Functions
    - get_brevo_api_key() - Extracts API key from SMTP URL
    - send_email_via_brevo() - Sends emails using Brevo API
    - send_team_invitation_email() - Sends team invitations
    - test_email_sending() - Tests email system
  
  2. Security
    - All functions are SECURITY DEFINER
    - Execute permissions granted to service_role
    - test_email_sending() accessible to authenticated users
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
  html_content := format(
    E'<html>\n  <body style="font-family: sans-serif; line-height:1.6; color:#333;">\n    <h2>Hello %s,</h2>\n    <p>%s has invited you to join the team <strong>%s</strong> on DecisionGuide.AI.</p>\n    <p style="text-align:center; margin:40px 0;">\n      <a href="%s"\n         style="background:#6366F1; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">\n        Accept Your Invitation\n      </a>\n    </p>\n    <p>If the button above doesn''t work, copy and paste this URL into your browser:</p>\n    <p style="word-break:break-all;"><a href="%s">%s</a></p>\n    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />\n    <footer style="font-size:12px; color:#888;">\n      DecisionGuide.AI · <a href="https://decisionguide.ai/decision">Make better decisions together</a>\n    </footer>\n  </body>\n</html>',
    invitee_name, inviter_name, team_name, invite_link, invite_link, invite_link
  );

  -- Create plain text email content
  text_content := format(
    E'Hello %s,\n\n%s has invited you to join the team "%s" on DecisionGuide.AI.\n\nAccept your invitation:\n%s\n\nOr paste the URL into your browser.\n\n— The DecisionGuide.AI Team',
    invitee_name, inviter_name, team_name, invite_link
  );

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
      RAISE WARNING E'Failed to track invitation status: %', SQLERRM;
  END;

  -- Send email via Brevo API
  SELECT
    public.send_email_via_brevo(
      to_email,
      format('You''re invited to join "%s" on DecisionGuide.AI', team_name),
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
      RAISE WARNING E'Failed to track invitation status: %', SQLERRM;
  END;
  
  RETURN result;
END;
$$;

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
  html_content := E'<html>\n  <body style="font-family: sans-serif; line-height:1.6; color:#333;">\n    <h2>Test Email from DecisionGuide.AI</h2>\n    <p>This is a test email to verify that the email delivery system is working correctly.</p>\n    <p>If you''re receiving this email, it means our system can successfully send emails to your address.</p>\n    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />\n    <footer style="font-size:12px; color:#888;">\n      DecisionGuide.AI · <a href="https://decisionguide.ai">Make better decisions together</a>\n    </footer>\n  </body>\n</html>';

  -- Create plain text email content
  text_content := E'Test Email from DecisionGuide.AI\n\nThis is a test email to verify that the email delivery system is working correctly.\n\nIf you''re receiving this email, it means our system can successfully send emails to your address.\n\n— The DecisionGuide.AI Team';

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_brevo_api_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_email_via_brevo(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_team_invitation_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_email_sending(TEXT) TO authenticated;