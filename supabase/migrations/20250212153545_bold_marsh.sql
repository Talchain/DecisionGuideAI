/*
  # Fix Decision Analysis Persistence
  
  1. Changes
    - Add better RLS policies with proper ownership checks
    - Add validation functions for decision ownership
    - Add indexes for performance
    - Add proper error handling for missing data
  
  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Add ownership validation
*/

-- Drop existing policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg(
      format('DROP POLICY IF EXISTS %I ON public.decision_analysis', policyname),
      '; '
    )
    FROM pg_policies 
    WHERE tablename = 'decision_analysis' 
    AND schemaname = 'public'
  );
END $$;

-- Ensure table exists with proper structure
CREATE TABLE IF NOT EXISTS public.decision_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE NOT NULL,
  analysis_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft',
  version integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT decision_analysis_status_check 
    CHECK (status IN ('draft', 'in_progress', 'finalized', 'archived')),
  CONSTRAINT decision_analysis_version_check 
    CHECK (version > 0)
);

-- Enable RLS
ALTER TABLE public.decision_analysis ENABLE ROW LEVEL SECURITY;

-- Create function to validate decision ownership
CREATE OR REPLACE FUNCTION public.validate_decision_ownership(decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF decision_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM decisions
    WHERE id = decision_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Create function to get latest analysis version
CREATE OR REPLACE FUNCTION public.get_latest_analysis_version(decision_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_version integer;
BEGIN
  SELECT COALESCE(MAX(version), 0) INTO latest_version
  FROM decision_analysis
  WHERE decision_id = $1;
  
  RETURN latest_version;
END;
$$;

-- Create policies with proper ownership checks
CREATE POLICY "Enable read access for decision owners"
  ON public.decision_analysis
  FOR SELECT
  TO authenticated
  USING (
    validate_decision_ownership(decision_id)
  );

CREATE POLICY "Enable insert access for decision owners"
  ON public.decision_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    validate_decision_ownership(decision_id)
  );

CREATE POLICY "Enable update access for decision owners"
  ON public.decision_analysis
  FOR UPDATE
  TO authenticated
  USING (
    validate_decision_ownership(decision_id)
  )
  WITH CHECK (
    validate_decision_ownership(decision_id)
  );

CREATE POLICY "Enable delete access for decision owners"
  ON public.decision_analysis
  FOR DELETE
  TO authenticated
  USING (
    validate_decision_ownership(decision_id)
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_decision_analysis_decision_id 
  ON public.decision_analysis(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_analysis_status 
  ON public.decision_analysis(status);
CREATE INDEX IF NOT EXISTS idx_decision_analysis_version 
  ON public.decision_analysis(version);
CREATE INDEX IF NOT EXISTS idx_decision_analysis_created_at 
  ON public.decision_analysis(created_at);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS handle_updated_at_decision_analysis ON public.decision_analysis;
CREATE TRIGGER handle_updated_at_decision_analysis
  BEFORE UPDATE ON public.decision_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.decision_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_decision_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_analysis_version TO authenticated;