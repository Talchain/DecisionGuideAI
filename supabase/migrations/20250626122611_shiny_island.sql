/*
  # Update criteria_templates table structure and policies
  
  1. New Columns
     - Add owner_id column with reference to auth.users
     - Add sharing column for access control
     - Add tags array for categorization
     - Add featured flag for highlighting templates
  
  2. Indexes
     - Create indexes for performance optimization
  
  3. RLS Policies
     - Update policies to control access based on sharing level
*/

-- Add missing columns to criteria_templates table
ALTER TABLE criteria_templates 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS sharing text DEFAULT 'private'::text CHECK (sharing IN ('private', 'team', 'organization', 'public')),
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_criteria_templates_owner_id ON criteria_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_criteria_templates_sharing ON criteria_templates(sharing);
CREATE INDEX IF NOT EXISTS idx_criteria_templates_featured ON criteria_templates(featured);

-- Update RLS policies
DROP POLICY IF EXISTS "Anyone can read templates" ON criteria_templates;

-- Policy for reading templates based on sharing level
CREATE POLICY "Users can read accessible templates" ON criteria_templates
  FOR SELECT
  TO public
  USING (
    sharing = 'public' OR
    (sharing = 'private' AND owner_id = auth.uid()) OR
    (sharing = 'team' AND owner_id IS NOT NULL) OR
    (sharing = 'organization' AND owner_id IS NOT NULL)
  );

-- Policy for creating templates
CREATE POLICY "Users can create own templates" ON criteria_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Policy for updating own templates
CREATE POLICY "Users can update own templates" ON criteria_templates
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy for deleting own templates
CREATE POLICY "Users can delete own templates" ON criteria_templates
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());