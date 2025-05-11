// src/components/InviteCollaborators.tsx

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Mail,
  AlertCircle,
  Loader2,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import { supabase } from '../lib/supabase';
import type { Collaborator } from '../contexts/DecisionContext';
import Tooltip from './Tooltip';

type Role = 'contributor' | 'viewer' | 'decision_lead' | 'approver';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'contributor', label: 'Contributor (can edit)' },
  { value: 'viewer',       label: 'Viewer (read-only)' },
  { value: 'decision_lead',label: 'Decision Lead (owner)' },
  { value: 'approver',     label: 'Approver (finalize decisions)' },
];

interface InviteCollaboratorsProps {
  onClose: () => void;
}

export default function InviteCollaborators({ onClose }: InviteCollaboratorsProps) {
  const { decisionId, collaborators, setCollaborators } = useDecision();
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<Role>('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch list helper (must come before useEffect so it's in scope)
  const fetchCollaborators = async () => {
    if (!decisionId) return;
    try {
      const { data, error: rpcErr } = await supabase.rpc(
        'get_decision_collaborators',
        { decision_id_param: decisionId }
      );
      if (rpcErr) throw rpcErr;
      setCollaborators(data || []);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch collaborators');
    }
  };

  // Subscribe + initial load
  useEffect(() => {
    if (!decisionId) return;

    // initial load
    fetchCollaborators();

    // realtime channel
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
        () => {
          fetchCollaborators();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [decisionId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionId || !email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Look up existing user by email
      const { data: userCheck } = await supabase.rpc(
        'check_user_email_exists',
        { email_to_check: email.trim() }
      );

      const { error: insertErr } = await supabase
        .from('decision_collaborators')
        .insert({
          decision_id: decisionId,
          user_id: userCheck?.id ?? null,
          email: email.trim(),
          role,
          status: 'invited',
          permissions: {
            can_comment: role === 'contributor',
            can_suggest: role === 'contributor',
            can_rate: role === 'contributor',
          },
        });

      if (insertErr) throw insertErr;

      setEmail('');
      fetchCollaborators();
    } catch (err) {
      console.error('Error inviting collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (collabId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteErr } = await supabase
        .from('decision_collaborators')
        .delete()
        .eq('id', collabId);
      if (deleteErr) throw deleteErr;
      fetchCollaborators();
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      setLoading(false);
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
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Existing Collaborators */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Collaborators</h3>
            {collaborators.length > 0 ? (
              <ul className="space-y-2">
                {collaborators.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{c.email}</p>
                      <p className="text-sm text-gray-500">
                        {c.role.replace(/_/g, ' ')} • {c.status}
                      </p>
                    </div>
                    <Tooltip content="Remove collaborator">
                      <button
                        onClick={() => handleRemove(c.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                        aria-label={`Remove ${c.email}`}
                      >
                        <UserMinus className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No collaborators yet</p>
            )}
          </div>

          {/* Invite Form */}
          <form onSubmit={handleInvite} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                  className="pl-10 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Inviting…</span>
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