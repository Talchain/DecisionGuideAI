// src/components/DecisionDetails.tsx

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ArrowLeft } from 'lucide-react'
import { getUserId, createDecision, DecisionType } from '../lib/supabase'
import { useDecision } from '../contexts/DecisionContext'

export default function DecisionDetails() {
  const navigate = useNavigate()
  const {
    decisionType,
    decision,
    setDecision,
    setDecisionId,
    setDecisionType
  } = useDecision()

  // Rehydrate type if missing
  useEffect(() => {
    if (!decisionType) {
      const savedType = localStorage.getItem('decisionType')
      if (savedType) {
        setDecisionType(savedType)
        if (import.meta.env.DEV) {
          console.debug('[DD] 💾 Rehydrated decisionType from localStorage:', savedType)
        }
      }
    }
  }, [decisionType, setDecisionType])

  if (!decisionType) {
    return <p className="text-center text-gray-500">Loading decision details…</p>
  }

  const [localDecision, setLocalDecision] = useState(decision || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (decision) setLocalDecision(decision)
  }, [decision])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = localDecision.trim()
    if (!trimmed) {
      setError('Please enter a decision')
      return
    }
    if (!decisionType || !(decisionType as DecisionType)) {
      console.error('[DD] ❌ Invalid decisionType value:', decisionType)
      setError('Invalid decision type. Please start again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const userId = await getUserId()
      if (!userId) {
        setError('Unable to get user session. Please log in again.')
        return
      }

      const payload = {
        title: trimmed,
        type: decisionType as DecisionType,
        status: 'draft',
        user_id: userId
      }
      if (import.meta.env.DEV) console.debug('[DD] ⏳ inserting payload', payload)

      const { data, error: supaErr } = await createDecision(payload)
      if (supaErr) {
        console.error('[DD] ❌ Supabase insert error:', supaErr)
        setError(supaErr.message)
        return
      }
      if (!data?.id) {
        setError('Unexpected error: No ID returned')
        return
      }

      setDecision(trimmed)
      setDecisionId(data.id)

      // ← send them into the Invite step first
      navigate('/decision/invite')
    } catch (err) {
      console.error('[DD] 💥 Unexpected exception', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => navigate('/decision')

  const getPlaceholder = () => {
    switch (decisionType) {
      case 'professional':
        return 'e.g., Should we implement a new project management system?'
      case 'financial':
        return 'e.g., Should I invest in index funds or real estate?'
      case 'health':
        return 'e.g., Which fitness program should I follow?'
      case 'career':
        return 'e.g., Should I pursue an MBA or specialised certification?'
      case 'relationships':
        return 'e.g., Should I move in with my partner?'
      default:
        return 'e.g., What decision are you trying to make?'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <button
        onClick={handleBack}
        disabled={loading}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Decision Types
      </button>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* …rest remains unchanged */}
      </form>
    </div>
  )
}