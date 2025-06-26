/*
  # Add owner tracking to criteria templates

  1. Changes
    - Add `owner_id` column to `criteria_templates` table
    - Add foreign key constraint to `users` table
    - Add index for performance
    - Add `sharing` column for template visibility control
    - Add `tags` column for template categorization
    - Add `featured` column for highlighting special templates
    - Update RLS policies to support ownership-based access

  2. Security
    - Enable RLS on `criteria_templates` table
    - Add policies for CRUD operations based on ownership
    - Add policies for reading shared templates
*/

-- Add missing columns to criteria_templates table
ALTER TABLE criteria_templates 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS sharing text DEFAULT 'private' CHECK (sharing IN ('private', 'team', 'organization', 'public')),
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
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