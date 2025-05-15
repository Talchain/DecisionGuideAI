/*
  # Add SMTP URL Validation Function
  
  1. New Functions
    - `validate_smtp_url`: Validates SMTP URL format
    - `parse_smtp_url`: Parses SMTP URL into components
  
  2. Security
    - Functions are SECURITY DEFINER
    - Only accessible to authenticated users
*/

-- Function to validate SMTP URL format
CREATE OR REPLACE FUNCTION public.validate_smtp_url(
  smtp_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  protocol text;
  username text;
  password text;
  host text;
  port text;
BEGIN
  -- Basic validation
  IF smtp_url IS NULL OR smtp_url = '' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'SMTP URL is empty'
    );
  END IF;
  
  -- Check protocol
  IF NOT (
    smtp_url LIKE 'smtp://%' OR 
    smtp_url LIKE 'smtps://%' OR
    smtp_url LIKE 'smtp+starttls://%'
  ) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Invalid protocol. Must be smtp://, smtps://, or smtp+starttls://'
    );
  END IF;
  
  -- Try to parse the URL
  RETURN jsonb_build_object(
    'valid', true,
    'message', 'SMTP URL format is valid',
    'parsed', parse_smtp_url(smtp_url)
  );
END;
$$;

-- Function to parse SMTP URL into components
CREATE OR REPLACE FUNCTION public.parse_smtp_url(
  smtp_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protocol text;
  auth_part text;
  host_part text;
  username text;
  password text;
  host text;
  port text;
BEGIN
  -- Extract protocol
  protocol := substring(smtp_url from '^([^:]+)://');
  
  -- Extract auth and host parts
  auth_part := substring(smtp_url from '://([^@]+)@');
  host_part := substring(smtp_url from '@([^/]+)');
  
  -- Extract username and password
  username := substring(auth_part from '^([^:]+)');
  password := substring(auth_part from ':([^@]+)$');
  
  -- Extract host and port
  host := substring(host_part from '^([^:]+)');
  port := substring(host_part from ':([0-9]+)$');
  
  -- Return parsed components
  RETURN jsonb_build_object(
    'protocol', protocol,
    'username', username,
    'password_length', CASE WHEN password IS NULL THEN 0 ELSE length(password) END,
    'host', host,
    'port', port
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_smtp_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_smtp_url(text) TO authenticated;

-- Add function comments
COMMENT ON FUNCTION public.validate_smtp_url IS
'Validates SMTP URL format and returns parsed components';

COMMENT ON FUNCTION public.parse_smtp_url IS
'Parses SMTP URL into components (protocol, username, password, host, port)';