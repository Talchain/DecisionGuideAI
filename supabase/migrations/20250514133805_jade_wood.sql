/*
  # Create invitations table and policies

  1. New Tables
    - `invitations`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `invited_at` (timestamptz)
      - `status` (text, check constraint)
      - `invited_by` (uuid, references auth.users)
      - `team_id` (uuid, references teams)
      - `role` (text)
      - `decision_role` (text)

  2. Security
    - Enable RLS on invitations table
    - Add policies for authenticated users
      - Insert: Only allow users to create invitations they send
      - Select: Allow all authenticated users to read invitations

  3. Indexes
    - Email index for lookups
    - Status index for filtering
    - Invited at index for sorting
    - Team ID index for filtering
*/

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invitations;
  DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.invitations;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by uuid REFERENCES auth.users(id),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member'::text,
  decision_role TEXT DEFAULT 'contributor'::text
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_at ON public.invitations(invited_at);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON public.invitations(team_id);

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