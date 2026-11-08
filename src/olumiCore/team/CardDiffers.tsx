/**
 * TM-04, "Where your explanations differ" on the cards (DL backlog row 7, 8 Nov). After the reveal, each link one member doubts and another
 * keeps is a chip on both of its cards, in the card's one rail beside the reveal's chips (RevealMarks.tsx CardViewChips, or StrategyChips
 * when that is the card's rail). The source is core's `GET …/differences`: an entry of kind 'link' names both its cards (`cards`, core
 * debate.ts:306). Every word is core's, as given:
 * - the link (`label`);
 * - who holds which explanation (`sides[].text`);
 * - core's sentence for what the difference does to the chances (`status_text`, on hover).
 * Core gives a link one entry per aim it was run for; the card shows the link once (its first entry, core's order), and the Team tab
 * shows each aim's.
 * Selecting the chip opens the difference in the dock's Team tab. A factor a member thinks the model leaves out names no card (`cards: []`,
 * debate.ts:346), so it is said in the Team tab only. A figure the team differs on is already the reveal's own chip. Before the reveal,
 * while gated, or on an earlier version, nothing is read or drawn. The read is the Team tab's own (`differencesKey`), so the dock and the
 * canvas never read the same View twice.
 */
import { useEffect } from 'react'
import { Unlink2 } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { useViewStore } from '../../olumiView/store'
import { differencesKey, readDifferences, useDifferences, type Difference } from './differences'

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
  if (data === null || data.gated) return NONE
  const seen = new Set<string>()
  return data.differences.filter((d) => {
    if (d.kind !== 'link' || !(d.cards ?? []).includes(card) || seen.has(d.record)) return false
    seen.add(d.record)
    return true
  })
}

const initial = (by: string) => (Array.from(by)[0] ?? '').toUpperCase()
const quoted = (s: string) => s.replace(/["\\]/g, '\\$&')

/** Open the difference in the dock (the Team tab), brought into view once the tab draws it. Nothing opens on an earlier version. */
function openDiffer(d: Difference): void {
  if (useViewStore.getState().at !== null) return
  useUIStore.getState().forceActivateOutputTab('team')
  const at = `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}`
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-testid="${quoted(at)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })))
}

/**
 * One doubted link on one of its cards: the people who hold an explanation of it (core's order: who doubts it, then who keeps it), and the
 * link in core's words. The first chip on a rail keeps its words; a later one is compact, as the rail's later chips are. Its whole name is
 * core's: the link, and each person's explanation.
 */
export function DifferChip({ d, card, first }: { d: Difference; card: string; first: boolean }): JSX.Element {
  return (
    <button type="button" title={d.status_text} data-differ-chip={d.record} data-differ-card={card}
      onClick={(e) => { e.stopPropagation(); openDiffer(d) }}
      className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel pl-0.5 ${first ? 'flex-none pr-2.5' : 'min-w-0 pr-2'} ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2`}>
      <span aria-hidden="true" className="inline-flex flex-none">
        {d.sides.map((s, i) => <span key={s.holder_id} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${i > 0 ? '-ml-1.5' : ''}`}>{initial(s.holder)}</span>)}
      </span>
      <Unlink2 aria-hidden="true" className="h-3 w-3 flex-none text-text-body" />
      <span className={first ? 'truncate' : 'sr-only'} data-differ-label="">{d.label}</span>
      {d.sides.map((s) => <span key={s.holder_id} className="sr-only" data-differ-side={s.holder_id}>{s.text}</span>)}
    </button>
  )
}
