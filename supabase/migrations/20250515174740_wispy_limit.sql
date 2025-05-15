/*
  # Add Invitation Logs Table
  
  1. New Tables
    - `invitation_logs`: Tracks invitation status changes and email delivery attempts
  
  2. New Functions
    - `track_invitation_status`: Records status changes for invitations
    - `get_invitation_status`: Retrieves status history for an invitation
  
  3. Security
    - Enable RLS on invitation_logs table
    - Add policies for authenticated users
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

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Try to drop policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "invitation_logs_select_policy" ON public.invitation_logs;
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "invitation_logs_insert_policy" ON public.invitation_logs;
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;
END $$;

-- Create policies with unique names
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invitation_logs' 
    AND policyname = 'invitation_logs_select_policy'
  ) THEN
    CREATE POLICY "invitation_logs_select_policy"
      ON public.invitation_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invitation_logs' 
    AND policyname = 'invitation_logs_insert_policy'
  ) THEN
    CREATE POLICY "invitation_logs_insert_policy"
      ON public.invitation_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Function to track invitation status
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
BEGIN
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