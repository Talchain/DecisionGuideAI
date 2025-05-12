import { User } from '@supabase/supabase-js';

export interface TeamMember {
  id: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamContextState {
  teams: Team[];
  currentTeam: Team | null;
  loading: boolean;
  error: string | null;
}

export type TeamContextActions = {
  createTeam: (name: string, description?: string) => Promise<Team>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  setCurrentTeam: (teamId: string | null) => void;
  addTeamMember: (teamId: string, userId: string, role?: TeamMember['role']) => Promise<void>;
  removeTeamMember: (teamId: string, userId: string) => Promise<void>;
  updateTeamMember: (teamId: string, userId: string, updates: Partial<TeamMember>) => Promise<void>;
};