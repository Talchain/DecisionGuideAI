export interface DirectoryUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  source: 'profile' | 'invitation';
  invited_at: string | null;
}

export interface DirectoryState {
  users: DirectoryUser[];
  loading: boolean;
  error: string | null;
}