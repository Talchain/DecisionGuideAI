/**
 * StreamParametersPanel - Stream Configuration Parameters
 * Phase 2E-D: Extracted from SandboxStreamPanel.tsx
 *
 * Manages seed, budget, and model parameters for streaming runs.
 * Provides input validation and persistence handling via onChange callback.
 */

import { memo, useCallback } from 'react'

interface StreamParametersProps {
  value: { seed: string; budget: string; model: string; scenarioId?: string | null }
  onChange: (next: StreamParametersProps['value']) => void
  disabled?: boolean
  readOnly?: boolean
}

function StreamParametersPanel({ value, onChange, disabled = false, readOnly = false }: StreamParametersProps) {
  const handleSeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const seed = e.target.value
      onChange({ ...value, seed })
    },
    [value, onChange]
  )

  const handleBudgetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const budget = e.target.value
      onChange({ ...value, budget })
    },
    [value, onChange]
  )

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const model = e.target.value
      onChange({ ...value, model })
    },
    [value, onChange]
  )

  const isDisabled = disabled || readOnly

  return (
    <div className="flex items-center gap-2 text-xs ml-2">
      <label className="flex items-center gap-1 text-gray-700">
        <span>Seed</span>
        <input
          data-testid="param-seed"
          type="text"
          className="w-20 px-1 py-0.5 border rounded"
          value={value.seed}
          onChange={handleSeedChange}
          disabled={isDisabled}
          aria-label="Random seed for reproducibility"
        />
      </label>
      <label className="flex items-center gap-1 text-gray-700">
        <span>Budget</span>
        <input
          data-testid="param-budget"
          type="number"
          step="0.01"
          className="w-24 px-1 py-0.5 border rounded"
          value={value.budget}
          onChange={handleBudgetChange}
          disabled={isDisabled}
          aria-label="Maximum budget in dollars"
        />
      </label>
      <label className="flex items-center gap-1 text-gray-700">
        <span>Model</span>
        <select
          data-testid="param-model"
          className="px-1 py-0.5 border rounded"
          value={value.model}
          onChange={handleModelChange}
          disabled={isDisabled}
          aria-label="AI model to use"
        >
          <option value="">(default)</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="claude-haiku">claude-haiku</option>
          <option value="local-sim">local-sim</option>
        </select>
      </label>
    </div>
  )
}

export default memo(StreamParametersPanel)
export type { StreamParametersProps }
