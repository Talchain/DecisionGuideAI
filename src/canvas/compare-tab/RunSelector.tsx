import { typography } from '../../styles/typography'
import { runLabel } from './runLabels'
import type { RunPair, RunPreset } from './types'

export interface RunSelectorRun {
  runNumber: number
  timestamp: string
}

interface RunSelectorProps {
  preset: RunPreset
  onChange: (preset: RunPreset) => void
  runCount: number
  showExpert: boolean
  /**
   * ROADMAP 2.113a slice 2 — the runs the A/B pick chooses between, and the
   * current pick. `pair` is null when the current selection cannot be resolved
   * to two distinct runs; the selects then fall back to the extremes rather
   * than rendering a self-comparison.
   */
  runs: ReadonlyArray<RunSelectorRun>
  pair: RunPair | null
  onPairChange: (endpoint: 'from' | 'to', runNumber: number) => void
}

function runOptionLabel(run: RunSelectorRun): string {
  return runLabel(run.runNumber, run.timestamp)
}

export function RunSelector({
  preset,
  onChange,
  runCount,
  showExpert,
  runs,
  pair,
  onPairChange,
}: RunSelectorProps) {
  const presets: Array<{ id: RunPreset; label: string; hidden?: boolean }> = [
    { id: 'prev', label: 'Latest vs previous' },
    { id: 'first', label: 'Latest vs first', hidden: runCount <= 2 },
    { id: 'all', label: 'All runs' },
    // Slice 2. Not hidden at 2 runs: "pick two" is exactly what you can do
    // with two runs, and the pair view says more about them than the preset.
    { id: 'pick', label: 'Pick two runs' },
  ]

  return (
    <div className="border-b border-panel-border">
      <div className="flex items-center gap-1 px-4 py-1.5">
        {presets.map(p =>
          p.hidden ? null : (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className={`px-2.5 py-0.5 rounded-full cursor-pointer border whitespace-nowrap transition-colors ${
                preset === p.id
                  ? 'border-info/30 bg-info/10'
                  : 'border-panel-border bg-transparent'
              } ${typography.panelMeta} text-text-body`}
            >
              {p.label}
            </button>
          )
        )}
        {showExpert && (
          <span className={`${typography.panelMeta} ml-auto text-info cursor-pointer`}>
            Run details
          </span>
        )}
      </div>

      {preset === 'pick' && (
        <div
          className="flex items-center gap-2 px-4 pb-1.5 flex-wrap"
          data-testid="run-pair-picker"
        >
          <label className={`${typography.panelMeta} text-text-light`} htmlFor="compare-pick-from">
            Compare run
          </label>
          <select
            id="compare-pick-from"
            aria-label="Earlier run"
            data-testid="run-pick-from"
            value={pair?.from ?? ''}
            onChange={e => onPairChange('from', Number(e.target.value))}
            className={`${typography.panelMeta} px-2 py-0.5 rounded border border-panel-border bg-transparent text-text-body cursor-pointer`}
          >
            {runs.map(r => (
              <option key={r.runNumber} value={r.runNumber}>
                {runOptionLabel(r)}
              </option>
            ))}
          </select>
          <label className={`${typography.panelMeta} text-text-light`} htmlFor="compare-pick-to">
            with
          </label>
          <select
            id="compare-pick-to"
            aria-label="Later run"
            data-testid="run-pick-to"
            value={pair?.to ?? ''}
            onChange={e => onPairChange('to', Number(e.target.value))}
            className={`${typography.panelMeta} px-2 py-0.5 rounded border border-panel-border bg-transparent text-text-body cursor-pointer`}
          >
            {runs.map(r => (
              <option key={r.runNumber} value={r.runNumber}>
                {runOptionLabel(r)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
