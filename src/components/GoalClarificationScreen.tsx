// src/components/GoalClarificationScreen.tsx

import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'

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
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false)

  // Guards: ensure prior steps are done
  if (!decisionType) {
    return <Navigate to="/decision" replace />
  }
  if (!decision) {
    return <Navigate to="/decision/details" replace />
  }
  if (!importance) {
    return <Navigate to={`/decision/${decisionId}/importance`} replace />
  }
  if (!reversibility) {
    return <Navigate to={`/decision/${decisionId}/reversibility`} replace />
  }
  if (!decisionId) {
    return <Navigate to="/decision" replace />
  }

  // Auto-skip for certain conditions
  const shouldSkipGoals =
    importance === 'low_priority_quick_assessment' && reversibility === 'Low'

  useEffect(() => {
    if (shouldSkipGoals) {
      navigate('/decision/analysis', { replace: true })
    }
  }, [shouldSkipGoals, navigate])

  const handleBack = () => {
    navigate('/decision/reversibility')
  }

  const handleContinue = () => {
    navigate('/decision/options')
  }

  const handleAddGoal = () => {
    const trimmed = newGoal.trim()
    if (!trimmed) return
    setGoals([...goals, trimmed])
    setNewGoal('')
  }

  const handleRemoveGoal = (index: number) => {
    const updated = [...goals]
    updated.splice(index, 1)
    setGoals(updated)
  }

  // Skip without clearing existing goals
  const handleSkip = () => {
    if (!showSkipConfirmation) {
      setShowSkipConfirmation(true)
    } else {
    // either preserve or clear goals—your choice—
    // but ALWAYS navigate to a route you’ve defined:
    //   /decision/options  or  /decision/analysis
    setGoals(goals)     // or setGoals([])
    navigate('/decision/options')
    }
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto p-4">
      <button
        onClick={handleBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Reversibility
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">What are your goals?</h2>
        <p className="text-gray-600">
          Defining goals helps focus the analysis on what matters most.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {goals.length > 0 && (
          <ul className="space-y-2 mb-4">
            {goals.map((goal, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center p-2 bg-gray-50 rounded"
              >
                <span>{goal}</span>
                <button
                  onClick={() => handleRemoveGoal(idx)}
                  aria-label="Remove goal"
                  className="text-gray-400 hover:text-red-500"
                >
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
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.preventDefault(), handleAddGoal())
            }
            placeholder="Enter a goal…"
            className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAddGoal}
            disabled={!newGoal.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {showSkipConfirmation && (
          <div className="bg-yellow-50 p-4 rounded mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  Are you sure you want to skip setting goals?
                </p>
                <p className="text-yellow-700">
                  Goals help ensure the analysis stays on track.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 bg-yellow-100 text-yellow-900 rounded"
                  >
                    Yes, skip goals
                  </button>
                  <button
                    onClick={() => setShowSkipConfirmation(false)}
                    className="px-4 py-2 bg-white border rounded"
                  >
                    No, add goals
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={handleContinue}
            disabled={goals.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            Continue
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-2 border text-gray-700 rounded"
          >
            Skip Goals
          </button>
        </div>
      </div>
    </div>
  );
}