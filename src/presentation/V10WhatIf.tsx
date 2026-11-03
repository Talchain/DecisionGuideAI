/**
 * v10 (#/canvas2): the "What if" lens, as a PREVIEW. The same served what-if as #/canvas (`runWhatIf` → CEE's what-if route,
 * which runs a COPY of the model and writes nothing); v10 changes how it is asked and how the result is held.
 *
 * What v10 adds on top of the served key (`artefacts/WhatIfKey.tsx` mounts these only when `usePresentation() === 'v10'`):
 *   · one sentence that says what a what-if is, and that nothing is saved here;
 *   · "What if it were" with the saved figure beside it, and "Try it" with "Nothing is saved";
 *   · an optional change-course point, set BEFORE the result and unset by default;
 *   · the result marked "Not saved", in CEE's own cells, with the person's point shown beside CEE's figure;
 *   · "Clear this what-if", which only clears the held preview.
 *
 * ⛔ NO WRITE PATH. Nothing in this file edits, sends or saves a figure: it imports no edit authority, no value editor and no
 *   system-event sender (a spec asserts `proposeFactorValue` is never reached). A person changes a figure through the
 *   canvas's existing edit, never through the lens.
 * ⛔ No number is invented and no verdict is composed. Results are CEE's cells verbatim; the change-course point is the
 *   person's own, shown BESIDE CEE's figure with no judgement word. Where the run supplies no preview, it says so.
 * ⛔ Ink is the person, blue is Olumi: nothing here is blue. Nothing dims: a control that cannot be pressed is greyed text on a
 *   plain ground, never a faded one. "What-if" names a variant; Olumi never says which to choose.
 */
import { Flag, Lock } from 'lucide-react'

