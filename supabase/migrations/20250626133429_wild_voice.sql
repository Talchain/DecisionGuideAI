/*
  # Fix criteria_templates table and policies

  1. New Columns
    - Add `owner_id` column referencing auth.users(id)
    - Add `sharing` column with check constraint for sharing levels
    - Add `tags` column as text array
    - Add `featured` boolean column
  
  2. Indexes
    - Create indexes for performance on owner_id, sharing, and featured columns
  
  3. Policies
    - Drop all existing policies for criteria_templates
    - Create new policies for read, create, update, and delete operations
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

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read templates" ON criteria_templates;
DROP POLICY IF EXISTS "Users can read accessible templates" ON criteria_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON criteria_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON criteria_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON criteria_templates;

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