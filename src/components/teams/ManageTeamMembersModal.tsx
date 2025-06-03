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
import { sendInviteViaEdge } from '../../lib/email';
import type { Team } from '../../types/teams';
import type { Invitation } from '../../types/invitations';
import Tooltip from '../Tooltip';
import UserDirectoryTab from './UserDirectoryTab';

interface ManageTeamMembersModalProps {
  team: Team;
  onClose: () => void;
}

type TabId = 'email' | 'directory' | 'existing' | 'pending';
type TeamRole = 'admin' | 'member';
type DecisionRole = 'owner' | 'approver' | 'contributor' | 'viewer';

const TEAM_ROLES = [
  { id: 'admin', label: 'Admin', description: 'Can manage team and members' },
  { id: 'member', label: 'Member', description: 'Regular team member' }
] as const;

const DECISION_ROLES = [
  { id: 'owner', label: 'Decision Lead', description: 'Full control over the decision' },
  { id: 'approver', label: 'Approver', description: 'Can approve or reject suggestions' },
  { id: 'contributor', label: 'Contributor', description: 'Can add suggestions and comments' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access' }
] as const;

export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMembersModalProps) {
  const { user, addTeamMember, inviteTeamMember, getTeamInvitations, revokeInvitation } = useTeams();

  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');
  const [decisionRole, setDecisionRole] = useState<DecisionRole>('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);

  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<'checking' | 'ok' | 'error' | null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState<string | null>(null);

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // whenever we switch tabs, re-check health; when 'pending', also reload invites
  useEffect(() => {
    checkEdgeFunctionStatus();
    if (activeTab === 'pending') {
      fetchInvitations();
    }
  }, [activeTab]);

  async function checkEdgeFunctionStatus() {
    setEdgeFunctionStatus('checking');
    setEdgeFunctionError(null);
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-team-invite/health`);
      const data = await response.json();
      if (response.ok && data.success) {
        setEdgeFunctionStatus('ok');
      } else {
        setEdgeFunctionStatus('error');
        setEdgeFunctionError('Email system unreachable');
      }
    } catch (err: any) {
      setEdgeFunctionStatus('error');
      setEdgeFunctionError(err.message);
    }
  }

  // fetch pending invitations from your context
  async function fetchInvitations() {
    setLoadingInvitations(true);
    setError(null);
    try {
      const invs = await getTeamInvitations(team.id);
      setInvitations(invs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInvitations(false);
    }
  }

  // add by email handler
  async function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const list = emails.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
      for (const email of list) {
        const result = await inviteTeamMember(team.id, email, teamRole, decisionRole);
        if (result.status === 'invited') {
          setSuccessMessage(`Invitation sent to ${email}`);
        } else if (result.status === 'already_invited') {
          setInfoMessage(`${email} is already invited`);
        }
      }
      setEmails('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (activeTab === 'pending') await fetchInvitations();
    }
  }

  // resend invite via Edge
  async function handleResendInvitation(inv: Invitation) {
    setProcessingInvitationId(inv.id);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    try {
      const edgeResult = await sendInviteViaEdge({
        invitation_id: inv.id,
        email: inv.email,
        team_id: team.id,
        team_name: team.name,
        inviter_id: user!.id
      });
      if (edgeResult.success) {
        setSuccessMessage(`Invitation resent to ${inv.email}`);
      } else {
        setError(edgeResult.error || 'Failed to resend invitation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
      fetchInvitations();
    }
  }

  // revoke pending invitation
  async function handleRevokeInvitation(invId: string) {
    setProcessingInvitationId(invId);
    setError(null);
    try {
      await revokeInvitation(invId);
      setInfoMessage('Invitation revoked');
      fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
    }
  }

  // send a test email
  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmailAddress.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError(null);
    setSendingTestEmail(true);
    try {
      await fetch(`${supabase.supabaseUrl}/functions/v1/send-team-invite/test-email`, {
        method: 'POST',
        headers: {
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: testEmailAddress })
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingTestEmail(false);
    }
  }

  // safe array lengths
  const pendingCount = invitations?.length ?? 0;
  const memberCount = team.members?.length ?? 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.currentTarget === e.target && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Team Members</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TABS */}
        <div className="p-4">
          <div className="flex gap-1 mb-4">
            {(['email','pending','directory','existing'] as TabId[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-lg transition ${
                  activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
                }`}
              >
                {tab === 'email' && <Mail className="inline mr-1 h-4 w-4" />}
                {tab === 'pending' && <Clock className="inline mr-1 h-4 w-4" />}
                {tab === 'directory' && <UserSearch className="inline mr-1 h-4 w-4" />}
                {tab === 'existing' && <UserPlus className="inline mr-1 h-4 w-4" />}
                {tab === 'email'
                  ? 'Add by Email'
                  : tab === 'pending'
                  ? `Pending Invites (${pendingCount})`
                  : tab === 'directory'
                  ? 'Directory'
                  : `Current Members (${memberCount})`}
              </button>
            ))}
          </div>

          {/* GLOBAL FEEDBACK */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded">
              {successMessage}
            </div>
          )}
          {infoMessage && (
            <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded">
              {infoMessage}
            </div>
          )}

          {/* HEALTH & TEST */}
          {activeTab === 'email' && edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              edgeFunctionStatus === 'ok' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {edgeFunctionStatus === 'ok' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {edgeFunctionStatus === 'ok'
                    ? 'Email system operational'
                    : 'Checking email system...'}
                </p>
                {edgeFunctionStatus === 'ok' && (
                  <form onSubmit={handleSendTestEmail} className="mt-2 flex gap-2">
                    <input
                      type="email"
                      className="flex-1 px-2 py-1 border rounded"
                      placeholder="Test email address"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={sendingTestEmail}
                      className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50"
                    >
                      {sendingTestEmail ? 'Sending…' : 'Send Test Email'}
                    </button>
                  </form>
                )}
                {edgeFunctionError && <p className="text-sm mt-1 text-red-600">{edgeFunctionError}</p>}
              </div>
            </div>
          )}

          {/* TAB CONTENT */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              {/* Team Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Team Role</label>
                <select
                  value={teamRole}
                  onChange={e => setTeamRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                >
                  {TEAM_ROLES.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label} – {r.description}
                    </option>
                  ))}
                </select>
              </div>
              {/* Decision Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Decision Role</label>
                <select
                  value={decisionRole}
                  onChange={e => setDecisionRole(e.target.value as DecisionRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                >
                  {DECISION_ROLES.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label} – {r.description}
                    </option>
                  ))}
                </select>
              </div>
              {/* Emails */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Addresses</label>
                <textarea
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  placeholder="One per line or comma-separated"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emails.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                {loading ? 'Adding…' : 'Add Members'}
              </button>
            </form>
          )}

          {activeTab === 'directory' && (
            <UserDirectoryTab
              onAddUser={async id => {
                const ok = await addTeamMember(team.id, id, teamRole, decisionRole);
                if (ok) setInfoMessage('Member added');
              }}
            />
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loadingInvitations ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
                  <span>Loading invitations…</span>
                </div>
              ) : pendingCount === 0 ? (
                <p className="text-center text-gray-500 py-8">No pending invitations</p>
              ) : (
                invitations.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Invited {new Date(inv.invited_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Tooltip content="Resend">
                        <button
                          disabled={processingInvitationId === inv.id}
                          onClick={() => handleResendInvitation(inv)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded disabled:opacity-50"
                        >
                          {processingInvitationId === inv.id ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      </Tooltip>
                      <Tooltip content="Revoke">
                        <button
                          disabled={processingInvitationId === inv.id}
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                        >
                          {processingInvitationId === inv.id ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'existing' && (
            <div className="space-y-4">
              {memberCount === 0 ? (
                <p className="text-center text-gray-500 py-8">No members yet</p>
              ) : (
                (team.members || []).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{m.email || m.user_id}</p>
                    </div>
                    <button
                      onClick={() => /* optionally remove member */ null}
                      className="p-2 text-gray-400 hover:text-red-600 rounded"
                    >
                      <UserMinus className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}