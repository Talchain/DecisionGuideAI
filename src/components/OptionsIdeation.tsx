// src/components/OptionsIdeation.tsx

import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Brain,
  ArrowRight
} from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'
import { analyzeOptions } from '../lib/api'
import Tooltip from './Tooltip'

interface Option {
  name: string
  pros: string[]
  cons: string[]
}

interface Bias {
  name: string
  definition: string
  mitigationTip: string
}

interface AIResponse {
  options: Option[]
  biases: Bias[]
}

export default function OptionsIdeation() {
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

  // ensure prior steps are complete
  if (!decisionId)       return <Navigate to="/decision" replace />
  if (!decision)         return <Navigate to="/decision/details" replace />
  if (!importance)       return <Navigate to="/decision/importance" replace />
  if (!reversibility)    return <Navigate to="/decision/reversibility" replace />

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await analyzeOptions({
          decision,
          decisionType,
          reversibility,
          importance,
          goals
        })

        setAiResponse(response)
        if (response.options) {
          setOptions(response.options)
        }
      } catch (err) {
        console.error('Error fetching options:', err)
        setError(err instanceof Error ? err.message : 'Failed to generate options')
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [
    decision,
    decisionType,
    reversibility,
    importance,
    goals,
    setOptions
  ])

  const handleBack     = () => navigate('/decision/goals')
  const handleContinue = () => navigate('/decision/criteria')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-gray-600">
          Generating options and analyzing potential biases...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="bg-red-50 p-4 rounded-lg max-w-md w-full">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error generating options
              </h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Back to Goals */}
      <button
        onClick={handleBack}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Goals
      </button>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">
          Consider These Options
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Based on your goals (if any) and decision context, here are some
          promising options to consider. Review each one carefully while
          being mindful of potential cognitive biases.
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiResponse?.options.map((opt, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-50 flex items-center justify-center">
                <span className="text-indigo-600 font-medium">{idx + 1}</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {opt.name}
                </h3>

                <div className="space-y-2">
                  <p className="font-semibold">Pros:</p>
                  <ul className="list-disc ml-5">
                    {opt.pros.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>

                  <p className="font-semibold mt-2">Cons:</p>
                  <ul className="list-disc ml-5">
                    {opt.cons.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cognitive Biases */}
      <div className="bg-gray-50 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-medium text-gray-900">
            Watch Out for These Biases
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiResponse?.biases.map((b, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-lg border border-gray-200"
            >
              <h4 className="font-medium text-gray-900 mb-1">
                {b.name}
              </h4>
              <p className="text-sm text-gray-600">
                {b.definition}
              </p>
              <p className="italic mt-2 text-gray-700">
                <span className="font-semibold">Mitigation Tip:</span>{' '}
                {b.mitigationTip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Continue to Criteria */}
      <div className="flex justify-end pt-6">
        <button
          onClick={handleContinue}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue to Criteria
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </div>
    </div>
  )
}