/*
  # Add Criteria Sets Support
  
  1. New Tables
    - `criteria_sets`: Stores reusable criteria templates
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, optional)
      - `criteria` (jsonb)
      - `user_id` (uuid)
      - `team_id` (uuid, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for viewing, creating, updating, and deleting criteria sets
    - Ensure users can only access their own or their team's criteria sets
*/

-- Create criteria_sets table
CREATE TABLE IF NOT EXISTS criteria_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  criteria jsonb NOT NULL DEFAULT '[]',
  user_id uuid NOT NULL REFERENCES auth.users(id),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure unique names per user (when personal) or per team (when shared)
  CONSTRAINT unique_name_per_scope UNIQUE NULLS NOT DISTINCT (name, user_id, team_id)
);

-- Enable RLS
ALTER TABLE criteria_sets ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_criteria_sets_user_id ON criteria_sets(user_id);
CREATE INDEX idx_criteria_sets_team_id ON criteria_sets(team_id);
CREATE INDEX idx_criteria_sets_created_at ON criteria_sets(created_at);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_criteria_sets
  BEFORE UPDATE ON criteria_sets
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS Policies

-- Users can view their own criteria sets
CREATE POLICY "Users can view own criteria sets"
  ON criteria_sets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create criteria sets
CREATE POLICY "Users can create criteria sets"
  ON criteria_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      team_id IS NULL OR
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  );

-- Users can update their own criteria sets
CREATE POLICY "Users can update own criteria sets"
  ON criteria_sets
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    (
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  );

-- Users can delete their own criteria sets
CREATE POLICY "Users can delete own criteria sets"
  ON criteria_sets
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  );