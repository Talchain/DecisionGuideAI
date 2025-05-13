import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeams } from '../../contexts/TeamsContext';
import { supabase } from '../../lib/supabase';
import { Users, Loader2, AlertTriangle, ArrowLeft, UserPlus, Calendar, Trash2, Edit2 } from 'lucide-react';
import EditTeamModal from './EditTeamModal';
import ManageTeamMembersModal from './ManageTeamMembersModal';
import { format } from 'date-fns';
import type { Team } from '../../types/teams';

export default function TeamDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Fetch team details using RPC function
  useEffect(() => {
    if (!id) return;

    const fetchTeamDetails = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase.rpc('get_team_details', { team_uuid: id });
        
        if (err) throw err;
        if (!data?.[0]) throw new Error('Team not found');
        
        setTeam(data[0]);
      } catch (err) {
        console.error('Error fetching team details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [id]);

  // Refresh team details after changes
  const refreshTeam = async () => {
    if (!id) return;
    try {
      const { data, error: err } = await supabase.rpc('get_team_details', { team_uuid: id });
      if (err) throw err;
      if (data?.[0]) setTeam(data[0]);
    } catch (err) {
      console.error('Error refreshing team details:', err);
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
            <h3 className="font-medium text-red-800">Error loading team</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Team not found</p>
        <button
          onClick={() => navigate('/teams')}
          className="mt-4 text-indigo-600 hover:text-indigo-700"
        >
          Back to Teams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/teams')}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMembersModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Manage Members
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <Edit2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Team Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">About</h2>
          {team.description ? (
            <p className="text-gray-600">{team.description}</p>
          ) : (
            <p className="text-gray-400 italic">No description provided</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Created {format(new Date(team.created_at), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span>{team.members.length} members</span>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Members</h2>
            <button
              onClick={() => setShowMembersModal(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              Manage Members
            </button>
          </div>

          <div className="space-y-2">
            {team.members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {member.user_id}
                  </div>
                  <div className="text-sm text-gray-500">
                    {member.role}
                  </div>
                </div>
                <button
                  onClick={() => {/* Handle remove */}}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditTeamModal
          team={team}
          onClose={() => {
            setShowEditModal(false);
            refreshTeam();
          }}
        />
      )}

      {showMembersModal && (
        <ManageTeamMembersModal
          team={team}
          onClose={() => {
            setShowMembersModal(false);
            refreshTeam();
          }}
        />
      )}
    </div>
  );
}