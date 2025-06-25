/*
  # Create Default Organizations for Existing Users

  1. New Tables
    - No new tables created in this migration
  
  2. Changes
    - Creates a default organization for each user who owns teams or decisions
    - Uses a DO block to safely create organizations only for users who don't already have one
    - Sets organization name to "My Organization" with a slug based on the user's ID
  
  3. Security
    - No security changes in this migration
*/

-- Create default organizations for existing users who own teams or decisions
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get all users who own teams or decisions but don't have an organization yet
  FOR user_record IN (
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    WHERE u.id IN (
      SELECT DISTINCT created_by FROM teams
      UNION
      SELECT DISTINCT user_id FROM decisions
    )
    AND NOT EXISTS (
      SELECT 1 FROM organisations o WHERE o.owner_id = u.id
    )
  ) LOOP
    -- Create a default organization for each user
    INSERT INTO organisations (
      name,
      slug,
      description,
      owner_id,
      settings,
      created_at,
      updated_at
    ) VALUES (
      'My Organization',
      'org-' || REPLACE(user_record.id::text, '-', ''),
      'Default organization created during migration',
      user_record.id,
      '{"default": true, "created_during_migration": true}'::jsonb,
      NOW(),
      NOW()
    );
    
    -- Log the creation for audit purposes
    RAISE NOTICE 'Created default organization for user %', user_record.email;
  END LOOP;
END $$;