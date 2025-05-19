// src/components/teams/MyTeams.tsx

import React, { useState, useEffect } from 'react';
import { useTeams } from '../../contexts/TeamsContext';
import {
  Edit2,
  Trash2,
  PlusCircle,
  Users,
  Loader2,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
import CreateTeamModal from './CreateTeamModal';
import EditTeamModal from './EditTeamModal';
import ManageTeamMembersModal from './ManageTeamMembersModal';
import type { Team } from '../../types/teams';
import Tooltip from '../Tooltip';

// TeamCard component with new Manage Members button
function TeamCard({
  team,
  onEdit,
  onDelete,
  onManageMembers,
  deleting
}: {
  team: Team;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
  deleting: boolean;
}) {
  const members = Array.isArray(team?.members) ? team.members : [];
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900">{team.name}</h3>
          {team.description && (
            <p className="text-sm text-gray-500 mt-1">{team.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip content="Manage team members">
            <button
              onClick={onManageMembers}
              className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </Tooltip>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m) => (
            <div
              key={m.id}
              className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-sm font-medium text-indigo-600"
            >
              {m.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          ))}
          {members.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-sm font-medium text-gray-600">
              +{members.length - 4}
            </div>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
      </div>
    </div>
  );
}

export default function MyTeams() {
  const { teams, loading, error, deleteTeam, fetchTeams } = useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [managingTeam, setManagingTeam] = useState<Team | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  useEffect(() => {
    void fetchTeams(); // Use void operator to handle the Promise
  }, [fetchTeams]);

  const handleDelete = async (teamId: string) => {
    setDeletingTeamId(teamId);
    try {
      await deleteTeam(teamId);
      await fetchTeams();
    } catch (err) {
      console.error('Failed to delete team:', err);
    } finally {
      setDeletingTeamId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Error loading teams</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Ensure teams is initialized as an array
  const teamsArray = Array.isArray(teams) ? teams : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Create Team
        </button>
      </div>

      {teamsArray.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-4">Create your first team to start collaborating</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamsArray.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={() => setEditingTeam(team)}
              onDelete={() => handleDelete(team.id)}
              onManageMembers={() => setManagingTeam(team)}
              deleting={deletingTeamId === team.id}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal onClose={() => { setShowCreateModal(false); fetchTeams(); }} />
      )}
      
      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          onClose={() => { setEditingTeam(null); fetchTeams(); }}
        />
      )}

      {managingTeam && (
        <ManageTeamMembersModal
          team={managingTeam}
          onClose={() => { setManagingTeam(null); fetchTeams(); }}
        />
      )}
    </div>
  );
}
