// src/components/InviteCollaborators.tsx

import React, { useState, useEffect } from 'react'
import {
  X,
  Users,
  Mail,
  AlertCircle,
  Loader2,
  UserPlus,
  UserMinus
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDecision } from '../contexts/DecisionContext'
import type { Collaborator } from '../contexts/DecisionContext'
import Tooltip from './Tooltip'

export default function InviteCollaborators() {
  const navigate = useNavigate()
  const { decisionId, collaborators, setCollaborators } = useDecision()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner'|'contributor'|'approver'|'viewer'>('contributor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch & subscribe
  useEffect(() => {
    if (!decisionId) {
      // if someone lands here out of sequence
      navigate('/decision/details', { replace: true })
      return
    }

    const fetchCollaborators = async () => {
      const { data, error } = await supabase.rpc(
        'get_decision_collaborators',
        { decision_id_param: decisionId }
      )
      if (error) {
        console.error('Error fetching collaborators:', error)
        setError(error.message)
      } else {
        setCollaborators(data || [])
      }
    }

    fetchCollaborators()

    const channel = supabase
      .channel(`decision_collab:${decisionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_collaborators',
          filter: `decision_id=eq.${decisionId}`
        },
        () => fetchCollaborators()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [decisionId, navigate, setCollaborators])

  // Invite form
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    try {
      // optional: check user existence
      const { data: userCheck } = await supabase.rpc(
        'check_user_email_exists',
        { email_to_check: email.trim() }
      )

      const { error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert({
          decision_id: decisionId,
          user_id: userCheck?.id || null,
          email: email.trim(),
          role,
          status: 'invited'
        })

      if (inviteError) throw inviteError
      setEmail('')
    } catch (err: any) {
      console.error('Error inviting collaborator:', err)
      setError(err.message || 'Failed to invite')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('decision_collaborators')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (err: any) {
      console.error('Error removing collaborator:', err)
      setError(err.message || 'Remove failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Invite Collaborators</h3>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-auto flex-1 flex flex-col">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">Current</h4>
            {collaborators.length ? (
              <ul className="space-y-2">
                {collaborators.map(c => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">{c.email}</p>
                      <p className="text-xs text-gray-500">
                        {c.role} — {c.status}
                      </p>
                    </div>
                    <Tooltip content="Remove">
                      <button
                        onClick={() => handleRemove(c.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-full"
                      >
                        <UserMinus className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No collaborators yet.
              </p>
            )}
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  className="w-full pl-10 px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Role
              </label>
              <select
                id="role"
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                value={role}
                onChange={e => setRole(e.target.value as any)}
              >
                <option value="owner">Decision Lead</option>
                <option value="approver">Approver</option>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Inviting…
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" /> Send Invitation
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}