/*
  # Add invite link function
  
  1. New Functions
    - create_invite_link: Generates a secure invite link for a decision
    
  2. Security
    - Function is only accessible to authenticated users
    - Validates user has permission to invite to the decision
*/

-- Function to create an invite link
CREATE OR REPLACE FUNCTION create_invite_link(
  decision_id uuid,
  expires_in integer DEFAULT 86400 -- 24 hours in seconds
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token text;
  link text;
BEGIN
  -- Check if user has permission to create invite links
  IF NOT (
    EXISTS (
      SELECT 1 FROM decisions WHERE id = decision_id AND user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM decision_collaborators 
      WHERE decision_id = decision_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'collaborator')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create invite links for this decision';
  END IF;

  -- Generate secure token
  token := encode(gen_random_bytes(32), 'base64');
  
  -- Store invite link
  INSERT INTO decision_invites (
    decision_id,
    created_by,
    token,
    expires_at
  ) VALUES (
    decision_id,
    auth.uid(),
    token,
    NOW() + (expires_in || ' seconds')::interval
  );

  -- Return the token
  RETURN token;
END;
$$;