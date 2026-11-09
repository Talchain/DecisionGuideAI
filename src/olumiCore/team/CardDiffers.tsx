/**
 * TM-04, "Where your explanations differ" on the cards (DL backlog row 7, 8 Nov). After the reveal, each link one member doubts and another
 * keeps is a chip on both of its cards, in the card's one rail beside the reveal's chips (RevealMarks.tsx CardViewChips, or StrategyChips
 * when that is the card's rail). The source is core's `GET …/differences`: an entry of kind 'link' names both its cards (`cards`, core
 * debate.ts:306). Every word is core's, as given:
 * - on the chip, core's words for it (`chip`, at most 28 characters: who doubts the link);
 * - in its name, the link (`label`) and who holds which explanation (`sides[].text`);
 * - on hover, the link (`label`), then core's sentence for what the difference does to the chances (`status_text`), so two chips with the
 *   same words on one card say which link each is.
 * A rail that holds a doubted link stays inside its card and wraps to a second row rather than cut or squeeze a chip (`railLayout`).
 * Core gives a link one entry per aim it was run for; the card shows the link once (its first entry, core's order), and the Team tab
 * shows each aim's.
 * Selecting the chip opens the difference in the dock's Team tab. A factor a member thinks the model leaves out names no card (`cards: []`,
 * debate.ts:346), so it is said in the Team tab only. A figure the team differs on is already the reveal's own chip. Before the reveal,
 * while gated, or on an earlier version, nothing is read or drawn. The read is the Team tab's own (`differencesKey`), so the dock and the
 * canvas never read the same View twice.
 * Core's one chip per link (`collab.link_marks`, LinkMarks.tsx) replaces this chip: a link this canvas draws a link mark for is not drawn
 * here. Without link marks (an older core), or for a link whose mark has no line or card here, this chip is drawn as before.
 */
import { Fragment, useEffect, type CSSProperties } from 'react'
import { Unlink2 } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { useViewStore } from '../../olumiView/store'
import { CARD_WIDTH } from '../../olumiView/layout'
import { differencesKey, readDifferences, useDifferences, type Difference } from './differences'
import { usePlacedKeys } from './LinkMarks'

const NONE: readonly Difference[] = []

/** The doubted links core names on this card, once each (its first aim's entry), in core's order. Reads the differences once per revealed
 *  View; the Team tab shares the read. */
export function useLinkDiffers(card: string): readonly Difference[] {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  // Core names no link or factor until two views are shown to this viewer (debate.ts `newest.size < 2`), and nothing while they are gated.
  const key = sid !== null && view !== null && at === null && !view.gated && view.collab.shared.length >= 2 ? differencesKey(sid, view) : null
  const read = useDifferences((s) => s.key)
  useEffect(() => { if (sid !== null && key !== null && read !== key) void readDifferences(sid, key) }, [sid, key, read])
  // Only an answer read for this very View: an older one (another version, before a reveal, or kept after a failed read) is never drawn as
  // this one's.
  const data = useDifferences((s) => (key !== null && s.read === key ? s.data : null))
  // A link core draws its own one chip for (on its line or its folding card) is not drawn again here (keyed on records).
  const marked = usePlacedKeys()
  if (data === null || data.gated) return NONE
  const seen = new Set<string>()
  return data.differences.filter((d) => {
    if (d.kind !== 'link' || !(d.cards ?? []).includes(card) || seen.has(d.record) || marked.has(d.record)) return false
    seen.add(d.record)
    return true
  })
}

const quoted = (s: string) => s.replace(/["\\]/g, '\\$&')

/**
 * Where a card's one rail sits (UI, 8 Nov, Paul's visual gate: nothing cut, nothing off its card). A rail that holds a doubted link is the
 * card's width and wraps to a second row, so every chip keeps its natural width inside the card. A rail of the reveal's own chips alone
 * keeps V11's geometry (one row, `wide`, centred under the card): that rail is V11's to change.
 */
export function railLayout(holdsDoubts: boolean, wide: number): { wrap: string; style: CSSProperties } {
  return holdsDoubts ? { wrap: 'flex-wrap', style: { width: CARD_WIDTH } } : { wrap: 'flex-nowrap', style: { width: wide, marginLeft: (CARD_WIDTH - wide) / 2 } }
}

/** Open the difference in the dock (the Team tab), brought into view once the tab draws it. Nothing opens on an earlier version. */
function openDiffer(d: Difference): void {
  if (useViewStore.getState().at !== null) return
  useUIStore.getState().forceActivateOutputTab('team')
  const at = `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}`
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-testid="${quoted(at)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })))
}

/**
 * One doubted link on one of its cards, as the reveal's chips are drawn: a mark in the circle where they have initials, then core's words for
 * it (`chip`). Core names only who doubts the link, never a keeper, so no person's initial stands beside its words. The chip keeps its
 * natural width; were core's words ever wider than the card, they would wrap inside the chip, never cut. Its whole name is core's: the chip,
 * the link, and each person's explanation, each said whole and apart. An older core sends no `chip`: the mark alone, with the same name.
 */
export function DifferChip({ d, card }: { d: Difference; card: string }): JSX.Element {
  return (
    <button type="button" title={`${d.label}\n${d.status_text}`} data-differ-chip={d.record} data-differ-card={card}
      onClick={(e) => { e.stopPropagation(); openDiffer(d) }}
      className={`pointer-events-auto inline-flex min-h-6 max-w-full flex-none cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel py-0.5 pl-0.5 ${d.chip ? 'pr-2.5' : 'pr-0.5'} text-left ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2`}>
      <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">
        <Unlink2 className="h-3 w-3" />
      </span>
      {d.chip ? <span data-differ-chip-text="">{d.chip}</span> : null}
      {' '}<span className="sr-only" data-differ-label="">{d.label}</span>
      {d.sides.map((s) => <Fragment key={s.holder_id}>{' '}<span className="sr-only" data-differ-side={s.holder_id}>{s.text}</span></Fragment>)}
    </button>
  )
}
