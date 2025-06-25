import type { Criterion } from '../contexts/DecisionContext';

export interface CriteriaTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  criteria: Criterion[];
  sharing: string;
  owner_id: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
  featured?: boolean;
  tags?: string[];
}

export interface TemplateFilter {
  owner: string;
  useCase: string;
  tags: string[];
  dateRange: string;
  sharing: string;
}