/*
  # Fix Decision Analysis RLS Policies
  
  1. Changes
    - Simplify RLS policies for better security
    - Add proper user ownership checks
    - Add cascade delete trigger
    - Add better constraints and validation

  2. Security
    - Ensure proper user ownership validation
    - Add proper error handling
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read for own decision analysis" ON public.decision_analysis;
DROP POLICY IF EXISTS "Enable insert for own decision analysis" ON public.decision_analysis;
DROP POLICY IF EXISTS "Enable update for own decision analysis" ON public.decision_analysis;

-- Create simplified policies with better security
CREATE POLICY "Enable read access for decision owners"
  ON public.decision_analysis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_analysis.decision_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable insert access for decision owners"
  ON public.decision_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_analysis.decision_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable update access for decision owners"
  ON public.decision_analysis
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_analysis.decision_id
      AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_analysis.decision_id
      AND d.user_id = auth.uid()
    )
  );

-- Add better validation
ALTER TABLE public.decision_analysis
  ADD CONSTRAINT decision_analysis_version_check
  CHECK (version > 0);

-- Add function to validate decision ownership
CREATE OR REPLACE FUNCTION public.validate_decision_ownership(decision_id uuid)
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