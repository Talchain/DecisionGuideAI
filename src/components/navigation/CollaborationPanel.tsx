import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, UserPlus, CheckCircle, AlertTriangle, Users, Clock } from 'lucide-react';
import { useDecision } from '../../contexts/DecisionContext';
import { supabase } from '../../lib/supabase';

interface CollaborationPanelProps {
  onClose: () => void;
}

export default function CollaborationPanel({ onClose }: CollaborationPanelProps) {
  const { decisionId, collaborators } = useDecision();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'invite' | 'current'>('current');
  
  // Invite a collaborator
  const inviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !decisionId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // First check if user exists
      const { data: userCheck, error: userCheckError } = await supabase
        .rpc('check_user_email_exists', { email_to_check: email });
        
      // Create the collaborator record
      const { error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert({
          decision_id: decisionId,
          user_id: userCheck ? userCheck.id : null,
          email: email,
          role: role,
          status: 'invited',
          permissions: {
            can_comment: role !== 'viewer',
            can_suggest: role !== 'viewer',
            can_rate: role !== 'viewer'
          },
          invited_at: new Date().toISOString()
        });
        
      if (inviteError) throw inviteError;
      
      setSuccess(true);
      setEmail('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error inviting collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    } finally {
      setLoading(false);
    }
  };
  
  // Remove a collaborator
  const removeCollaborator = async (collaboratorId: string) => {
    if (!decisionId) return;
    
    try {
      const { error } = await supabase
        .from('decision_collaborators')
        .delete()
        .eq('id', collaboratorId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  };

  return (
    <div className="w-80 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Collaboration</h3>
        <button 
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'current' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Current ({collaborators.length})
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'invite' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Invite
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {activeTab === 'current' ? (
          <div className="space-y-4">
            {collaborators.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No collaborators yet</p>
                <button
                  onClick={() => setActiveTab('invite')}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Invite someone
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {collaborators.map(collab => (
                  <div key={collab.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{collab.email || `User ${collab.user_id?.substring(0, 8)}`}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize">{collab.role}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {collab.status === 'invited' ? 'Invited' : 'Active'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeCollaborator(collab.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700">Invitation sent successfully!</p>
              </div>
            )}
            
            <form onSubmit={inviteCollaborator} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="contributor">Contributor (can edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="approver">Approver (can approve changes)</option>
                </select>
              </div>
              
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}