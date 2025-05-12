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
import { generateOptionsIdeation, OptionIdeation, BiasIdeation } from '../lib/api'
import InviteCollaborators from './InviteCollaborators'

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

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string|null>(null)
  const [opts, setLocalOpts]  = useState<OptionIdeation[]>([])
  const [biases, setLocalBiases] = useState<BiasIdeation[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  // Flow guards
  if (!decisionId)      return <Navigate to="/decision" replace />
  if (!decision)        return <Navigate to="/decision/details" replace />
  if (!importance)      return <Navigate to="/decision/importance" replace />
  if (!reversibility)   return <Navigate to="/decision/reversibility" replace />

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const r = await generateOptionsIdeation({
          decision, decisionType, reversibility, importance, goals
        })
        setLocalOpts(r.options)
        setLocalBiases(r.biases)
        setOptions(r.options)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [decision, decisionType, reversibility, importance, goals, setOptions])

  const back   = () => navigate('/decision/goals')
  const next   = () => navigate('/decision/criteria')

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin"/>
      <p className="text-gray-600">Generating options…</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertTriangle className="w-8 h-8 text-red-500"/>
      <p className="text-red-600">{error}</p>
      <button onClick={() => window.location.reload()} className="underline text-indigo-600">
        Try again
      </button>
    </div>
  )

  return (
    <>
      {inviteOpen && (
        <InviteCollaborators
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          decisionId={decisionId}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={back} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Goals
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
          >
            Invite Collaborators
          </button>
        </div>

        <h2 className="text-3xl font-bold text-center">Consider These Options</h2>
        <p className="text-gray-600 text-center max-w-2xl mx-auto">
          Based on your context, here are some promising options.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {opts.map((o,i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border">
              <h3 className="text-lg font-semibold mb-2">{o.label}</h3>
              <p className="text-gray-700">{o.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-5 w-5 text-indigo-600"/>
            <h3 className="text-lg font-medium text-gray-900">Cognitive Biases to Watch</h3>
          </div>
          <ul className="list-disc ml-6 space-y-2">
            {biases.map((b,i)=>(
              <li key={i}><strong>{b.name}:</strong> {b.description}</li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={next}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Continue to Criteria <ArrowRight className="ml-2 h-5 w-5"/>
          </button>
        </div>
      </div>
    </>
  )
}