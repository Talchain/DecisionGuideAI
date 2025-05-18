/*
  # Configure Brevo Email Settings
  
  1. Changes
    - Creates custom settings table for email configuration
    - Adds secure functions to manage and verify settings
    - Sets initial Brevo API key and sender email
  
  2. Security
    - Settings are only accessible via secure functions
    - Values are stored in a protected table
*/

-- Create settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only allow access via our functions
CREATE POLICY "No direct access to settings"
  ON app_settings
  USING (false);

-- Function to update settings
CREATE OR REPLACE FUNCTION set_app_setting(setting_key text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO app_settings (key, value)
  VALUES (setting_key, setting_value)
  ON CONFLICT (key) DO UPDATE
    SET value = setting_value,
        updated_at = now();
END;
$$;

-- Function to get settings
CREATE OR REPLACE FUNCTION get_app_setting(setting_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  setting_value text;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;
  RETURN setting_value;
END;
$$;

-- Function to verify email settings
CREATE OR REPLACE FUNCTION verify_email_settings()
RETURNS TABLE (
  brevo_api_key text,
  from_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    get_app_setting('brevo_api_key'),
    get_app_setting('from_email');
END;
$$;

-- Set initial values
SELECT set_app_setting('brevo_api_key', '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');
SELECT set_app_setting('from_email', 'hello@decisionguide.ai');