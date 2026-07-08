// Top strip: preview identity pill · Simple/Detailed segmented control ·
// state pills (Example data / Results out of date) · Exit preview.
//
// The "Results out of date" pill is one half of the stale-clarity contract
// (amendment A7); the per-card "From a previous run" markers are the other.

import { useRef } from 'react'
import { useGraphExperienceVMContext } from './vm/useGraphExperienceVM'
import { useViewLevelStore, type ViewLevel } from './state/viewLevelStore'
import { PREVIEW_PILL_LABEL, STALE_PILL_LABEL, FIXTURE_PILL_LABEL, EXIT_LABEL } from './vm/strings'

const LEVELS: Array<{ value: ViewLevel; label: string }> = [
  { value: 'simple', label: 'Simple' },
  { value: 'detailed', label: 'Detailed' },
]

function ViewLevelToggle() {
  const level = useViewLevelStore((s) => s.level)
  const setLevel = useViewLevelStore((s) => s.setLevel)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const currentIndex = LEVELS.findIndex((l) => l.value === level)
    const nextIndex = (currentIndex + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? LEVELS.length - 1 : 1)) % LEVELS.length
    setLevel(LEVELS[nextIndex].value)
    refs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="View level"
      data-testid="vnext-view-toggle"
      className="flex items-center rounded-full border border-panel-border bg-panel p-0.5"
      onKeyDown={onKeyDown}
    >
      {LEVELS.map((entry, i) => {
        const active = level === entry.value
        return (
          <button
            key={entry.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-testid={`vnext-view-${entry.value}`}
            onClick={() => setLevel(entry.value)}
            className={`rounded-full px-3 py-1 text-xs ${
              active ? 'bg-primary text-text-on-color' : 'bg-transparent text-text-body hover:bg-panel-hover'
            }`}
          >
            {entry.label}
          </button>
        )
      })}
    </div>
  )
}

export function VNextTopStrip({ onExit }: { onExit: () => void }) {
  const vm = useGraphExperienceVMContext()

  return (
    <div
      data-testid="vnext-top-strip"
      className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b border-panel-border bg-panel/90 px-3 py-2"
    >
      <span className="rounded-full border border-info/30 bg-transparent px-2 py-0.5 text-xs text-text-body">
        {PREVIEW_PILL_LABEL}
      </span>

      <ViewLevelToggle />

      {vm.provenance === 'fixture' && (
        <span
          data-testid="vnext-fixture-banner"
          className="rounded-full border border-warning/30 bg-transparent px-2 py-0.5 text-xs text-text-body"
        >
          {FIXTURE_PILL_LABEL}
        </span>
      )}

      {vm.analysis.isStaleResult && (
        <span
          data-testid="vnext-stale-pill"
          className="rounded-full border border-warning/30 bg-transparent px-2 py-0.5 text-xs text-text-body"
        >
          {STALE_PILL_LABEL}
        </span>
      )}

      <button
        type="button"
        data-testid="vnext-exit"
        onClick={onExit}
        className="ml-auto rounded-md border border-panel-border bg-panel px-3 py-1 text-xs text-text-body hover:bg-panel-hover"
      >
        {EXIT_LABEL}
      </button>
    </div>
  )
}
