-- Drop ALL existing policies first
DO $$ 
BEGIN
  -- Drop all policies on the decisions table
  EXECUTE (
    SELECT string_agg(
      format('DROP POLICY IF EXISTS %I ON public.decisions', policyname),
      '; '
    )
    FROM pg_policies 
    WHERE tablename = 'decisions' 
    AND schemaname = 'public'
  );
END $$;

-- Ensure the decisions table exists with all required columns
CREATE TABLE IF NOT EXISTS public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  reversibility text NOT NULL,
  importance text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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