/**
 * E4 "What you said" (DL 19 Nov; field shape Codex 12:26Z, ruling 12:29Z; Paul's UX test, URL 2): an intake preview the person may skip, never
 * an assent. It lists each figure core read from the person's words, as core quotes it (`quote`: an exact span of what they wrote, their labels
 * and any uncertainty kept), keyed by where it sits in their words (`source`). What it says about the model is read from ONE typed field, `record`:
 * - a record id: the figure is present in the model (not a claim that any calculation uses it); pressing shows that record in the workspace;
 * - null: "not in your model yet" (core sends null only where it can prove completeness for that source);
 * - "unknown": the figure and its words only, with NO claim about the model: no chip and no contribution to the missing count.
 * Never from the words.
 *
 * Core serves `view.intake` only where the experiment runs; without it nothing is drawn. It is drawn only once a model exists, below the
 * thread, so it never stands before the first model. Folded at rest to one row; removable like Olumi's questions (page and viewer only,
 * nothing written). Chrome words only.
 */
import { useId, useState } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { VIEW_CHIP_OUTLINE_CLASS } from '../../../v5/blocks/chipClass'
import { OkIconButton } from '../../look/icons'
import { FoldChevron } from '../../look/FoldChevron'
import { HoverButton } from '../../look/Hover'
import { useViewStore } from '../../store'
import type { View } from '../../client'
import { pressCard } from '../../reasoning/tabRing'
import { cardKindOf, isAssumptionShape } from '../cards/kind'
import { cardDsKindOf, cardKind } from '../fields/fields'
import { recordReach, showRecord } from '../showInWorkspace/show'

/** The field core serves (wip/x-e4-intake, Codex 12:26Z): one row per figure in the person's words. */
export interface IntakeFigure {
  /** Where the figure stands in the stored words: the row its line was typed in ('brief' for the brief) and its offsets; null where the row is not known. */
  readonly source: { readonly row: number | 'brief'; readonly start: number; readonly end: number } | null
  readonly quote: string
  readonly unit: string | null
  /** Core's reading of the stated value and bound (core dbf5aba7): not drawn; the quote says it in the person's words. */
  readonly stated?: unknown
  readonly record: string | null
}
export const UNKNOWN = 'unknown'

export const INTAKE_HEAD = 'What you said'
export const NOT_IN_MODEL = 'not in your model yet'
const NOT_IN_MODEL_CHIP = 'Not in your model yet'
export const SHOW_RECORD = 'Show in the workspace'
export const REMOVE_INTAKE = 'Remove this list'
export const OPEN_INTAKE = 'Show what you said'
export const CLOSE_INTAKE = 'Hide what you said'

const int = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
/** The typed rows, or none: a row is kept only with a quote and a whole source or none (null: row not known); anything else core sends is not guessed at. */
export const intakeOf = (view: View | null | undefined): IntakeFigure[] => {
  const raw = (view as { intake?: { figures?: unknown } } | null | undefined)?.intake?.figures
  if (!Array.isArray(raw)) return []
  return raw.filter((f): f is IntakeFigure => {
    if (f === null || typeof f !== 'object') return false
    const { source: s, quote, record } = f as Partial<IntakeFigure>
    return (s === null || (s != null && (int(s.row) || s.row === 'brief') && int(s.start) && int(s.end))) && typeof quote === 'string' && quote !== '' && (record === null || typeof record === 'string')
  })
}
/** A row's identity: its source; a figure with no known source is keyed by its place in the list and its words. */
export const sourceKey = (f: IntakeFigure, i: number): string => (f.source === null ? `none:${i}:${f.quote}` : `${f.source.row}:${f.source.start}:${f.source.end}`)
/** What `record` says, by its type alone: an id (present), null (authoritatively absent), or "unknown" (no claim). */
export const recordState = (f: IntakeFigure): { kind: 'present'; id: string } | { kind: 'absent' } | { kind: 'unknown' } =>
  f.record === null ? { kind: 'absent' } : f.record === UNKNOWN || f.record === '' ? { kind: 'unknown' } : { kind: 'present', id: f.record }

/** One quoted sentence with its figures' statuses counted: core sends one row per FIGURE and each quote is the whole sentence, so rows with the
 *  same source row and the same quote are one sentence. A row with no known source is never merged (nothing says it is the same place). */
export interface IntakeGroup { readonly key: string; readonly quote: string; readonly figures: IntakeFigure[]; readonly absent: number; readonly present: Map<string, number> }
export const intakeGroups = (rows: readonly IntakeFigure[]): IntakeGroup[] => {
  const by = new Map<string, { key: string; quote: string; figures: IntakeFigure[]; absent: number; present: Map<string, number> }>()
  rows.forEach((r, i) => {
    const gk = r.source === null ? sourceKey(r, i) : `${r.source.row}|${r.quote}`
    const g = by.get(gk) ?? { key: sourceKey(r, i), quote: r.quote, figures: [], absent: 0, present: new Map<string, number>() }
    g.figures.push(r)
    const st = recordState(r)
    if (st.kind === 'absent') g.absent += 1
    else if (st.kind === 'present') g.present.set(st.id, (g.present.get(st.id) ?? 0) + 1)
    by.set(gk, g)
  })
  return [...by.values()]
}

