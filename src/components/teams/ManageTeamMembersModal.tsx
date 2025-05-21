// src/components/teams/ManageTeamMembersModal.tsx

import React, { useState, useEffect } from 'react';
import {
  X, Mail, Loader2, UserPlus, UserMinus,
  AlertCircle, UserSearch, Clock, RefreshCw,
  XCircle, CheckCircle, Info
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useTeams } from '../../contexts/TeamsContext';
import { sendInviteViaEdge, sendTeamInvitationEmail } from '../../lib/email';
import { useAuth } from '../../contexts/AuthContext';
import type { Team } from '../../types/teams';
import type { Invitation, InviteResult } from '../../types/invitations';
import Tooltip from '../Tooltip';
import UserDirectoryTab from './UserDirectoryTab';

interface Props { team: Team; onClose: () => void; }
type TabId = 'email' | 'directory' | 'existing' | 'pending';
type TeamRole = 'admin' | 'member';
type DecisionRole = 'owner' | 'approver' | 'contributor' | 'viewer';

const TEAM_ROLES = [
  { id: 'admin', label: 'Admin', description: 'Can manage team and members' },
  { id: 'member', label: 'Member', description: 'Regular team member' }
] as const;
const DECISION_ROLES = [
  { id: 'owner', label: 'Decision Lead', description: 'Full control' },
  { id: 'approver', label: 'Approver', description: 'Can approve/reject' },
  { id: 'contributor', label: 'Contributor', description: 'Can add suggestions' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only' }
] as const;

export default function ManageTeamMembersModal({ team, onClose }: Props) {
  const { user } = useAuth();
  const {
    addTeamMember, inviteTeamMember, getTeamInvitations, revokeInvitation
  } = useTeams();

  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');
  const [decisionRole, setDecisionRole] = useState<DecisionRole>('contributor');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [successMessage, setSuccessMessage] = useState<string|null>(null);
  const [infoMessage, setInfoMessage] = useState<string|null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string|null>(null);

  const [selectedInvitation, setSelectedInvitation] = useState<Invitation|null>(null);
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<'checking'|'ok'|'error'|null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState<string|null>(null);

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'pending') fetchInvitations();
    checkHealth();
  }, [activeTab]);

  async function checkHealth() {
    setEdgeFunctionStatus('checking');
    setEdgeFunctionError(null);
    try {
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/send-team-invite/health`, {
        headers: { apikey: supabase.supabaseKey }
      });
      const body = await res.json();
      if (res.ok && body.success) setEdgeFunctionStatus('ok');
      else {
        setEdgeFunctionStatus('error');
        setEdgeFunctionError(body.error || body.message || 'Health check failed');
      }
    } catch (e: any) {
      setEdgeFunctionStatus('error');
      setEdgeFunctionError(e.message);
    }
  }

  async function fetchInvitations() {
    setLoadingInvitations(true);
    try {
      const invs = await getTeamInvitations(team.id);
      setInvitations(invs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingInvitations(false);
    }
  }

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setInfoMessage(null);
    setLoading(true);
    setError(null);

    try {
      const list = emails.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      for (const addr of list) {
        const res = await inviteTeamMember(team.id, addr, teamRole, decisionRole);
        if (res.status === 'invited') setSuccessMessage(`Invitation sent to ${addr}`);
        if (res.status === 'already_invited') setInfoMessage(`${addr} was already invited`);
      }
      setEmails('');
      if (list.length) await fetchInvitations();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    setSuccessMessage(null);
    setInfoMessage(null);
    try {
      const inv = invitations.find(i => i.id === id)!;
      const edge = await sendInviteViaEdge({
        invitation_id: id,
        email: inv.email,
        team_id: team.id,
        team_name: team.name,
        inviter_id: user!.id
      });
      if (edge.success) setSuccessMessage(`Invitation resent to ${inv.email}`);
      else setError(edge.error || 'Failed to resend invitation');
      await fetchInvitations();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    try {
      await revokeInvitation(id);
      setSuccessMessage('Invitation revoked');
      await fetchInvitations();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  // --- RENDER ---
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
            <X className="h-5 w-5"/>
          </button>
        </div>

        <div className="p-4">
          {/* Banners */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded flex items-start gap-2">
              <AlertCircle className="h-5 w-5"/><span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded">{successMessage}</div>
          )}
          {infoMessage && (
            <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded">{infoMessage}</div>
          )}

          {/* Health & Test Email */}
          {edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded flex items-start gap-2 ${
              edgeFunctionStatus==='ok' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}>
              {edgeFunctionStatus==='ok'
                ? <CheckCircle className="h-5 w-5"/>
                : <Loader2 className="animate-spin h-5 w-5"/>
              }
              <div>
                <p className="font-medium">
                  {edgeFunctionStatus==='ok'
                    ? 'Email system is operational'
                    : 'Checking email system…'}
                </p>
                {edgeFunctionError && <p className="text-sm mt-1">{edgeFunctionError}</p>}

                {edgeFunctionStatus==='ok' && (
                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      setSendingTestEmail(true);
                      try {
                        const { data, error } = await supabase.functions.invoke(
                          'send-team-invite/test-email',
                          { body: { email: testEmailAddress } }
                        );
                        if (error) throw error;
                        setTestEmailResult(data);
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setSendingTestEmail(false);
                      }
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="email"
                      placeholder="Enter email"
                      className="flex-1 px-2 py-1 border rounded"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      required
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
              </div>
            </div>
          )}

          {testEmailResult && (
            <pre className="mb-4 max-h-40 overflow-auto bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(testEmailResult, null, 2)}
            </pre>
          )}

          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab==='email' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2"/>Add by Email
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab==='pending' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2"/>Pending Invites
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab==='directory' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserSearch className="h-4 w-4 inline mr-2"/>Directory
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab==='existing' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-2"/>Current Members
            </button>
          </div>

          {/* Email Tab */}
          {activeTab==='email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team Role</label>
                <select
                  value={teamRole}
                  onChange={e=>setTeamRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {TEAM_ROLES.map(r =>
                    <option key={r.id} value={r.id}>
                      {r.label} – {r.description}
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Decision Role</label>
                <select
                  value={decisionRole}
                  onChange={e=>setDecisionRole(e.target.value as DecisionRole)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {DECISION_ROLES.map(r =>
                    <option key={r.id} value={r.id}>
                      {r.label} – {r.description}
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Emails</label>
                <textarea
                  value={emails}
                  onChange={e=>setEmails(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="One per line or comma-separated"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emails.trim()}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                {loading
                  ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/>Adding…</>
                  : <><UserPlus className="h-5 w-5 mr-2"/>Add Members</>
                }
              </button>
            </form>
          )}

          {/* Pending Invites */}
          {activeTab==='pending' && (
            <div className="space-y-4">
              {loadingInvitations
                ? <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2"/>
                    <span>Loading invitations…</span>
                  </div>
                : invitations.length === 0
                  ? <p className="text-center text-gray-500 py-8">No pending invitations</p>
                  : invitations.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{inv.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            <Clock className="h-3 w-3 inline mr-1"/>Invited {new Date(inv.invited_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Tooltip content="View logs">
                            <button onClick={e=>{ e.stopPropagation(); setSelectedInvitation(inv); fetchInvLogs(inv); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            ><Info className="h-4 w-4"/></button>
                          </Tooltip>
                          <Tooltip content="Resend">
                            <button disabled={processingInvitationId===inv.id} onClick={e=>{ e.stopPropagation(); handleResendInvitation(inv.id); }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-50 rounded"
                            >
                              {processingInvitationId===inv.id
                                ? <Loader2 className="h-4 w-4 animate-spin"/>
                                : <RefreshCw className="h-4 w-4"/>
                              }
                            </button>
                          </Tooltip>
                          <Tooltip content="Revoke">
                            <button disabled={processingInvitationId===inv.id} onClick={e=>{ e.stopPropagation(); handleRevokeInvitation(inv.id); }}
                              className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50 rounded"
                            >
                              {processingInvitationId===inv.id
                                ? <Loader2 className="h-4 w-4 animate-spin"/>
                                : <XCircle className="h-4 w-4"/>
                              }
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))
              }
            </div>
          )}

          {/* Invitation Logs Modal */}
          {selectedInvitation && (
            <InvitationLogsModal
              invitation={selectedInvitation}
              logs={invitationLogs}
              loading={loadingLogs}
              onClose={()=>setSelectedInvitation(null)}
              onResend={()=>handleResendInvitation(selectedInvitation.id)}
            />
          )}

          {/* Current Members */}
          {activeTab==='existing' && (
            <div className="space-y-4">
              {team.members.length === 0
                ? <p className="text-center text-gray-500 py-8">No members yet</p>
                : team.members.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{m.email||m.user_id}</p>
                        <div className="flex gap-2 mt-1">
                          <select
                            value={m.role}
                            onChange={e=>handleUpdateRole(m.id,e.target.value)}
                            className="text-sm bg-transparent border-none focus:ring-0"
                          >
                            {TEAM_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                          </select>
                          <select
                            value={m.decision_role||'viewer'}
                            onChange={e=>handleUpdateRole(m.id,e.target.value)}
                            className="text-sm bg-transparent border-none focus:ring-0"
                          >
                            {DECISION_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <button onClick={()=>handleRemoveMember(m.id)} className="p-2 text-gray-400 hover:text-red-600 rounded">
                        <UserMinus className="h-5 w-5"/>
                      </button>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}