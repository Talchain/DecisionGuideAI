// src/components/teams/MyTeams.tsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTeams } from '../../contexts/TeamsContext';
import { useOrganisation } from '../../contexts/OrganisationContext';
import {
  Edit2,
  Trash2,
  PlusCircle,
  Users,
  Loader2,
  AlertTriangle,
  UserPlus,
  CreditCard
} from 'lucide-react';
import CreateTeamModal from './CreateTeamModal';
import EditTeamModal from './EditTeamModal';
import ManageTeamMembersModal from './ManageTeamMembersModal';
import type { Team } from '../../types/teams';
import Tooltip from '../Tooltip';
import EmptyState from '../EmptyState';
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
  const { organisations } = useOrganisation();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [managingTeam, setManagingTeam] = useState<Team | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [organisationFilter, setOrganisationFilter] = useState<string | null>(null);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState<boolean>(false);
  
  // Get organisation ID from location state if available
  const organisationIdFromState = location.state?.organisationId;

  // Effect to handle opening create modal when navigating from organisation page
  useEffect(() => {
    if (organisationIdFromState) {
      setOrganisationFilter(organisationIdFromState);
      setShowCreateModal(true);
      
      // Clear the state to prevent modal from reopening on navigation within the component
      navigate(location.pathname, { replace: true, state: {} });
    }
    void fetchTeams(); // Use void operator to handle the Promise
  }, [fetchTeams, organisationIdFromState, navigate, location.pathname]);

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

  // Ensure teams is initialized as an array
  const teamsArray = Array.isArray(teams) ? teams : [];

  // Filter teams by organisation if filter is set
  const filteredTeams = organisationFilter
    ? teamsArray.filter(team => team.organisation_id === organisationFilter)
    : teamsArray;

  // Get organisation name if filter is set
  const selectedOrganisation = organisationFilter
    ? organisations.find(org => org.id === organisationFilter)
    : null;
    
  // Check if the selected organisation is on a solo plan
  const isOrganisationSolo = selectedOrganisation?.plan_type === 'solo';
  
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedOrganisation ? `${selectedOrganisation.name} Teams` : 'My Teams'}
          </h1>
          {selectedOrganisation && (
            <p className="text-sm text-gray-500">
              Teams in this organisation 
              {isOrganisationSolo && (
                <span className="ml-1 text-amber-600">(Solo Plan - Upgrade to create teams)</span>
              )}
            </p>
          )}
        </div>
        {isOrganisationSolo ? (
          <button
            onClick={() => setShowUpgradeMessage(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Upgrade to Team Plan
          </button>
        ) : (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Team
          </button>
        )}
      </div>

      {/* Upgrade Message */}
      {showUpgradeMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Team Plan Required</h3>
              <p className="text-sm text-amber-700 mt-1">
                Creating teams requires a Team Plan. Please visit the organisation settings to upgrade your plan.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/organisations/${selectedOrganisation?.id}`}
                  className="text-sm text-amber-700 hover:text-amber-800 font-medium"
                >
                  Go to Organisation Settings
                </Link>
                <button
                  onClick={() => setShowUpgradeMessage(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredTeams.length === 0 ? (
        <EmptyState
          title={selectedOrganisation 
            ? `No teams in ${selectedOrganisation.name}` 
            : 'No teams yet'}
          description={isOrganisationSolo
            ? "Upgrade to Team Plan to create teams and collaborate"
            : selectedOrganisation
              ? `Create your first team in ${selectedOrganisation.name}`
              : "Create your first team to start collaborating"}
          icon={Users}
          actionText={isOrganisationSolo ? "Upgrade Plan" : "Create Team"}
          actionPath={isOrganisationSolo 
            ? `/organisations/${selectedOrganisation?.id}` 
            : "#"}
          tips={[
            "Teams help you collaborate on decisions with others",
            "Invite team members to contribute to decisions",
            "Share templates and criteria sets with your team"
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
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
        <CreateTeamModal 
          onClose={() => { setShowCreateModal(false); fetchTeams(); }}
          organisationId={organisationFilter || organisationIdFromState} 
        />
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
