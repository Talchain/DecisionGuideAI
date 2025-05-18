/*
  # Email Settings Migration
  
  1. New Tables
    - `app_email_settings`: Secure storage for email service credentials
      - `id` (serial, primary key)
      - `api_key` (text)
      - `from_email` (text) 
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on settings table
    - Only allow service_role to write
    
  3. Functions
    - `verify_email_settings`: Helper to verify credentials
*/

-- Create secure storage for email settings
CREATE TABLE IF NOT EXISTS app_email_settings (
  id           SERIAL PRIMARY KEY,
  api_key      TEXT NOT NULL,
  from_email   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only allow SERVICE_ROLE to insert/update
ALTER TABLE app_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY write_email_settings ON app_email_settings
  FOR ALL TO service_role
  USING (true);

-- Seed Brevo credentials
INSERT INTO app_email_settings (api_key, from_email)
VALUES (
  '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',
  'hello@decisionguide.ai'
)
ON CONFLICT (id) DO UPDATE
  SET api_key    = EXCLUDED.api_key,
      from_email = EXCLUDED.from_email,
      updated_at = now();

-- Helper to verify settings
CREATE OR REPLACE FUNCTION verify_email_settings()
  RETURNS TABLE (api_key TEXT, from_email TEXT) 
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT s.api_key, s.from_email 
  FROM app_email_settings s 
  LIMIT 1;
END;
$$;