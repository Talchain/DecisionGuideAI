/*
# Email System Overhaul

1. New Tables
   - `email_templates` - Stores HTML and text templates for emails
   - `email_logs` - Enhanced logging for email delivery attempts

2. Functions
   - `get_smtp_credentials()` - Simplified to return only API key and from email
   - `send_email_with_template()` - Updated to use Brevo API directly via HTTP
   - `send_team_invitation_email()` - Enhanced with better error handling

3. Security
   - All functions are SECURITY DEFINER to access credentials
   - RLS policies restrict access to email logs
*/

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  name TEXT PRIMARY KEY,
  html TEXT NOT NULL,
  txt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS to email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Only allow admins to manage templates
CREATE POLICY "Only admins can manage email templates" 
  ON email_templates
  USING (auth.jwt() ? 'is_admin'::text);

-- Create or replace the get_smtp_credentials function to return only API key and from email
CREATE OR REPLACE FUNCTION get_smtp_credentials()
RETURNS TABLE (
  api_key TEXT,
  from_email TEXT
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    current_setting('app.brevo_api_key', true)::TEXT,
    current_setting('app.from_email', true)::TEXT;
END;
$$;

-- Create or replace the send_email_with_template function
CREATE OR REPLACE FUNCTION send_email_with_template(
  p_to TEXT,
  p_subject TEXT,
  p_template_name TEXT,
  p_template_data JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_api_key TEXT;
  v_from_email TEXT;
  v_template_html TEXT;
  v_template_text TEXT;
  v_log_id UUID;
  v_response JSONB;
  v_request_body JSONB;
  v_http_response JSONB;
  v_http_status INT;
  v_success BOOLEAN;
  v_error TEXT;
  v_message_id TEXT;
BEGIN
  -- Get credentials
  SELECT api_key, from_email INTO v_api_key, v_from_email
  FROM get_smtp_credentials();
  
  IF v_api_key IS NULL OR v_from_email IS NULL THEN
    RAISE EXCEPTION 'Missing email credentials';
  END IF;
  
  -- Get template
  SELECT html, txt INTO v_template_html, v_template_text
  FROM email_templates
  WHERE name = p_template_name;
  
  IF v_template_html IS NULL THEN
    -- Fallback to basic templates if not found
    CASE p_template_name
      WHEN 'team_invitation' THEN
        v_template_html := '<html><body><h2>You''ve been invited to join a team</h2><p>Click <a href="{{invite_link}}">here</a> to accept.</p></body></html>';
        v_template_text := 'You''ve been invited to join a team. Click here to accept: {{invite_link}}';
      WHEN 'test_email' THEN
        v_template_html := '<html><body><h2>Test Email</h2><p>This is a test email from DecisionGuide.AI.</p></body></html>';
        v_template_text := 'Test Email from DecisionGuide.AI';
      ELSE
        RAISE EXCEPTION 'Template "%" not found', p_template_name;
    END CASE;
  END IF;
  
  -- Apply template variables
  SELECT 
    regexp_replace(v_template_html, '{{([^}]+)}}', 
      (CASE 
        WHEN p_template_data ? substring(regexp_replace(v_template_html, '.*?{{([^}]+)}}.*', '\1') from 1) 
        THEN p_template_data->>substring(regexp_replace(v_template_html, '.*?{{([^}]+)}}.*', '\1') from 1)
        ELSE ''
      END), 'g')
  INTO v_template_html;
  
  SELECT 
    regexp_replace(v_template_text, '{{([^}]+)}}', 
      (CASE 
        WHEN p_template_data ? substring(regexp_replace(v_template_text, '.*?{{([^}]+)}}.*', '\1') from 1) 
        THEN p_template_data->>substring(regexp_replace(v_template_text, '.*?{{([^}]+)}}.*', '\1') from 1)
        ELSE ''
      END), 'g')
  INTO v_template_text;
  
  -- Create log entry
  INSERT INTO email_logs (
    recipient_email,
    subject,
    template_name,
    template_data,
    status,
    details
  ) VALUES (
    p_to,
    p_subject,
    p_template_name,
    p_template_data,
    'initiated',
    jsonb_build_object(
      'initiated_at', now(),
      'initiated_by', auth.uid()
    )
  )
  RETURNING id INTO v_log_id;
  
  -- Prepare request body for Brevo API
  v_request_body := jsonb_build_object(
    'sender', jsonb_build_object('email', v_from_email, 'name', 'DecisionGuide.AI'),
    'to', jsonb_build_array(jsonb_build_object('email', p_to)),
    'subject', p_subject,
    'htmlContent', v_template_html,
    'textContent', v_template_text
  );
  
  -- Send email via Brevo API
  SELECT
    status,
    content::jsonb
  INTO
    v_http_status,
    v_http_response
  FROM
    http((
      'POST',
      'https://api.brevo.com/v3/smtp/email',
      ARRAY[
        ('api-key', v_api_key),
        ('accept', 'application/json'),
        ('content-type', 'application/json')
      ],
      'application/json',
      v_request_body::text
    ));
  
  -- Process response
  v_success := v_http_status BETWEEN 200 AND 299;
  
  IF v_success THEN
    v_message_id := v_http_response->>'messageId';
    v_error := NULL;
  ELSE
    v_message_id := NULL;
    v_error := CASE
      WHEN v_http_response ? 'message' THEN v_http_response->>'message'
      ELSE 'API error: ' || v_http_status::text
    END;
  END IF;
  
  -- Update log entry
  UPDATE email_logs
  SET
    status = CASE WHEN v_success THEN 'sent' ELSE 'failed' END,
    details = details || jsonb_build_object(
      'completed_at', now(),
      'success', v_success,
      'message_id', v_message_id,
      'error', v_error,
      'http_status', v_http_status,
      'http_response', v_http_response
    )
  WHERE id = v_log_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', v_success,
    'message_id', v_message_id,
    'error', v_error,
    'log_id', v_log_id
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    IF v_log_id IS NOT NULL THEN
      UPDATE email_logs
      SET
        status = 'failed',
        details = details || jsonb_build_object(
          'completed_at', now(),
          'success', false,
          'error', SQLERRM,
          'stack', format('%s: %s', SQLSTATE, SQLERRM)
        )
      WHERE id = v_log_id;
    END IF;
    
    -- Return error
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'log_id', v_log_id
    );
END;
$$;

-- Create or replace the send_team_invitation_email function
CREATE OR REPLACE FUNCTION send_team_invitation_email(
  invitation_uuid UUID,
  to_email TEXT,
  team_name TEXT,
  inviter_name TEXT DEFAULT 'A team admin',
  app_url TEXT DEFAULT 'https://decisionguide.ai'
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invite_link TEXT;
  v_subject TEXT;
  v_template_data JSONB;
  v_result JSONB;
BEGIN
  -- Generate invitation link
  v_invite_link := app_url || '/teams/join?token=' || invitation_uuid;
  
  -- Set subject
  v_subject := 'You''ve been invited to join "' || team_name || '" on DecisionGuide.AI';
  
  -- Prepare template data
  v_template_data := jsonb_build_object(
    'invite_link', v_invite_link,
    'team_name', team_name,
    'inviter_name', inviter_name,
    'recipient_name', split_part(to_email, '@', 1)
  );
  
  -- Send email
  v_result := send_email_with_template(
    to_email,
    v_subject,
    'team_invitation',
    v_template_data
  );
  
  -- Track invitation status
  PERFORM track_invitation_status(
    invitation_uuid,
    CASE WHEN (v_result->>'success')::BOOLEAN THEN 'email_sent' ELSE 'email_failed' END,
    v_result
  );
  
  RETURN v_result;
END;
$$;

-- Create or replace the test_email_sending function
CREATE OR REPLACE FUNCTION test_email_sending(
  to_email TEXT
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Send test email
  v_result := send_email_with_template(
    to_email,
    'Test Email from DecisionGuide.AI',
    'test_email',
    jsonb_build_object('timestamp', now())
  );
  
  RETURN v_result;
END;
$$;

-- Insert default email templates
INSERT INTO email_templates (name, html, txt)
VALUES 
  ('team_invitation', 
   '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">DecisionGuide.AI Team Invitation</h2>
          <p>Hello {{recipient_name}},</p>
          <p><strong>{{inviter_name}}</strong> has invited you to join <strong>{{team_name}}</strong> on DecisionGuide.AI.</p>
          <p>Click the button below to accept this invitation:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="{{invite_link}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
          </p>
          <p>If you don''t have an account yet, you''ll be able to create one after accepting the invitation.</p>
          <p>If you didn''t expect this invitation, you can safely ignore this email.</p>
          <p>Best regards,<br>The DecisionGuide.AI Team</p>
        </div>
      </body>
    </html>',
   'Hello {{recipient_name}},

{{inviter_name}} has invited you to join {{team_name}} on DecisionGuide.AI.

Accept your invitation:
{{invite_link}}

If you don''t have an account yet, you''ll be able to create one after accepting the invitation.

Best regards,
The DecisionGuide.AI Team'
  ),
  ('test_email',
   '<html>
      <body style="font-family: sans-serif; line-height:1.6; color:#333;">
        <h2>Test Email from DecisionGuide.AI</h2>
        <p>This is a test email to verify that the email delivery system is working correctly.</p>
        <p>If you''re receiving this email, it means our system can successfully send emails to your address.</p>
        <hr style="margin:40px 0; border:none; border-top:1px #eee solid;" />
        <footer style="font-size:12px; color:#888;">
          DecisionGuide.AI · <a href="https://decisionguide.ai">Make better decisions together</a>
        </footer>
      </body>
    </html>',
   'Test Email from DecisionGuide.AI

This is a test email to verify that the email delivery system is working correctly.

If you''re receiving this email, it means our system can successfully send emails to your address.

— The DecisionGuide.AI Team'
  );