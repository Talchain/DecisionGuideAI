// src/components/OptionsIdeation.tsx

import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Loader2, AlertTriangle, Pencil, Trash2, Plus, Users, Save,
  WifiOff, Clock, ServerCrash, AlertCircle
} from 'lucide-react'
import ChatBox from './ChatBox'
import InviteCollaborators from './InviteCollaborators'
import { useDecision } from '../contexts/DecisionContext'
import { OptionIdeation, BiasIdeation, ErrorType as ApiErrorType } from '../lib/api'
import { generateOptionsIdeation } from '../lib/generateOptionsIdeation'
import CollaborativeOptions from './CollaborativeOptions'
import Button from './shared/Button'
import { AppErrorHandler } from '../lib/errors'

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
    setOptions,
    saveOptionsToSupabase
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
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ApiErrorType | null>(null)
  const [retryCount, setRetryCount]         = useState(0)
  const [biases, setBiases]                 = useState<BiasIdeation[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCollaborative, setShowCollaborative] = useState(false)
  const [saving, setSaving] = useState(false)

  const back = () => navigate('/decision/goals')
  
  const next = async () => {
    setSaving(true);
    setError(null);
    try {
      // Update context state
      setOptions(localOptions);
      
      // Save to Supabase
      await saveOptionsToSupabase(localOptions);
      
      navigate('/decision/criteria');
    } catch (err) {
      const errorMessage = AppErrorHandler.getUserFriendlyMessage(err as any);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    if (!newOption.label.trim()) return
    setLocalOptions([...localOptions, { ...newOption }])
    setNewOption({ label: '', description: '' })
    setError(null)
  }

  const saveEdit = () => {
    if (editingIdx === null) return
    const arr = [...localOptions]
    arr[editingIdx] = { ...newOption }
    setLocalOptions(arr)
    setEditingIdx(null)
    setNewOption({ label: '', description: '' })
    setError(null)
  }

  const deleteOption = (i: number) => {
    const arr = [...localOptions]
    arr.splice(i, 1)
    setLocalOptions(arr)
    setError(null)
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    setErrorType(null)
    
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
      
      if (err instanceof Error && 'type' in err) {
        const appError = err as any;
        setError(AppErrorHandler.getUserFriendlyMessage(appError));
        setErrorType(appError.type);
      } else {
        setError('Failed to generate options. Please try again or check your connection.');
        setErrorType(ApiErrorType.UNKNOWN);
      }
    } finally {
      setLoading(false)
    }
  }

  // Retry handler
  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1)
      setError(null)
      setErrorType(null)
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
            <Button
              onClick={generate}
              loading={loading}
              icon={Plus}
            >
              Generate Options
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              {/* Show different icons based on error type */}
              {errorType === ApiErrorType.NETWORK ? (
                <WifiOff className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              ) : errorType === ApiErrorType.RATE_LIMIT ? (
                <Clock className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              ) : errorType === ApiErrorType.SERVER_ERROR ? (
                <ServerCrash className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="text-red-700 font-medium">Error generating options</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                
                {/* Show specific guidance based on error type */}
                {errorType === ApiErrorType.NETWORK && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                    <p className="font-medium">Network issue detected:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Check your internet connection</li>
                      <li>Ensure you're not behind a restrictive firewall</li>
                      <li>Try refreshing the page</li>
                    </ul>
                  </div>
                )}
                
                {errorType === ApiErrorType.RATE_LIMIT && (
                  <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <p className="font-medium">Rate limit reached:</p>
                    <p className="mt-1">Please wait a moment before trying again. Our AI service has usage limits to ensure fair access for all users.</p>
                  </div>
                )}
                
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
                  <Button
                    onClick={editingIdx !== null ? saveEdit : addOption}
                    disabled={!newOption.label.trim()}
                  >
                    {editingIdx !== null ? 'Save Changes' : 'Add Option'}
                  </Button>
                  {editingIdx !== null && (
                    <Button
                      onClick={() => {
                        setEditingIdx(null)
                        setNewOption({ label: '', description: '' })
                      }}
                      variant="outline"
                      className="ml-2"
                    >
                      Cancel
                    </Button>
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
          <Button
            onClick={next}
            disabled={!localOptions.length}
            loading={saving}
            icon={ArrowRight}
            size="lg"
          >
            Continue to Criteria
          </Button>
        </div>
      </div>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </>
  )
}