// src/components/InviteCollaborators.tsx
import React, { useState, useEffect } from 'react';
import {
  X, Users, Mail, Loader2, UserPlus, Copy, Link as LinkIcon, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTeams } from '../contexts/TeamsContext';
import Tooltip from './Tooltip';

interface InviteCollaboratorsProps {
  open: boolean;
  onClose: () => void;
  decisionId: string;
}

type TabId = 'email' | 'team';
type Role = 'owner' | 'approver' | 'contributor' | 'viewer';

const ROLES: { id: Role; label: string; description: string }[] = [
  { id: 'owner',      label: 'Decision Lead',    description: 'Full control over the decision' },
  { id: 'approver',   label: 'Approver',        description: 'Can approve or reject suggestions' },
  { id: 'contributor',label: 'Contributor',     description: 'Can add suggestions and comments' },
  { id: 'viewer',     label: 'Viewer',          description: 'Read-only access' }
];

export default function InviteCollaborators({
  open, onClose, decisionId
}: InviteCollaboratorsProps) {
  const { teams, loading: teamsLoading, fetchTeams } = useTeams();
  const [activeTab, setActiveTab]       = useState<TabId>('email');
  const [emails, setEmails]             = useState('');
  const [role, setRole]                 = useState<Role>('contributor');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);
  const [inviteLink, setInviteLink]     = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchTeams();
  }, [open, fetchTeams]);

  // 1) External invites by email
  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(Boolean);

      // insert & return the new rows
      const { data: invites, error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert(
          emailList.map(email => ({
            decision_id: decisionId,
            email,
            role,
            status: 'invited',
            permissions: {
              can_comment: role !== 'viewer',
              can_suggest: role !== 'viewer',
              can_rate: role !== 'viewer'
            }
          }))
        )
        .select('id, email, decision_id, role, invited_at, permissions');

      if (inviteError || !invites) throw inviteError;

      // fire off your Edge Function for each invite
      await Promise.all(
        invites.map(invite =>
          supabase.functions.invoke('send-team-invite', {
            body: {
              invitation_id: invite.id,
              email: invite.email,
              team_id: decisionId,          // reuse decisionId for your edge fn payload field
              team_name: null,              // null here since it's a decision, not a team
              inviter_id: supabase.auth.getUser().data.user?.id
            }
          })
        )
      );

      // generate a join-link for externals
      const { data: token, error: linkError } = await supabase
        .rpc('create_invite_link', { decision_id: decisionId });

      if (!linkError && token) {
        setInviteLink(`${window.location.origin}/join/${token}`);
      }

      setEmails('');
      setSuccess(true);
    } catch (err) {
      console.error('Failed to send invites:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 2) Team invites
  const handleTeamInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const team = teams.find(t => t.id === selectedTeamId);
      if (!team) throw new Error('Team not found');

      // insert & return the new rows
      const { data: invites, error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert(
          team.members.map(member => ({
            decision_id: decisionId,
            user_id: member.user_id,
            role,
            status: 'invited',
            permissions: {
              can_comment: role !== 'viewer',
              can_suggest: role !== 'viewer',
              can_rate: role !== 'viewer'
            }
          }))
        )
        .select('id, user_id, decision_id, role, status');

      if (inviteError || !invites) throw inviteError;

      // for each, look up the user’s email and invoke Edge Fn
      await Promise.all(
        invites.map(async invite => {
          // fetch their email
          const { data: profile, error: profErr } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('id', invite.user_id)
            .single();
          if (profErr || !profile?.email) return;

          return supabase.functions.invoke('send-team-invite', {
            body: {
              invitation_id: invite.id,
              email: profile.email,
              team_id: selectedTeamId,
              team_name: team.name,
              inviter_id: supabase.auth.getUser().data.user?.id
            }
          });
        })
      );

      setSelectedTeamId('');
      setSuccess(true);
    } catch (err) {
      console.error('Failed to invite team:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // copy the token-based link
  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } transition-opacity`}
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* header, tabs & forms unchanged… */}
        {/* just wire handleEmailInvite & handleTeamInvite onSubmit */}
      </div>
    </div>
  );
}