/*
  # Add goals column to decisions table
  
  1. Changes
    - Add goals column of type text[] to store decision goals
    - Make column nullable since not all decisions require goals
  
  2. Security
    - Maintains existing RLS policies
    - No additional security needed for the column
*/

-- Add goals column to decisions table
ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS goals text[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.decisions.goals IS 'Optional array of goals/objectives for this decision';