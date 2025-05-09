/*
  # Add due_date column to decisions table

  1. Changes
    - Add due_date column to decisions table
    - Add index for due_date column
    - Update existing rows with NULL due_date
*/

-- Add due_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'decisions' 
    AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.decisions
      ADD COLUMN due_date timestamptz DEFAULT NULL;

    -- Add index for due_date
    CREATE INDEX idx_decisions_due_date ON public.decisions(due_date);
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN public.decisions.due_date IS 'Optional due date for the decision';