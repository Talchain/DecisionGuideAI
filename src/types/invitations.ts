export interface Invitation {
  id: string;
  email: string;
  invited_at: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by: string;
  team_id: string;
  team_name?: string;
  role: string;
  decision_role: string;
  inviter_email?: string;
}

export interface InviteResult {
  id?: string;
  team_id?: string;
  user_id?: string;
  email?: string;
  role?: string;
  decision_role?: string;
  joined_at?: string;
  invited_at?: string;
  status: 'added' | 'invited';
}