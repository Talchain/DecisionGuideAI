/*
  # Fix Foreign Key Relationship Between decision_collaborators and users

  1. Changes
    - Add missing foreign key between decision_collaborators.user_id and auth.users.id
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper relationships for join operations
*/

-- Add the missing foreign key relationship 
ALTER TABLE public.decision_collaborators
  DROP CONSTRAINT IF EXISTS decision_collaborators_user_id_fkey;

ALTER TABLE public.decision_collaborators
  ADD CONSTRAINT decision_collaborators_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id);

-- Verify the constraint was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_schema = tc.constraint_schema
    AND ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'decision_collaborators_user_id_fkey'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
    AND ccu.column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'Foreign key constraint decision_collaborators_user_id_fkey was not created correctly';
  END IF;
END $$;