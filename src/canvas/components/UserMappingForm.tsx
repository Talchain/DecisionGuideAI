/**
 * UserMappingForm Component (Phase 1.3)
 *
 * Handles user resolution of `needs_user_mapping` options.
 * Allows users to specify which causal variables each option affects
 * and what values to use.
 *
 * Key features:
 * - Immutable updates (creates new objects, no mutation)
 * - Factor node selection from current graph
 * - Value input with unit hints from target node
 * - Save creates a ready option with user_specified source
 */

import { useState, useMemo } from 'react'
import { Plus, Trash2, HelpCircle, Check } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { UIOption, UIInterventionValue } from '../../types/options'

// ============================================================================
// Types
// ============================================================================

interface UserMappingFormProps {
  /** Option being configured */
  option: UIOption
  /** Canvas nodes for target selection */
  nodes: Node[]
  /** Callback when mapping is complete */
  onSave: (updatedOption: UIOption) => void
  /** Callback to cancel */
  onCancel?: () => void
}

interface DraftMapping {
  id: string
  nodeId: string
  value: string // String for input, converted to number on save
}

interface NodeData {
  label?: string
  kind?: string
  observedState?: {
    value?: number
    baseline?: number
    unit?: string
  }
}

// ============================================================================
// Component
// ============================================================================

