/*
  # Create Organization Members Table

  1. New Tables
    - `organisation_members`
      - `id` (uuid, primary key)
      - `organisation_id` (uuid, references organisations)
      - `user_id` (uuid, references auth.users)
      - `role` (enum: owner, admin, member, billing_admin, guest)
      - `permissions` (jsonb, for granular permissions)
      - `invited_by` (uuid, references auth.users)
      - `invited_at` (timestamptz)
      - `joined_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `organisation_members` table
    - Add policies for member access control
    - Users can read their own memberships
    - Organization admins can manage members

  3. Constraints
    - Unique constraint on (organisation_id, user_id)
    - Check constraint for valid roles

  4. Indexes
    - Add indexes for performance on commonly queried fields
*/

-- Create enum for organization roles
CREATE TYPE organisation_role AS ENUM (
  'owner',
  'admin', 
  'member',
  'billing_admin',
  'guest'
);

-- Create organisation_members table
CREATE TABLE IF NOT EXISTS organisation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role organisation_role NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique membership per user per organization
  UNIQUE(organisation_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS organisation_members_organisation_id_idx ON organisation_members(organisation_id);
CREATE INDEX IF NOT EXISTS organisation_members_user_id_idx ON organisation_members(user_id);
CREATE INDEX IF NOT EXISTS organisation_members_role_idx ON organisation_members(role);

-- Enable RLS
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organisation_members table
-- Policy: Users can read their own memberships
CREATE POLICY "Users can read their own organization memberships"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Organization admins and owners can read all memberships in their org
CREATE POLICY "Organization admins can read organization memberships"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Organization owners and admins can invite/add members
CREATE POLICY "Organization admins can manage memberships"
  ON organisation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR (
      -- Allow users to accept invitations (join organizations)
      user_id = auth.uid()
    )
  );

-- Policy: Organization owners and admins can update memberships
CREATE POLICY "Organization admins can update memberships"
  ON organisation_members
  FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR (
      -- Users can update their own membership (e.g., accept invitation)
      user_id = auth.uid()
    )
  );

-- Policy: Organization owners and admins can remove members
CREATE POLICY "Organization admins can remove memberships"
  ON organisation_members
  FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR (
      -- Users can remove themselves from organizations
      user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
CREATE TRIGGER update_organisation_members_updated_at
  BEFORE UPDATE ON organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically add organization owner as member
CREATE OR REPLACE FUNCTION add_organization_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organisation_members (organisation_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', now())
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically add organization owner as member when organization is created
CREATE TRIGGER add_organization_owner_as_member_trigger
  AFTER INSERT ON organisations
  FOR EACH ROW
  EXECUTE FUNCTION add_organization_owner_as_member();