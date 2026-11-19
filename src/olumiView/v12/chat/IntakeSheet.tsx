/**
 * E4 "What you said" (DL 19 Nov 12:3xZ, Paul's UX test, URL 2): an optional, removable sheet listing each figure core read from the person's
 * words, as core quotes it (`quote`: an exact span of what they wrote), and whether the model uses it. "In your model" or "not in your model
 * yet" is read from ONE typed field, `record` (the record that cites the figure by id, or null): never from the words.
 *
 * Core serves `view.intake` only where the experiment runs; without it nothing is drawn. It is drawn only once a model exists, below the
 * thread, so it never stands before the first model. Folded at rest to one row; removable like Olumi's questions (page and viewer only,
 * nothing written). Chrome words only: the quotes are the person's own, in core's spans.
 */
import { useState } from 'react'
import { typography } from '../../../styles/typography'
import { OkIconButton } from '../../look/icons'
import { FoldChevron } from '../../look/FoldChevron'
import { useViewStore } from '../../store'
import type { View } from '../../client'

/** The field core serves (wip/x-e4-intake): one row per figure in the person's words, linked to the model by citation id. */
export interface IntakeFigure { readonly figure_id: string; readonly quote: string; readonly unit: string | null; readonly stated?: string | null; readonly record: string | null }

export const INTAKE_HEAD = 'What you said'
export const IN_MODEL = 'in your model'
export const NOT_IN_MODEL = 'not in your model yet'
export const REMOVE_INTAKE = 'Remove this list'
export const OPEN_INTAKE = 'Show what you said'
export const CLOSE_INTAKE = 'Hide what you said'

/** The typed rows, or none: a row is kept only with a figure id and a quote; anything else core sends is not guessed at. */
export const intakeOf = (view: View | null | undefined): IntakeFigure[] => {
  const raw = (view as { intake?: { figures?: unknown } } | null | undefined)?.intake?.figures
  if (!Array.isArray(raw)) return []
  return raw.filter((f): f is IntakeFigure => f !== null && typeof f === 'object' && typeof (f as IntakeFigure).figure_id === 'string'
    && typeof (f as IntakeFigure).quote === 'string' && (f as IntakeFigure).quote !== '' && ((f as IntakeFigure).record === null || typeof (f as IntakeFigure).record === 'string'))
}

const removed = new Set<string>()
/** Tests only. */
export const resetRemovedIntake = (): void => removed.clear()

export function IntakeSheet(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const [, bump] = useState(0)
  const rows = intakeOf(view)
  const key = JSON.stringify([view?.you_id ?? null, view?.id ?? null, ...rows.map((r) => [r.figure_id, r.quote])])
  if (view?.model == null || rows.length === 0 || removed.has(key)) return null
  const missing = rows.filter((r) => r.record === null).length
  return (
    <section className={`${typography.viewPanelBody} space-y-2 rounded-md border border-panel-border bg-panel p-2`} data-testid="view-intake" aria-label={INTAKE_HEAD} data-open={open ? '' : undefined}>
      <div className="flex items-center gap-2">
        <p className={`${typography.viewPanelHeading} m-0 min-w-0 flex-1`}>
          {INTAKE_HEAD}
          {missing === 0 ? null : <span className={`${typography.viewPanelMeta} ml-2 text-text-light`} data-testid="view-intake-missing">{missing} {NOT_IN_MODEL}</span>}
        </p>
        <button type="button" aria-expanded={open} aria-controls="view-intake-rows" aria-label={open ? CLOSE_INTAKE : OPEN_INTAKE} title={open ? CLOSE_INTAKE : OPEN_INTAKE} data-testid="view-intake-toggle" onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info">
          <FoldChevron open={open} />
        </button>
        <OkIconButton id="cancel-close" tone="ghost" testid="view-intake-remove" words={REMOVE_INTAKE} onClick={() => { removed.add(key); bump((x) => x + 1) }} />
      </div>
      {!open ? null : (
        <ul id="view-intake-rows" className="m-0 list-none space-y-1 p-0" data-testid="view-intake-rows">
          {rows.map((r) => (
            <li key={r.figure_id} className="flex flex-wrap items-baseline gap-x-2" data-intake-figure={r.figure_id} data-intake-record={r.record ?? undefined}>
              <span className="text-text-body">“{r.quote}”</span>
              <span className={`${typography.viewPanelMeta} ${r.record === null ? 'text-text-header' : 'text-text-light'}`} data-intake-mark={r.record === null ? 'missing' : 'used'}>{r.record === null ? NOT_IN_MODEL : IN_MODEL}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
