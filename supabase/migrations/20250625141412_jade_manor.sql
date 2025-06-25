/*
  # Update organisation deletion policy
  
  1. Changes
    - Drop existing delete policy that only allows owners to delete organizations
    - Create new policy that allows both owners and admins to delete organizations
  
  2. Security
    - Ensures both organization owners and admins can delete organizations
    - Uses auth.uid() to properly reference the authenticated user's ID
*/

-- Drop the existing delete policy
DROP POLICY IF EXISTS "Owners can delete organizations" ON public.organisations;

-- Create the updated policy that allows both owners and admins to delete
CREATE POLICY "Owners and admins can delete organizations" 
ON public.organisations
FOR DELETE 
TO authenticated
USING (
  (owner_id = auth.uid()) OR 
  (
    EXISTS (
      SELECT 1 
      FROM organisation_members 
      WHERE 
        organisation_members.organisation_id = organisations.id AND 
        organisation_members.user_id = auth.uid() AND 
        organisation_members.role = 'admin'
    )
  )
);