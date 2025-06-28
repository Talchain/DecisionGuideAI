// src/components/DecisionDetails.tsx

import React, { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ArrowLeft } from 'lucide-react'
import {
  getUserId,
  createDecision,
  DecisionType,
  isValidDecisionType
} from '../lib/supabase'
import { useDecision } from '../contexts/DecisionContext'
import ChatBox from './ChatBox'

const ROUTES = {
  TYPE: '/decision',
  IMPORTANCE: '/decision/importance'
}

const PLACEHOLDERS: Record<DecisionType, string> = {
  professional: 'e.g., Should we implement a new project management system?',
  financial: 'e.g., Should I invest in index funds or real estate?',
  health: 'e.g., Which fitness program should I follow?',
  career: 'e.g., Should I pursue an MBA or specialization?',
  relationships: 'e.g., Should I move in with my partner?',
  other: 'e.g., What decision are you trying to make?'
}

export default function DecisionDetails() {
  const navigate = useNavigate()
  const {
    decisionType,
    decision,
    setDecision,
    setDecisionId,
    setDecisionType
  } = useDecision()

  const [localDecision, setLocalDecision] = useState(decision || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Rehydrate decisionType from localStorage if missing
  useEffect(() => {
    if (!decisionType) {
      const saved = localStorage.getItem('decisionType')
      if (saved && isValidDecisionType(saved)) {
        setDecisionType(saved)
      }
    }
  }, [decisionType, setDecisionType])

  // Redirect if still no decisionType
  useEffect(() => {
    if (!decisionType) {
      navigate(ROUTES.TYPE, { replace: true })
    }
  }, [decisionType, navigate])

  // Sync context decision into local state
  useEffect(() => {
    if (decision) {
      setLocalDecision(decision)
    }
  }, [decision])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = localDecision.trim()
    if (!trimmed) {
      setError('Please enter a decision.')
      return
    }
    if (!decisionType || !isValidDecisionType(decisionType)) {
      setError('Invalid decision type. Please start again.')
      return
    }

    setLoading(true)
    try {
      const userId = await getUserId()
      if (!userId) {
        setError('Unable to get user session. Please log in again.')
        return
      }

      const { data, error: supaErr } = await createDecision({
        user_id: userId,
        type: decisionType,
        title: trimmed,
        status: 'draft'
      })
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
      navigate(ROUTES.IMPORTANCE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setLoading(false)
    }
  }

  if (!decisionType) return null

  return (
    <section
      aria-labelledby="decision-details-heading"
      className="bg-white rounded-xl shadow-lg p-8"
    >
      {/* Invisible heading for screen readers */}
      <h2 id="decision-details-heading" className="sr-only">
        Decision Details
      </h2>

      {/* Progress indicator */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">Step 2 of 7</p>
      </div>

      {/* Back button */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(ROUTES.TYPE)}
          disabled={loading}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Decision Types
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div>
          <label
            htmlFor="decision"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            What decision are you trying to make?
          </label>
          <input
            id="decision"
            name="decision"
            type="text"
            autoFocus
            value={localDecision}
            onChange={(e) => setLocalDecision(e.target.value)}
            placeholder={PLACEHOLDERS[decisionType]}
            disabled={loading}
            aria-describedby={error ? 'decision-error' : undefined}
            className={`w-full px-4 py-3 rounded-lg border ${
              error ? 'border-red-300' : 'border-gray-300'
            } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
          />
          {error && (
            <p
              id="decision-error"
              className="mt-2 text-sm text-red-600"
              role="alert"
            >
              • {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!localDecision.trim() || loading}
          className="w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          Continue
        </button>
      </form>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </section>
  )
}