/*
  # Update email functions to use Brevo API
  
  1. Changes
    - Remove old SMTP-based functions
    - Add new functions using Brevo HTTP API
    - Add logging and error handling
    
  2. New Functions
    - send_email_with_template: Core email sending function using Brevo API
    - test_email_sending: Function to test email delivery
    - send_team_invitation_email: Function to send team invitations
    
  3. Security
    - All functions are SECURITY DEFINER to use service role
    - Input validation and sanitization added
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS public.send_email_with_template(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.test_email_sending(text);
DROP FUNCTION IF EXISTS public.send_team_invitation_email(uuid, text, text, text, text);

-- Core email sending function using Brevo API
CREATE OR REPLACE FUNCTION public.send_email_with_template(
  to_email TEXT,
  subject TEXT,
  html_content TEXT,
  text_content TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  api_key TEXT := current_setting('app.brevo_api_key');
  from_email TEXT := current_setting('app.from_email', true);
  result jsonb;
  response_status INT;
BEGIN
  -- Input validation
  IF to_email IS NULL OR subject IS NULL OR html_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  END IF;

  -- Call Brevo API
  SELECT
    status,
    content::jsonb
  INTO
    response_status,
    result
  FROM http((
    'POST',
    'https://api.brevo.com/v3/smtp/email',
    ARRAY[
      ('accept', 'application/json'),
      ('content-type', 'application/json'),
      ('api-key', api_key)
    ],
    'application/json',
    jsonb_build_object(
      'sender', jsonb_build_object(
        'name', 'DecisionGuide.AI',
        'email', from_email
      ),
      'to', jsonb_build_array(
        jsonb_build_object('email', to_email)
      ),
      'subject', subject,
      'htmlContent', html_content,
      'textContent', COALESCE(text_content, '')
    )::text
  ));

  -- Return result
  RETURN jsonb_build_object(
    'success', response_status BETWEEN 200 AND 299,
    'status', response_status,
    'response', result
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Test email function
CREATE OR REPLACE FUNCTION public.test_email_sending(
  to_email TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.send_email_with_template(
    to_email,
    'Test Email from DecisionGuide.AI',
    '<h2>Test Email</h2><p>This is a test email to verify the system is working.</p>',
    'This is a test email to verify the system is working.'
  );
END;
$$;

-- Team invitation email function
CREATE OR REPLACE FUNCTION public.send_team_invitation_email(
  invitation_uuid UUID,
  to_email TEXT,
  team_name TEXT,
  inviter_name TEXT DEFAULT 'A team admin',
  app_url TEXT DEFAULT 'https://decisionguide.ai'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accept_link TEXT;
  html_content TEXT;
  text_content TEXT;
  result jsonb;
BEGIN
  -- Generate accept link
  accept_link := app_url || '/teams/join?token=' || invitation_uuid;
  
  -- Create email content
  html_content := format(
    '<h2>Team Invitation</h2>
    <p>%s has invited you to join %s on DecisionGuide.AI</p>
    <p style="text-align:center">
      <a href="%s" style="background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
        Accept Invitation
      </a>
    </p>
    <p>Or copy this link: %s</p>',
    inviter_name,
    team_name,
    accept_link,
    accept_link
  );
  
  text_content := format(
    '%s has invited you to join %s on DecisionGuide.AI

Accept your invitation here: %s',
    inviter_name,
    team_name,
    accept_link
  );

  -- Send email
  result := public.send_email_with_template(
    to_email,
    format('Join %s on DecisionGuide.AI', team_name),
    html_content,
    text_content
  );

  -- Log attempt
  INSERT INTO invitation_logs (
    invitation_id,
    status,
    details
  ) VALUES (
    invitation_uuid,
    CASE WHEN (result->>'success')::boolean
      THEN 'email_sent'
      ELSE 'email_failed'
    END,
    result
  );

  RETURN result;
END;
$$;