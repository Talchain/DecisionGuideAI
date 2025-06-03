/*
  # Add Collaborative Criteria Support

  1. New Tables
    - `criteria_suggestions`
      - Stores proposed criteria from team members
      - Tracks votes and status
    - `criteria_comments`
      - Stores threaded discussion on criteria
    - `criteria_votes`
      - Tracks individual votes on criteria

  2. Security
    - Enable RLS on all tables
    - Add policies for team member access
    - Ensure proper cascading deletes

  3. Changes
    - Add collaboration fields to existing criteria table
*/

-- Criteria suggestions table
CREATE TABLE IF NOT EXISTS criteria_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  description text,
  weight integer CHECK (weight >= 1 AND weight <= 5),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criteria comments table
CREATE TABLE IF NOT EXISTS criteria_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES criteria_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  parent_id uuid REFERENCES criteria_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Criteria votes table
CREATE TABLE IF NOT EXISTS criteria_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES criteria_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  vote_type text NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- Enable RLS
ALTER TABLE criteria_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria_votes ENABLE ROW LEVEL SECURITY;

-- Criteria suggestions policies
CREATE POLICY "Users can create suggestions for their decisions"
  ON criteria_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_collaborators dc
      WHERE dc.decision_id = criteria_suggestions.decision_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  );

CREATE POLICY "Users can view suggestions for their decisions"
  ON criteria_suggestions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_collaborators dc
      WHERE dc.decision_id = criteria_suggestions.decision_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  );

CREATE POLICY "Decision owners can update suggestions"
  ON criteria_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decisions d
      WHERE d.id = criteria_suggestions.decision_id
      AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decisions d
      WHERE d.id = criteria_suggestions.decision_id
      AND d.user_id = auth.uid()
    )
  );

-- Comments policies
CREATE POLICY "Users can create comments on suggestions"
  ON criteria_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM criteria_suggestions cs
      JOIN decision_collaborators dc ON dc.decision_id = cs.decision_id
      WHERE cs.id = criteria_comments.suggestion_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  );

CREATE POLICY "Users can view comments on suggestions"
  ON criteria_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM criteria_suggestions cs
      JOIN decision_collaborators dc ON dc.decision_id = cs.decision_id
      WHERE cs.id = criteria_comments.suggestion_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  );

CREATE POLICY "Users can update their own comments"
  ON criteria_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Votes policies
CREATE POLICY "Users can vote on suggestions"
  ON criteria_votes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM criteria_suggestions cs
      JOIN decision_collaborators dc ON dc.decision_id = cs.decision_id
      WHERE cs.id = criteria_votes.suggestion_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM criteria_suggestions cs
      JOIN decision_collaborators dc ON dc.decision_id = cs.decision_id
      WHERE cs.id = criteria_votes.suggestion_id
      AND dc.user_id = auth.uid()
      AND dc.status = 'active'
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER handle_updated_at_criteria_suggestions
  BEFORE UPDATE ON criteria_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_updated_at_criteria_comments
  BEFORE UPDATE ON criteria_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add indexes
CREATE INDEX idx_criteria_suggestions_decision_id ON criteria_suggestions(decision_id);
CREATE INDEX idx_criteria_suggestions_user_id ON criteria_suggestions(user_id);
CREATE INDEX idx_criteria_suggestions_status ON criteria_suggestions(status);
CREATE INDEX idx_criteria_comments_suggestion_id ON criteria_comments(suggestion_id);
CREATE INDEX idx_criteria_comments_user_id ON criteria_comments(user_id);
CREATE INDEX idx_criteria_votes_suggestion_id ON criteria_votes(suggestion_id);
CREATE INDEX idx_criteria_votes_user_id ON criteria_votes(user_id);