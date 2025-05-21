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

  // fetch invites & health on tab switch
  useEffect(() => {
    if (activeTab === 'pending') fetchInvitations();
    checkHealth();
  }, [activeTab]);

  const checkHealth = async () => {
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
  };

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const invs = await getTeamInvitations(team.id);
      setInvitations(invs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingInvitations(false);
    }
  };

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
      if (list.some(a => a)) fetchInvitations();
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
      fetchInvitations();
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
      fetchInvitations();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  // … rest of your test-email, logs, tabs, and JSX exactly as before, plus above banners:

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Team Members</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full"><X className="h-5 w-5"/></button>
        </div>

        {/* BANNERS */}
        <div className="p-4">
          {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded flex gap-2"><AlertCircle/><span>{error}</span></div>}
          {successMessage && <div className="mb-4 bg-green-50 text-green-700 p-3 rounded">{successMessage}</div>}
          {infoMessage    && <div className="mb-4 bg-blue-50  text-blue-700  p-3 rounded">{infoMessage}</div>}

          {/* HEALTH & TEST EMAIL */}
          {edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded flex gap-2 ${edgeFunctionStatus==='ok'? 'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>
              {edgeFunctionStatus==='ok'? <CheckCircle/>:<Loader2 className="animate-spin"/>}
              <div>
                <p className="font-medium">
                  {edgeFunctionStatus==='ok' ? 'Email system is operational' : 'Checking email system…'}
                </p>
                {edgeFunctionError && <p className="text-sm mt-1">{edgeFunctionError}</p>}
                {edgeFunctionStatus==='ok' && (
                  <form onSubmit={async e => {
                    e.preventDefault();
                    setSendingTestEmail(true);
                    try {
                      const res = await supabase.functions.invoke('send-team-invite/test-email', { body:{ email:testEmailAddress }});
                      setTestEmailResult(res.data);
                    } catch(err){ setError((err as any).message) }
                    setSendingTestEmail(false);
                  }} className="mt-2 flex gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Enter email"
                      value={testEmailAddress}
                      onChange={e=>setTestEmailAddress(e.target.value)}
                      className="flex-1 border px-2 py-1 rounded"
                    />
                    <button disabled={sendingTestEmail} className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50">
                      {sendingTestEmail?'Sending…':'Send Test Email'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
          {testEmailResult && (
            <pre className="mb-4 max-h-40 overflow-auto bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(testEmailResult,null,2)}
            </pre>
          )}

        {/* …then your tabs and forms exactly as before… */}
        </div>
      </div>
    </div>
  );
}