import React, { useState } from 'react';
import { X, Users, Mail, Loader2, UserPlus, UserMinus, AlertCircle, UserSearch, Clock, RefreshCw, XCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTeams } from '../../contexts/TeamsContext';
import type { Team } from '../../types/teams';
import type { Invitation, InviteResult } from '../../types/invitations';
import Tooltip from '../Tooltip';
import UserDirectoryTab from './UserDirectoryTab';

interface ManageTeamMembersModalProps {
  team: Team;
  onClose: () => void;
}

type TabId = 'email' | 'directory' | 'existing' | 'pending';
type TeamRole = 'admin' | 'member';
type DecisionRole = 'owner' | 'approver' | 'contributor' | 'viewer';

const TEAM_ROLES: { id: TeamRole; label: string; description: string }[] = [
  { id: 'admin', label: 'Admin', description: 'Can manage team and members' },
  { id: 'member', label: 'Member', description: 'Regular team member' }
];

const DECISION_ROLES: { id: DecisionRole; label: string; description: string }[] = [
  { id: 'owner', label: 'Decision Lead', description: 'Full control over the decision' },
  { id: 'approver', label: 'Approver', description: 'Can approve or reject suggestions' },
  { id: 'contributor', label: 'Contributor', description: 'Can add suggestions and comments' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access' }
];

export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMembersModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');
  const [decisionRole, setDecisionRole] = useState<DecisionRole>('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState<boolean>(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);

  const { addTeamMember, inviteTeamMember, getTeamInvitations, revokeInvitation, resendInvitation } = useTeams();

  // Fetch pending invitations when the tab is selected
  React.useEffect(() => {
    if (activeTab === 'pending') {
      fetchInvitations();
    }
  }, [activeTab]);

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const invites = await getTeamInvitations(team.id);
      setInvitations(invites || []);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations');
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');

    try {
      const emailList = emails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
      const results: InviteResult[] = [];
      
      // Process each email
      for (const email of emailList) {
        const result = await inviteTeamMember(team.id, email, teamRole, decisionRole);
        results.push(result);
      }

      // Count added and invited users
      const added = results.filter(r => r.status === 'added').length;
      const invited = results.filter(r => r.status === 'invited').length;
      
      // Create success message
      let message = '';
      if (added > 0) {
        message += `${added} user${added !== 1 ? 's' : ''} added directly. `;
      }
      if (invited > 0) {
        message += `${invited} invitation${invited !== 1 ? 's' : ''} sent.`;
      }
      
      setSuccessMessage(message);

      setEmails('');
      setSuccess(true);
      
      // Refresh invitations if we sent any
      if (invited > 0) {
        fetchInvitations();
      }
    } catch (err) {
      console.error('Failed to add members:', err);
      setError(err instanceof Error ? err.message : 'Failed to add members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromDirectory = async (userId: string, role: string, decisionRole: string) => {
    try {
      await addTeamMember(team.id, userId, role, decisionRole);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      return true;
    } catch (err) {
      console.error('Failed to add member from directory:', err);
      throw err;
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: Role) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ 
          role: newRole 
        })
        .eq('id', memberId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      setProcessingInvitationId(invitationId);
      await revokeInvitation(invitationId);
      // Refresh the invitations list
      fetchInvitations();
      setSuccessMessage('Invitation revoked successfully');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setProcessingInvitationId(invitationId);
      await resendInvitation(invitationId);
      // Refresh the invitations list
      fetchInvitations();
      setSuccessMessage('Invitation resent successfully');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setProcessingInvitationId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Team Members</h2>
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
              Add by Email
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'pending'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Pending Invites
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'directory'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <UserSearch className="h-4 w-4 inline mr-2" />
              Directory
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'existing'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Current Members
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
              {successMessage || 'Operation completed successfully!'}
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              {/* Role Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Role
                </label>
                <select
                  value={teamRole}
                  onChange={(e) => setTeamRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {TEAM_ROLES.map(({ id, label, description }) => (
                    <option key={id} value={id}>
                      {label} - {description}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Decision Role Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Decision Role
                </label>
                <select
                  value={decisionRole}
                  onChange={(e) => setDecisionRole(e.target.value as DecisionRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {DECISION_ROLES.map(({ id, label, description }) => (
                    <option key={id} value={id}>
                      {label} - {description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
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
                    Adding Members...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Add Members
                  </>
                )}
              </button>
            </form>
          )}

          {/* Directory Tab */}
          {activeTab === 'directory' && (
            <UserDirectoryTab onAddUser={handleAddFromDirectory} />
          )}

          {/* Pending Invitations Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loadingInvitations ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
                  <span className="text-gray-600">Loading invitations...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending invitations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Pending Invitations</h3>
                  {invitations.map(invitation => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{invitation.email}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="inline-flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Invited {new Date(invitation.invited_at).toLocaleString()}
                          </span>
                          <span className="mx-2">•</span>
                          <span>
                            Team Role: <span className="font-medium">{invitation.role}</span>
                          </span>
                          <span className="mx-2">•</span>
                          <span>
                            Decision Role: <span className="font-medium">{invitation.decision_role}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Tooltip content="Resend invitation">
                          <button
                            disabled={processingInvitationId === invitation.id}
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50"
                          >
                            {processingInvitationId === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                        </Tooltip>
                        <Tooltip content="Revoke invitation">
                          <button
                            disabled={processingInvitationId === invitation.id}
                            onClick={() => handleRevokeInvitation(invitation.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            {processingInvitationId === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invitations.length === 0 && !loadingInvitations && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No pending invitations</p>
                  <p className="text-sm mt-2">Invite team members using the "Add by Email" tab</p>
                </div>
              )}
            </div>
          )}

          {/* Current Members Tab */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              {team.members.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No members yet
                </p>
              ) : (
                <div className="space-y-2">
                  {team.members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.email || member.user_id}
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value as TeamRole)}
                            className="text-sm bg-transparent border-none focus:ring-0"
                          >
                            {TEAM_ROLES.map(role => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={member.decision_role || 'viewer'}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value as DecisionRole)}
                            className="text-sm bg-transparent border-none focus:ring-0"
                          >
                            {DECISION_ROLES.map(role => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Tooltip content="Remove member">
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}