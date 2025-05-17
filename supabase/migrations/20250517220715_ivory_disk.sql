/*
  # Fix Email System Functions

  1. Email Functions
    - Properly drop existing functions with exact parameter signatures
    - Create email sending functions with proper parameter types
    - Add template variable replacement
    
  2. Invitation Functions
    - Fix team invitation email sending
    - Add proper error handling and logging
*/

-- Drop existing functions with exact parameter signatures to avoid "function not unique" errors
DROP FUNCTION IF EXISTS public.send_email_with_template(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.test_email_sending(text);
DROP FUNCTION IF EXISTS public.send_team_invitation_email(uuid, text, text, text, text);

-- Function to send an email using Brevo API
CREATE FUNCTION public.send_email_with_template(
  p_to TEXT,
  p_subject TEXT,
  p_template_name TEXT,
  p_template_data JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_api_key TEXT;
  v_from_email TEXT;
  v_from_name TEXT;
  v_html_content TEXT;
  v_text_content TEXT;
  v_response JSONB;
  v_status INTEGER;
  v_error TEXT;
  v_template RECORD;
  v_key TEXT;
  v_value TEXT;
  v_keys_values RECORD;
BEGIN
  -- Get API key from environment
  v_api_key := current_setting('app.settings.brevo_api_key', true);
  IF v_api_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing email credentials: API key not configured'
    );
  END IF;

  -- Get from email
  v_from_email := current_setting('app.settings.from_email', true);
  IF v_from_email IS NULL THEN
    v_from_email := 'noreply@decisionguide.ai';
  END IF;
  
  v_from_name := 'DecisionGuide.AI';
  
  -- Get template content
  SELECT html, txt INTO v_template 
  FROM public.email_templates 
  WHERE name = p_template_name;
  
  IF NOT FOUND THEN
    -- Use default template if not found
    v_html_content := '<html><body><h1>' || p_subject || '</h1><p>This is an automated email from DecisionGuide.AI.</p></body></html>';
    v_text_content := p_subject || '\n\nThis is an automated email from DecisionGuide.AI.';
  ELSE
    v_html_content := v_template.html;
    v_text_content := v_template.txt;
    
    -- Replace template variables
    IF p_template_data IS NOT NULL AND jsonb_typeof(p_template_data) = 'object' THEN
      FOR v_keys_values IN SELECT * FROM jsonb_each_text(p_template_data)
      LOOP
        v_key := v_keys_values.key;
        v_value := v_keys_values.value;
        v_html_content := replace(v_html_content, '{{' || v_key || '}}', v_value);
        v_text_content := replace(v_text_content, '{{' || v_key || '}}', v_value);
      END LOOP;
    END IF;
  END IF;
  
  -- Call Brevo API
  SELECT
    status,
    content::jsonb,
    CASE WHEN status >= 400 THEN content ELSE NULL END
  INTO
    v_status,
    v_response,
    v_error
  FROM
    http((
      'POST',
      'https://api.brevo.com/v3/smtp/email',
      ARRAY[
        http_header('api-key', v_api_key),
        http_header('Content-Type', 'application/json'),
        http_header('Accept', 'application/json')
      ],
      'application/json',
      jsonb_build_object(
        'sender', jsonb_build_object('email', v_from_email, 'name', v_from_name),
        'to', jsonb_build_array(jsonb_build_object('email', p_to)),
        'subject', p_subject,
        'htmlContent', v_html_content,
        'textContent', v_text_content
      )::text
    ));
  
  IF v_status >= 400 OR v_error IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_error, 'API error: ' || v_status::text),
      'status_code', v_status
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message_id', COALESCE((v_response->>'messageId')::text, 'unknown'),
    'response', v_response
  );
END;
$$;

