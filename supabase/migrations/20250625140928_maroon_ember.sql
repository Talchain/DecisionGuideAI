/*
  # Update organisation delete policy

  1. Changes
     - Update the DELETE policy on organisations table to allow both owners and admins to delete organisations
     - The policy now checks if the user is either the owner_id OR has an admin role in organisation_members

  2. Security
     - Maintains proper access control while expanding delete permissions to admins
     - Ensures only appropriate users can delete organisations
*/

-- Drop the existing delete policy
DROP POLICY IF EXISTS "Owners can delete organizations" ON public.organisations;

-- Create the updated policy that allows both owners and admins to delete
CREATE POLICY "Owners and admins can delete organizations" 
ON public.organisations
FOR DELETE 
TO authenticated
USING (
  (owner_id = uid()) OR 
  (
    EXISTS (
      SELECT 1 
      FROM organisation_members 
      WHERE 
        organisation_members.organisation_id = organisations.id AND 
        organisation_members.user_id = uid() AND 
        organisation_members.role = 'admin'
    )
  )
);