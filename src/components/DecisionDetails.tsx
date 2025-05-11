// src/components/DecisionDetails.tsx

import React, { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ArrowLeft, UserPlus } from 'lucide-react'
import {
  getUserId,
  createDecision,
  DecisionType,
  isValidDecisionType
} from '../lib/supabase'
import { useDecision } from '../contexts/DecisionContext'
import Tooltip from './Tooltip'

export default function DecisionDetails() {
  const navigate = useNavigate()
  const {
    decisionType,
    decision,
    setDecision,
    setDecisionId,
    setDecisionType,
    collaborators
  } = useDecision()

  // Rehydrate decisionType if missing
  useEffect(() => {
    if (!decisionType) {
      const saved = localStorage.getItem('decisionType')
      if (saved) {
        setDecisionType(saved)
        if (import.meta.env.DEV) console.debug('[DD] 💾 rehydrated type:', saved)
      }
    }
  }, [decisionType, setDecisionType])

  // If still no decisionType, send them home
  useEffect(() => {
    if (!decisionType) navigate('/decision', { replace: true })
  }, [decisionType, navigate])

  const [localDecision, setLocalDecision] = useState(decision || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep localDecision in sync if context updates
  useEffect(() => {
    if (decision) setLocalDecision(decision)
  }, [decision])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = localDecision.trim()
    if (!trimmed) {
      setError('Please enter a decision.')
      return
    }

    if (!isValidDecisionType(decisionType!)) {
      setError('Invalid decision type. Please start again.')
      return
    }

    setLoading(true)
    console.debug('[DD] 🟡 handleSubmit - fetching userId…')
    try {
      const userId = await getUserId()
      console.debug('[DD] 👤 getUserId returned', userId)
      if (!userId) {
        setError('Unable to get user session. Please log in again.')
        return
      }

      const payload = {
        user_id: userId,
        type: decisionType as DecisionType,
        title: trimmed,
        status: 'draft'
      }
      console.debug('[DD] 📨 createDecision payload', payload)

      const { data, error: supaErr } = await createDecision(payload)
      console.debug('[DD] 📥 createDecision response', { data, supaErr })

      if (supaErr) {
        setError(supaErr.message)
        return
      }
      if (!data?.id) {
        setError('Unexpected error: no ID returned.')
        return
      }

      setDecision(trimmed)
      setDecisionId(data.id)
      navigate('/decision/invite')  // ← send to your Invite step
    } catch (err) {
      console.error('[DD] 💥 handleSubmit exception', err)
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setLoading(false)
    }
  }

  const getPlaceholder = () => {
    switch (decisionType) {
      case 'professional':
        return 'e.g., Should we implement a new project management system?'
      case 'financial':
        return 'e.g., Should I invest in index funds or real estate?'
      case 'health':
        return 'e.g., Which fitness program should I follow?'
      case 'career':
        return 'e.g., Should I pursue an MBA or specialisation?'
      case 'relationships':
        return 'e.g., Should I move in with my partner?'
      default:
        return 'e.g., What decision are you trying to make?'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/decision')}
          disabled={loading}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Decision Types
        </button>

        <Tooltip content="Invite others to collaborate">
          <button
            onClick={() => navigate('/decision/invite')}
            className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite ({collaborators.length})</span>
          </button>
        </Tooltip>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="decision"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            What decision are you trying to make?
          </label>
          <input
            id="decision"
            type="text"
            value={localDecision}
            onChange={(e) => setLocalDecision(e.target.value)}
            placeholder={getPlaceholder()}
            disabled={loading}
            required
            className={`w-full px-4 py-3 rounded-lg border ${
              error ? 'border-red-300' : 'border-gray-300'
            } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">• {error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!localDecision.trim() || loading}
          className="w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating…
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Continue
            </>
          )}
        </button>
      </form>
    </div>
  )
}