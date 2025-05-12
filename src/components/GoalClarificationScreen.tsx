import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'
import InviteCollaborators from './InviteCollaborators'

export default function GoalClarificationScreen() {
  const navigate = useNavigate()
  const {
    decisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    setGoals
  } = useDecision()

  const [newGoal, setNewGoal] = useState('')
  const [skipConfirm, setSkipConfirm] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  // Flow guards…
  if (!decisionType)    return <Navigate to="/decision" replace />
  if (!decision)        return <Navigate to="/decision/details" replace />
  if (!importance)      return <Navigate to="/decision/importance" replace />
  if (!reversibility)   return <Navigate to="/decision/reversibility" replace />
  if (!decisionId)      return <Navigate to="/decision" replace />

  useEffect(() => {
    if (
      importance === 'low_priority_quick_assessment' &&
      reversibility === 'Low'
    ) {
      navigate('/decision/options', { replace: true })
    }
  }, [importance, reversibility, navigate])

  const back   = () => navigate('/decision/reversibility')
  const next   = () => navigate('/decision/options')
  const add    = () => {
    if (!newGoal.trim()) return
    setGoals([...goals, newGoal.trim()])
    setNewGoal('')
  }
  const remove = (i: number) => {
    const arr = [...goals]
    arr.splice(i, 1)
    setGoals(arr)
  }
  const skip   = () => {
    if (!skipConfirm) return setSkipConfirm(true)
    setSkipConfirm(false)
    navigate('/decision/options')
  }

  return (
    <>
      <InviteCollaborators
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        decisionId={decisionId}
      />

      <div className="space-y-8 max-w-2xl mx-auto p-4">
        {/* …rest of your UI… */}

        <div className="flex gap-2">
          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
          >
            Invite Collaborators
          </button>
          {/* … */}
        </div>
      </div>
    </>
  )
}