// src/components/GoalClarificationScreen.tsx

import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react'
import ChatBox from './ChatBox'
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

  // Flow guards
  if (!decisionId) return <Navigate to="/decision/intake" replace />
  if (!decision) return <Navigate to="/decision/intake" replace />
  if (!importance) return <Navigate to="/decision/intake" replace />
  if (!reversibility) return <Navigate to="/decision/intake" replace />
  // quick-skip
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
    console.log("[GoalClarificationScreen] Adding goal:", newGoal);
    if (!newGoal.trim()) return
    setGoals([...goals, newGoal.trim()])
    setNewGoal('')
  }
  const remove = (i: number) => {
    console.log("[GoalClarificationScreen] Removing goal at index:", i);
    const arr = [...goals]
    arr.splice(i, 1)
    setGoals(arr)
  }
  const skip   = () => {
    console.log("[GoalClarificationScreen] Skipping goals");
    if (!skipConfirm) return setSkipConfirm(true)
    setSkipConfirm(false)
    navigate('/decision/options')
  }

  return (
    <>
      {inviteOpen && (
        <InviteCollaborators
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          decisionId={decisionId}
        />
      )}

      <div className="space-y-8 max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={back}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Reversibility
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setInviteOpen(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
            >
              Invite Collaborators
            </button>
            <button
              onClick={() => alert('Coming soon!')}
              className="px-4 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100"
            >
              Generate Goals
            </button>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">What are your goals?</h2>
          <p className="text-gray-600">Defining goals helps focus the analysis.</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {goals.length > 0 && (
            <ul className="space-y-2 mb-4">
              {goals.map((g,i) => (
                <li key={i} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{g}</span>
                  <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              onKeyDown={e => e.key==='Enter' && (e.preventDefault(), add())}
              placeholder="Enter a goal…"
              className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={add}
              disabled={!newGoal.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              <Plus className="h-5 w-5"/>
            </button>
          </div>

          {skipConfirm && (
            <div className="bg-yellow-50 p-4 rounded mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5"/>
                <div>
                  <p className="font-medium text-yellow-800">Skip setting goals?</p>
                  <p className="text-yellow-700">Goals help keep your analysis on track.</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={skip} className="px-4 py-2 bg-yellow-100 rounded">Yes, skip</button>
                    <button onClick={() => setSkipConfirm(false)} className="px-4 py-2 bg-white border rounded">No, add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={next}
              disabled={goals.length===0}
              className="px-6 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              Continue
            </button>
            <button onClick={skip} className="px-6 py-2 border rounded">Skip Goals</button>
          </div>
        </div>
      </div>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </>
  )
}