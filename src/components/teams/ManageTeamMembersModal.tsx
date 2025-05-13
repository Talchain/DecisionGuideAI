import React, { useState } from 'react';
import { X, Users, Mail, Loader2, UserPlus, UserMinus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTeams } from '../../contexts/TeamsContext';
import type { Team, TeamMember } from '../../types/teams';
import Tooltip from '../Tooltip';

interface ManageTeamMembersModalProps {
  team: Team;
  onClose: () => void;
}

type TabId = 'email' | 'existing';
type Role = 'admin' | 'member';

const ROLES: { id: Role; label: string; description: string }[] = [
  { id: 'admin', label: 'Admin', description: 'Can manage team and members' },
  { id: 'member', label: 'Member', description: 'Regular team member' }
];

export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMembersModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('email');
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const emailList = emails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
      
      // Use the manage_team_invitation RPC function for each email
      await Promise.all(emailList.map(async (email) => {
        const { error: inviteError } = await supabase
          .rpc('manage_team_invitation', {
            team_uuid: team.id,
            email_address: email,
            member_role: role
          });

        if (inviteError) throw inviteError;
      }));

      setEmails('');
      setSuccess(true);
    } catch (err) {
      console.error('Failed to add members:', err);
      setError(err instanceof Error ? err.message : 'Failed to add members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: Role) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Team Members</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'email'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Add by Email
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'existing'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Current Members
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
              Members added successfully!
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLES.map(({ id, label, description }) => (
                    <option key={id} value={id}>
                      {label} - {description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Addresses
                </label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
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
                    Adding Members...
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

          {/* Current Members Tab */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              {team.members.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No members yet
                </p>
              ) : (
                <div className="space-y-2">
                  {team.members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.email || member.user_id}
                        </div>
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value as Role)}
                          className="mt-1 text-sm bg-transparent border-none focus:ring-0"
                        >
                          {ROLES.map(role => (
                            <option key={role.id} value={role.id}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Tooltip content="Remove member">
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}