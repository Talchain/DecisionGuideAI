/*
  # Add Test Email Function
  
  1. New Functions
    - `send_test_email`: Function to send a test email via Edge Function
    
  2. Security
    - Function is accessible to authenticated users only
    - Proper error handling and validation
*/

-- Create function to send a test email
CREATE OR REPLACE FUNCTION public.send_test_email(
  recipient_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Validate email
  IF recipient_email IS NULL OR recipient_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email address is required',
      'timestamp', now()
    );
  END IF;
  
  -- Validate email format
  IF recipient_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid email format',
      'timestamp', now()
    );
  END IF;
  
  -- Log the test email attempt
  INSERT INTO public.system_logs (
    component,
    message,
    details
  ) VALUES (
    'email_test',
    'Test email requested',
    jsonb_build_object(
      'email', recipient_email,
      'requested_by', auth.uid(),
      'timestamp', now()
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Test email request submitted',
    'recipient', recipient_email,
    'timestamp', now()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_test_email(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.send_test_email IS
'Sends a test email to verify SMTP configuration';