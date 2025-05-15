// src/components/teams/ManageTeamMembersModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Loader2,
  UserPlus,
  UserMinus,
  AlertCircle,
  UserSearch,
  Clock,
  RefreshCw,
  XCircle,
  CheckCircle
} from 'lucide-react';
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
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);

  const {
    addTeamMember,
    inviteTeamMember,
    getTeamInvitations,
    revokeInvitation,
    resendInvitation
  } = useTeams();

  useEffect(() => {
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
      setError((err as Error).message);
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
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(Boolean);

      const results: InviteResult[] = [];
      for (const email of emailList) {
        try {
          const result = await inviteTeamMember(
            team.id,
            email,
            teamRole,
            decisionRole
          );
          results.push(result);
        } catch (err: any) {
          if (err.code === '23505') {
            // conflict on invitations.email
            results.push({ status: 'already_invited', email });
          } else {
            throw err;
          }
        }
      }

      const added = results.filter(r => r.status === 'added').length;
      const invited = results.filter(r => r.status === 'invited').length;
      const already = results.filter(r => r.status === 'already_invited').length;

      let msg = '';
      if (added) msg += `${added} user${added !== 1 ? 's' : ''} added. `;
      if (invited) msg += `${invited} invitation${invited !== 1 ? 's' : ''} sent. `;
      if (already) msg += `${already} already invited.`;
      setSuccessMessage(msg.trim());

      setEmails('');
      setSuccess(true);

      if (invited) fetchInvitations();
    } catch (err) {
      console.error('Failed to add members:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromDirectory = async (userId: string) => {
    try {
      await addTeamMember(team.id, userId, teamRole, decisionRole);
      setSuccessMessage('Member added.');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      return true;
    } catch (err) {
      console.error('Failed to add member from directory:', err);
      setError((err as Error).message);
      return false;
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await supabase.from('team_members').delete().eq('id', memberId);
      setSuccessMessage('Member removed.');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError((err as Error).message);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);
      setSuccessMessage('Role updated.');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError((err as Error).message);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setProcessingInvitationId(invitationId);
    try {
      await revokeInvitation(invitationId);
      setSuccessMessage('Invitation revoked.');
      setSuccess(true);
      fetchInvitations();
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
      setError((err as Error).message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingInvitationId(invitationId);
    try {
      await resendInvitation(invitationId);
      setSuccessMessage('Invitation resent.');
      setSuccess(true);
      fetchInvitations();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError((err as Error).message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Team Members</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'email' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Add by Email
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'pending' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Pending Invites
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'directory' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserSearch className="h-4 w-4 inline mr-2" />
              Directory
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'existing' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-2" />
              Current Members
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              {/* Team Role */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Role
                </label>
                <select
                  value={teamRole}
                  onChange={e => setTeamRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg focus