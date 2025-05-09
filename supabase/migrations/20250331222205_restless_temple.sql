/*
  # Collaborative Decision Hub Schema

  1. New Tables
    - `decision_collaborators`: Stores participant access and roles
    - `decision_comments`: Stores discussion threads
    - `decision_suggestions`: Stores suggested changes
    - `decision_activities`: Tracks collaboration events
  
  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    - Add validation functions
*/

-- Create enum types for roles and statuses
CREATE TYPE collaborator_role AS ENUM ('owner', 'collaborator', 'viewer');
CREATE TYPE collaborator_status AS ENUM ('invited', 'active', 'removed');
CREATE TYPE suggestion_type AS ENUM ('option', 'pro', 'con');
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'rejected');

-- Create decision_collaborators table
CREATE TABLE IF NOT EXISTS public.decision_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  role collaborator_role NOT NULL DEFAULT 'viewer',
  status collaborator_status NOT NULL DEFAULT 'invited',
  permissions jsonb DEFAULT '{
    "can_comment": false,
    "can_rate": false,
    "can_suggest": false
  }'::jsonb,
  email text,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(decision_id, user_id)
);

-- Create decision_comments table
CREATE TABLE IF NOT EXISTS public.decision_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  parent_id uuid REFERENCES public.decision_comments(id),
  content text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  mentions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create decision_suggestions table
CREATE TABLE IF NOT EXISTS public.decision_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type suggestion_type NOT NULL,
  content jsonb NOT NULL,
  status suggestion_status DEFAULT 'pending',
  feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create decision_activities table
CREATE TABLE IF NOT EXISTS public.decision_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  activity_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add collaboration fields to decisions table
ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS is_collaborative boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS collaboration_settings jsonb DEFAULT '{
    "allow_suggestions": true,
    "require_approval": true,
    "auto_notify": true
  }'::jsonb;

-- Enable RLS
ALTER TABLE public.decision_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_activities ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_decision_collaborators_decision_id ON public.decision_collaborators(decision_id);
CREATE INDEX idx_decision_collaborators_user_id ON public.decision_collaborators(user_id);
CREATE INDEX idx_decision_collaborators_email ON public.decision_collaborators(email);
CREATE INDEX idx_decision_comments_decision_id ON public.decision_comments(decision_id);
CREATE INDEX idx_decision_comments_user_id ON public.decision_comments(user_id);
CREATE INDEX idx_decision_comments_parent_id ON public.decision_comments(parent_id);
CREATE INDEX idx_decision_suggestions_decision_id ON public.decision_suggestions(decision_id);
CREATE INDEX idx_decision_suggestions_user_id ON public.decision_suggestions(user_id);
CREATE INDEX idx_decision_activities_decision_id ON public.decision_activities(decision_id);
CREATE INDEX idx_decision_activities_user_id ON public.decision_activities(user_id);

-- Create function to check if user is decision owner
CREATE OR REPLACE FUNCTION public.is_decision_owner(decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM decisions
    WHERE id = decision_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Create function to check if user is collaborator
CREATE OR REPLACE FUNCTION public.is_decision_collaborator(decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM decision_collaborators
    WHERE decision_id = decision_id
    AND user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'collaborator')
  );
END;
$$;

-- Create function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_collaboration_permission(decision_id uuid, permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM decision_collaborators
    WHERE decision_id = decision_id
    AND user_id = auth.uid()
    AND status = 'active'
    AND (
      role = 'owner'
      OR (role = 'collaborator' AND permissions->permission = 'true')
    )
  );
END;
$$;

-- Create RLS policies for decision_collaborators
CREATE POLICY "Enable read access for decision participants"
  ON public.decision_collaborators
  FOR SELECT
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions WHERE user_id = auth.uid()
      UNION
      SELECT decision_id FROM decision_collaborators 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Enable insert access for decision owners"
  ON public.decision_collaborators
  FOR INSERT
  TO authenticated
  WITH CHECK (is_decision_owner(decision_id));

CREATE POLICY "Enable update access for decision owners"
  ON public.decision_collaborators
  FOR UPDATE
  TO authenticated
  USING (is_decision_owner(decision_id))
  WITH CHECK (is_decision_owner(decision_id));

-- Create RLS policies for decision_comments
CREATE POLICY "Enable read access for decision participants"
  ON public.decision_comments
  FOR SELECT
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions WHERE user_id = auth.uid()
      UNION
      SELECT decision_id FROM decision_collaborators 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Enable insert access for collaborators with permission"
  ON public.decision_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (has_collaboration_permission(decision_id, 'can_comment'));

CREATE POLICY "Enable update access for comment authors"
  ON public.decision_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create RLS policies for decision_suggestions
CREATE POLICY "Enable read access for decision participants"
  ON public.decision_suggestions
  FOR SELECT
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions WHERE user_id = auth.uid()
      UNION
      SELECT decision_id FROM decision_collaborators 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Enable insert access for collaborators with permission"
  ON public.decision_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (has_collaboration_permission(decision_id, 'can_suggest'));

CREATE POLICY "Enable update access for decision owners"
  ON public.decision_suggestions
  FOR UPDATE
  TO authenticated
  USING (is_decision_owner(decision_id))
  WITH CHECK (is_decision_owner(decision_id));

-- Create RLS policies for decision_activities
CREATE POLICY "Enable read access for decision participants"
  ON public.decision_activities
  FOR SELECT
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions WHERE user_id = auth.uid()
      UNION
      SELECT decision_id FROM decision_collaborators 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Enable insert access for system"
  ON public.decision_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger function to log activities
CREATE OR REPLACE FUNCTION public.log_decision_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO decision_activities (
    decision_id,
    user_id,
    activity_type,
    details
  ) VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'decision_collaborators' THEN NEW.decision_id
      WHEN TG_TABLE_NAME = 'decision_comments' THEN NEW.decision_id
      WHEN TG_TABLE_NAME = 'decision_suggestions' THEN NEW.decision_id
    END,
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' THEN 'updated'
      WHEN TG_OP = 'DELETE' THEN 'deleted'
    END || '_' || TG_TABLE_NAME,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record_id', NEW.id,
      'operation', TG_OP
    )
  );
  RETURN NEW;
END;
$$;

-- Create triggers for activity logging
CREATE TRIGGER log_collaborator_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.decision_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.log_decision_activity();

CREATE TRIGGER log_comment_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.decision_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_decision_activity();

CREATE TRIGGER log_suggestion_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.decision_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_decision_activity();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comments
COMMENT ON TABLE public.decision_collaborators IS 'Stores participant access and roles for collaborative decisions';
COMMENT ON TABLE public.decision_comments IS 'Stores discussion threads for collaborative decisions';
COMMENT ON TABLE public.decision_suggestions IS 'Stores suggested changes from collaborators';
COMMENT ON TABLE public.decision_activities IS 'Tracks all collaboration events';