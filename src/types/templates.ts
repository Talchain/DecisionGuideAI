import type { Criterion } from '../contexts/DecisionContext';

export interface CriteriaTemplate {
  id: string;
  name: string;
  description: string | null;
  tooltip?: string;
  type: string;
  owner_id: string;
  owner_name?: string;
  criteria: Criterion[];
  sharing: string;
  tags?: string[];
  featured?: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  sharing: 'private' | 'team' | 'organization' | 'public';
  tags: string[];
  featured: boolean;
  sharing: string;
  owner_id: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
  owner: string;
  useCase: string;
  tags: string[];
  dateRange: string;
  sharing: string;
}

export interface TemplateFilter {
  owner: string;
  useCase: string;
  tags: string[];
  dateRange: string;
  sharing: string;
}