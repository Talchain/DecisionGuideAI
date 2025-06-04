/*
  # Criteria Sets Schema
  
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
    - Add policies for CRUD operations
    - Ensure proper team access controls
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
  CONSTRAINT unique_name_per_scope UNIQUE NULLS NOT DISTINCT (name, user_id, team_id)
);

-- Enable RLS
ALTER TABLE criteria_sets ENABLE ROW LEVEL SECURITY;

-- Create indexes (with IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_sets_user_id') THEN
    CREATE INDEX idx_criteria_sets_user_id ON criteria_sets(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_sets_team_id') THEN
    CREATE INDEX idx_criteria_sets_team_id ON criteria_sets(team_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_sets_created_at') THEN
    CREATE INDEX idx_criteria_sets_created_at ON criteria_sets(created_at);
  END IF;
END $$;

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_criteria_sets
  BEFORE UPDATE ON criteria_sets
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS Policies
CREATE POLICY "Users can view own criteria sets"
  ON criteria_sets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

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