import type { WhatIfCell } from '../adapters/cee/whatIf'
import { action, ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { figureText } from '../canvas/nodes/ProposalGhostLayer'
import { useWhatIfStore, type HeldWhatIf } from '../canvas/stores/whatIfStore'
import { typography } from '../styles/typography'

export const V10_WHAT_IF_COPY = {
  what: 'A what-if tries another value for one figure and shows what changes here. Nothing is saved: to change a figure, edit it on the canvas.',
  legendEmpty: 'Try another value without saving',
  legendHeld: (label: string, figure: string) => `What if ${label} were ${figure}`,
  notSaved: 'Not saved',
  nothingSaved: 'Nothing is saved',
  itWere: 'What if it were',
  savedWas: (figure: string) => `Saved: ${figure}`,
  tryIt: 'Try it',
  running: 'Running the what-if',
  clear: 'Clear this what-if',
  courseOn: 'Change course if the chance falls below',
  courseOption: 'Option',
  coursePercent: 'Change-course chance, percent',
  courseInvalid: 'Enter a percentage from 0 to 100.',
  courseUnset: 'No change-course point set',
  yourPoint: (pct: number) => `Your change-course point: below ${pct}%`,
  noPreview: 'No preview from this run.',
  saved: 'Saved',
  whatIf: 'What if',
} as const

/** The person's typed point as a percentage, or null when it is empty or not a number from 0 to 100. */
export function readCoursePoint(typed: string): number | null {
  if (typed.trim() === '') return null
  const n = Number(typed)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

/** A typed point that is not empty and not a percentage from 0 to 100: shown as an error, never silently corrected. */
export const courseTypedIsInvalid = (typed: string): boolean => typed.trim() !== '' && readCoursePoint(typed) === null

export interface CourseDraft { readonly on: boolean; readonly optionId: string | null; readonly pct: string }
export const NO_COURSE: CourseDraft = { on: false, optionId: null, pct: '' }

const INK_BUTTON = `${typography.panelBody} inline-flex min-h-[24px] items-center rounded-full px-3 py-1 bg-text-header text-text-on-color hover:bg-text-body ${ACTION_FOCUS}`
const INK_BUTTON_OFF = `${typography.panelBody} inline-flex min-h-[24px] cursor-not-allowed items-center rounded-full px-3 py-1 bg-panel-hover text-text-light ${ACTION_FOCUS}`
const PILL = `${typography.panelMeta} inline-flex items-center rounded-full border border-panel-border px-2 py-0.5 text-text-body`

function Cell({ cell }: { cell: WhatIfCell }) {
  if (cell.display === null) return <span className="text-text-light">{cell.not_shown}</span>
  return (
    <span className="text-text-header">
      {cell.display}
      {cell.provisional && <span className={`${typography.panelMeta} ml-1 text-text-light`}>Provisional</span>}
    </span>
  )
}

/** Clears the held preview and nothing else. */
function ClearButton() {
  return (
    <button
      type="button"
      data-testid="what-if-clear"
      onClick={() => useWhatIfStore.getState().clear()}
      className={`${typography.panelBody} ${action('secondary')} rounded-full px-3 py-1`}
    >
      {V10_WHAT_IF_COPY.clear}
    </button>
  )
}

/** Folded, the lens bar's one line: what is being tried, marked "Not saved", with the way to clear it. */
export function V10Legend({ held }: { held: HeldWhatIf | null }) {
  return (
    <div className="space-y-2" data-testid="what-if-legend">
      <p className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-body`}>
        <span>
          {held ? V10_WHAT_IF_COPY.legendHeld(held.label, figureText({ value: held.whatIf, unit: held.unit })) : V10_WHAT_IF_COPY.legendEmpty}
        </span>
        {held && <span className={PILL}>{V10_WHAT_IF_COPY.notSaved}</span>}
      </p>
      {held && <ClearButton />}
    </div>
  )
}

export interface V10BodyProps {
  readonly choices: readonly { id: string; label: string; saved: number; unit: string }[]
  readonly picked: { id: string; label: string; saved: number; unit: string }
  readonly typed: string
  readonly placeholder: string
  readonly canRun: boolean
  readonly running: boolean
  readonly onPick: (id: string) => void
  readonly onType: (value: string) => void
  readonly onTry: () => void
  readonly options: readonly { id: string; label: string }[]
  readonly course: CourseDraft
  readonly onCourse: (next: CourseDraft) => void
  readonly held: HeldWhatIf | null
  readonly notice: string | null
  readonly why: { nextStep?: string; questions?: readonly string[] } | null
  readonly result: {
    readonly paired: boolean
    readonly notPairedWords: string
    readonly rows: readonly { id: string; label: string; saved: WhatIfCell; whatIf: WhatIfCell; variationWords: string | null }[]
  } | null
}

export function V10WhatIfBody(p: V10BodyProps) {
  const savedFigure = figureText({ value: p.picked.saved, unit: p.picked.unit })
  const point = p.course.on ? readCoursePoint(p.course.pct) : null
  const pointInvalid = p.course.on && courseTypedIsInvalid(p.course.pct)
  // The point belongs to the option the person chose; if that option is gone there is no point (never moved to another).
  const courseOptionId = p.options.find((o) => o.id === p.course.optionId)?.id ?? null
  const pointOptionId = point !== null ? courseOptionId : null
  const canTry = p.canRun && !pointInvalid
  const field = `${typography.panelBody} rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`
  return (
    <div data-testid="what-if-key" className="space-y-3">
      <p className={`${typography.panelBody} text-text-body`}>{V10_WHAT_IF_COPY.what}</p>
      <div className="flex flex-col gap-2">
        <label className={`${typography.panelMeta} flex flex-col gap-1 text-text-light`}>
          Factor
          <select data-testid="what-if-factor" value={p.picked.id} onChange={(e) => p.onPick(e.target.value)} className={field}>
            {p.choices.map((c) => <option key={c.id} value={c.id}>{`${c.label} (${figureText({ value: c.saved, unit: c.unit })})`}</option>)}
          </select>
        </label>
        <label className={`${typography.panelMeta} flex flex-col gap-1 text-text-light`}>
          {V10_WHAT_IF_COPY.itWere}
          <span className="flex items-center gap-2">
            <input
              data-testid="what-if-value"
              type="number"
              inputMode="decimal"
              value={p.typed}
              placeholder={p.placeholder}
              onChange={(e) => p.onType(e.target.value)}
              className={`${field} w-28`}
            />
            {p.picked.unit !== '' && <span className={`${typography.panelBody} text-text-body`}>{p.picked.unit}</span>}
            <span data-testid="what-if-saved-was" className={`${typography.panelMeta} text-text-light`}>{V10_WHAT_IF_COPY.savedWas(savedFigure)}</span>
          </span>
        </label>
        {p.options.length > 0 && (
          <div className="space-y-1" data-testid="what-if-course">
            <div className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-body`}>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="what-if-course-on"
                  checked={p.course.on}
                  onChange={(e) => p.onCourse(e.target.checked ? { ...p.course, on: true, optionId: p.course.optionId ?? p.options[0]?.id ?? null } : { ...p.course, on: false })}
                  className="h-3.5 w-3.5 accent-text-header"
                />
                <span>{V10_WHAT_IF_COPY.courseOn}</span>
              </label>
              <select
                aria-label={V10_WHAT_IF_COPY.courseOption}
                data-testid="what-if-course-option"
                disabled={!p.course.on}
                value={p.course.optionId ?? p.options[0]?.id ?? ''}
                onChange={(e) => p.onCourse({ ...p.course, optionId: e.target.value })}
                className={`${field} max-w-[11rem] disabled:text-text-light`}
              >
                {p.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <input
                data-testid="what-if-course-pct"
                inputMode="decimal"
                aria-label={V10_WHAT_IF_COPY.coursePercent}
                aria-invalid={pointInvalid}
                aria-describedby={pointInvalid ? 'what-if-course-error' : undefined}
                disabled={!p.course.on}
                value={p.course.pct}
                onChange={(e) => p.onCourse({ ...p.course, pct: e.target.value })}
                className={`${field} w-14 disabled:text-text-light`}
              />
              <span>%</span>
            </div>
            {pointInvalid && (
              <p id="what-if-course-error" data-testid="what-if-course-error" role="alert" className={`${typography.panelMeta} text-text-header`}>
                {V10_WHAT_IF_COPY.courseInvalid}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" data-testid="what-if-run" disabled={!canTry} onClick={p.onTry} className={canTry ? INK_BUTTON : INK_BUTTON_OFF}>
            {p.running ? `${V10_WHAT_IF_COPY.running}…` : V10_WHAT_IF_COPY.tryIt}
          </button>
          <span className={`${typography.panelMeta} inline-flex items-center gap-1 text-text-light`}>
            <Lock aria-hidden="true" className="h-3 w-3" />
            {V10_WHAT_IF_COPY.nothingSaved}
          </span>
        </div>
      </div>
      {p.notice !== null && <p data-testid="what-if-notice" role="status" className={`${typography.panelBody} text-text-body`}>{p.notice}</p>}
      {p.why !== null && (
        <div data-testid="what-if-why" className={`${typography.panelBody} space-y-1 text-text-body`}>
          {p.why.nextStep !== undefined && <p>{p.why.nextStep}</p>}
          {p.why.questions !== undefined && <ul className="list-disc space-y-0.5 pl-4">{p.why.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
        </div>
      )}
      {p.result !== null && p.held !== null && (
        <div data-testid="what-if-result" className="space-y-3">
          <div className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-header`}>
            <span>{V10_WHAT_IF_COPY.legendHeld(p.held.label, figureText({ value: p.held.whatIf, unit: p.held.unit }))}</span>
            <span data-testid="what-if-not-saved" className={PILL}>{V10_WHAT_IF_COPY.notSaved}</span>
          </div>
          {p.result.rows.length === 0 ? (
            <p data-testid="what-if-no-preview" className={`${typography.panelBody} text-text-body`}>{V10_WHAT_IF_COPY.noPreview}</p>
          ) : (
            <>
              {!p.result.paired && <p data-testid="what-if-not-paired" className={`${typography.panelMeta} text-text-light`}>{p.result.notPairedWords}</p>}
              <ul className="space-y-2">
                {p.result.rows.map((row) => (
                  <li key={row.id} data-testid={`what-if-row-${row.id}`} className={`${typography.panelBody} space-y-0.5`}>
                    <p className="text-text-header">{row.label}</p>
                    <p><span className="text-text-light">{V10_WHAT_IF_COPY.saved}: </span><Cell cell={row.saved} /></p>
                    <p><span className="text-text-light">{V10_WHAT_IF_COPY.whatIf}: </span><Cell cell={row.whatIf} /></p>
                    {point !== null && pointOptionId === row.id && (
                      <p data-testid="what-if-course-point" className="inline-flex items-center gap-1 text-text-body">
                        <Flag aria-hidden="true" className="h-3 w-3 text-text-light" />
                        {V10_WHAT_IF_COPY.yourPoint(point)}
                      </p>
                    )}
                    {row.variationWords !== null && <p className={`${typography.panelMeta} text-text-light`}>{row.variationWords}</p>}
                  </li>
                ))}
              </ul>
              {point === null && (
                <p className={`${typography.panelBody} inline-flex items-center gap-2 text-text-body`} data-testid="what-if-course-row">
                  <Flag aria-hidden="true" className="h-3.5 w-3.5 text-text-light" />
                  {V10_WHAT_IF_COPY.courseUnset}
                </p>
              )}
            </>
          )}
          <ClearButton />
        </div>
      )}
    </div>
  )
}
