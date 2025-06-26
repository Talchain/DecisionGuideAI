export interface Criterion {
  id: string;
  name: string;
  weight: number;
  tooltip?: string;
}

export interface CriteriaTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  criteria: Criterion[];
  owner_id?: string;
  owner_name?: string;
  sharing?: string;
  tags?: string[];
  featured?: boolean;
  created_at: string;
  updated_at: string;
}

export type TabId = 'my' | 'team' | 'organization' | 'featured' | 'marketplace';

export interface TemplateFilter {
  owner: string;
  useCase: string;
  tags: string[];
  dateRange: string;
  sharing: string;
}