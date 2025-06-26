import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building, 
  Users,
  Briefcase, 
  Calendar, 
  Settings, 
  ArrowLeft,
  Edit,
  Trash2,
  UserPlus, 
  PlusCircle,
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { 
  supabase, 
  getOrganisationDetails, 
  getOrganisationMembers, 
  getOrganisationTeams 
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import EditOrganisationModal from './EditOrganisationModal';
import ManageOrganisationMembersModal from './ManageOrganisationMembersModal';
import Tooltip from '../Tooltip';

interface Organisation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  role: string;
}

interface OrganisationMember {
  id: string;
  user_id: string;
  organisation_id: string;
  role: string;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count: number;
}

export default function OrganisationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [members, setMembers] = useState<OrganisationMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrganisationDetails();
    }
  }, [id]);

  const fetchOrganisationDetails = async () => {
    if (!id || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch organisation details using the helper function
      const { data: orgData, error: orgError } = await getOrganisationDetails(id);
      
      if (orgError) throw orgError;
      if (!orgData) throw new Error('Organisation not found');
      
      setOrganisation(orgData);
      
      // Fetch organisation members using the helper function
      const { data: membersData, error: membersError } = await getOrganisationMembers(id);
      
      if (membersError) throw membersError;
      setMembers(membersData || []);
      
      // Fetch organisation teams using the helper function
      const { data: teamsData, error: teamsError } = await getOrganisationTeams(id);
      
      if (teamsError) throw teamsError;
      setTeams(teamsData || []);
      
    } catch (err) {
      console.error('Error fetching organisation details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organisation details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganisation = async () => {
    if (!organisation || !user) return;
    
    if (deleteConfirmation !== organisation.name) {
      alert('Please type the organisation name to confirm deletion');
      return;
    }
    
    setDeleting(true);
    
    try {
      const { error } = await supabase
        .from('organisations')
        .delete()
        .eq('id', organisation.id);
        
      if (error) throw error;
      
      navigate('/organisations');
    } catch (err) {
      console.error('Error deleting organisation:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete organisation');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Show success message with auto-dismiss
  const displaySuccessMessage = (message: string) => {
    setShowSuccessMessage(message);
    setTimeout(() => setShowSuccessMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !organisation) {
    return (
      <div className="bg-red-50 p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Error loading organisation</h3>
            <p className="text-sm text-red-700 mt-1">{error || 'Organisation not found'}</p>
            <button
              onClick={() => navigate('/organisations')}
              className="mt-4 text-sm text-red-700 hover:text-red-800 underline"
            >
              Back to Organisations
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/organisations')} 
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{organisation.name}</h1>
          {organisation.is_owner && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              Owner
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {(organisation.is_owner || organisation.role === 'admin') && (
            <div className="flex items-center gap-2">
              <div className="flex">
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-l-lg hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Add Members
                </button>
                <Link
                  to="/teams"
                  state={{ organisationId: organisation.id }}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 border-l border-indigo-500 transition-colors"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Create Team
                </Link>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Edit className="h-5 w-5" />
                </button>
                
                {(organisation.is_owner || organisation.role === 'admin') && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center animate-fade-in">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p>{showSuccessMessage}</p>
        </div>
      )}

      {/* Organisation Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">About</h2>
            {organisation.description ? (
              <p className="text-gray-600">{organisation.description}</p>
            ) : (
              <p className="text-gray-400 italic">No description provided</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>Created {organisation.created_at ? format(new Date(organisation.created_at), 'MMM d, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{members.length} members</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span>{teams.length} teams</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <span>Slug: {organisation.slug}</span>
              </div>
            </div>
          </div>

          {/* Teams Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Teams</h2>
              <Link
                to="/teams/new"
                state={{ organisationId: organisation.id }}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Create Team
              </Link>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No teams in this organisation yet</p>
                <Link
                  to="/teams/new"
                  state={{ organisationId: organisation.id }}
                  className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Create your first team
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">{team.name}</h3>
                      {team.description && (
                        <p className="text-sm text-gray-500">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                      </span>
                      <div className="text-gray-400">
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Members Sidebar */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Members</h2>
            {(organisation.is_owner || organisation.role === 'admin') && (
              <button
                onClick={() => setShowMembersModal(true)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Manage
              </button>
            )}
          </div>

          <div className="space-y-3">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {member.first_name && member.last_name
                      ? `${member.first_name} ${member.last_name}`
                      : member.email || member.user_id}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      member.role === 'owner' 
                        ? 'bg-indigo-500' 
                        : member.role === 'admin'
                        ? 'bg-green-500'
                        : 'bg-gray-500'
                    }`}></span>
                    <span className="capitalize">{member.role}</span>
                  </div>
                </div>
                
                {(organisation.is_owner || organisation.role === 'admin') && member.user_id !== user?.id && (
                  <Tooltip content="Remove member">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        // Implement remove member functionality
                        alert('Remove member functionality to be implemented');
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Section */}
      {(organisation.is_owner || organisation.role === 'admin') && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Organisation Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Deleting an organisation will permanently remove all associated teams, decisions, and data.
                This action cannot be undone.
              </p>
              
              {showDeleteConfirm ? (
                <div className="space-y-3 p-3 border border-red-200 rounded-lg bg-red-50">
                  <p className="text-sm text-red-700">
                    To confirm deletion, please type <strong>{organisation.name}</strong> below:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Type organisation name to confirm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteOrganisation}
                      disabled={deleteConfirmation !== organisation.name || deleting}
                      className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          Deleting...
                        </>
                      ) : (
                        'Confirm Delete'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmation('');
                      }}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Organisation
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showEditModal && (
        <EditOrganisationModal
          organisation={organisation}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchOrganisationDetails();
          }}
        />
      )}

      {showMembersModal && (
        <ManageOrganisationMembersModal
          organisation={organisation}
          initialTab="invite"
          members={members}
          onClose={() => setShowMembersModal(false)}
          onUpdated={(message) => {
            setShowMembersModal(false);
            fetchOrganisationDetails();
            if (message) {
              displaySuccessMessage(message);
            }
          }}
        />
      )}
    </div>
  );
}