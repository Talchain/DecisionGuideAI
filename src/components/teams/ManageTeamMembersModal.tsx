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
    revokeInvitation
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
    // Implementation omitted for brevity
  };

  // Function to view invitation logs
  const viewInvitationLogs = async (invitation: Invitation) => {
    // Implementation omitted for brevity
  };

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

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingInvitationId(invitationId);
    if (!user) {
      console.warn('Cannot resend invitation - user not authenticated');
      setError('You must be signed in to resend invitations');
      setProcessingInvitationId(null);
      return;
    }
    
    try {
      // Get invitation details
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .select('id, email, team_id')
        .eq('id', invitationId)
        .single();
        
      if (inviteError) throw inviteError;
      
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
      
      // Update invitation timestamp
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ 
          invited_at: new Date().toISOString(),
          status: 'pending'
        })
        .eq('id', invitationId);
        
      if (updateError) throw updateError;
      
      // Send the invitation email
      const emailResult = await sendTeamInvitationEmail(
        invitationId,
        invitation.email,
        team.name,
        user.email || 'A team admin'
      );
      
      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send invitation email');
      }
      
      // Track success
      await supabase.rpc(
        'track_invitation_status',
        { 
          invitation_uuid: invitationId,
          status_value: 'resend_completed',
          details_json: { 
            completed_by: user.id,
            message_id: emailResult.messageId,
            timestamp: new Date().toISOString()
          }
        }
      );
      
      setSuccessMessage(`Invitation resent to ${invitation.email}.`);
      setSuccess(true);
      await fetchInvitations();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  }

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

        {/* Content */}
        <div className="p-4">
          {/* Tabs */}
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
          
          {/* Content based on active tab */}
          {activeTab === 'email' && (
            <div className="space-y-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}