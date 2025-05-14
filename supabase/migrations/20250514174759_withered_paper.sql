/*
  # Collaborative Options Schema

  1. New Tables
    - `options`
      - `id` (uuid, primary key)
      - `decision_id` (uuid, references decisions)
      - `user_id` (uuid, references auth.users)
      - `text` (text)
      - `source` (text, either 'user' or 'ai')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `metadata` (jsonb)

  2. Security
    - Enable RLS on `options` table
    - Add policies for:
      - Viewing options for accessible decisions
      - Creating options for accessible decisions
      - Updating own options or with permission
      - Deleting own options or with permission

  3. Functions
    - `merge_options`: Merges multiple options into one
    - `can_access_decision`: Helper to check decision access
    - `can_modify_option`: Helper to check option modification rights
*/

-- Create options table
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'ai')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_options_decision_id ON options(decision_id);
CREATE INDEX IF NOT EXISTS idx_options_user_id ON options(user_id);
CREATE INDEX IF NOT EXISTS idx_options_source ON options(source);

-- Enable RLS
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access a decision
CREATE OR REPLACE FUNCTION can_access_decision(decision_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM decisions d
    WHERE d.id = decision_uuid 
    AND (
      -- User owns the decision
      d.user_id = auth.uid()
      OR
      -- User is a collaborator
      EXISTS (
        SELECT 1 FROM decision_collaborators dc
        WHERE dc.decision_id = decision_uuid
        AND dc.user_id = auth.uid()
        AND dc.status = 'active'::collaborator_status
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can modify an option
CREATE OR REPLACE FUNCTION can_modify_option(option_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM options o
    JOIN decisions d ON d.id = o.decision_id
    LEFT JOIN decision_collaborators dc ON dc.decision_id = d.id AND dc.user_id = auth.uid()
    WHERE o.id = option_uuid
    AND (
      -- User owns the decision
      d.user_id = auth.uid()
      OR
      -- User created the option
      o.user_id = auth.uid()
      OR
      -- User is an admin/owner collaborator
      (dc.status = 'active'::collaborator_status AND dc.role IN ('owner', 'collaborator'))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge options
CREATE OR REPLACE FUNCTION merge_options(
  p_option_ids UUID[],
  p_new_text TEXT,
  p_user_id UUID,
  p_decision_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_new_option_id UUID;
  v_option_id UUID;
BEGIN
  -- Verify user can access the decision
  IF NOT can_access_decision(p_decision_id) THEN
    RAISE EXCEPTION 'Access denied: Cannot access this decision';
  END IF;

  -- Verify user can modify all options
  FOREACH v_option_id IN ARRAY p_option_ids LOOP
    IF NOT can_modify_option(v_option_id) THEN
      RAISE EXCEPTION 'Access denied: Cannot modify option %', v_option_id;
    END IF;
  END LOOP;

  -- Create new merged option
  INSERT INTO options (
    decision_id,
    user_id,
    text,
    source,
    metadata
  ) VALUES (
    p_decision_id,
    p_user_id,
    p_new_text,
    'user',
    jsonb_build_object(
      'merged_from', p_option_ids,
      'merged_at', now()
    )
  )
  RETURNING id INTO v_new_option_id;

  -- Delete original options
  DELETE FROM options
  WHERE id = ANY(p_option_ids);

  RETURN v_new_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Users can view options for accessible decisions"
  ON options FOR SELECT
  USING (can_access_decision(decision_id));

CREATE POLICY "Users can insert options for accessible decisions"
  ON options FOR INSERT
  WITH CHECK (
    can_access_decision(decision_id) 
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update their own options or if they have permission"
  ON options FOR UPDATE
  USING (can_modify_option(id));

CREATE POLICY "Users can delete their own options or if they have permission"
  ON options FOR DELETE
  USING (can_modify_option(id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE options;

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_options
  BEFORE UPDATE ON options
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();