import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Brain,
  ArrowRight,
  UserPlus
} from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'
import {
  generateOptionsIdeation,
  OptionIdeation,
  BiasIdeation
} from '../lib/api'

interface Props {
  onInvite: () => void
}

export default function OptionsIdeation({ onInvite }: Props) {
  const navigate = useNavigate()
  const {
    decisionId,
    decision,
    decisionType,
    importance,
    reversibility,
    goals,
    setOptions
  } = useDecision()

  // Guard-rails for flow
  if (!decisionId)    return <Navigate to="/decision" replace />
  if (!decision)      return <Navigate to="/decision/details" replace />
  if (!importance)    return <Navigate to="/decision/importance" replace />
  if (!reversibility) return <Navigate to="/decision/reversibility" replace />

  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [options, setLocalOptions] = useState<OptionIdeation[]>([])
  const [biases, setLocalBiases]   = useState<BiasIdeation[]>([])

  // fetch once on mount (won’t re-run when modal opens/closes)
  useEffect(() => {
    let cancelled = false
    async function fetchIdeation() {
      try {
        setLoading(true)
        setError(null)

        const response = await generateOptionsIdeation({
          decision,
          decisionType,
          reversibility,
          importance,
          goals
        })

        if (!cancelled) {
          setLocalOptions(response.options)
          setLocalBiases(response.biases)
          setOptions(response.options)
        }
      } catch (err) {
        console.error('Error fetching options:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate options')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchIdeation()
    return () => { cancelled = true }
  }, [
    decision,
    decisionType,
    reversibility,
    importance,
    goals,
    setOptions
  ])

  const goBack = () => navigate('/decision/goals')
  const goNext = () => navigate('/decision/criteria')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-gray-600">Generating options…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="underline">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Row: Back + Invite */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Goals
        </button>

        <button
          onClick={onInvite}
          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-900"
        >
          <UserPlus className="h-5 w-5" />
          Invite collaborators
        </button>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">
          Consider These Options
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Based on your decision context, here are some promising options to consider.
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((opt, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <h3 className="text-lg font-semibold mb-2">{opt.label}</h3>
            <p className="text-gray-700">{opt.description}</p>
          </div>
        ))}
      </div>

      {/* Biases */}
      <div className="bg-gray-50 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-medium text-gray-900">
            Cognitive Biases to Watch
          </h3>
        </div>
        <ul className="list-disc ml-6 space-y-2">
          {biases.map((b, i) => (
            <li key={i}>
              <span className="font-semibold">{b.name}:</span> {b.description}
            </li>
          ))}
        </ul>
      </div>

      {/* Continue */}
      <div className="flex justify-end pt-6">
        <button
          onClick={goNext}
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Continue to Criteria
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </div>
    </div>
  )
}