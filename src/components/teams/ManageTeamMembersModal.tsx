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
  CheckCircle,
  Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTeams } from '../../contexts/TeamsContext';
import { sendTeamInvitationEmail } from '../../lib/email';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user } = useAuth();
  const { addTeamMember, inviteTeamMember, getTeamInvitations, revokeInvitation, resendInvitation } = useTeams();

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
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<'checking' | 'ok' | 'error' | null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchInvitations();
    }
    checkEdgeFunctionStatus();
  }, [activeTab]);

  // Edge function health check (implementation omitted for brevity)
  const checkEdgeFunctionStatus = async () => {
    // …
  };

  const viewInvitationLogs = async (inv: Invitation) => {
    setSelectedInvitation(inv);
    setLoadingLogs(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_invitation_status', { invitation_uuid: inv.id });
      if (error) throw error;
      setInvitationLogs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const invs = await getTeamInvitations(team.id);
      setInvitations(invs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const list = emails.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      const results: InviteResult[] = [];
      for (const email of list) {
        try {
          const r = await inviteTeamMember(team.id, email, teamRole, decisionRole);
          results.push(r);
        } catch (err: any) {
          if (err.code === '23505') {
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
      setSuccess(true);
      setEmails('');
      if (invited) await fetchInvitations();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    try {
      await revokeInvitation(id);
      setSuccessMessage('Invitation revoked.');
      setSuccess(true);
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleResendInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    try {
      await resendInvitation(id);
      setSuccessMessage('Invitation resent.');
      setSuccess(true);
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setSendingTestEmail(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/send-team-invite/test-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: testEmailAddress })
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setTestEmailResult(data);
      if (data.success) {
        setSuccessMessage(`Test email sent to ${testEmailAddress}.`);
        setSuccess(true);
        // also call DB function
        const { data: dbRes } = await supabase.rpc('test_email_sending', { to_email: testEmailAddress });
        if (dbRes?.success) {
          setSuccessMessage(prev => `${prev} Also sent via DB function.`);
        }
      } else {
        setError(data.error || 'Failed to send test email');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
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
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab === 'email' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Add by Email
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab === 'pending' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Pending Invites
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab === 'directory' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserSearch className="h-4 w-4 inline mr-2" />
              Directory
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 px-4 rounded-lg ${
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
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Edge Function Status & Test Email */}
          {edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
              edgeFunctionStatus === 'ok' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {edgeFunctionStatus === 'ok' ? <CheckCircle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
              <div>
                <p className="font-medium">
                  {edgeFunctionStatus === 'ok' ? 'Email system is operational' : 'Checking email system...'}
                </p>
                {edgeFunctionStatus === 'ok' && (
                  <form onSubmit={handleSendTestEmail} className="mt-2 flex gap-2">
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      placeholder="Enter email for test"
                      className="flex-1 px-2 py-1 border rounded"
                      required
                    />
                    <button type="submit" disabled={sendingTestEmail} className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50">
                      {sendingTestEmail ? 'Sending…' : 'Send Test Email'}
                    </button>
                  </form>
                )}
                {edgeFunctionError && <p className="text-sm mt-1">{edgeFunctionError}</p>}
              </div>
            </div>
          )}
          {testEmailResult && (
            <div className="mb-4 bg-gray-50 p-3 rounded">
              <h4 className="font-medium mb-2">Test Email Results</h4>
              <pre className="text-xs text-gray-600 max-h-40 overflow-auto bg-gray-100 p-2 rounded">
                {JSON.stringify(testEmailResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              {/* Team Role */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Role</label>
                <select
                  value={teamRole}
                  onChange={e => setTeamRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {TEAM_ROLES.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label} – {r.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Decision Role */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Decision Role</label>
                <select
                  value={decisionRole}
                  onChange={e => setDecisionRole(e.target.value as DecisionRole)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
                <textarea
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
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
                    Adding…
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

          {/* Pending Invitations */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loadingInvitations ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
                  <span className="text-gray-600">Loading invitations…</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending invitations</p>
                </div>
              ) : (
                invitations.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{inv.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="inline-flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Invited {new Date(inv.invited_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Tooltip content="View logs">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            viewInvitationLogs(inv);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Resend">
                        <button
                          disabled={processingInvitationId === inv.id}
                          onClick={e => {
                            e.stopPropagation();
                            handleResendInvitation(inv.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded disabled:opacity-50"
                        >
                          {processingInvitationId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      </Tooltip>
                      <Tooltip content="Revoke">
                        <button
                          disabled={processingInvitationId === inv.id}
                          onClick={e => {
                            e.stopPropagation();
                            handleRevokeInvitation(inv.id);
                          }}```   (file truncated)  