export function UserMappingForm({
  option,
  nodes,
  onSave,
  onCancel,
}: UserMappingFormProps) {
  // Draft state for mappings being edited
  const [drafts, setDrafts] = useState<DraftMapping[]>(() => {
    // Initialize from unresolved targets if available
    return (
      option.unresolved_targets?.map((target, idx) => ({
        id: `draft-${idx}`,
        nodeId: '',
        value: '',
      })) ?? [{ id: 'draft-0', nodeId: '', value: '' }]
    )
  })

  // Get factor/decision nodes that can be intervention targets
  const targetableNodes = useMemo(
    () =>
      nodes.filter((n) => {
        const kind = (n.data as NodeData)?.kind
        // Exclude option nodes - can't intervene on options
        return kind !== 'option' && kind !== 'decision' && n.type !== 'option'
      }),
    [nodes]
  )

  // Check if form is valid
  const isValid = useMemo(() => {
    const nonEmptyDrafts = drafts.filter((d) => d.nodeId && d.value)
    if (nonEmptyDrafts.length === 0) return false

    // Check all values are valid numbers
    return nonEmptyDrafts.every((d) => {
      const parsed = parseFloat(d.value)
      return !isNaN(parsed) && isFinite(parsed)
    })
  }, [drafts])

  // Add a new mapping row
  const addMapping = () => {
    setDrafts((d) => [...d, { id: `draft-${Date.now()}`, nodeId: '', value: '' }])
  }

  // Remove a mapping row
  const removeMapping = (id: string) => {
    setDrafts((d) => d.filter((m) => m.id !== id))
  }

  // Update a mapping
  const updateMapping = (id: string, field: 'nodeId' | 'value', value: string) => {
    setDrafts((d) =>
      d.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    )
  }

  // Save the mappings
  const handleSave = () => {
    if (!isValid) return

    // Create new intervention objects (no mutation)
    const newInterventions: Record<string, UIInterventionValue> = {}

    for (const draft of drafts) {
      if (!draft.nodeId || !draft.value) continue

      const parsedValue = parseFloat(draft.value)
      if (isNaN(parsedValue)) continue

      newInterventions[draft.nodeId] = {
        value: parsedValue,
        source: 'user_specified',
        target_match: {
          node_id: draft.nodeId,
          match_type: 'exact_id',
          confidence: 'high',
        },
        value_confidence: 'high',
      }
    }

    // Create new option object (immutable)
    const updatedOption: UIOption = {
      ...option,
      status: 'ready',
      interventions: {
        ...option.interventions,
        ...newInterventions,
      },
      user_questions: undefined,
      unresolved_targets: undefined,
    }

    onSave(updatedOption)
  }

  // Get unit hint for a node
  const getUnitHint = (nodeId: string): string | undefined => {
    const node = nodes.find((n) => n.id === nodeId)
    return (node?.data as NodeData)?.observedState?.unit
  }

  return (
    <div className="space-y-4" data-testid="user-mapping-form">
      {/* Questions from backend */}
      {option.user_questions && option.user_questions.length > 0 && (
        <div className="space-y-2">
          {option.user_questions.map((question, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 px-3 py-2 bg-sky-50 rounded-lg"
            >
              <HelpCircle className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <p className={`${typography.bodySmall} text-sky-800`}>{question}</p>
            </div>
          ))}
        </div>
      )}

      {/* Mapping rows */}
      <div className="space-y-2">
        <p className={`${typography.caption} font-medium text-ink-600`}>
          Specify what this option changes:
        </p>

        {drafts.map((draft, idx) => {
          const targetLabel = option.unresolved_targets?.[idx]
          const unitHint = draft.nodeId ? getUnitHint(draft.nodeId) : undefined

          return (
            <div
              key={draft.id}
              className="flex items-center gap-2 p-2 bg-sand-50 rounded-lg"
            >
              {/* Target label from brief (if available) */}
              {targetLabel && (
                <span
                  className={`${typography.caption} text-ink-500 bg-white px-2 py-1 rounded flex-shrink-0`}
                >
                  "{targetLabel}"
                </span>
              )}

              {/* Arrow */}
              <span className="text-ink-400">→</span>

              {/* Node selector */}
              <select
                value={draft.nodeId}
                onChange={(e) => updateMapping(draft.id, 'nodeId', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-sand-200 rounded bg-white"
              >
                <option value="">Select variable...</option>
                {targetableNodes.map((node) => {
                  const data = node.data as NodeData
                  return (
                    <option key={node.id} value={node.id}>
                      {data.label || node.id}
                      {data.observedState?.unit && ` (${data.observedState.unit})`}
                    </option>
                  )
                })}
              </select>

              {/* Value input */}
              <div className="relative">
                <input
                  type="number"
                  placeholder="Value"
                  value={draft.value}
                  onChange={(e) => updateMapping(draft.id, 'value', e.target.value)}
                  className="w-24 px-2 py-1.5 text-sm border border-sand-200 rounded bg-white"
                />
                {unitHint && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                    {unitHint}
                  </span>
                )}
              </div>

              {/* Remove button */}
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMapping(draft.id)}
                  className="p-1 text-carrot-500 hover:text-carrot-700 hover:bg-carrot-50 rounded"
                  aria-label="Remove mapping"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        })}

        {/* Add mapping button */}
        <button
          type="button"
          onClick={addMapping}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-sky-700 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add another variable
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-sand-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-ink-600 hover:text-ink-800 hover:bg-sand-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className={`flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            isValid
              ? 'bg-sky-600 text-white hover:bg-sky-700'
              : 'bg-sand-200 text-sand-500 cursor-not-allowed'
          }`}
        >
          <Check className="h-4 w-4" />
          Save and enable option
        </button>
      </div>
    </div>
  )
}

/**
 * Compact inline prompt for options needing mapping.
 */
export function NeedsMappingPrompt({
  option,
  onConfigure,
}: {
  option: UIOption
  onConfigure: () => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 bg-banana-50 border border-banana-200 rounded-lg"
      data-testid="needs-mapping-prompt"
    >
      <div className="flex items-center gap-2 min-w-0">
        <HelpCircle className="h-4 w-4 text-banana-600 flex-shrink-0" />
        <span className={`${typography.caption} text-banana-700 truncate`}>
          This option needs configuration
        </span>
      </div>
      <button
        type="button"
        onClick={onConfigure}
        className="px-2 py-1 text-xs font-medium text-banana-700 bg-banana-100 hover:bg-banana-200 rounded transition-colors flex-shrink-0"
      >
        Configure
      </button>
    </div>
  )
}
