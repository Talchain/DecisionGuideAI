export interface Criterion {
  id: string;
  name: string;
  weight: number;
  tooltip?: string;
}

export interface CriteriaTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  criteria: Criterion[];
  owner_id: string;
  owner_name?: string;
  sharing: 'private' | 'team' | 'organization' | 'public';
  tags?: string[];
  featured?: boolean;
  created_at: string;
  updated_at: string;
  version?: number;
  team_id?: string;
  organization_id?: string;
}

export interface TemplateFilter {
  owner: string;
  useCase: string;
  tags: string[];
  dateRange: string;
  sharing: string;
}

export interface TemplateStats {
  totalTemplates: number;
  myTemplates: number;
  teamTemplates: number;
  organizationTemplates: number;
  featuredTemplates: number;
}