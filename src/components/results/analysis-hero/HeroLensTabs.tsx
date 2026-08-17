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

/**
 * Lenses whose unavailability the USER CAN ACT ON. `goal` is the only one:
 * when it is unavailable because no success target is set, the panel body
 * offers "Set a success target to unlock Goal fit." with a live define-success
 * route — so the muted tab is a real affordance.
 *
 * ⭐ L-57/L-38, AND THE RULE BEHIND IT. Every other unavailable lens is a
 * PRODUCER GAP the user can do nothing whatever about: `stability` needs
 * per-option stability data ISL does not emit (issue 211) and `whatChanged`
 * needs versioned run comparisons PLoT does not emit (issue 212). Neither is
 * ever pushed into the available set by the live adapter (`buildHeroModel.ts`
 * pushes exactly `goal` and `outcome`), so on live data those two tabs were
 * PERMANENTLY muted — a strip in which half the tabs advertise capabilities
 * the product does not have, one of them explaining itself in producer-issue
 * vocabulary ("This unlocks with versioned run comparisons. Olumi will not
 * approximate it locally.").
 *
 * A tab the user cannot act on and the producer cannot fill is not an
 * affordance, it is an advertisement. It is hidden — NOT deleted: the moment a
 * producer starts supplying the data, `available` contains the lens and the
 * tab returns with no code change. The fixture gallery keeps all four, because
 * fixtures genuinely populate them.
 */
export const USER_ACTIONABLE_WHEN_UNAVAILABLE: readonly HeroLens[] = ['goal']

/**
 * The lenses the strip renders. Pure and exported so the rule is testable
 * without a DOM, and so a mutant that widens it is visible.
 */
export function selectVisibleLenses(available: readonly HeroLens[]): HeroLens[] {
  return ALL_HERO_LENSES.filter(
    (lens) => available.includes(lens) || USER_ACTIONABLE_WHEN_UNAVAILABLE.includes(lens),
  )
}

export interface HeroLensTabsProps {
  /** DATA-BEARING lenses; every other lens renders muted but selectable. */
  available: HeroLens[]
  active: HeroLens
  onSelect: (lens: HeroLens) => void
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
  panelId,
}: HeroLensTabsProps) {
  const refs = useRef<Partial<Record<HeroLens, HTMLButtonElement | null>>>({})
  // Roving focus must walk the RENDERED tabs, not the full lens enum — arrowing
  // onto a tab that is not in the DOM focuses nothing and strands the keyboard
  // user (the `refs.current[next]?.focus()` below would silently no-op).
  const visibleLenses = selectVisibleLenses(available)

  const moveTo = (index: number) => {
    const count = visibleLenses.length
    if (count === 0) return
    const next = visibleLenses[(index + count) % count]
    onSelect(next)
    refs.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
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
        moveTo(visibleLenses.length - 1)
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={HERO_COPY.tablistAria}
      className="flex gap-0.5 rounded-full border border-panel-border p-0.5"
    >
      {visibleLenses.map((lens, index) => {
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
            onClick={() => onSelect(lens)}
            onKeyDown={(e) => onKeyDown(e, index)}
            data-testid={`hero-lens-tab-${lens}`}
            data-available={isAvailable ? 'true' : 'false'}
            className={`${typography.panelMeta} flex-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              selected
                ? 'bg-primary text-text-on-color'
                : isAvailable
                  ? 'bg-transparent text-text-light hover:bg-panel-hover hover:text-text-body'
                  : 'bg-transparent text-text-light opacity-60 hover:bg-panel-hover'
            }`}
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
