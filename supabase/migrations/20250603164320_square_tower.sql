/*
  # Add Criteria Templates
  
  1. New Tables
    - `criteria_templates` - Stores predefined criteria templates
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `description` (text) - Template description
      - `type` (text) - Decision type this template is for
      - `criteria` (jsonb) - Array of criteria with weights
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policy for public read access
*/

-- Create criteria_templates table
CREATE TABLE IF NOT EXISTS criteria_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE criteria_templates ENABLE ROW LEVEL SECURITY;

-- Add read-only policy for authenticated users
CREATE POLICY "Anyone can read templates"
  ON criteria_templates
  FOR SELECT
  TO public
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_criteria_templates
  BEFORE UPDATE ON criteria_templates
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insert default templates
INSERT INTO criteria_templates (name, description, type, criteria) VALUES
  (
    'Feature Prioritization',
    'Standard criteria for evaluating and prioritizing product features',
    'professional',
    '[
      {"id": "user-value", "name": "User Value", "weight": 5, "description": "Impact and benefit to users"},
      {"id": "effort", "name": "Implementation Effort", "weight": 4, "description": "Development and deployment complexity"},
      {"id": "risk", "name": "Technical Risk", "weight": 3, "description": "Potential technical challenges and risks"},
      {"id": "strategic", "name": "Strategic Alignment", "weight": 4, "description": "Alignment with company goals"},
      {"id": "roi", "name": "ROI", "weight": 4, "description": "Expected return on investment"}
    ]'::jsonb
  ),
  (
    'Vendor Selection',
    'Evaluate and compare potential vendors or service providers',
    'professional',
    '[
      {"id": "cost", "name": "Total Cost", "weight": 4, "description": "Including setup, maintenance, and training"},
      {"id": "reliability", "name": "Reliability & Support", "weight": 5, "description": "Service reliability and support quality"},
      {"id": "features", "name": "Feature Set", "weight": 4, "description": "Available features and capabilities"},
      {"id": "integration", "name": "Integration", "weight": 3, "description": "Ease of integration with existing systems"},
      {"id": "scalability", "name": "Scalability", "weight": 3, "description": "Ability to grow with business needs"}
    ]'::jsonb
  ),
  (
    'Career Move',
    'Evaluate career opportunities and job changes',
    'career',
    '[
      {"id": "growth", "name": "Growth Potential", "weight": 5, "description": "Career advancement and skill development"},
      {"id": "compensation", "name": "Compensation", "weight": 4, "description": "Salary, benefits, and equity"},
      {"id": "culture", "name": "Company Culture", "weight": 4, "description": "Work environment and values alignment"},
      {"id": "work-life", "name": "Work-Life Balance", "weight": 3, "description": "Schedule flexibility and demands"},
      {"id": "stability", "name": "Job Security", "weight": 3, "description": "Company stability and role security"}
    ]'::jsonb
  ),
  (
    'Product Launch',
    'Evaluate product launch timing and strategy',
    'professional',
    '[
      {"id": "market-fit", "name": "Market Fit", "weight": 5, "description": "Product-market fit and demand"},
      {"id": "readiness", "name": "Product Readiness", "weight": 4, "description": "Feature completeness and quality"},
      {"id": "competition", "name": "Competitive Landscape", "weight": 3, "description": "Market competition and timing"},
      {"id": "resources", "name": "Resource Availability", "weight": 4, "description": "Team and resource readiness"},
      {"id": "risk-factors", "name": "Risk Factors", "weight": 3, "description": "Potential risks and mitigation"}
    ]'::jsonb
  ),
  (
    'Project Prioritization',
    'Evaluate and prioritize multiple projects',
    'professional',
    '[
      {"id": "impact", "name": "Business Impact", "weight": 5, "description": "Expected business value and impact"},
      {"id": "urgency", "name": "Urgency", "weight": 4, "description": "Time sensitivity and deadlines"},
      {"id": "resources", "name": "Resource Requirements", "weight": 3, "description": "Required team and resources"},
      {"id": "dependencies", "name": "Dependencies", "weight": 3, "description": "Project dependencies and blockers"},
      {"id": "confidence", "name": "Success Confidence", "weight": 4, "description": "Likelihood of successful execution"}
    ]'::jsonb
  );