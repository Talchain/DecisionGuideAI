// src/components/OptionsIdeation.tsx

import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Plus
} from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'
import { generateOptionsIdeation, OptionIdeation, BiasIdeation } from '../lib/api'

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
  if (!decisionId)      return <Navigate to="/decision" replace />
  if (!decision)        return <Navigate to="/decision/details" replace />
  if (!importance)      return <Navigate to="/decision/importance" replace />
  if (!reversibility)   return <Navigate to="/decision/reversibility" replace />

  const [localOptions, setLocalOptions] = useState<OptionIdeation[]>(options)
  const [newOption, setNewOption]       = useState({ label: '', description: '' })
  const [editingIdx, setEditingIdx]     = useState<number | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [biases, setBiases]             = useState<BiasIdeation[]>([])

  const back = () => navigate('/decision/goals')
  const next = () => {
    setOptions(localOptions)
    navigate('/decision/criteria')
  }

  const addOption = () => {
    const { label, description } = newOption
    if (!label.trim()) return
    setLocalOptions([
      ...localOptions,
      { label: label.trim(), description: description.trim() }
    ])
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
      const r = await generateOptionsIdeation({
        decision, decisionType, reversibility, importance, goals
      })
      setLocalOptions(r.options)
      setBiases(r.biases)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to generate options')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex items-center justify-between">
        <button onClick={back} className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-2"/> Back to Goals
        </button>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin h-5 w-5 inline mr-2"/> 
            ) : <Plus className="h-5 w-5 inline mr-2"/>}
          {loading ? 'Generating…' : 'Generate Options'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 p-4 rounded">
          <AlertTriangle className="h-5 w-5 text-red-500"/>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <h2 className="text-3xl font-bold text-center">Your Options</h2>

      <div className="space-y-4">
        {localOptions.map((opt, i) => (
          <div key={i} className="flex items-start justify-between bg-white p-4 rounded-xl shadow-sm">
            <div>
              <h3 className="font-medium">{opt.label}</h3>
              {opt.description && <p className="text-gray-600 mt-1">{opt.description}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                setEditingIdx(i)
                setNewOption({ label: opt.label, description: opt.description })
              }} className="p-1 text-gray-400 hover:text-gray-600">
                <Pencil className="h-4 w-4"/>
              </button>
              <button onClick={() => deleteOption(i)} className="p-1 text-gray-400 hover:text-red-600">
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
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Continue to Criteria <ArrowRight className="ml-2 h-5 w-5"/>
        </button>
      </div>
    </div>
  )
}