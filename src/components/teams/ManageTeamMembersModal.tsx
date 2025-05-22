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
import { sendInviteViaEdge } from '../../lib/email';
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

export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMembersModalProps) {
  const { user } = useAuth();
  const { addTeamMember, inviteTeamMember, getTeamInvitations, revokeInvitation } = useTeams();

  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);

  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<'checking' | 'ok' | 'error' | null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'pending') fetchInvitations();
    checkEdgeFunctionStatus();
  }, [activeTab]);

  async function checkEdgeFunctionStatus() {
    setEdgeFunctionStatus('checking');
    setEdgeFunctionError(null);
    try {
      // invokes GET /functions/v1/send-team-invite/health
      const { data, error } = await supabase.functions.invoke('send-team-invite/health');
      if (error) throw error;
      if (data.success) setEdgeFunctionStatus('ok');
      else {
        setEdgeFunctionStatus('error');
        setEdgeFunctionError(data.message || 'Unknown health-check failure');
      }
    } catch (err: any) {
      console.error('Edge Function health error', err);
      setEdgeFunctionStatus('error');
      setEdgeFunctionError(err.message);
    }
  }

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

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const list = emails.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
    if (!list.length) return;

    setLoading(true);
    try {
      const results: InviteResult[] = [];
      for (const email of list) {
        const result = await inviteTeamMember(team.id, email, 'member', 'contributor');
        results.push(result);
        if (result.status === 'invited') {
          setSuccessMessage(`Invitation sent to ${email}`);
        } else if (result.status === 'already_invited') {
          setInfoMessage(`${email} is already invited`);
        }
      }
      setEmails('');
      if (results.some(r => r.status === 'invited')) {
        await fetchInvitations();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromDirectory = async (userId: string) => {
    setError(null);
    try {
      await addTeamMember(team.id, userId, 'member', 'contributor');
      setSuccessMessage('Member added.');
      setTimeout(() => setSuccessMessage(null), 3000);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await revokeInvitation(id);
      setSuccessMessage('Invitation revoked.');
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  const handleResendInvitation = async (id: string) => {
    setProcessingInvitationId(id);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const inv = invitations.find(i => i.id === id);
    if (!inv) {
      setError('Invitation not found');
      setProcessingInvitationId(null);
      return;
    }

    try {
      const edgeResult = await sendInviteViaEdge({
        invitation_id: id,
        email: inv.email,
        team_id: team.id,
        team_name: team.name,
        inviter_id: user!.id
      });
      if (edgeResult.success) {
        setSuccessMessage(`Invitation resent to ${inv.email}`);
      } else {
        throw new Error(edgeResult.error || 'Resend failed');
      }
      await fetchInvitations();
    } catch (err: any) {
      console.error('Error resending invite via Edge Function:', err);
      setError(err.message);
    } finally {
      setProcessingInvitationId(null);
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

        <div className="p-4">
          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button onClick={() => setActiveTab('email')} className={`flex-1 py-2 px-4 rounded-lg ${activeTab==='email'?'bg-indigo-100 text-indigo-700':'hover:bg-gray-100'}`}>
              <Mail className="h-4 w-4 inline mr-2" />Add by Email
            </button>
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2 px-4 rounded-lg ${activeTab==='pending'?'bg-indigo-100 text-indigo-700':'hover:bg-gray-100'}`}>
              <Clock className="h-4 w-4 inline mr-2" />Pending Invites
            </button>
            <button onClick={() => setActiveTab('directory')} className={`flex-1 py-2 px-4 rounded-lg ${activeTab==='directory'?'bg-indigo-100 text-indigo-700':'hover:bg-gray-100'}`}>
              <UserSearch className="h-4 w-4 inline mr-2" />Directory
            </button>
            <button onClick={() => setActiveTab('existing')} className={`flex-1 py-2 px-4 rounded-lg ${activeTab==='existing'?'bg-indigo-100 text-indigo-700':'hover:bg-gray-100'}`}>
              <UserPlus className="h-4 w-4 inline mr-2" />Current Members
            </button>
          </div>

          {/* Inline Messages */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
              {successMessage}
            </div>
          )}
          {infoMessage && (
            <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded-lg">
              {infoMessage}
            </div>
          )}

          {/* Edge Function Health */}
          {edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${edgeFunctionStatus==='ok'?'bg-green-50 text-green-700':'bg-blue-50 text-blue-700'}`}>
              {edgeFunctionStatus==='ok' ? <CheckCircle className="h-5 w-5"/> : <Loader2 className="h-5 w-5 animate-spin"/>}
              <div>
                <p className="font-medium">
                  {edgeFunctionStatus==='ok' ? 'Email system is operational' : 'Checking email system…'}
                </p>
                {edgeFunctionError && <p className="text-sm mt-1">{edgeFunctionError}</p>}
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
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
                {loading ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/>Sending…</> : <><UserPlus className="h-5 w-5 mr-2"/>Send Invites</>}
              </button>
            </form>
          )}

          {/* Directory Tab */}
          {activeTab === 'directory' && <UserDirectoryTab onAddUser={handleAddFromDirectory}/>}

          {/* Pending Invitations */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {loadingInvitations
                ? <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2"/><span>Loading…</span></div>
                : invitations.length === 0
                  ? <div className="text-center py-8 text-gray-500">No pending invitations</div>
                  : invitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div>
                        <div className="font-medium text-gray-900">{inv.email}</div>
                        <div className="text-xs text-gray-500 mt-1"><Clock className="h-3 w-3 inline mr-1"/>Invited {new Date(inv.invited_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <Tooltip content="Resend"><button disabled={processingInvitationId===inv.id} onClick={() => handleResendInvitation(inv.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded disabled:opacity-50">{processingInvitationId===inv.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}</button></Tooltip>
                        <Tooltip content="Revoke"><button disabled={processingInvitationId===inv.id} onClick={() => handleRevokeInvitation(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50">{processingInvitationId===inv.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="h-4 w-4"/>}</button></Tooltip>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}

          {/* Current Members */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              {team.members.length === 0
                ? <p className="text-center text-gray-500 py-4">No members yet</p>
                : team.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{m.email || m.user_id}</div>
                    </div>
                    <button onClick={() => {/* implement remove if desired */}} className="p-2 text-gray-400 hover:text-red-600 rounded"><UserMinus className="h-5 w-5"/></button>
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