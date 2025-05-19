// src/components/teams/ManageTeamMembersModal.tsx
import React, { useState } from 'react';
import { X, Mail, Loader2, UserPlus, Users, Building2, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTeams } from '../../contexts/TeamsContext';
import { useDirectory } from '../../hooks/useDirectory';
import { useQuery } from '@tanstack/react-query';
import DirectoryUserCard from './DirectoryUserCard';
import DirectorySearchSkeleton from './DirectorySearchSkeleton';

interface ManageTeamMembersModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
}

type TabId = 'users' | 'teams' | 'settings';

export default function ManageTeamMembersModal({ open, onClose, teamId }: ManageTeamMembersModalProps) {
  const { inviteTeamMember } = useTeams();
  const { users, loading: directoryLoading, error: directoryError, searchTerm, setSearchTerm } = useDirectory();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Fetch teams for the teams tab
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('teams').select('*');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching teams:', err);
        throw new Error('Failed to load teams');
      }
    }
  });

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Process selected users
      if (selectedUsers.length > 0) {
        for (const userId of selectedUsers) {
          const user = users.find(u => u.id === userId);
          if (!user?.email) continue;

          const result = await inviteTeamMember(teamId, user.email, role);
          if (result.error) {
            throw new Error(`Failed to invite ${user.email}: ${result.error}`);
          }
        }
      }

      // Process manual email if provided
      if (email.trim()) {
        const result = await inviteTeamMember(teamId, email.trim(), role);
        if (result.error) {
          throw new Error(`Failed to invite ${email}: ${result.error}`);
        }
      }

      setSuccess(true);
      setSelectedUsers([]);
      setEmail('');
      
      // Auto-close after success
      setTimeout(() => {
        if (success) onClose();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Invite Collaborators</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Users</span>
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'teams' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Teams</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              Invitations sent successfully!
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Manual email input */}
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="Or enter email address manually..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                <div className="relative text-center">
                  <span className="px-2 text-sm text-gray-500 bg-white">or search directory</span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {directoryLoading ? (
                <DirectorySearchSkeleton />
              ) : directoryError ? (
                <div className="bg-red-50 p-4 rounded-lg text-red-700">
                  {directoryError}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users found matching your search.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {users.map(user => (
                    <DirectoryUserCard
                      key={user.id}
                      user={user}
                      isSelected={selectedUsers.includes(user.id)}
                      onSelect={() => {
                        setSelectedUsers(prev =>
                          prev.includes(user.id)
                            ? prev.filter(id => id !== user.id)
                            : [...prev, user.id]
                        );
                      }}
                    />
                  ))}
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                    </div>
                    <button
                      onClick={() => setSelectedUsers([])}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="space-y-4">
              {teamsLoading ? (
                <DirectorySearchSkeleton />
              ) : teams?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No teams available.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {teams?.map(team => (
                    <div
                      key={team.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        selectedTeams.includes(team.id)
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedTeams(prev =>
                          prev.includes(team.id)
                            ? prev.filter(id => id !== team.id)
                            : [...prev, team.id]
                        );
                      }}
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">{team.name}</h3>
                        {team.description && (
                          <p className="text-sm text-gray-500">{team.description}</p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(team.id)}
                        onChange={() => {}} // Handled by parent click
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="contributor">Contributor (can edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (!email && selectedUsers.length === 0 && selectedTeams.length === 0)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Inviting...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Send Invitations</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}