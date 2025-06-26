import React, { useState } from 'react';
import { Search, UserPlus, Loader2, AlertCircle, User, Clock } from 'lucide-react';
import { useDirectory } from '../../hooks/useDirectory';
import type { DirectoryUser } from '../../types/directory';
import Tooltip from '../Tooltip';
import DirectoryUserCard from './DirectoryUserCard';
import DirectorySearchSkeleton from './DirectorySearchSkeleton';

interface UserDirectoryTabProps {
  onAddUser: (userId: string, teamRole: string, decisionRole: string) => Promise<boolean>;
  organisationId?: string | null;
}

export default function UserDirectoryTab({ onAddUser, organisationId }: UserDirectoryTabProps) {
  const { users, loading, error, searchTerm, setSearchTerm } = useDirectory({ organisationId });
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [teamRole, setTeamRole] = useState('member');
  const [decisionRole, setDecisionRole] = useState('contributor');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const handleAddUser = async (user: DirectoryUser) => {
    if (selectedUser?.id === user.id) {
      // If already selected, submit the form
      handleSubmitAdd();
    } else {
      // Otherwise, select the user
      setSelectedUser(user);
      setAddError(null);
      setAddSuccess(false);
    }
  };

  const handleSubmitAdd = async () => {
    if (!selectedUser) return;
    
    setAddingUser(true);
    setAddError(null);
    setAddSuccess(false);
    
    try {
      const success = await onAddUser(selectedUser.id, teamRole, decisionRole);
      if (success) {
        setAddSuccess(true);
        setTimeout(() => setAddSuccess(false), 3000);
      }
      setSelectedUser(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, user: DirectoryUser) => {
    if (e.key === 'Enter') {
      handleAddUser(user);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          aria-label="Search directory"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Add User Error */}
      {addError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{addError}</p>
        </div>
      )}
      {addSuccess && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4">
          User added successfully!
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <DirectorySearchSkeleton />
      ) : (
        <>
          {/* User Selection Form */}
          {selectedUser && (
            <div className="bg-indigo-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-full">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{selectedUser.email}</h4>
                  {selectedUser.first_name && selectedUser.last_name && (
                    <p className="text-sm text-gray-600">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Role
                  </label>
                  <select
                    value={teamRole}
                    onChange={(e) => setTeamRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Decision Role
                  </label>
                  <select
                    value={decisionRole}
                    onChange={(e) => setDecisionRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="owner">Decision Lead</option>
                    <option value="approver">Approver</option>
                    <option value="contributor">Contributor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAdd}
                  disabled={addingUser}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {addingUser ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Add to Team
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* User List */}
          <div className="max-h-[400px] overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? (
                  <p>No users found matching "{searchTerm}". Try another search or add by email.</p>
                ) : (
                  <p>No users found. Try searching by name or email.</p>
                )}
              </div>
            ) : (
              <ul className="space-y-2" role="listbox">
                {users.map((user) => (
                  <DirectoryUserCard
                    key={user.id}
                    user={user}
                    isSelected={selectedUser?.id === user.id}
                    onSelect={handleAddUser}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}