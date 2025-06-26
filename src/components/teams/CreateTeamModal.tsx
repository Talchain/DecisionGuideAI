import React, { useState } from 'react';
import { X, Loader2, Users, Check, Search } from 'lucide-react';
import { useTeams } from '../../contexts/TeamsContext';
import { useOrganisation } from '../../contexts/OrganisationContext';
import { supabase } from '../../lib/supabase';

interface CreateTeamModalProps {
  onClose: () => void;
  organisationId?: string;
}

interface OrganisationMember {
  id: string;
  user_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

enum CreateTeamStep {
  DETAILS,
  ADD_MEMBERS
}

export default function CreateTeamModal({ onClose, organisationId }: CreateTeamModalProps) {
  const { createTeam, addTeamMember } = useTeams();
  const { currentOrganisation } = useOrganisation();
  
  // Step state
  const [currentStep, setCurrentStep] = useState<CreateTeamStep>(CreateTeamStep.DETAILS);
  
  // Team details state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  
  // Member selection state
  const [organisationMembers, setOrganisationMembers] = useState<OrganisationMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  
  // Fetch organisation members when moving to the add members step
  React.useEffect(() => {
    if (currentStep === CreateTeamStep.ADD_MEMBERS && organisationId) {
      fetchOrganisationMembers();
    }
  }, [currentStep, organisationId]);
  
  // Fetch organisation members
  const fetchOrganisationMembers = async () => {
    if (!organisationId) return;
    
    setLoadingMembers(true);
    
    try {
      const { data, error } = await supabase.rpc(
        'get_organisation_members',
        { org_id: organisationId }
      );
      
      if (error) throw error;
      
      setOrganisationMembers(data || []);
    } catch (err) {
      console.error('Error fetching organisation members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organisation members');
    } finally {
      setLoadingMembers(false);
    }
  };
  
  // Toggle member selection
  const toggleMemberSelection = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };
  
  // Filter members based on search term
  const filteredMembers = organisationMembers.filter(member => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const email = member.email?.toLowerCase() || '';
    const firstName = member.first_name?.toLowerCase() || '';
    const lastName = member.last_name?.toLowerCase() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return email.includes(search) || firstName.includes(search) || 
           lastName.includes(search) || fullName.includes(search);
  });

  // Handle team creation
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const team = await createTeam(
        name.trim(),
        description.trim() || undefined,
        organisationId || currentOrganisation?.id
      );
      
      if (!team) {
        throw new Error('Failed to create team');
      }
      
      setCreatedTeamId(team.id);
      setCurrentStep(CreateTeamStep.ADD_MEMBERS);
    } catch (err) {
      console.error('Failed to create team:', err);
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding members to the team
  const handleAddMembers = async () => {
    if (!createdTeamId || selectedMembers.length === 0) {
      onClose();
      return;
    }
    
    setAddingMembers(true);
    
    try {
      // Add each selected member to the team
      for (const userId of selectedMembers) {
        await addTeamMember(createdTeamId, userId, 'member', 'contributor');
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to add members to team:', err);
      setError(err instanceof Error ? err.message : 'Failed to add members to team');
    } finally {
      setAddingMembers(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mt-16 relative animate-slideUp max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">
            {currentStep === CreateTeamStep.DETAILS ? 'Create New Team' : 'Add Team Members'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {error && currentStep === CreateTeamStep.DETAILS && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {currentStep === CreateTeamStep.DETAILS ? (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Team Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter team name"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter team description"
              rows={3}
            />
          </div>

          {(organisationId || currentOrganisation) && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              This team will be created in the organisation: {currentOrganisation?.name || "Selected organisation"}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Creating...
                </>
              ) : ( 
                'Create Team'
              )}
            </button>
          </div>
            </form>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="bg-green-50 p-3 rounded-lg text-sm text-green-700 flex items-center">
                <Check className="h-5 w-5 mr-2 text-green-500" />
                <div>
                  <p className="font-medium">Team created successfully!</p>
                  <p>Now you can add members to your team.</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Members to Team (Optional)
                </label>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                {loadingMembers ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mr-2" />
                    <span className="text-gray-500">Loading members...</span>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {searchTerm ? 'No members found matching your search' : 'No members available'}
                  </p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {filteredMembers.map(member => (
                      <div 
                        key={member.user_id}
                        className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                          selectedMembers.includes(member.user_id) ? 'bg-indigo-50' : ''
                        }`}
                        onClick={() => toggleMemberSelection(member.user_id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.user_id)}
                          onChange={() => toggleMemberSelection(member.user_id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.first_name && member.last_name
                              ? `${member.first_name} ${member.last_name}`
                              : member.email || member.user_id}
                          </div>
                          {member.email && member.email !== `${member.first_name} ${member.last_name}` && (
                            <div className="text-sm text-gray-500">{member.email}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={addingMembers}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                >
                  {addingMembers ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Adding Members...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      {selectedMembers.length > 0 
                        ? `Add ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}` 
                        : 'Finish'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}