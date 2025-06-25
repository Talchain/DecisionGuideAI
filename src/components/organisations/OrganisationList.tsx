import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building, 
  PlusCircle, 
  Users, 
  Briefcase, 
  Calendar, 
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CreateOrganisationModal from './CreateOrganisationModal';
import Tooltip from '../Tooltip';
import { format } from 'date-fns';

interface Organisation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  member_count: number;
  team_count: number;
  is_owner: boolean;
  role: string;
}

export default function OrganisationList() {
  const { user } = useAuth();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganisations();
  }, []);

  const fetchOrganisations = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_user_organisations');
      
      if (error) throw error;
      
      setOrganisations(data || []);
    } catch (err) {
      console.error('Error fetching organisations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganisation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organisation? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('organisations')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      fetchOrganisations();
    } catch (err) {
      console.error('Error deleting organisation:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete organisation');
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
            <h3 className="font-medium text-red-800">Error loading organisations</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Organisations</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Create Organisation
        </button>
      </div>

      {organisations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No organisations yet</h3>
          <p className="text-gray-500 mb-4">Create your first organisation to start collaborating</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Organisation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organisations.map((org) => (
            <div key={org.id} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">{org.name}</h3>
                  {org.description && (
                    <p className="text-sm text-gray-500 mt-1">{org.description}</p>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setActionMenuOpen(actionMenuOpen === org.id ? null : org.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  
                  {actionMenuOpen === org.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1">
                        <Link
                          to={`/organisations/${org.id}`}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Building className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                        
                        {org.is_owner && (
                          <>
                            <Link
                              to={`/organisations/${org.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </>
                        )}
                            
                        {(org.is_owner || org.role === 'admin') && (
                          <button
                            onClick={() => {
                              setActionMenuOpen(null);
                              handleDeleteOrganisation(org.id);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400 mr-2" />
                  <span>{org.member_count} {org.member_count === 1 ? 'member' : 'members'}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Briefcase className="h-4 w-4 text-gray-400 mr-2" />
                  <span>{org.team_count} {org.team_count === 1 ? 'team' : 'teams'}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <span>Created {format(new Date(org.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to={`/organisations/${org.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  View Organisation
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateOrganisationModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchOrganisations();
          }}
        />
      )}
    </div>
  );
}