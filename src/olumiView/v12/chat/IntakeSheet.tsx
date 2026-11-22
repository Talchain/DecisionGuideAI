/**
 * The intake review uses core's record status. A null record marks a figure absent from the model.
 * A linked record opens in the workspace. Unknown figures are omitted.
 */
import { useId, useState } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { VIEW_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'
import { OkIconButton } from '../../look/icons'
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

const INTAKE_HEAD = 'What you said'
const NOT_IN_MODEL = 'Not in your model yet'
export const SHOW_RECORD = 'Show in the workspace'
const REMOVE_INTAKE = 'Remove this list'

const int = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
/** Figures that can be reviewed against the current model, with their original quotes. */
export const intakeOf = (view: View | null | undefined): IntakeFigure[] => {
  const raw = (view as { intake?: { figures?: unknown } } | null | undefined)?.intake?.figures
  if (view?.model == null || !Array.isArray(raw)) return []
  return raw.filter((f): f is IntakeFigure => {
    if (f === null || typeof f !== 'object') return false
    const { source: s, quote, record } = f as Partial<IntakeFigure>
    return (s === null || (s != null && (int(s.row) || s.row === 'brief') && int(s.start) && int(s.end))) &&
      typeof quote === 'string' && quote !== '' &&
      (record === null || (typeof record === 'string' && record !== UNKNOWN && record !== ''))
  })
}

/** A figure without a source keeps its own row because its location is unknown. */
const sourceKey = (f: IntakeFigure, i: number): string =>
  f.source === null ? `none:${i}:${f.quote}` : `${f.source.row}:${f.source.start}:${f.source.end}`

const removed = new Set<string>()
/** Tests only. */
export const resetRemovedIntake = (): void => removed.clear()

const show = (id: string) => { if (recordReach(id) === 'show') void showRecord(id); else pressCard(id) }

export function IntakeSheet(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const [, bump] = useState(0)
  const rowsId = useId()
  const rows = intakeOf(view)
  const model = view?.model
  if (model == null || rows.length === 0) return null
  const key = JSON.stringify([view?.you_id ?? null, view?.id ?? null, ...rows.map((r, i) => [sourceKey(r, i), r.quote])])
  if (removed.has(key)) return null

  const missing = rows.filter((row) => row.record === null)
  const count = missing.length || rows.length
  const summary = `${count} ${count === 1 ? 'figure' : 'figures'} ${missing.length > 0 ? 'not in your model yet' : 'from what you said'}`
  const quotes = new Map(missing.map((row, i) => [
    row.source === null ? sourceKey(row, i) : `${row.source.row}|${row.quote}`,
    row.quote,
  ] as const))
  const cards = new Map(model.cards.map((card) => [card.id, card]))
  const records = new Set(rows.flatMap((row) => row.record === null ? [] : [row.record]))

  return (
    <section className={`${typography.viewPanelBody} space-y-2 rounded-md border border-panel-border bg-panel p-2`} data-testid="view-intake" aria-label={INTAKE_HEAD} data-open={open ? '' : undefined}>
      <div className="flex items-center gap-2">
        <p className="m-0 min-w-0 flex-1 text-text-body" data-testid="view-intake-summary">{summary}</p>
        <button type="button" aria-expanded={open} aria-controls={open ? rowsId : undefined} data-testid="view-intake-toggle"
          onClick={() => setOpen((previous) => !previous)} className={`${VIEW_CHIP_PRIMARY_CLASS} shrink-0`}>
          {open ? 'Hide figures' : 'Review'}
        </button>
        <OkIconButton id="cancel-close" tone="ghost" testid="view-intake-remove" words={REMOVE_INTAKE} onClick={() => { removed.add(key); bump((x) => x + 1) }} />
      </div>
      {open ? (
        <div id={rowsId} className="space-y-2 border-t border-panel-border pt-2" data-testid="view-intake-rows">
          {quotes.size > 0 ? (
            <div className="space-y-1">
              <h3 className={`${typography.viewPanelHeading} text-text-header`}>{NOT_IN_MODEL}</h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {[...quotes].map(([source, quote]) => (
                  <li key={source} className="whitespace-pre-wrap break-words text-text-body underline decoration-dashed decoration-field underline-offset-4">{quote}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {records.size > 0 ? (
            <ul className="m-0 list-none divide-y divide-panel-border p-0">
              {[...records].map((id) => {
                const card = cards.get(id)
                const heading = card?.heading ?? SHOW_RECORD
                return (
                  <li key={id}>
                    <HoverButton type="button" data-intake-show={id} onClick={() => show(id)} words={card ? `${SHOW_RECORD}: ${heading}` : undefined}
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
                      {card ? <NodeShapeIndicator nodeKind={cardDsKindOf(cardKind(card, model, view))} size={14}
                        dashedOutline={isAssumptionShape(cardKindOf(card, model, view).shape)} /> : null}
                      <span className="min-w-0 flex-1 break-words">{heading}</span>
                      {card?.figure?.text ? <span className="min-w-0 break-words text-right tabular-nums text-text-light">{card.figure.text}</span> : null}
                    </HoverButton>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
