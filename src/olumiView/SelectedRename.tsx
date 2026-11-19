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
import { detailsOf, useLaneInspector } from './v12/edit/inspectorStore'

/**
 * A card's authorship and what its headline rests on, core's words verbatim (ORDER-UI-3, DL-348, 13 Nov; UI restore 11 Nov, R12): whose figure it is
 * (the person's neutral, Olumi's in Olumi's blue, its source on hover) and the sentence the headline rests on (`headline.title`), drawn whole: on the
 * card it was reachable only by hover, so a chance resting on Olumi's assumption never said so where a person reads. Nothing is drawn for a card core
 * gives neither. Drawn in the dock's selection row (the default test ids) and in the details panel beside the card (`ids`: its own, so one page
 * never holds two of the same).
 */
export function CardWords({ id, ids, only }: { id: string; ids?: { author: string; basis: string }; /** The box's preview says whose the figure is and leaves the basis sentence to the pinned box. */ only?: 'author' | 'basis' }): JSX.Element | null {
  const author = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.author ?? null)
  const said = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.headline?.title ?? null)
  const here = ids === undefined
  return (
    <>
      {only === 'basis' || author === null ? null : <span className={`${typography.viewPanelMeta} ${author.by === 'olumi' ? 'text-info' : 'text-text-light'}`} title={author.title} data-view={here ? `${id}.author.text` : undefined} data-testid={ids?.author ?? 'selected-author'}>{author.text}</span>}
      {only === 'author' || said === null || said === '' ? null : <p className={`${typography.viewPanelMeta} m-0 basis-full whitespace-pre-wrap break-words text-text-body`} data-view={here ? `${id}.headline.title` : undefined} data-testid={ids?.basis ?? 'selected-headline-title'}>{said}</p>}
    </>
  )
}

/** True while the lane's details panel is open for this very card (SelectionPill `useQuiet`): the chip row then holds the chip alone. */
export const useDetailsOpenFor = (id: string): boolean => useLaneInspector((s) => { const t = detailsOf(s); return t !== null && t.kind === 'card' && t.id === id })

function SelectedRename({ id }: { id: string }): JSX.Element | null {
  const heading = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.heading ?? null)
  // DL 04:59Z (4): an option's next step (core's `headline.add`) is cut to two lines on the card; here it is whole, verbatim.
  const add = useViewStore((s) => { const c = s.view?.model?.cards.find((x) => x.id === id); return c?.family === 'option' ? c.headline?.add ?? null : null })
  const view = useViewStore((s) => s.view)
  if (heading === null) return null
  // Keyed by the card, so a rename half-typed for one card never carries over to the next one selected.
  return (
    <>
      <Rename key={id} id={id} heading={heading} shown />
      {/* Surfaces step 4: while THIS card's details stand open beside it the row is the chip alone (useDetailsOpenFor, SelectionPill `useQuiet`), because the
          panel draws its authorship, basis, next step and explanation (LaneInspector); closed, or selected another route, all of it is drawn here as before. */}
      <CardWords id={id} />
      {add === null || add === '' ? null : <p className={`${typography.viewPanelMeta} m-0 basis-full whitespace-pre-wrap break-words text-text-body`} data-testid="selected-headline-add">{add}</p>}
      {/* DL journey 3: a selected option's explanation, from core's fields (look/SelectedExplain.tsx). */}
      {view === null ? null : <SelectedExplain view={view} id={id} />}
    </>
  )
}

/** For the dock's selection row (SelectionPill `after`): a stable function, so the memoised row does not redraw on every dock render. */
/** Null for a selection core's model holds no card for (the question, a link, a group): the row then draws no detail box at all. */
export const selectedRename = (s: { id: string; kind: 'node' | 'edge' }): ReactNode =>
  (s.kind === 'node' && (useViewStore.getState().view?.model?.cards.some((c) => c.id === s.id) ?? false) ? <SelectedRename id={s.id} /> : null)

/**
 * The selected card's own kind shape (the composer's selection chip, 17 Nov calm panel): the same shape the canvas draws it with (`drawKindOf`,
 * NodeShapeIndicator), never a new mark. A link's selection, or an id core's model does not hold, draws none. A stable function (SelectionPill `mark`).
 */
function SelectedKind({ id }: { id: string }): JSX.Element | null {
  const kind = useViewStore((s) => { const m = s.view?.model, c = m?.cards.find((x) => x.id === id); return m == null || c === undefined ? null : drawKindOf(c, m) })
  return kind === null ? null : <span className="inline-flex flex-none" data-testid="selection-kind-shape" data-kind={kind}><NodeShapeIndicator nodeKind={kind} size={12} /></span>
}
export const selectedKindMark = (s: { id: string; kind: 'node' | 'edge' }): ReactNode => (s.kind === 'node' ? <SelectedKind id={s.id} /> : null)
