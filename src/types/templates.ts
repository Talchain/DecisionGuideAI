import type { Criterion } from '../contexts/DecisionContext';

export interface CriteriaTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  criteria: Criterion[];
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