const removed = new Set<string>()
/** Tests only. */
export const resetRemovedIntake = (): void => removed.clear()

const show = (id: string) => { if (recordReach(id) === 'show') void showRecord(id); else pressCard(id) }

export function IntakeSheet(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const [openSentence, setOpenSentence] = useState<{ sheet: string; group: string } | null>(null)
  const [, bump] = useState(0)
  // The disclosure's own region id, unique per sheet; named by the toggle only while the rows are drawn (a closed fold names nothing).
  const rowsId = useId()
  const rows = intakeOf(view)
  const key = JSON.stringify([view?.you_id ?? null, view?.id ?? null, ...rows.map((r, i) => [sourceKey(r, i), r.quote])])
  const model = view?.model
  if (model == null || rows.length === 0 || removed.has(key)) return null
  const missing = rows.filter((r) => recordState(r).kind === 'absent').length
  const groups = intakeGroups(rows).sort((a, b) => Number(b.absent > 0) - Number(a.absent > 0))
  const cards = new Map(model.cards.map((card) => [card.id, card]))
  return (
    <section className={`${typography.viewPanelBody} space-y-2 rounded-md border border-panel-border bg-panel p-2`} data-testid="view-intake" aria-label={INTAKE_HEAD} data-open={open ? '' : undefined}>
      <div className="flex items-center gap-2">
        <p className={`${typography.viewPanelHeading} m-0 min-w-0 flex-1`}>
          {INTAKE_HEAD}
          {missing === 0 ? null : <span className={`${typography.viewPanelMeta} ml-2 text-text-light`} data-testid="view-intake-missing">{missing} {NOT_IN_MODEL}</span>}
        </p>
        <HoverButton type="button" words={open ? CLOSE_INTAKE : OPEN_INTAKE} aria-expanded={open} aria-controls={open ? rowsId : undefined} aria-label={open ? CLOSE_INTAKE : OPEN_INTAKE} data-testid="view-intake-toggle" onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info">
          <FoldChevron open={open} />
        </HoverButton>
        <OkIconButton id="cancel-close" tone="ghost" testid="view-intake-remove" words={REMOVE_INTAKE} onClick={() => { removed.add(key); bump((x) => x + 1) }} />
      </div>
      {!open ? null : (
        <ul id={rowsId} className="m-0 list-none space-y-1 p-0" data-testid="view-intake-rows">
          {groups.map((g, i) => {
            const expanded = openSentence?.sheet === key && openSentence.group === g.key
            const quoteId = `${rowsId}-quote-${i}`
            const count = g.figures.length
            const preview = g.quote.split(/\r\n?|\n/, 1)[0]
            return (
              <li key={g.key} className="space-y-1 border-t border-panel-border px-2 py-1" data-intake-source={g.key} data-intake-count={count}>
                <button type="button" aria-label={`${preview}, ${count} ${count === 1 ? 'figure' : 'figures'}`}
                  aria-expanded={expanded} aria-controls={expanded ? quoteId : undefined}
                  onClick={() => setOpenSentence(expanded ? null : { sheet: key, group: g.key })}
                  className="flex w-full items-center justify-between gap-2 rounded-control text-left text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info">
                  <span className="line-clamp-1 min-w-0 break-words">{preview}</span>
                  <span aria-hidden="true" className={`${typography.viewPanelMeta} shrink-0 rounded-control bg-panel-hover px-1.5 tabular-nums text-text-light`}>{count}</span>
                </button>
                {expanded ? <p id={quoteId} className="m-0 whitespace-pre-wrap break-words text-text-body">{g.quote}</p> : null}
                {g.present.size === 0 && g.absent === 0 ? null : (
                  <div className="flex flex-wrap items-center gap-1">
                    {[...g.present].map(([id, n]) => {
                      const card = cards.get(id)
                      const words = card ? `${SHOW_RECORD}: ${card.heading}` : SHOW_RECORD
                      return (
                        <HoverButton key={id} type="button" data-intake-mark="present" data-intake-show={id} data-intake-n={n}
                          onClick={() => show(id)} words={words} className={`${VIEW_CHIP_OUTLINE_CLASS} min-w-0 max-w-full`}>
                          {card && <NodeShapeIndicator nodeKind={cardDsKindOf(cardKind(card, model, view))} size={14}
                            dashedOutline={isAssumptionShape(cardKindOf(card, model, view).shape)} />}
                          <span className="line-clamp-1 min-w-0 break-words font-medium">{card?.heading ?? SHOW_RECORD}</span>
                          {card?.figure?.text ? <span className="min-w-0 break-words text-text-light">{card.figure.text}</span> : null}
                        </HoverButton>
                      )
                    })}
                    {g.absent > 0 ? (
                      <span className={`${typography.viewPanelMeta} inline-flex min-h-7 items-center rounded-control border border-dashed border-warning px-2 text-warning-ink`}
                        data-intake-mark="absent" data-intake-n={g.absent}>{NOT_IN_MODEL_CHIP}</span>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
