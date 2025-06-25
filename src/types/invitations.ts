export interface Invitation {
  id: string;
  email: string;
  invited_at: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by?: string;
  team_id?: string;
  role?: string;
  decision_role?: string;
  organisation_id?: string;
}

export interface InviteResult {
  status: 'invited' | 'already_invited' | 'added';
  id?: string;
  user_id?: string;
  email: string;
  team_id: string;
  role: string;
  decision_role: string;
  invited_at?: string;
}