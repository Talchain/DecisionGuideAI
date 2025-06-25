export interface Organisation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  role: string;
  member_count?: number;
  team_count?: number;
}

export interface OrganisationMember {
  id: string;
  user_id: string;
  organisation_id: string;
  role: string;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface OrganisationTeam {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count: number;
}