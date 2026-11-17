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
import { typography } from '../styles/typography'
import { SelectedExplain } from './look/SelectedExplain'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import { drawKindOf } from './layout'

function SelectedRename({ id }: { id: string }): JSX.Element | null {
  const heading = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.heading ?? null)
  const author = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.author ?? null)
  // ORDER-UI-3 (DL-348, 13 Nov): what the card's headline rests on, in core's own sentence (`headline.title`), drawn whole once the card is
  // selected: on the card it was reachable only by hover, so a chance resting on Olumi's assumption never said so where a person reads.
  // Verbatim; nothing is drawn for a card core gives no headline.
  const said = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.headline?.title ?? null)
  // DL 04:59Z (4): an option's next step (core's `headline.add`) is cut to two lines on the card; here it is whole, verbatim.
  const add = useViewStore((s) => { const c = s.view?.model?.cards.find((x) => x.id === id); return c?.family === 'option' ? c.headline?.add ?? null : null })
  const view = useViewStore((s) => s.view)
  if (heading === null) return null
  // Keyed by the card, so a rename half-typed for one card never carries over to the next one selected.
  // UI restore 11 Nov (R12, DL PL-100): whose figure it is, core's words verbatim, once the card is selected: the person's neutral, Olumi's
  // in Olumi's blue (blue is Olumi's alone); its source on hover. Nothing is said for a card core gives no author.
  return (
    <>
      <Rename key={id} id={id} heading={heading} shown />
      {author === null ? null : <span className={`${typography.viewPanelMeta} ${author.by === 'olumi' ? 'text-info' : 'text-text-light'}`} title={author.title} data-view={`${id}.author.text`} data-testid="selected-author">{author.text}</span>}
      {said === null || said === '' ? null : <p className={`${typography.viewPanelMeta} m-0 basis-full whitespace-pre-wrap break-words text-text-body`} data-view={`${id}.headline.title`} data-testid="selected-headline-title">{said}</p>}
      {add === null || add === '' ? null : <p className={`${typography.viewPanelMeta} m-0 basis-full whitespace-pre-wrap break-words text-text-body`} data-testid="selected-headline-add">{add}</p>}
      {/* DL journey 3: a selected option's explanation, from core's fields (look/SelectedExplain.tsx). */}
      {view === null ? null : <SelectedExplain view={view} id={id} />}
    </>
  )
}

/** For the dock's selection row (SelectionPill `after`): a stable function, so the memoised row does not redraw on every dock render. */
/** "Find evidence" (research/FindEvidence.tsx) is not offered in N1: web research returns in N2 once its checks pass review. */
export const selectedRename = (s: { id: string; kind: 'node' | 'edge' }): ReactNode => (s.kind === 'node' ? <SelectedRename id={s.id} /> : null)

/**
 * The selected card's own kind shape (the composer's selection chip, 17 Nov calm panel): the same shape the canvas draws it with (`drawKindOf`,
 * NodeShapeIndicator), never a new mark. A link's selection, or an id core's model does not hold, draws none. A stable function (SelectionPill `mark`).
 */
function SelectedKind({ id }: { id: string }): JSX.Element | null {
  const kind = useViewStore((s) => { const m = s.view?.model, c = m?.cards.find((x) => x.id === id); return m == null || c === undefined ? null : drawKindOf(c, m) })
  return kind === null ? null : <span className="inline-flex flex-none" data-testid="selection-kind-shape" data-kind={kind}><NodeShapeIndicator nodeKind={kind} size={12} /></span>
}
export const selectedKindMark = (s: { id: string; kind: 'node' | 'edge' }): ReactNode => (s.kind === 'node' ? <SelectedKind id={s.id} /> : null)
