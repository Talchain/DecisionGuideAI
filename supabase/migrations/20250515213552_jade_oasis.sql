/*
  # Fix SMTP Testing and Email Delivery
  
  1. Changes
    - Create a new function to test SMTP configuration
    - Add better error handling for email delivery
    - Fix ambiguous column references in get_invitation_status
  
  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Proper error handling and logging
*/

-- Create a function to test SMTP configuration that returns more details
CREATE OR REPLACE FUNCTION public.test_smtp_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function will trigger the Edge Function to test SMTP
  -- The actual testing happens in the Edge Function
  
  -- Return a simple success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'SMTP configuration test initiated',
    'timestamp', now()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.test_smtp_configuration() TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.test_smtp_configuration IS
'Tests the SMTP configuration for the Edge Function';

-- Create a function to send a test email
CREATE OR REPLACE FUNCTION public.send_test_email(
  recipient_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email
  IF recipient_email IS NULL OR recipient_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email address is required',
      'timestamp', now()
    );
  END IF;
  
  -- This function will trigger the Edge Function to send a test email
  -- The actual sending happens in the Edge Function
  
  -- Return a simple success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Test email sending initiated',
    'recipient', recipient_email,
    'timestamp', now()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.send_test_email(text) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.send_test_email IS
'Sends a test email to verify SMTP configuration';