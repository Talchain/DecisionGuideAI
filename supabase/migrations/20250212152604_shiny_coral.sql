/*
  # Add Decision Analysis Storage
  
  1. New Tables
    - `decision_analysis`
      - `id` (uuid, primary key)
      - `decision_id` (uuid, references decisions)
      - `analysis_data` (jsonb)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `version` (integer)
      - `metadata` (jsonb)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Grant necessary permissions

  3. Changes
    - Add version control for analysis data
    - Add metadata storage
    - Add status tracking
*/

-- Create decision_analysis table
CREATE TABLE IF NOT EXISTS public.decision_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE,
  analysis_data jsonb NOT NULL,
  status text DEFAULT 'draft',
  version integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add status constraint
ALTER TABLE public.decision_analysis
  ADD CONSTRAINT decision_analysis_status_check
  CHECK (status IN ('draft', 'in_progress', 'finalized', 'archived'));

-- Enable RLS
ALTER TABLE public.decision_analysis ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read for own decision analysis"
  ON public.decision_analysis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_analysis.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable insert for own decision analysis"
  ON public.decision_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_analysis.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable update for own decision analysis"
  ON public.decision_analysis
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_analysis.decision_id
      AND decisions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_analysis.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX idx_decision_analysis_decision_id 
  ON public.decision_analysis(decision_id);
CREATE INDEX idx_decision_analysis_status 
  ON public.decision_analysis(status);
CREATE INDEX idx_decision_analysis_created_at 
  ON public.decision_analysis(created_at);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_decision_analysis
  BEFORE UPDATE ON public.decision_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();