-- Grant execute permission to authenticated users with explicit parameter types
GRANT EXECUTE ON FUNCTION public.send_email_with_template(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_email_with_template(TEXT, TEXT, TEXT, JSONB) TO anon;

-- Function to test email sending
CREATE FUNCTION public.test_email_sending(
  to_email TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validate email
  IF to_email IS NULL OR to_email = '' OR to_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email address'
    );
  END IF;
  
  -- Send test email
  v_result := public.send_email_with_template(
    to_email,
    'Test Email from DecisionGuide.AI',
    'test_email',
    jsonb_build_object(
      'timestamp', now()::text,
      'recipient', to_email
    )
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users with explicit parameter types
GRANT EXECUTE ON FUNCTION public.test_email_sending(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_email_sending(TEXT) TO anon;

-- Function to send team invitation email
CREATE FUNCTION public.send_team_invitation_email(
  invitation_uuid UUID,
  to_email TEXT,
  team_name TEXT,
  inviter_name TEXT DEFAULT 'A team admin',
  app_url TEXT DEFAULT 'https://decisionguide.ai'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_accept_link TEXT;
BEGIN
  -- Validate inputs
  IF invitation_uuid IS NULL OR to_email IS NULL OR team_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  END IF;
  
  -- Create accept link
  v_accept_link := app_url || '/teams/join?token=' || invitation_uuid::text;
  
  -- Track invitation status
  PERFORM public.track_invitation_status(
    invitation_uuid,
    'sending',
    jsonb_build_object(
      'team_name', team_name,
      'inviter_name', inviter_name,
      'timestamp', now()::text
    )
  );
  
  -- Send invitation email
  v_result := public.send_email_with_template(
    to_email,
    'You''ve been invited to join ' || team_name || ' on DecisionGuide.AI',
    'team_invitation',
    jsonb_build_object(
      'team_name', team_name,
      'inviter_name', inviter_name,
      'accept_link', v_accept_link,
      'recipient_name', split_part(to_email, '@', 1)
    )
  );
  
  -- Track invitation status
  IF (v_result->>'success')::boolean THEN
    PERFORM public.track_invitation_status(
      invitation_uuid,
      'sent',
      jsonb_build_object(
        'message_id', v_result->>'message_id',
        'timestamp', now()::text
      )
    );
  ELSE
    PERFORM public.track_invitation_status(
      invitation_uuid,
      'failed',
      jsonb_build_object(
        'error', v_result->>'error',
        'timestamp', now()::text
      )
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users with explicit parameter types
GRANT EXECUTE ON FUNCTION public.send_team_invitation_email(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_team_invitation_email(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;

-- Create default email templates if they don't exist
INSERT INTO public.email_templates (name, html, txt)
VALUES 
('test_email', 
'<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Test Email from DecisionGuide.AI</h2>
    <p>This is a test email to verify that the email delivery system is working correctly.</p>
    <p>If you''re receiving this email, it means our system can successfully send emails to your address.</p>
    <p>Timestamp: {{timestamp}}</p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai">Make better decisions together</a>
    </footer>
  </body>
</html>', 
'Test Email from DecisionGuide.AI

This is a test email to verify that the email delivery system is working correctly.

If you''re receiving this email, it means our system can successfully send emails to your address.

Timestamp: {{timestamp}}

— The DecisionGuide.AI Team')
ON CONFLICT (name) DO UPDATE 
SET 
  html = EXCLUDED.html,
  txt = EXCLUDED.txt,
  updated_at = now();

INSERT INTO public.email_templates (name, html, txt)
VALUES 
('team_invitation', 
'<html>
  <body style="font-family: sans-serif; line-height:1.6; color:#333;">
    <h2>Hello {{recipient_name}},</h2>
    <p>{{inviter_name}} has invited you to join the team <strong>{{team_name}}</strong> on DecisionGuide.AI.</p>
    <p style="text-align:center; margin:40px 0;">
      <a href="{{accept_link}}"
         style="background:#6366F1; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">
        Accept Your Invitation
      </a>
    </p>
    <p>If the button above doesn''t work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;"><a href="{{accept_link}}">{{accept_link}}</a></p>
    <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
    <footer style="font-size:12px; color:#888;">
      DecisionGuide.AI · <a href="https://decisionguide.ai/decision">Make better decisions together</a>
    </footer>
  </body>
</html>', 
'Hello {{recipient_name}},

{{inviter_name}} has invited you to join the team "{{team_name}}" on DecisionGuide.AI.

Accept your invitation:
{{accept_link}}

Or paste the URL into your browser.

— The DecisionGuide.AI Team')
ON CONFLICT (name) DO UPDATE 
SET 
  html = EXCLUDED.html,
  txt = EXCLUDED.txt,
  updated_at = now();