// src/components/GoalClarificationScreen.tsx

import React, { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, AlertTriangle, Save } from 'lucide-react'
import ChatBox from './ChatBox'
import { useDecision } from '../contexts/DecisionContext'
import InviteCollaborators from './InviteCollaborators'
import Button from './shared/Button'
import { AppErrorHandler } from '../lib/errors'

export default function GoalClarificationScreen() {
  const navigate = useNavigate()
  const {
    decisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    setGoals,
    saveGoalsToSupabase
  } = useDecision()

  const [newGoal, setNewGoal] = useState('')
  const [skipConfirm, setSkipConfirm] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const back   = () => navigate('/decision/intake')
  
  const next = async () => {
    if (goals.length > 0) {
      setSaving(true);
      setError(null);
      try {
        await saveGoalsToSupabase(goals);
        navigate('/decision/options');
      } catch (err) {
        const errorMessage = AppErrorHandler.getUserFriendlyMessage(err as any);
        setError(errorMessage);
      } finally {
        setSaving(false);
      }
    } else {
      navigate('/decision/options');
    }
  };
  
  const add    = () => {
    console.log("[GoalClarificationScreen] Adding goal:", newGoal);
    if (!newGoal.trim()) return
    setGoals([...goals, newGoal.trim()])
    setNewGoal('')
    setError(null)
  }
  const remove = (i: number) => {
    console.log("[GoalClarificationScreen] Removing goal at index:", i);
    const arr = [...goals]
    arr.splice(i, 1)
    setGoals(arr)
    setError(null)
  }
  const skip = async () => {
    console.log("[GoalClarificationScreen] Skipping goals");
    if (!skipConfirm) {
      setSkipConfirm(true);
      return;
    }
    
    // Save empty goals array to Supabase when skipping
    setSaving(true);
    setError(null);
    try {
      await saveGoalsToSupabase([]);
      setSkipConfirm(false);
      navigate('/decision/options');
    } catch (err) {
      const errorMessage = AppErrorHandler.getUserFriendlyMessage(err as any);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

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
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Decision Details
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
          {error && (
            <div className="mb-4 bg-red-50 p-4 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

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
            <Button
              onClick={add}
              disabled={!newGoal.trim()}
              icon={Plus}
            >
              Add
            </Button>
          </div>

          {skipConfirm && (
            <div className="bg-yellow-50 p-4 rounded mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5"/>
                <div>
                  <p className="font-medium text-yellow-800">Skip setting goals?</p>
                  <p className="text-yellow-700">Goals help keep your analysis on track.</p>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      onClick={skip} 
                      variant="outline"
                      loading={saving}
                    >
                      Yes, skip
                    </Button>
                    <Button 
                      onClick={() => setSkipConfirm(false)}
                      variant="outline"
                    >
                      No, add goals
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              onClick={next}
              disabled={goals.length === 0}
              loading={saving}
            >
              Continue
            </Button>
            <Button 
              onClick={skip} 
              variant="outline"
              loading={saving}
            >
              Skip Goals
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </>
  )
}