/*
  # Add plan_type to organisations table
  
  1. Changes
     - Add plan_type column to organisations table with default value 'solo'
     - Add check constraint to ensure plan_type is one of the allowed values
  
  2. Purpose
     - Enable feature gating based on organization plan type
     - Support "solo", "team", and "enterprise" plan types
*/

-- Add plan_type column with default value 'solo'
ALTER TABLE public.organisations
ADD COLUMN plan_type text NOT NULL DEFAULT 'solo';

-- Add check constraint to ensure plan_type is one of the allowed values
ALTER TABLE public.organisations
ADD CONSTRAINT organisations_plan_type_check
CHECK (plan_type IN ('solo', 'team', 'enterprise'));

-- Update the organisation_type in the Organisation interface
COMMENT ON COLUMN public.organisations.plan_type IS 'The plan type of the organisation. Valid values: solo, team, enterprise';