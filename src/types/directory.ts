export interface DirectoryUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  source: 'user' | 'invitation';
  invited_at?: string;
}