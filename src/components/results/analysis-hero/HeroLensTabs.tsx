/**
 * HeroLensTabs — the lens switcher (Goal fit / Likely outcome / Stability /
 * What changed).
 *
 * WAI-ARIA tabs pattern: role="tablist" with roving tabindex — Left/Right
 * arrows (plus Home/End) move focus AND selection; only the active tab is
 * in the tab order. The strip always renders ALL four prototype lenses:
 * lenses without data stay selectable (muted, with a screen-reader cue) and
 * the panel body explains why they are unavailable and what unlocks them —
 * an explained empty state, never a dead tab and never a fabricated chart.
 * Lens switching is pure local render state in the parent — no fetch, no
 * rerun, no chart remount.
 */
import { useRef } from 'react'
import { typography } from '@/styles/typography'
import { HERO_COPY } from './heroCopy'
import { ALL_HERO_LENSES } from './heroTypes'
import type { HeroLens } from './heroTypes'

export interface HeroLensTabsProps {
  /** DATA-BEARING lenses; every other lens renders muted but selectable. */
  available: HeroLens[]
  active: HeroLens
  onSelect: (lens: HeroLens) => void
  /** False while stale — lens switching is locked. */
  interactive: boolean
  /** id of the tabpanel the tabs control. */
  panelId: string
}

/**
 * Tab element ids are scoped to the owning panel's useId (like every other
 * id in the module) so a second concurrent mount can never produce
 * duplicate DOM ids / ambiguous aria references.
 */
export function tabId(panelId: string, lens: HeroLens): string {
  return `${panelId}-tab-${lens}`
}

export function HeroLensTabs({
  available,
  active,
  onSelect,
  interactive,
  panelId,
}: HeroLensTabsProps) {
  const refs = useRef<Partial<Record<HeroLens, HTMLButtonElement | null>>>({})

  const moveTo = (index: number) => {
    const count = ALL_HERO_LENSES.length
    const next = ALL_HERO_LENSES[(index + count) % count]
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
        moveTo(ALL_HERO_LENSES.length - 1)
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={HERO_COPY.tablistAria}
      className="flex gap-0.5 rounded-full border border-panel-border p-0.5"
    >
      {ALL_HERO_LENSES.map((lens, index) => {
        const selected = lens === active
        const isAvailable = available.includes(lens)
        return (
          <button
            key={lens}
            ref={(el) => {
              refs.current[lens] = el
            }}
            type="button"
            role="tab"
            id={tabId(panelId, lens)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={!interactive}
            onClick={() => interactive && onSelect(lens)}
            onKeyDown={(e) => onKeyDown(e, index)}
            data-testid={`hero-lens-tab-${lens}`}
            data-available={isAvailable ? 'true' : 'false'}
            className={`${typography.panelMeta} flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              selected
                ? 'bg-primary text-text-on-color'
                : isAvailable
                  ? 'bg-transparent text-text-light hover:bg-panel-hover hover:text-text-body'
                  : 'bg-transparent text-text-light opacity-60 hover:bg-panel-hover'
            } disabled:cursor-default`}
          >
            {HERO_COPY.lensLabel[lens]}
            {!isAvailable && (
              <span className="sr-only"> ({HERO_COPY.srLensUnavailable})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default HeroLensTabs
