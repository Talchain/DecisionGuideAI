-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_at ON public.invitations(invited_at);

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop all policies on the invitations table
  EXECUTE (
    SELECT string_agg(
      format('DROP POLICY IF EXISTS %I ON public.invitations', policyname),
      '; '
    )
    FROM pg_policies 
    WHERE tablename = 'invitations' 
    AND schemaname = 'public'
  );
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- Create RLS policies for invitations
CREATE POLICY "Enable insert for authenticated users"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Enable read for authenticated users"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.invitations TO authenticated;