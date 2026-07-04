/**
 * HeroLensTabs — the lens switcher (Goal fit / Likely outcome).
 *
 * WAI-ARIA tabs pattern: role="tablist" with roving tabindex — Left/Right
 * arrows (plus Home/End) move focus AND selection; only the active tab is
 * in the tab order. Unavailable lenses are never passed in (no disabled
 * dead tabs), and the parent hides this strip entirely when only one lens
 * exists. Lens switching is pure local render state in the parent — no
 * fetch, no rerun, no chart remount.
 */
import { useRef } from 'react'
import { typography } from '@/styles/typography'
import { HERO_COPY } from './heroCopy'
import type { HeroLens } from './heroTypes'

export interface HeroLensTabsProps {
  lenses: HeroLens[]
  active: HeroLens
  onSelect: (lens: HeroLens) => void
  /** False while stale — lens switching is locked. */
  interactive: boolean
  /** id of the tabpanel the tabs control. */
  panelId: string
}

export function tabId(lens: HeroLens): string {
  return `analysis-hero-tab-${lens}`
}

export function HeroLensTabs({ lenses, active, onSelect, interactive, panelId }: HeroLensTabsProps) {
  const refs = useRef<Partial<Record<HeroLens, HTMLButtonElement | null>>>({})

  const moveTo = (index: number) => {
    const next = lenses[(index + lenses.length) % lenses.length]
    onSelect(next)
    refs.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!interactive) return
    // Horizontal tablist: Left/Right + Home/End only (WAI-ARIA APG).
    // Up/Down are deliberately NOT handled so page scrolling still works
    // while the tablist has focus.
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveTo(index - 1)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(lenses.length - 1)
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={HERO_COPY.tablistAria}
      className="flex gap-0.5 rounded-full border border-panel-border p-0.5"
    >
      {lenses.map((lens, index) => {
        const selected = lens === active
        return (
          <button
            key={lens}
            ref={(el) => {
              refs.current[lens] = el
            }}
            type="button"
            role="tab"
            id={tabId(lens)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={!interactive}
            onClick={() => interactive && onSelect(lens)}
            onKeyDown={(e) => onKeyDown(e, index)}
            data-testid={`hero-lens-tab-${lens}`}
            className={`${typography.panelMeta} flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              selected
                ? 'bg-primary text-text-on-color'
                : 'bg-transparent text-text-light hover:bg-panel-hover hover:text-text-body'
            } disabled:cursor-default`}
          >
            {HERO_COPY.lensLabel[lens]}
          </button>
        )
      })}
    </div>
  )
}

export default HeroLensTabs
