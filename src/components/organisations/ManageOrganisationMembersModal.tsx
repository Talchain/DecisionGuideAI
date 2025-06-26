import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Loader2, 
  UserPlus, 
  UserMinus, 
  AlertCircle, 
  Search, 
  CheckCircle, 
  Users as UsersIcon,
  Clock,
  RefreshCw,
  XCircle,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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

interface ManageOrganisationMembersModalProps {
  organisation: Organisation;
  initialTab?: 'current' | 'invite' | 'pending';
  members: OrganisationMember[];
  onClose: () => void;
  onUpdated: (message?: string) => void;
}

type TabId = 'current' | 'invite' | 'pending';

export default function ManageOrganisationMembersModal({
  organisation,
  initialTab = 'current',
  members,
  onClose,
  onUpdated
}: ManageOrganisationMembersModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  
  const [emailsInput, setEmailsInput] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [emailLookupResults, setEmailLookupResults] = useState<Map<string, { 
    status: 'exists' | 'new' | 'invalid' | 'checking', 
    userProfile?: { id: string, email: string, first_name?: string, last_name?: string } 
  }>>(new Map());
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);
  
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<{id: string, name: string}[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  // Parse emails from input
  const parseEmails = (input: string): string[] => {
    if (!input.trim()) return [];
    
    // Split by commas, semicolons, spaces, and newlines
    return input
      .split(/[,;\s\n]+/)
      .map(email => email.trim().toLowerCase())
      .filter(email => {
        // Basic email validation
        return email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      });
  };

  // Handle email input change with debounced lookup
  const handleEmailInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const input = e.target.value;
    setEmailsInput(input);
    
    // Parse emails
    const emails = parseEmails(input);
    setParsedEmails(emails);
    
    // Update lookup results for new emails
    const currentEmails = Array.from(emailLookupResults.keys());
    
    // Add new emails to lookup results with 'checking' status
    emails.forEach(email => {
      if (!emailLookupResults.has(email)) {
        setEmailLookupResults(prev => {
          const newMap = new Map(prev);
          newMap.set(email, { status: 'checking' });
          return newMap;
        });
        
        // Lookup email
        lookupEmail(email);
      }
    });
    
    // Remove emails that are no longer in the input
    currentEmails.forEach(email => {
      if (!emails.includes(email)) {
        setEmailLookupResults(prev => {
          const newMap = new Map(prev);
          newMap.delete(email);
          return newMap;
        });
      }
    });
  };

  // Lookup email in Supabase
  const lookupEmail = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('check_user_email_exists', { 
        email_to_check: email 
      });
      
      if (error) throw error;
      
      if (data?.exists) {
        // If user exists, get their profile
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name')
          .eq('id', data.id)
          .single();
          
        setEmailLookupResults(prev => {
          const newMap = new Map(prev);
          newMap.set(email, { 
            status: 'exists', 
            userProfile: { 
              id: data.id, 
              email, 
              first_name: profileData?.first_name,
              last_name: profileData?.last_name
            } 
          });
          return newMap;
        });
      } else {
        setEmailLookupResults(prev => {
          const newMap = new Map(prev);
          newMap.set(email, { status: 'new' });
          return newMap;
        });
      }
    } catch (err) {
      console.error('Error looking up email:', err);
      setEmailLookupResults(prev => {
        const newMap = new Map(prev);
        newMap.set(email, { status: 'invalid' });
        return newMap;
      });
    }
  };

  // Fetch pending invitations
  React.useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingInvitations();
    }
    
    if (activeTab === 'invite') {
      fetchOrganisationTeams();
    }
  }, [activeTab]);

  const fetchPendingInvitations = async () => {
    if (!organisation.id) return;
    
    setLoadingInvitations(true);
    
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });
        
      if (error) throw error;
      
      setPendingInvitations(data || []);
    } catch (err) {
      console.error('Error fetching pending invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending invitations');
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Fetch organisation teams for team assignment
  const fetchOrganisationTeams = async () => {
    if (!organisation.id) return;
    
    setLoadingTeams(true);
    
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organisation_id', organisation.id);
        
      if (error) throw error;
      
      setAvailableTeams(data || []);
    } catch (err) {
      console.error('Error fetching organisation teams:', err);
    } finally {
      setLoadingTeams(false);
    }
  };

  // Handle team selection toggle
  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId) 
        : [...prev, teamId]
    );
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedEmails.length === 0) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const results = {
      added: 0,
      invited: 0,
      failed: 0,
      alreadyMembers: 0
    };
    
    try {
      // Process each email
      for (const email of parsedEmails) {
        const lookupResult = emailLookupResults.get(email);
        
        if (!lookupResult) continue;
        
        if (lookupResult.status === 'exists') {
          // User exists, add directly to organisation
          const { error: addError } = await supabase.from('organisation_members').insert({
            organisation_id: organisation.id,
            user_id: lookupResult.userProfile!.id,
            role
          });
          
          if (addError) {
            if (addError.code === '23505') {
              results.alreadyMembers++;
            } else {
              results.failed++;
              console.error(`Error adding ${email}:`, addError);
            }
          } else {
            results.added++;
            
            // If teams are selected, add user to those teams
            if (selectedTeams.length > 0) {
              for (const teamId of selectedTeams) {
                await supabase.from('team_members').insert({
                  team_id: teamId,
                  user_id: lookupResult.userProfile!.id,
                  role: 'member',
                  decision_role: 'contributor'
                }).catch(err => {
                  console.error(`Error adding ${email} to team ${teamId}:`, err);
                });
              }
            }
          }
        } else if (lookupResult.status === 'new') {
          // User doesn't exist, create invitation
          const { error: inviteError } = await supabase.from('invitations').insert({
            email: email,
            organisation_id: organisation.id,
            invited_by: user?.id,
            role,
            status: 'pending'
          });
          
          if (inviteError) {
            if (inviteError.code === '23505') {
              results.alreadyMembers++;
            } else {
              results.failed++;
              console.error(`Error inviting ${email}:`, inviteError);
            }
          } else {
            results.invited++;
          }
        } else {
          results.failed++;
        }
      }
      
      // Generate success message
      let successMessage = '';
      if (results.added > 0) {
        successMessage += `${results.added} user${results.added !== 1 ? 's' : ''} added. `;
      }
      if (results.invited > 0) {
        successMessage += `${results.invited} invitation${results.invited !== 1 ? 's' : ''} sent. `;
      }
      if (results.alreadyMembers > 0) {
        successMessage += `${results.alreadyMembers} already member${results.alreadyMembers !== 1 ? 's' : ''}. `;
      }
      if (results.failed > 0) {
        successMessage += `${results.failed} failed. `;
      }
      
      setSuccess(successMessage.trim());
      setEmailsInput('');
      setParsedEmails([]);
      setEmailLookupResults(new Map());
      setSelectedTeams([]);
      
      // Refresh data
      if (results.added > 0 || results.invited > 0) {
        onUpdated(successMessage.trim());
      }
      
      // Switch to pending tab if invitations were sent
      if (results.invited > 0) {
        setActiveTab('pending');
        fetchPendingInvitations();
      }
    } catch (err) {
      console.error('Error inviting member:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === organisation.owner_id) {
      setError('Cannot remove the organisation owner');
      return;
    }
    
    if (memberUserId === user?.id) {
      if (!confirm('Are you sure you want to leave this organisation?')) {
        return;
      }
    } else {
      if (!confirm('Are you sure you want to remove this member?')) {
        return;
      }
    }
    
    setProcessingMemberId(memberId);
    
    try {
      const { error } = await supabase
        .from('organisation_members')
        .delete()
        .eq('id', memberId);
        
      if (error) throw error;
      
      onUpdated();
    } catch (err) {
      console.error('Error removing member:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setProcessingMemberId(null);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    setProcessingMemberId(memberId);
    
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ role: newRole })
        .eq('id', memberId);
        
      if (error) throw error;
      
      onUpdated();
    } catch (err) {
      console.error('Error updating member role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setProcessingMemberId(null);
    }
  };

  // Handle resending invitation
  const handleResendInvitation = async (invitationId: string) => {
    setProcessingInvitationId(invitationId);
    
    try {
      const { error } = await supabase.rpc('resend_organisation_invitation', {
        invitation_id: invitationId
      });
      
      if (error) throw error;
      
      setSuccess('Invitation resent successfully');
    } catch (err) {
      console.error('Error resending invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setProcessingInvitationId(null);
    }
  };

  // Handle revoking invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    
    setProcessingInvitationId(invitationId);
    
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);
        
      if (error) throw error;
      
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setSuccess('Invitation revoked successfully');
    } catch (err) {
      console.error('Error revoking invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setProcessingInvitationId(null);
    }
  };

  // Filter members based on search term
  const filteredMembers = members.filter(member => {
    const searchString = searchTerm.toLowerCase();
    const email = member.email?.toLowerCase() || '';
    const firstName = member.first_name?.toLowerCase() || '';
    const lastName = member.last_name?.toLowerCase() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return email.includes(searchString) || 
           firstName.includes(searchString) || 
           lastName.includes(searchString) || 
           fullName.includes(searchString);
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.currentTarget === e.target && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Manage Organisation Members</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setActiveTab('current')} 
              className={`flex-1 py-2 px-4 rounded-lg transition ${
                activeTab === 'current' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UsersIcon className="h-4 w-4 mr-2 inline-block" />
              Current Members
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                {members.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('invite')} 
              className={`flex-1 py-2 px-4 rounded-lg transition ${
                activeTab === 'invite' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <UserPlus className="h-4 w-4 mr-2 inline-block" />
              Invite Members
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg transition ${
                activeTab === 'pending' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4 mr-2 inline-block" />
              Pending
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                {pendingInvitations.length}
              </span>
            </button>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded flex items-start gap-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {/* Tab Content */}
          <div className="mt-4">
            {/* Current Members Tab */}
            {activeTab === 'current' && (
              <div>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                
                {/* Members List */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      {searchTerm ? 'No members found matching your search' : 'No members yet'}
                    </p>
                  ) : (
                    filteredMembers.map(member => (
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
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              member.role === 'owner'
                                ? 'bg-indigo-100 text-indigo-800'
                                : member.role === 'admin'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role}
                            </span>
                            
                            {/* Role dropdown for admins */}
                            {(organisation.is_owner || organisation.role === 'admin') && 
                             member.role !== 'owner' &&
                             member.user_id !== user?.id && (
                              <select
                                value={member.role}
                                onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                disabled={processingMemberId === member.id}
                                className="text-xs border border-gray-300 rounded px-1 py-0.5"
                              >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </select>
                            )}
                          </div>
                        </div>
                        
                        {/* Remove button */}
                        {(member.user_id === user?.id || 
                          (organisation.is_owner || 
                           (organisation.role === 'admin' && member.role !== 'owner'))) && 
                         member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            disabled={processingMemberId === member.id}
                            className="p-2 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                          >
                            {processingMemberId === member.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <UserMinus className="h-5 w-5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Invite Members Tab */}
            {activeTab === 'invite' && (
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Addresses
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <textarea
                      value={emailsInput}
                      onChange={handleEmailInputChange}
                      placeholder="Enter email addresses (comma or line separated)"
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                      required
                    />
                  </div>
                  
                  {/* Email Preview */}
                  {parsedEmails.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {parsedEmails.map(email => {
                        const result = emailLookupResults.get(email);
                        return (
                          <div 
                            key={email}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              result?.status === 'exists' ? 'bg-green-100 text-green-800' :
                              result?.status === 'new' ? 'bg-blue-100 text-blue-800' :
                              result?.status === 'invalid' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {result?.status === 'exists' && <Check className="h-3 w-3" />}
                            {result?.status === 'new' && <Mail className="h-3 w-3" />}
                            {result?.status === 'invalid' && <AlertCircle className="h-3 w-3" />}
                            {result?.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
                            <span>{email}</span>
                            {result?.status === 'exists' && (
                              <span className="ml-1 bg-green-50 px-1 rounded">existing user</span>
                            )}
                            {result?.status === 'new' && (
                              <span className="ml-1 bg-blue-50 px-1 rounded">will invite</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="admin">Admin - Can manage organisation settings and members</option>
                    <option value="member">Member - Can view and participate in organisation activities</option>
                  </select>
                </div>
                
                {/* Team Assignment (Optional) */}
                {availableTeams.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign to Teams (Optional)
                    </label>
                    <div className="max-h-[150px] overflow-y-auto border border-gray-300 rounded-lg p-2">
                      {loadingTeams ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin mr-2" />
                          <span className="text-gray-500">Loading teams...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availableTeams.map(team => (
                            <div key={team.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`team-${team.id}`}
                                checked={selectedTeams.includes(team.id)}
                                onChange={() => toggleTeamSelection(team.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <label htmlFor={`team-${team.id}`} className="ml-2 text-sm text-gray-700">
                                {team.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || parsedEmails.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      {parsedEmails.length > 1 
                        ? `Add ${parsedEmails.length} Members` 
                        : 'Add Member'}
                    </>
                  )}
                </button>
                
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p>
                    <strong>Note:</strong> If the email belongs to an existing user, they will be added directly to the organisation.
                    Otherwise, an invitation will be sent to the email address.
                  </p>
                </div>
              </form>
            )}
            
            {/* Pending Invitations Tab */}
            {activeTab === 'pending' && (
              <div>
                {loadingInvitations ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mr-2" />
                    <span className="text-gray-500">Loading invitations...</span>
                  </div>
                ) : pendingInvitations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No pending invitations
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {pendingInvitations.map(invitation => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{invitation.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              <Clock className="inline h-3 w-3 mr-1" />
                              Invited {new Date(invitation.invited_at).toLocaleDateString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
                              {invitation.role}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Tooltip content="Resend invitation">
                            <button
                              onClick={() => handleResendInvitation(invitation.id)}
                              disabled={processingInvitationId === invitation.id}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded disabled:opacity-50"
                            >
                              {processingInvitationId === invitation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </button>
                          </Tooltip>
                          <Tooltip content="Revoke invitation">
                            <button
                              onClick={() => handleRevokeInvitation(invitation.id)}
                              disabled={processingInvitationId === invitation.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                            >
                              {processingInvitationId === invitation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}