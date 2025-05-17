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
import { useAuth } from '../../contexts/AuthContext';
import { sendTeamInvitationEmail } from '../../lib/email';
import { useAuth } from '../../contexts/AuthContext';
import type { Team } from '../../types/teams';
import type { Invitation, InviteResult } from '../../types/invitations';
import Tooltip from '../Tooltip';

export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMembersModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('email');
  const { user } = useAuth();
  const [emails, setEmails] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');
  const [decisionRole, setDecisionRole] = useState<DecisionRole>('contributor');

  const handleResendInvitation = async (invitationId: string) => {
    setProcessingInvitationId(invitationId);
    if (!user) {
      setError("You must be logged in to resend invitations");
      setProcessingInvitationId(null);
      return;
    }
    
    
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
    <div>
      <div>
        <div>
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
))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}