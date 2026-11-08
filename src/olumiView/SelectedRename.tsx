/**
 * A SELECTED CARD'S RENAME, IN THE DOCK'S "Selected:" ROW (DL 7 Nov, run 0717: in the panel beside the card, Rename sat on the neighbouring
 * card and covered its words). The panel beside a card now opens only for the card's other words; its rename is offered where the
 * selection is already named, next to its name, so it never covers the board. Core's contract and words are unchanged (Rename.tsx): on an
 * approved board only, the person's own page, the live version. Only a card of core's model is renamed here (the question is renamed
 * elsewhere); a link's selection offers none.
 */
import type { ReactNode } from 'react'
import { Rename } from './Rename'
import { useViewStore } from './store'

function SelectedRename({ id }: { id: string }): JSX.Element | null {
  const heading = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.heading ?? null)
  if (heading === null) return null
  // Keyed by the card, so a rename half-typed for one card never carries over to the next one selected.
  return <Rename key={id} id={id} heading={heading} shown />
}

/** For the dock's selection row (SelectionPill `after`): a stable function, so the memoised row does not redraw on every dock render. */
/** "Find evidence" (research/FindEvidence.tsx) is not offered in N1: web research returns in N2 once its checks pass review. */
export const selectedRename = (s: { id: string; kind: 'node' | 'edge' }): ReactNode => (s.kind === 'node' ? <SelectedRename id={s.id} /> : null)
