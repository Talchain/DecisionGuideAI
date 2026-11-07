/**
 * The crafted lens tabs (`components/results/analysis-hero/HeroLensTabs.tsx`), ported: the same pill strip and the same keyboard model
 * (arrows, Home, End, roving tabindex). The tab words are core's (`run.lenses[].label`, its `title` on hover), one tab per lens the Run has
 * data for; with fewer than two there is nothing to switch, so no strip.
 */
import { useRef, type KeyboardEvent } from 'react'
import { TYPE } from './type'
import type { Lens } from './pick'

export const lensTabId = (panelId: string, lens: Lens['id']): string => `${panelId}-tab-${lens}`

export function LensTabs({ lenses, active, onSelect, panelId }: { lenses: readonly (Lens & { i: number })[]; active: Lens['id']; onSelect: (lens: Lens['id']) => void; panelId: string }) {
  const refs = useRef<Partial<Record<Lens['id'], HTMLButtonElement | null>>>({})
  if (lenses.length < 2) return null
  const moveTo = (index: number) => {
    const next = lenses[(index + lenses.length) % lenses.length]!.id
    onSelect(next)
    refs.current[next]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const to = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? lenses.length - 1 : null
    if (to === null) return
    e.preventDefault()
    moveTo(to)
  }
  return (
    <div role="tablist" className="flex gap-0.5 rounded-full border border-panel-border p-0.5" data-testid="port-lens-tabs">
      {lenses.map((lens, index) => {
        const selected = lens.id === active
        return (
          <button
            key={lens.id}
            ref={(el) => { refs.current[lens.id] = el }}
            type="button"
            role="tab"
            id={lensTabId(panelId, lens.id)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            title={lens.title}
            onClick={() => onSelect(lens.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            data-testid={`port-lens-tab-${lens.id}`}
            data-view={`run.lenses.${lens.i}.label`}
            className={`${TYPE.meta} flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              selected ? 'bg-primary text-text-on-color' : 'bg-transparent text-text-light hover:bg-panel-hover hover:text-text-body'
            }`}
          >
            {lens.label}
          </button>
        )
      })}
    </div>
  )
}
