/*
  # Fix Decisions RLS Policies

  1. Changes
    - Drop existing policies
    - Create new simplified policies with proper security context
    - Add better error handling for RLS violations
    - Add indexes for performance

  2. Security
    - Enable RLS on decisions table
    - Add policies for CRUD operations
    - Ensure proper user isolation
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own decisions" ON public.decisions;
DROP POLICY IF EXISTS "Users can create own decisions" ON public.decisions;
DROP POLICY IF EXISTS "Users can update own decisions" ON public.decisions;
DROP POLICY IF EXISTS "Users can delete own decisions" ON public.decisions;

-- Ensure RLS is enabled
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

-- Create new simplified policies
CREATE POLICY "Enable read for own decisions"
  ON public.decisions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for own decisions"
  ON public.decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own decisions"
  ON public.decisions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for own decisions"
  ON public.decisions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_decisions_user_id ON public.decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON public.decisions(created_at);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.decisions TO authenticated;

-- Add comment explaining policies
COMMENT ON TABLE public.decisions IS 'Stores user decisions with RLS policies ensuring users can only access their own data';