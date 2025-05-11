import React, { useState, useEffect } from 'react';
import { X, Users, Mail, AlertCircle, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import { inviteCollaborator, removeCollaborator, supabase } from '../lib/supabase';
import type { Collaborator } from '../contexts/DecisionContext';
import Tooltip from './Tooltip';

interface InviteCollaboratorsProps {
  onClose: () => void;
}

export default function InviteCollaborators({ onClose }: InviteCollaboratorsProps) {
  const { decisionId, collaborators, setCollaborators } = useDecision();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'contributor' | 'viewer'>('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to collaborator changes
  useEffect(() => {
    if (!decisionId) return;

    const channel = supabase
      .channel(`decision_collaborators:${decisionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_collaborators',
          filter: `decision_id=eq.${decisionId}`,
        },
        (payload) => {
          console.log('Collaborator change:', payload);
          // Refresh collaborators list
          fetchCollaborators();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [decisionId]);

  const fetchCollaborators = async () => {
    if (!decisionId) return;

    try {
      const { data, error } = await supabase.rpc('get_decision_collaborators', {
        decision_id_param: decisionId,
      });

      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch collaborators');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionId || !email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // First check if user exists
      const { data: userCheck } = await supabase.rpc('check_user_email_exists', {
        email_to_check: email.trim(),
      });

      const { error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert({
          decision_id: decisionId,
          user_id: userCheck?.id || null,
          email: email.trim(),
          role,
          status: 'invited',
          permissions: {
            can_comment: role === 'contributor',
            can_suggest: role === 'contributor',
            can_rate: role === 'contributor',
          },
        });

      if (inviteError) throw inviteError;

      setEmail('');
      await fetchCollaborators();
    } catch (err) {
      console.error('Error inviting collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (collaboratorId: string) => {
    try {
      const { error } = await removeCollaborator(collaboratorId);
      if (error) throw error;
      await fetchCollaborators();
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Invite Collaborators</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Current Collaborators */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Collaborators</h3>
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{collab.email}</p>
                      <p className="text-sm text-gray-500">
                        {collab.role} • {collab.status}
                      </p>
                    </div>
                    <Tooltip content="Remove collaborator">
                      <button
                        onClick={() => handleRemove(collab.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                      >
                        <UserMinus className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No collaborators yet</p>
            )}
          </div>

          {/* Invite Form */}
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="pl-10 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'contributor' | 'viewer')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="contributor">Contributor (can edit)</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Inviting...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}