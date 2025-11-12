/**
 * M6: Decision Rationale Form
 * Capture reasoning for scenario decisions
 */

import { useState } from 'react'
import { Plus, X, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { DecisionRationale } from '../snapshots/types'

interface DecisionRationaleFormProps {
  snapshotId: string
  existingRationale?: DecisionRationale
  onSave: (rationale: Omit<DecisionRationale, 'id' | 'decidedAt'>) => void
  onCancel: () => void
}

export function DecisionRationaleForm({
  snapshotId,
  existingRationale,
  onSave,
  onCancel,
}: DecisionRationaleFormProps) {
  const [title, setTitle] = useState(existingRationale?.title || '')
  const [reasoning, setReasoning] = useState(existingRationale?.reasoning || '')
  const [pros, setPros] = useState<string[]>(existingRationale?.pros || [''])
  const [cons, setCons] = useState<string[]>(existingRationale?.cons || [''])
  const [alternatives, setAlternatives] = useState<string[]>(
    existingRationale?.alternatives || []
  )
  const [decision, setDecision] = useState<DecisionRationale['decision']>(
    existingRationale?.decision || 'pending'
  )
  const [decidedBy, setDecidedBy] = useState(existingRationale?.decidedBy || '')

  const handleAddPro = () => setPros([...pros, ''])
  const handleRemovePro = (index: number) => setPros(pros.filter((_, i) => i !== index))
  const handleProChange = (index: number, value: string) => {
    const updated = [...pros]
    updated[index] = value
    setPros(updated)
  }

  const handleAddCon = () => setCons([...cons, ''])
  const handleRemoveCon = (index: number) => setCons(cons.filter((_, i) => i !== index))
  const handleConChange = (index: number, value: string) => {
    const updated = [...cons]
    updated[index] = value
    setCons(updated)
  }

  const handleAddAlternative = () => setAlternatives([...alternatives, ''])
  const handleRemoveAlternative = (index: number) =>
    setAlternatives(alternatives.filter((_, i) => i !== index))
  const handleAlternativeChange = (index: number, value: string) => {
    const updated = [...alternatives]
    updated[index] = value
    setAlternatives(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const rationale: Omit<DecisionRationale, 'id' | 'decidedAt'> = {
      snapshotId,
      title: title.trim(),
      reasoning: reasoning.trim(),
      pros: pros.filter((p) => p.trim().length > 0),
      cons: cons.filter((c) => c.trim().length > 0),
      alternatives: alternatives.filter((a) => a.trim().length > 0),
      decision,
      decidedBy: decidedBy.trim() || undefined,
    }

    onSave(rationale)
  }

  const decisionIcons = {
    approved: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    rejected: <XCircle className="w-4 h-4 text-red-600" />,
    pending: <Clock className="w-4 h-4 text-yellow-600" />,
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-4 space-y-4"
    >
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Decision Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Approve Product Launch Strategy"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      {/* Reasoning */}
      <div>
        <label htmlFor="reasoning" className="block text-sm font-medium text-gray-700 mb-1">
          Reasoning *
        </label>
        <textarea
          id="reasoning"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Explain the rationale for this decision..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      {/* Pros */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pros</label>
        <div className="space-y-2">
          {pros.map((pro, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={pro}
                onChange={(e) => handleProChange(index, e.target.value)}
                placeholder="Enter a positive aspect..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => handleRemovePro(index)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddPro}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Pro
          </button>
        </div>
      </div>

      {/* Cons */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cons</label>
        <div className="space-y-2">
          {cons.map((con, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={con}
                onChange={(e) => handleConChange(index, e.target.value)}
                placeholder="Enter a negative aspect..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => handleRemoveCon(index)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddCon}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Con
          </button>
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Alternatives Considered (optional)
        </label>
        <div className="space-y-2">
          {alternatives.map((alt, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={alt}
                onChange={(e) => handleAlternativeChange(index, e.target.value)}
                placeholder="Enter an alternative option..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => handleRemoveAlternative(index)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddAlternative}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Alternative
          </button>
        </div>
      </div>

      {/* Decision status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Decision Status *</label>
        <div className="flex gap-3">
          {(['approved', 'rejected', 'pending'] as const).map((status) => (
            <label
              key={status}
              className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer ${
                decision === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={status}
                checked={decision === status}
                onChange={(e) => setDecision(e.target.value as DecisionRationale['decision'])}
                className="hidden"
              />
              {decisionIcons[status]}
              <span className="text-sm font-medium capitalize">{status}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Decided by */}
      <div>
        <label htmlFor="decidedBy" className="block text-sm font-medium text-gray-700 mb-1">
          Decided By (optional)
        </label>
        <input
          id="decidedBy"
          type="text"
          value={decidedBy}
          onChange={(e) => setDecidedBy(e.target.value)}
          placeholder="Name or role of decision maker"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Save Decision
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
