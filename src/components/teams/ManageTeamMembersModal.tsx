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
import { sendTestEmail, sendTeamInvitationEmail } from '../../lib/email';
import { useTeams } from '../../contexts/TeamsContext';
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
    
    // Check edge function status when modal opens
    checkEdgeFunctionStatus();
  }, [activeTab]);

  // Function to check edge function status
  const checkEdgeFunctionStatus = async () => {
    setEdgeFunctionStatus('checking');
    setEdgeFunctionError(null);
    
    try {
      // Check if we can access the email system by calling the test_email_sending RPC
      const { data, error } = await supabase.rpc('test_email_sending', { 
        to_email: 'test@example.com' 
      });
      
      if (error) {
        throw error;
      }
      
      // Check if the email system is configured
      if (data.error && data.error.includes('Missing email credentials')) {
        setEdgeFunctionStatus('error');
        setEdgeFunctionError('Email system is not properly configured: Missing API key');
      } else {
        setEdgeFunctionStatus('ok');
      }
    } catch (err) {
      console.error('Error checking edge function status:', err);
      setEdgeFunctionStatus('error');
      setEdgeFunctionError(err instanceof Error ? 
        `Error: ${err.message}` : 
        'Failed to check edge function status');
    }
  };

  // Function to view invitation logs
  const viewInvitationLogs = async (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setLoadingLogs(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc(
        'get_invitation_status',
        { 
          invitation_uuid: invitation.id 
        }
      );
      
      if (error) throw error;
      setInvitationLogs(data || []);
    } catch (err) {
      console.error('Error fetching invitation logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invitation logs');
    } finally {
      setLoadingLogs(false);
    }
  };

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
    
    console.log('Starting email invite process for emails:', emails);

    try {
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(Boolean);
      
      console.log('Processed email list:', emailList);

      const results: InviteResult[] = [];
      for (const email of emailList) {
        try {
          console.log(`Inviting ${email} to team ${team.id}`);
          const result = await inviteTeamMember(
            team.id,
            email,
            teamRole,
            decisionRole
          );
          console.log(`Invite result for ${email}:`, result);
          results.push(result);
        } catch (err: any) {
          console.error(`Error inviting ${email}:`, err);
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
      console.log('Invitation process completed:', msg.trim());

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
      if (!user) {
        throw new Error('You must be logged in to resend invitations');
      }
      
      // Get invitation details
      const { data: invitation, error: invitationError } = await supabase
        .from('invitations')
        .select('email, team_id')
        .eq('id', invitationId)
        .single();
        
      if (invitationError) throw invitationError;
      
      // Get team details
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('name')
        .eq('id', invitation.team_id)
        .single();
        
      if (teamError) throw teamError;
      
      // Track invitation status
      await supabase.rpc(
        'track_invitation_status',
        { 
          invitation_uuid: invitationId,
          status_value: 'resend_requested',
          details_json: { 
            requested_by: user.id,
            timestamp: new Date().toISOString()
          }
        }
      );
      
      // Send invitation email
      const result = await sendTeamInvitationEmail(
        invitationId,
        invitation.email,
        team.name
      );
      
      if (result.success) {
        // Update invitation timestamp
        await supabase
          .from('invitations')
          .update({ 
            invited_at: new Date().toISOString(),
            status: 'pending'
          })
          .eq('id', invitationId);
          
        setSuccessMessage('Invitation resent successfully.');
        setSuccess(true);
        fetchInvitations();
      } else {
        throw new Error(result.error || 'Failed to send invitation email');
      }
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError((err as Error).message);
    } finally {
      setProcessingInvitationId(null);
    }
  };

  // Function to send a test email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setSendingTestEmail(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Send test email using the new email service
      const result = await sendTestEmail(testEmailAddress);
      setTestEmailResult(result);
      
      if (result.success) {
        setSuccessMessage(`Test email sent to ${testEmailAddress}. Please check your inbox and spam folder.`);
        setSuccess(true); 
      } else {
        setError(`Failed to send test email: ${result.error}`);
      }
    } catch (err) {
      console.error('Failed to send test email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test email');
      setTestEmailResult({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSendingTestEmail(false);
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
          
          {/* Edge Function Status */}
          {edgeFunctionStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
              edgeFunctionStatus === 'ok' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {edgeFunctionStatus === 'ok' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
              )}
              <div>
                <p className="font-medium">
                  {edgeFunctionStatus === 'ok' 
                    ? 'Email system is operational' 
                    : 'Checking email system...'}
                </p>
                {edgeFunctionError && (
                  <p className="text-sm mt-1">{edgeFunctionError}</p>
                )}
                {edgeFunctionStatus === 'checking' && (
                  <button 
                    onClick={checkEdgeFunctionStatus}
                    className="text-sm mt-2 underline"
                  >
                    Check again
                  </button>
                )}
                {edgeFunctionStatus === 'ok' && (
                  <div className="mt-2">
                    <form onSubmit={handleSendTestEmail} className="flex gap-2">
                      <input
                        type="email" 
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="Enter email for test"
                        className="text-sm px-2 py-1 border border-gray-300 rounded flex-1"
                        required
                      />
                      <button
                        type="submit"
                        disabled={sendingTestEmail || !testEmailAddress}
                        className="text-sm px-2 py-1 bg-indigo-600 text-white rounded disabled:opacity-50"
                      >
                        {sendingTestEmail ? 'Sending...' : 'Send Test Email'} 
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Test Email Results */}
          {testEmailResult && (
            <div className="mb-4 p-3 rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-2">Test Email Results</h4>
              <pre className="text-xs text-gray-600 overflow-x-auto max-h-40 p-2 bg-gray-100 rounded">
                {JSON.stringify(testEmailResult, null, 2)}
              </pre>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Decision Role
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Addresses
                </label>
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
                    onClick={() => viewInvitationLogs(inv)}
                    style={{ cursor: 'pointer' }}
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
                          onClick={(e) => {
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
                          onClick={(e) => {
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeInvitation(inv.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                        >
                          {processingInvitationId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
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
          
          {/* Invitation Logs Modal */}
          {selectedInvitation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-medium">Invitation Details</h3>
                  <button
                    onClick={() => setSelectedInvitation(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-4">
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">Invitation to: {selectedInvitation.email}</h4>
                    <p className="text-sm text-gray-500">
                      Status: <span className="font-medium">{selectedInvitation.status}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Invited: {new Date(selectedInvitation.invited_at).toLocaleString()}
                    </p>
                  </div>
                  
                  <h4 className="font-medium text-gray-900 mb-2">Activity Log</h4>
                  
                  {loadingLogs ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
                      <span>Loading logs...</span>
                    </div>
                  ) : invitationLogs.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4 text-center">No logs available</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {invitationLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{log.status}</span>
                            <span className="text-gray-500 text-xs">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <pre className="mt-1 text-xs text-gray-600 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleResendInvitation(selectedInvitation.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mr-2" 
                    >
                      Resend Invitation
                    </button>
                    <button
                      onClick={() => setSelectedInvitation(null)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Members */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              {team.members.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No members yet</p>
              ) : (
                team.members.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {m.email || m.user_id}
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <select
                          value={m.role}
                          onChange={e => handleUpdateRole(m.id, e.target.value)}
                          className="text-sm bg-transparent border-none focus:ring-0"
                        >
                          {TEAM_ROLES.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={m.decision_role || 'viewer'}
                          onChange={e => handleUpdateRole(m.id, e.target.value)}
                          className="text-sm bg-transparent border-none focus:ring-0"
                        >
                          {DECISION_ROLES.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
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