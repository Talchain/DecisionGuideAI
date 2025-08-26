-- Enable RLS on all tables by default
ALTER TABLE public.board_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_votes ENABLE ROW LEVEL SECURITY;

-- Create enum for node types
CREATE TYPE node_type AS ENUM ('decision', 'option', 'outcome');

-- Board versions table
CREATE TABLE IF NOT EXISTS public.board_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  parent_version_id UUID REFERENCES public.board_versions(id) ON DELETE SET NULL,
  commit_message TEXT,
  committed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  committed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT board_version_unique UNIQUE(board_id, version)
);

-- Scenarios (snapshots) table
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.board_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Option votes table
CREATE TABLE IF NOT EXISTS public.option_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote BOOLEAN NOT NULL, -- true for upvote, false for downvote
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT option_vote_unique UNIQUE(option_id, user_id)
);

-- Indexes for better query performance
CREATE INDEX idx_board_versions_board_id ON public.board_versions(board_id);
CREATE INDEX idx_scenarios_board_id ON public.scenarios(board_id);
CREATE INDEX idx_option_votes_option_id ON public.option_votes(option_id);
CREATE INDEX idx_option_votes_user_id ON public.option_votes(user_id);

-- RLS Policies
-- Board versions policies
CREATE POLICY "Users can view their board versions"
  ON public.board_versions
  FOR SELECT
  USING (auth.uid() = (SELECT created_by FROM public.boards WHERE id = board_id));

CREATE POLICY "Users can insert their own board versions"
  ON public.board_versions
  FOR INSERT
  WITH CHECK (auth.uid() = (SELECT created_by FROM public.boards WHERE id = board_id));

-- Scenarios policies
CREATE POLICY "Users can view their scenarios"
  ON public.scenarios
  FOR SELECT
  USING (auth.uid() = (SELECT created_by FROM public.boards WHERE id = board_id));

CREATE POLICY "Users can manage their scenarios"
  ON public.scenarios
  FOR ALL
  USING (auth.uid() = (SELECT created_by FROM public.boards WHERE id = board_id))
  WITH CHECK (auth.uid() = (SELECT created_by FROM public.boards WHERE id = board_id));

-- Option votes policies
CREATE POLICY "Users can view all votes"
  ON public.option_votes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own votes"
  ON public.option_votes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Functions
-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_board_versions_updated_at
BEFORE UPDATE ON public.board_versions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at
BEFORE UPDATE ON public.scenarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_option_votes_updated_at
BEFORE UPDATE ON public.option_votes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get current version of a board
CREATE OR REPLACE FUNCTION public.get_current_board_version(board_id UUID)
RETURNS SETOF public.board_versions AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.board_versions
  WHERE board_versions.board_id = $1
  ORDER BY version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create a new board version
CREATE OR REPLACE FUNCTION public.create_board_version(
  p_board_id UUID,
  p_title TEXT,
  p_nodes JSONB,
  p_edges JSONB,
  p_commit_message TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS public.board_versions AS $$
DECLARE
  new_version INTEGER;
  new_record public.board_versions;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO new_version
  FROM public.board_versions
  WHERE board_id = p_board_id;

  -- Insert the new version
  INSERT INTO public.board_versions (
    board_id,
    version,
    title,
    nodes,
    edges,
    commit_message,
    committed_by,
    parent_version_id
  ) VALUES (
    p_board_id,
    new_version,
    p_title,
    p_nodes,
    p_edges,
    p_commit_message,
    p_user_id,
    (SELECT id FROM public.board_versions WHERE board_id = p_board_id ORDER BY version DESC LIMIT 1)
  )
  RETURNING * INTO new_record;

  -- If this is a commit (not a draft), mark previous versions as not current
  IF p_commit_message IS NOT NULL THEN
    UPDATE public.board_versions
    SET is_draft = false
    WHERE id = new_record.id;
  END IF;

  RETURN new_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
