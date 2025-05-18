/*
  # Add Brevo API settings to database
  
  1. Changes
    - Add Brevo API key and email settings to database configuration
    - These settings will be used by database functions for sending emails
  
  2. Security
    - Settings are stored at database level for secure access
    - Only accessible via secure RPC functions
*/

-- Set Brevo API key
ALTER DATABASE current_database()
  SET app.settings.brevo_api_key = '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';

-- Set sender email address  
ALTER DATABASE current_database()
  SET app.settings.from_email = 'hello@decisionguide.ai';

-- Create function to verify settings
CREATE OR REPLACE FUNCTION verify_email_settings()
RETURNS TABLE (
  brevo_api_key text,
  from_email text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    current_setting('app.settings.brevo_api_key'),
    current_setting('app.settings.from_email');
END;
$$;