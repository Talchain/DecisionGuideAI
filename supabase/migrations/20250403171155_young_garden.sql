/*
  # Add Unique Constraint to decision_analysis Table with Duplicate Handling

  1. Changes
    - Remove duplicate decision_id entries keeping only the latest version
    - Add unique constraint to decision_id column in decision_analysis table
    - This enables proper upsert operations with ON CONFLICT
  
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity by preventing duplicate analysis entries
*/

-- First, identify and remove duplicates, keeping only the latest version for each decision_id
DO $$
DECLARE
  duplicate_decision_id uuid;
  duplicate_count integer := 0;
BEGIN
  -- Create a temporary table to store duplicate decision_ids
  CREATE TEMP TABLE duplicate_decision_ids AS
  SELECT decision_id
  FROM public.decision_analysis
  GROUP BY decision_id
  HAVING COUNT(*) > 1;
  
  -- Get count of duplicates
  SELECT COUNT(*) INTO duplicate_count FROM duplicate_decision_ids;
  
  -- Log the number of duplicates found
  RAISE NOTICE 'Found % decision_ids with duplicates', duplicate_count;
  
  -- For each duplicate decision_id, keep only the latest record
  FOR duplicate_decision_id IN SELECT decision_id FROM duplicate_decision_ids LOOP
    -- Delete all but the latest record for this decision_id
    DELETE FROM public.decision_analysis
    WHERE id IN (
      SELECT id
      FROM public.decision_analysis
      WHERE decision_id = duplicate_decision_id
      ORDER BY updated_at DESC, created_at DESC, version DESC
      OFFSET 1
    );
    
    RAISE NOTICE 'Cleaned up duplicates for decision_id: %', duplicate_decision_id;
  END LOOP;
  
  -- Drop the temporary table
  DROP TABLE duplicate_decision_ids;
END $$;

-- Now add the unique constraint
ALTER TABLE public.decision_analysis
  ADD CONSTRAINT decision_analysis_decision_id_key UNIQUE (decision_id);

-- Verify the constraint was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'decision_analysis_decision_id_key'
    AND table_name = 'decision_analysis'
    AND constraint_type = 'UNIQUE'
  ) THEN
    RAISE EXCEPTION 'Unique constraint was not created correctly';
  END IF;
END $$;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT decision_analysis_decision_id_key ON public.decision_analysis IS 
'Ensures each decision can only have one analysis record, enabling upsert operations';