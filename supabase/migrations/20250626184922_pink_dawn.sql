/*
  # Add plan_type to organisations table

  1. Changes
     - Add plan_type column to organisations table with default value 'solo'
     - Add check constraint to ensure plan_type is one of 'solo', 'team', 'enterprise'
     - Update existing rows to have plan_type = 'solo'
*/

-- Add plan_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organisations' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE organisations 
    ADD COLUMN plan_type text NOT NULL DEFAULT 'solo';
    
    -- Add check constraint
    ALTER TABLE organisations 
    ADD CONSTRAINT organisations_plan_type_check 
    CHECK (plan_type = ANY (ARRAY['solo'::text, 'team'::text, 'enterprise'::text]));
    
    -- Update existing rows to have plan_type = 'solo'
    UPDATE organisations SET plan_type = 'solo';
  END IF;
END $$;