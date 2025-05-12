import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Loader2, UserPlus, Copy, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTeams } from '../contexts/TeamsContext';
import Tooltip from './Tooltip';

interface InviteCollaboratorsProps {
  open: boolean;
  onClose: () => void;
  decisionId: string;
}

type TabId = 'email' | 'team';
type Role = 'owner' | 'approver' | 'contributor' | 'viewer';

const ROLES: { id: Role; label: string; description: string }[] = [
  { id: 'owner', label: 'Decision Lead', description: 'Full control over the decision' },
  { id: 'approver', label: 'Approver', description: 'Can approve or reject suggestions' },
  { id: 'contributor', label: 'Contributor', description: 'Can add suggestions and comments' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access' }
];

export default function InviteCollaborators({ open, onClose, decisionId }: InviteCollaboratorsProps) {
  const { teams, loading: teamsLoading, fetchTeams } = useTeams();
  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open, fetchTeams]);

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const emailList = emails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
      
      const { data: invites, error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert(emailList.map(email => ({
          decision_id: decisionId,
          email,
          role,
          status: 'invited',
          permissions: {
            can_comment: role !== 'viewer',
            can_suggest: role !== 'viewer',
            can_rate: role !== 'viewer'
          }
        })))
        .select();

      if (inviteError) throw inviteError;

      // Generate invite link for external users
      const { data: token, error: linkError } = await supabase
        .rpc('create_invite_link', { decision_id: decisionId });

      if (!linkError && token) {
        setInviteLink(`${window.location.origin}/join/${token}`);
      }

      setEmails('');
      setSuccess(true);
    } catch (err) {
      console.error('Failed to send invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const team = teams.find(t => t.id === selectedTeamId);
      if (!team) throw new Error('Team not found');

      const { error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert(
          team.members.map(member => ({
            decision_id: decisionId,
            user_id: member.user_id,
            role,
            status: 'invited',
            permissions: {
              can_comment: role !== 'viewer',
              can_suggest: role !== 'viewer',
              can_rate: role !== 'viewer'
            }
          }))
        );

      if (inviteError) throw inviteError;

      setSelectedTeamId('');
      setSuccess(true);
    } catch (err) {
      console.error('Failed to invite team:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite team');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      // Show temporary success message
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } transition-opacity`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="invite-title" className="text-lg font-semibold">Invite Collaborators</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'email'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              By Email
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'team'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              By Team
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
              Invitations sent successfully!
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(({ id, label, description }) => (
                <option key={id} value={id}>
                  {label} - {description}
                </option>
              ))}
            </select>
          </div>

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Addresses
                </label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="Enter email addresses (one per line or comma-separated)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={4}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emails.trim()}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Sending Invites...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Send Invites
                  </>
                )}
              </button>
            </form>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <form onSubmit={handleTeamInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Team
                </label>
                {teamsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                  </div>
                ) : teams.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No teams available
                  </p>
                ) : (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.members.length} members)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !selectedTeamId}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Inviting Team...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Invite Team
                  </>
                )}
              </button>
            </form>
          )}

          {/* Invite Link */}
          {inviteLink && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  <LinkIcon className="h-4 w-4 inline mr-2" />
                  Invite Link
                </h3>
                <Tooltip content="Copy link">
                  <button
                    onClick={copyInviteLink}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
              <div className="text-sm text-gray-500 break-all">
                {inviteLink}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}