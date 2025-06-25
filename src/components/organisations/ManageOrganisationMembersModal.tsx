import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Loader2, 
  UserPlus, 
  UserMinus, 
  AlertCircle, 
  Search, 
  CheckCircle 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  members: OrganisationMember[];
  onClose: () => void;
  onUpdated: () => void;
}

type TabId = 'current' | 'invite';

export default function ManageOrganisationMembersModal({
  organisation,
  members,
  onClose,
  onUpdated
}: ManageOrganisationMembersModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('current');
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // First check if user exists
      const { data: userCheck, error: userCheckError } = await supabase.rpc(
        'check_user_email_exists',
        { email_to_check: email.trim() }
      );
      
      if (userCheckError) throw userCheckError;
      
      if (userCheck?.exists) {
        // User exists, add directly to organisation
        const { error: addError } = await supabase.from('organisation_members').insert({
          organisation_id: organisation.id,
          user_id: userCheck.id,
          role
        });
        
        if (addError) {
          if (addError.code === '23505') {
            setError('This user is already a member of the organisation');
          } else {
            throw addError;
          }
        } else {
          setSuccess(`User added to the organisation`);
          setEmail('');
          onUpdated();
        }
      } else {
        // User doesn't exist, create invitation
        const { error: inviteError } = await supabase.from('invitations').insert({
          email: email.trim(),
          organisation_id: organisation.id,
          invited_by: user?.id,
          role,
          status: 'pending'
        });
        
        if (inviteError) {
          if (inviteError.code === '23505') {
            setError('An invitation has already been sent to this email');
          } else {
            throw inviteError;
          }
        } else {
          setSuccess(`Invitation sent to ${email}`);
          setEmail('');
        }
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
              Current Members ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('invite')}
              className={`flex-1 py-2 px-4 rounded-lg transition ${
                activeTab === 'invite' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
              }`}
            >
              Invite New Members
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
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
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
              
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    Send Invitation
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
        </div>
      </div>
    </div>
  );
}