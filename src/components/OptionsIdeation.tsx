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

  // Flow guards…
  if (!decisionId)    return <Navigate to="/decision" replace />
  if (!decision)      return <Navigate to="/decision/details" replace />
  if (!importance)    return <Navigate to="/decision/importance" replace />
  if (!reversibility) return <Navigate to="/decision/reversibility" replace />

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const r = await generateOptionsIdeation({
          decision, reversibility, importance, goals
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
    fetch()
  }, [decision, importance, reversibility, goals, setOptions])

  const back = () => navigate('/decision/goals')
  const next = () => navigate('/decision/criteria')

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin"/>
    </div>
  )
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertTriangle className="w-8 h-8 text-red-500"/>
      <p className="text-red-600">{error}</p>
    </div>
  )

  return (
    <>
      <InviteCollaborators
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        decisionId={decisionId}
      />

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
        {/* …rest of your UI… */}
      </div>
    </>
  )
}