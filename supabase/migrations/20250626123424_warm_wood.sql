/*
  # Fix criteria_templates table structure and policies

  1. Changes
     - Add missing columns to criteria_templates table if they don't exist
     - Add performance indexes
     - Update RLS policies with proper existence checks
*/

-- Add missing columns to criteria_templates table
DO $$ 
BEGIN
  -- Add owner_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'criteria_templates' AND column_name = 'owner_id') THEN
    ALTER TABLE criteria_templates ADD COLUMN owner_id uuid REFERENCES auth.users(id);
  END IF;
  
  -- Add sharing column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'criteria_templates' AND column_name = 'sharing') THEN
    ALTER TABLE criteria_templates ADD COLUMN sharing text DEFAULT 'private'::text;
    -- Add check constraint
    ALTER TABLE criteria_templates ADD CONSTRAINT criteria_templates_sharing_check 
      CHECK (sharing IN ('private', 'team', 'organization', 'public'));
  END IF;
  
  -- Add tags column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'criteria_templates' AND column_name = 'tags') THEN
    ALTER TABLE criteria_templates ADD COLUMN tags text[] DEFAULT '{}'::text[];
  END IF;
  
  -- Add featured column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'criteria_templates' AND column_name = 'featured') THEN
    ALTER TABLE criteria_templates ADD COLUMN featured boolean DEFAULT false;
  END IF;
END $$;

-- Add indexes for performance (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_templates_owner_id') THEN
    CREATE INDEX idx_criteria_templates_owner_id ON criteria_templates(owner_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_templates_sharing') THEN
    CREATE INDEX idx_criteria_templates_sharing ON criteria_templates(sharing);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_criteria_templates_featured') THEN
    CREATE INDEX idx_criteria_templates_featured ON criteria_templates(featured);
  END IF;
END $$;

-- Update RLS policies with proper existence checks
DO $$ 
BEGIN
  -- Drop old policy if it exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read templates' AND tablename = 'criteria_templates') THEN
    DROP POLICY "Anyone can read templates" ON criteria_templates;
  END IF;
  
  -- Create read policy only if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read accessible templates' AND tablename = 'criteria_templates') THEN
    CREATE POLICY "Users can read accessible templates" ON criteria_templates
      FOR SELECT
      TO public
      USING (
        sharing = 'public' OR
        (sharing = 'private' AND owner_id = auth.uid()) OR
        (sharing = 'team' AND owner_id IS NOT NULL) OR
        (sharing = 'organization' AND owner_id IS NOT NULL)
      );
  END IF;
  
  -- Create insert policy only if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own templates' AND tablename = 'criteria_templates') THEN
    CREATE POLICY "Users can create own templates" ON criteria_templates
      FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;
  
  -- Create update policy only if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own templates' AND tablename = 'criteria_templates') THEN
    CREATE POLICY "Users can update own templates" ON criteria_templates
      FOR UPDATE
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
  
  -- Create delete policy only if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own templates' AND tablename = 'criteria_templates') THEN
    CREATE POLICY "Users can delete own templates" ON criteria_templates
      FOR DELETE
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END $$;

-- Make sure RLS is enabled
ALTER TABLE criteria_templates ENABLE ROW LEVEL SECURITY;

-- Insert system templates with public sharing if they don't exist
DO $$
DECLARE
  template_count integer;
BEGIN
  SELECT COUNT(*) INTO template_count FROM criteria_templates WHERE sharing = 'public';
  
  IF template_count = 0 THEN
    -- Insert feature prioritization template
    INSERT INTO criteria_templates (name, description, type, criteria, sharing, featured)
    VALUES (
      'Feature Prioritization',
      'Evaluate and rank new features for your product roadmap.',
      'professional',
      '[
        {"id": "c1", "name": "User Value / Impact", "weight": 5},
        {"id": "c2", "name": "Effort / Cost", "weight": 4},
        {"id": "c3", "name": "Strategic Fit", "weight": 4},
        {"id": "c4", "name": "Risk", "weight": 3},
        {"id": "c5", "name": "Time to Deliver", "weight": 3}
      ]'::jsonb,
      'public',
      true
    );
    
    -- Insert roadmap planning template
    INSERT INTO criteria_templates (name, description, type, criteria, sharing, featured)
    VALUES (
      'Roadmap Planning',
      'Plan and prioritize initiatives for upcoming quarters.',
      'professional',
      '[
        {"id": "c1", "name": "Strategic Alignment", "weight": 5},
        {"id": "c2", "name": "Resource Availability", "weight": 4},
        {"id": "c3", "name": "Customer Demand", "weight": 5},
        {"id": "c4", "name": "Dependencies", "weight": 3},
        {"id": "c5", "name": "Business Value", "weight": 5}
      ]'::jsonb,
      'public',
      true
    );
    
    -- Insert vendor selection template
    INSERT INTO criteria_templates (name, description, type, criteria, sharing, featured)
    VALUES (
      'Vendor/Tool Selection',
      'Evaluate and select vendors, tools, or third-party services.',
      'professional',
      '[
        {"id": "c1", "name": "Cost / ROI", "weight": 5},
        {"id": "c2", "name": "Reliability", "weight": 4},
        {"id": "c3", "name": "Integration Fit", "weight": 4},
        {"id": "c4", "name": "Support / Service", "weight": 4},
        {"id": "c5", "name": "Security", "weight": 5}
      ]'::jsonb,
      'public',
      true
    );
  END IF;
END $$;