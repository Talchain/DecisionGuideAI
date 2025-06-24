/*
  # Create Organizations Table

  1. New Tables
    - `organisations`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `slug` (text, unique, for URL-friendly names)
      - `description` (text, optional)
      - `logo_url` (text, optional)
      - `domain` (text, optional, for SSO)
      - `owner_id` (uuid, references auth.users)
      - `billing_info` (jsonb, for future billing features)
      - `settings` (jsonb, for org-level settings)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `organisations` table
    - Add policies for organization access control
    - Only organization members can read organization data
    - Only organization owners/admins can update organization data

  3. Indexes
    - Add indexes for performance on commonly queried fields
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  domain text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_info jsonb DEFAULT '{}',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS organisations_owner_id_idx ON organisations(owner_id);
CREATE INDEX IF NOT EXISTS organisations_slug_idx ON organisations(slug);
CREATE INDEX IF NOT EXISTS organisations_domain_idx ON organisations(domain) WHERE domain IS NOT NULL;

-- Enable RLS
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organisations table
-- Policy: Users can read organizations they are members of
CREATE POLICY "Users can read organizations they belong to"
  ON organisations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

-- Policy: Only organization owners can update organization details
CREATE POLICY "Organization owners can update organization"
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy: Only organization owners can delete organizations
CREATE POLICY "Organization owners can delete organization"
  ON organisations
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Policy: Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();