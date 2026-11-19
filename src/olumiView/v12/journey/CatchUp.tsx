/**
 * The way into Catch up from the top of the Olumi panel (item 4 of overnight/journey/critique/SYNTHESIS.md, as far as fields the View sends
 * today allow): one quiet row, "Catch up · 2 conclusions moved · 3 open", only when there is something to catch up on; one press opens the
 * history panel's Catch up (JourneyRecord). It repeats nothing: no Next step (the panel draws its own), no conclusion words, only counts of
 * what the panel holds. "Since you were last here" needs a reader cursor the View does not carry yet (engine ask `journey.catch_up`), so
 * this counts what the View holds now and says no "new".
 *
 * Imports only `journey.ts` (types and pure code) and the versions panel store, so mounting it in the chat adds nothing to the first load.
 */
import { useMemo } from 'react'
import { typography } from '../../../styles/typography'
import { openVersionsPanel } from '../../../canvas/versions/versionsPanelStore'
import { useViewStore } from '../../store'
import { journeyOf } from './journey'

export const CATCH_UP_WORDS = {
  label: 'Catch up',
  moved: (n: number) => (n === 1 ? '1 conclusion moved' : `${n} conclusions moved`),
  open: (n: number) => `${n} open`,
} as const

/** The counts the row says: conclusions whose chance text changed at the version shown, and open items (as the panel lists them). */
export function catchUpCounts(view: Parameters<typeof journeyOf>[0], at: number | null): { moved: number; open: number } {
  const j = journeyOf(view, { at, keptNode: () => null, hasNext: false })
  return { moved: j.moved?.rows.filter((r) => !r.sameText).length ?? 0, open: j.open.length }
}

export function CatchUp(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const c = useMemo(() => (view === null ? null : catchUpCounts(view, at)), [view, at])
  if (c === null || (c.moved === 0 && c.open === 0)) return null
  const parts = [c.moved > 0 ? CATCH_UP_WORDS.moved(c.moved) : null, c.open > 0 ? CATCH_UP_WORDS.open(c.open) : null].filter((x): x is string => x !== null)
  return (
    <button type="button" onClick={openVersionsPanel} data-testid="journey-catch-up"
      className={`${typography.viewPanelMeta} block w-full min-w-0 rounded-sm px-0 text-left text-text-light hover:bg-panel-hover hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
      <span className="text-text-header">{CATCH_UP_WORDS.label}</span> · {parts.join(' · ')}
    </button>
  )
}
