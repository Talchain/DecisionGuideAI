/*
  # Email Settings Migration
  
  1. Changes
    - Creates app_email_settings table for storing email credentials
    - Drops existing policy and recreates it
    - Seeds Brevo API credentials
    - Creates helper function for verifying settings
  
  2. Security
    - Enables RLS on table
    - Only service_role can access the table
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

-- Drop existing policy if it exists
DROP POLICY IF EXISTS write_email_settings ON app_email_settings;

-- Recreate policy
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

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS verify_email_settings();

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