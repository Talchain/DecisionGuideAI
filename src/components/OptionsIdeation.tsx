// src/components/OptionsIdeation.tsx

import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Loader2, AlertTriangle, Pencil, Trash2, Plus, Users
} from 'lucide-react'
import ChatBox from './ChatBox'
import InviteCollaborators from './InviteCollaborators'
import { useDecision } from '../contexts/DecisionContext'
import { OptionIdeation, BiasIdeation } from '../lib/api'
import { generateOptionsIdeation } from '../lib/generateOptionsIdeation'
import { AlertCircle } from 'lucide-react'
import CollaborativeOptions from './CollaborativeOptions'

export default function OptionsIdeation() {
  const navigate = useNavigate()
  const {
    decisionId,
    decision,
    decisionType,
    importance,
    reversibility,
    goals,
    options,
    setOptions
  } = useDecision()

  // Flow guards
  if (!decisionId)    return <Navigate to="/decision/intake" replace />
  if (!decision)      return <Navigate to="/decision/intake" replace />
  if (!importance)    return <Navigate to="/decision/intake" replace />
  if (!reversibility) return <Navigate to="/decision/intake" replace />

  const [localOptions, setLocalOptions]     = useState<OptionIdeation[]>(options)
  const [newOption, setNewOption]           = useState({ label: '', description: '' })
  const [editingIdx, setEditingIdx]         = useState<number | null>(null)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [retryCount, setRetryCount]         = useState(0)
  const [biases, setBiases]                 = useState<BiasIdeation[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCollaborative, setShowCollaborative] = useState(false)

  const back = () => navigate('/decision/goals')
  const next = () => {
    setOptions(localOptions)
    navigate('/decision/criteria')
  }

  const addOption = () => {
    if (!newOption.label.trim()) return
    setLocalOptions([...localOptions, { ...newOption }])
    setNewOption({ label: '', description: '' })
  }

  const saveEdit = () => {
    if (editingIdx === null) return
    const arr = [...localOptions]
    arr[editingIdx] = { ...newOption }
    setLocalOptions(arr)
    setEditingIdx(null)
    setNewOption({ label: '', description: '' })
  }

  const deleteOption = (i: number) => {
    const arr = [...localOptions]
    arr.splice(i, 1)
    setLocalOptions(arr)
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Starting options generation...')
      const r = await generateOptionsIdeation({
        decision, decisionType, reversibility, importance, goals
      })
      console.log('Options generation successful:', r)
      setLocalOptions(r.options)
      setBiases(r.biases)
    } catch (err) {
      console.error(`Options generation failed (attempt ${retryCount + 1}):`, err)
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to generate options. Please try again or check your connection.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Retry handler
  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1)
      generate()
    }
  }

  return (
    <>
      {showInviteModal && (
        <InviteCollaborators
          open={true}
          onClose={() => setShowInviteModal(false)}
          decisionId={decisionId}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Goals
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
            >
              Invite Collaborators
            </button>
            <button
              onClick={() => setShowCollaborative(!showCollaborative)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
            >
              <Users className="h-5 w-5 inline mr-2"/>
              {showCollaborative ? 'Hide Collaborative' : 'Show Collaborative'}
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="animate-spin h-5 w-5 inline mr-2"/> Generating…</>
                : <><Plus className="h-5 w-5 inline mr-2"/> Generate Options</>
              }
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-700 font-medium">Error generating options</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                
                {retryCount < 3 && (
                  <button onClick={handleRetry} className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Try Again ({3 - retryCount} attempts remaining)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {showCollaborative ? (
          <CollaborativeOptions 
            decisionId={decisionId} 
            onGenerateAI={generate}
          />
        ) : (
          <>
            <h2 className="text-3xl font-bold text-center">Your Options</h2>
            <div className="space-y-4">
              {localOptions.map((opt, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between bg-white p-4 rounded-xl shadow-sm"
                >
                  <div>
                    <h3 className="font-medium">{opt.label}</h3>
                    {opt.description && <p className="text-gray-600 mt-1">{opt.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingIdx(i)
                        setNewOption({ label: opt.label, description: opt.description })
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4"/>
                    </button>
                    <button
                      onClick={() => deleteOption(i)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-gray-50 p-4 rounded-xl">
                <h3 className="font-medium mb-2">
                  {editingIdx !== null ? 'Edit Option' : 'Add New Option'}
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Option label"
                    value={newOption.label}
                    onChange={e => setNewOption(n => ({ ...n, label: e.target.value }))}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newOption.description}
                    onChange={e => setNewOption(n => ({ ...n, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                  <button
                    onClick={editingIdx !== null ? saveEdit : addOption}
                    disabled={!newOption.label.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {editingIdx !== null ? 'Save Changes' : 'Add Option'}
                  </button>
                  {editingIdx !== null && (
                    <button
                      onClick={() => {
                        setEditingIdx(null)
                        setNewOption({ label: '', description: '' })
                      }}
                      className="ml-2 px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {biases.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-xl space-y-4">
            <h3 className="text-lg font-medium">Cognitive Biases to Watch</h3>
            <ul className="list-disc ml-6 space-y-2">
              {biases.map((b,i) => (
                <li key={i}><strong>{b.name}:</strong> {b.description}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-6">
          <button
            onClick={next}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={!localOptions.length}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Continue to Criteria <ArrowRight className="ml-2 h-5 w-5"/>
          </button>
        </div>
      </div>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </>
  )
}