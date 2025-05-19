// src/components/teams/ManageTeamMembersModal.tsx
import React, { useState } from 'react';
import { X, Mail, Loader2, UserPlus, Users, Building2, Settings } from 'lucide-react';
import { useTeams } from '../../contexts/TeamsContext';
import { useDirectory } from '../../hooks/useDirectory';
import DirectoryUserCard from './DirectoryUserCard';
import DirectorySearchSkeleton from './DirectorySearchSkeleton';

interface ManageTeamMembersModalProps {
  open: boolean;
  onClose: () => void;
  decisionId: string;
}

type TabId = 'users' | 'teams' | 'settings';

export default function ManageTeamMembersModal({ open, onClose, decisionId }: ManageTeamMembersModalProps) {
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
          {activeTab === 'users' && (
            <div className="space-y-4">
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
              <div className="text-center py-8 text-gray-500">
                Team selection coming soon...
              </div>
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
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (!email && selectedUsers.length === 0)}
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