// src/contexts/TeamsContext.tsx (complete refactored version)

import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendInviteViaEdge, sendTestEmail } from '../lib/email';
import { getUserId } from '../lib/supabase';

const USE_EDGE_INVITES = import.meta.env.VITE_USE_EDGE_INVITES === 'true';

const TeamsContext = createContext(null);

export const TeamsProvider = ({ children }) => {
  const [invitations, setInvitations] = useState([]);

  const inviteTeamMember = async (teamId, email, role, decisionRole) => {
    try {
      const inviterId = await getUserId();
      if (!inviterId) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('manage_team_invite', {
        p_team_id: teamId,
        p_email: email,
        p_inviter_id: inviterId,
        p_role: role,
        p_decision_role: decisionRole,
      });

      if (error && error.code === '23505') {
        return { status: 'already_invited' };
      }

      if (USE_EDGE_INVITES && data?.invitation_id) {
        await sendInviteViaEdge({
          invitation_id: data.invitation_id,
          email,
          team_id: teamId,
          inviter_id: inviterId,
          team_name: data?.team_name || 'Team'
        });
      }

      await supabase.rpc('track_invitation_status', {
        p_email: email,
        p_status: 'sent'
      });

      return { status: 'success' };
    } catch (err) {
      console.error('Invite error:', err);
      return { status: 'error', message: err.message };
    }
  };

  const resendInvitation = async (invitationId, email, teamId, inviterId, teamName) => {
    if (!USE_EDGE_INVITES) return { status: 'skipped' };
    try {
      await sendInviteViaEdge({
        invitation_id: invitationId,
        email,
        team_id: teamId,
        inviter_id: inviterId,
        team_name: teamName
      });
      return { status: 'resent' };
    } catch (err) {
      console.error('Resend error:', err);
      return { status: 'error', message: err.message };
    }
  };

  const getTeamInvitations = async (teamId) => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('team_id', teamId);

    if (error) {
      console.error('Fetch invitations error:', error);
      return [];
    }

    setInvitations(data);
    return data;
  };

  const revokeInvitation = async (invitationId) => {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      console.error('Revoke error:', error);
      return { status: 'error', message: error.message };
    }

    setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    return { status: 'revoked' };
  };

  return (
    <TeamsContext.Provider
      value={{
        inviteTeamMember,
        getTeamInvitations,
        revokeInvitation,
        resendInvitation,
        invitations,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export const useTeams = () => useContext(TeamsContext);
