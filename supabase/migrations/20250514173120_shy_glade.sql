/*
  # Collaborative Options Schema

  1. New Tables
    - `options`
      - `id` (uuid, primary key)
      - `decision_id` (uuid, references decisions)
      - `user_id` (uuid, references auth.users)
      - `text` (text, the option content)
      - `source` (text, either 'user' or 'ai')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `metadata` (jsonb, for additional data like scores, tags, etc.)

  2. Security
    - Enable RLS on options table
    - Add policies for CRUD operations based on decision collaboration status
    - Grant realtime LISTEN/NOTIFY permissions

  3. Changes
    - Add realtime publication for options table
*/

-- Create options table
CREATE TABLE IF NOT EXISTS options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  text text NOT NULL,
  source text NOT NULL CHECK (source IN ('user', 'ai')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_options_decision_id ON options(decision_id);
CREATE INDEX IF NOT EXISTS idx_options_user_id ON options(user_id);
CREATE INDEX IF NOT EXISTS idx_options_source ON options(source);

-- Enable RLS
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access a decision
CREATE OR REPLACE FUNCTION can_access_decision(decision_uuid uuid)
RETURNS boolean AS $$
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
        AND dc.status = 'active'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can modify an option
CREATE OR REPLACE FUNCTION can_modify_option(option_uuid uuid)
RETURNS boolean AS $$
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
      (dc.status = 'active' AND dc.role IN ('owner', 'collaborator'))
    )
  );
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
  USING (can_modify_option(id))
  WITH CHECK (can_modify_option(id));

CREATE POLICY "Users can delete their own options or if they have permission"
  ON options FOR DELETE
  USING (can_modify_option(id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE options;

-- Updated trigger function
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_options
  BEFORE UPDATE ON options
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();