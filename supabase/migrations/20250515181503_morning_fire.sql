/*
  # Fix Invitation Logs Table and Policies

  1. Changes
    - Safely check if table exists before creating it
    - Safely check if policies exist before creating them
    - Add error handling to functions
    
  2. Security
    - Maintain existing RLS policies
    - Add proper error handling
*/

-- First check if the table already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'invitation_logs'
  ) THEN
    -- Create invitation_logs table
    CREATE TABLE public.invitation_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invitation_id uuid REFERENCES public.invitations(id) ON DELETE CASCADE,
      status text NOT NULL,
      details jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.invitation_logs ENABLE ROW LEVEL SECURITY;

    -- Create indexes
    CREATE INDEX idx_invitation_logs_invitation_id 
      ON public.invitation_logs(invitation_id);
    CREATE INDEX idx_invitation_logs_created_at 
      ON public.invitation_logs(created_at);
      
    -- Add comment
    COMMENT ON TABLE public.invitation_logs IS 
    'Tracks invitation status changes and email delivery attempts';
  END IF;
END $$;

-- Check if policies exist before creating them
DO $$ 
BEGIN
  -- Only create select policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invitation_logs' 
    AND policyname = 'invitation_logs_select_policy'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "invitation_logs_select_policy"
      ON public.invitation_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
  
  -- Only create insert policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invitation_logs' 
    AND policyname = 'invitation_logs_insert_policy'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "invitation_logs_insert_policy"
      ON public.invitation_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Create or replace functions with better error handling
CREATE OR REPLACE FUNCTION public.track_invitation_status(
  invitation_uuid uuid,
  status_value text,
  details_json jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
  invitation_exists boolean;
BEGIN
  -- Check if invitation exists
  SELECT EXISTS(
    SELECT 1 FROM invitations WHERE id = invitation_uuid
  ) INTO invitation_exists;
  
  -- If invitation doesn't exist, return null
  IF NOT invitation_exists THEN
    RAISE WARNING 'Invitation with ID % does not exist', invitation_uuid;
    RETURN NULL;
  END IF;

  -- Insert log entry
  INSERT INTO invitation_logs (
    invitation_id,
    status,
    details
  ) VALUES (
    invitation_uuid,
    status_value,
    details_json
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Function to get invitation status history
CREATE OR REPLACE FUNCTION public.get_invitation_status(
  invitation_uuid uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return empty set if invitation doesn't exist
  IF NOT EXISTS(SELECT 1 FROM invitations WHERE id = invitation_uuid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    il.id,
    il.status,
    il.details,
    il.created_at
  FROM invitation_logs il
  WHERE il.invitation_id = invitation_uuid
  ORDER BY il.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.track_invitation_status(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_status(uuid) TO authenticated;

-- Add function comments
COMMENT ON FUNCTION public.track_invitation_status IS
'Records a status change or event for an invitation';

COMMENT ON FUNCTION public.get_invitation_status IS
'Retrieves the status history for an invitation';