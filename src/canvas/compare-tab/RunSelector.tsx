import { typography } from '../../styles/typography'
import type { RunPreset } from './types'

interface RunSelectorProps {
  preset: RunPreset
  onChange: (preset: RunPreset) => void
  runCount: number
  showExpert: boolean
}

export function RunSelector({ preset, onChange, runCount, showExpert }: RunSelectorProps) {
  const presets: Array<{ id: RunPreset; label: string; hidden?: boolean }> = [
    { id: 'prev', label: 'Latest vs previous' },
    { id: 'first', label: 'Latest vs first', hidden: runCount <= 2 },
    { id: 'all', label: 'All runs' },
  ]

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-panel-border">
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
  )
}
