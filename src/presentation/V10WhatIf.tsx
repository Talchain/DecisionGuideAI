/**
 * v10 (#/canvas2): the "What if" lens. The same served what-if as #/canvas (`runWhatIf` → CEE's what-if route, which runs a
 * COPY of the model and writes nothing); v10 changes how it is asked and how the result is held.
 *
 * What v10 adds on top of the served key (`artefacts/WhatIfKey.tsx` mounts these only when `usePresentation() === 'v10'`):
 *   · one sentence that says what a what-if is, and "Try it" with "Nothing is saved" beside it;
 *   · an optional change-course point, set BEFORE the result: "Change course if <option>'s chance falls below N%";
 *   · the result marked "Not saved", then "Keep it" / "Let it go". Keep it sends the person's figure by the saved path's
 *     own writer (`useModelEditAuthority.proposeFactorValue`, the call the factor card's editor makes), so a kept figure is
 *     an ordinary edit with an ordinary receipt in the chat. Let it go discards the held value.
 *
 * ⛔ No number is invented. Results are CEE's cells verbatim. The change-course check reads only the percentage CEE
 *   displayed, and says "can't tell" when a range straddles the point or when there is no figure.
 * ⛔ Ink is the person, blue is Olumi: nothing here is blue. Nothing dims: a control that cannot be pressed is greyed
 *   text on a plain ground, never a faded one. "What-if" names a variant; Olumi never says which to choose.
 */
import type { ReactNode } from 'react'
import { Check, Flag, Lock } from 'lucide-react'

import type { WhatIfCell } from '../adapters/cee/whatIf'
import { action, ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { useModelEditAuthority } from '../canvas/hooks/useModelEditAuthority'
import { useIsViewer } from '../lib/viewerMode'
import { figureText } from '../canvas/nodes/ProposalGhostLayer'
import { useWhatIfStore, type HeldWhatIf } from '../canvas/stores/whatIfStore'
import { typography } from '../styles/typography'

export const V10_WHAT_IF_COPY = {
  what: 'A what-if tries another value for one figure and shows what changes. Nothing is saved until you keep it.',
  legendEmpty: 'Try another value without saving',
  legendHeld: (label: string, figure: string) => `What if ${label} were ${figure}`,
  notSaved: 'Not saved',
  nothingSaved: 'Nothing is saved',
  itWere: 'What if it were',
  savedWas: (figure: string) => `Saved: ${figure}`,
  tryIt: 'Try it',
  running: 'Running the what-if',
  keepIt: 'Keep it',
  letGo: 'Let it go',
  courseOn: 'Change course if the chance falls below',
  courseOption: 'Option',
  coursePercent: 'Change-course chance, percent',
  courseUnset: 'No change-course point set',
  courseSetFirst: 'You set the change-course point before this result.',
  courseBelow: (label: string, pct: number) => `Change course below ${pct}% for ${label}`,
  reached: 'Reached',
  notReached: 'Not reached',
  cannotTell: "Can't tell from this range",
  noFigure: 'No figure to compare',
  keepSentence: (figure: string, saved: string) => `Keep it to make ${figure} your figure, or let it go to go back to ${saved}.`,
  kept: (label: string, figure: string) => `Sent as your figure: ${label} is now ${figure}. The chat says when it is saved.`,
  keptDeviceOnly: 'Kept on this device only. It was not sent to your model.',
  keepFailed: "Couldn't keep it. Nothing was saved.",
  saved: 'Saved',
  whatIf: 'What if',
} as const

export type CourseState = 'reached' | 'not_reached' | 'cannot_tell' | 'no_figure'

/** A percentage from CEE's displayed chance ("30%" or "60–70%"); null for anything else. Never inferred from other text. */
export function readDisplayedPercent(display: string | null): { lo: number; hi: number } | null {
  if (display === null) return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*%\s*$/.exec(display)
  if (m === null) return null
  const lo = Number(m[1])
  const hi = m[2] === undefined ? lo : Number(m[2])
  return Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi ? { lo, hi } : null
}

/**
 * Has the what-if chance fallen below the person's point? "Below" is strict. A range answers only when the whole range is on
 * one side of the point; a range that straddles it is "can't tell", never rounded to a side.
 */
export function courseStateOf(cell: WhatIfCell, point: number): CourseState {
  const shown = readDisplayedPercent(cell.display)
  if (shown === null) return 'no_figure'
  if (shown.hi < point) return 'reached'
  if (shown.lo >= point) return 'not_reached'
  return 'cannot_tell'
}

/** The person's typed point as a percentage, or null when it is empty or not a number from 0 to 100. */
export function readCoursePoint(typed: string): number | null {
  if (typed.trim() === '') return null
  const n = Number(typed)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

export interface CourseDraft { readonly on: boolean; readonly optionId: string | null; readonly pct: string }
export const NO_COURSE: CourseDraft = { on: false, optionId: null, pct: '' }

const COURSE_WORDS: Record<CourseState, string> = {
  reached: V10_WHAT_IF_COPY.reached,
  not_reached: V10_WHAT_IF_COPY.notReached,
  cannot_tell: V10_WHAT_IF_COPY.cannotTell,
  no_figure: V10_WHAT_IF_COPY.noFigure,
}

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

/** Keep it / Let it go. Mounted only while a result is on screen; Keep it is the saved path's own writer. */
export function V10KeepBar({ held, onKept, sentence }: { held: HeldWhatIf; onKept: (note: string) => void; sentence?: ReactNode }) {
  const authority = useModelEditAuthority(held.nodeId)
  const viewer = useIsViewer()
  const keep = () => {
    const outcome = authority.proposeFactorValue(held.whatIf, held.level ? { unit: held.unit } : undefined)
    useWhatIfStore.getState().clear()
    if (outcome === 'dispatched') onKept(V10_WHAT_IF_COPY.kept(held.label, figureText({ value: held.whatIf, unit: held.unit })))
    else if (outcome === 'local_only') onKept(V10_WHAT_IF_COPY.keptDeviceOnly)
    else onKept(V10_WHAT_IF_COPY.keepFailed)
  }
  return (
    <div className="space-y-2" data-testid="what-if-keep-bar">
      {sentence}
      <div className="flex items-center gap-2">
        {!viewer && (
          <button type="button" data-testid="what-if-keep" onClick={keep} className={INK_BUTTON}>{V10_WHAT_IF_COPY.keepIt}</button>
        )}
        <button
          type="button"
          data-testid="what-if-let-go"
          onClick={() => useWhatIfStore.getState().clear()}
          className={`${typography.panelBody} ${action('secondary')} rounded-full px-3 py-1`}
        >
          {V10_WHAT_IF_COPY.letGo}
        </button>
      </div>
    </div>
  )
}

/** Folded, the lens bar's one line: what is being tried, marked "Not saved", with Keep it / Let it go once there is a result. */
export function V10Legend({ held, hasResult, keptNote, onKept }: { held: HeldWhatIf | null; hasResult: boolean; keptNote: string | null; onKept: (note: string) => void }) {
  return (
    <div className="space-y-2" data-testid="what-if-legend">
      <p className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-body`}>
        <span>
          {held ? V10_WHAT_IF_COPY.legendHeld(held.label, figureText({ value: held.whatIf, unit: held.unit })) : V10_WHAT_IF_COPY.legendEmpty}
        </span>
        {held && <span className={PILL}>{V10_WHAT_IF_COPY.notSaved}</span>}
      </p>
      {held && hasResult && <V10KeepBar held={held} onKept={onKept} />}
      {keptNote !== null && <p data-testid="what-if-kept" role="status" className={`${typography.panelBody} text-text-body`}>{keptNote}</p>}
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
  readonly keptNote: string | null
  readonly onKept: (note: string) => void
}

export function V10WhatIfBody(p: V10BodyProps) {
  const savedFigure = figureText({ value: p.picked.saved, unit: p.picked.unit })
  const point = p.course.on ? readCoursePoint(p.course.pct) : null
  const courseOptionId = p.options.find((o) => o.id === p.course.optionId)?.id ?? p.options[0]?.id ?? null
  const courseRow = point !== null && courseOptionId !== null ? p.result?.rows.find((r) => r.id === courseOptionId) ?? null : null
  const field = `${typography.panelBody} rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`
  return (
    <div data-testid="what-if-key" className="space-y-3">
      <p className={`${typography.panelBody} text-text-body`}>{V10_WHAT_IF_COPY.what}</p>
      {p.keptNote !== null && (
        <p data-testid="what-if-kept" role="status" className={`${typography.panelBody} flex items-start gap-2 text-text-body`}>
          <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" />
          <span>{p.keptNote}</span>
        </p>
      )}
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
          <div className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-body`} data-testid="what-if-course">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="what-if-course-on"
                checked={p.course.on}
                onChange={(e) => p.onCourse({ ...p.course, on: e.target.checked })}
                className="h-3.5 w-3.5 accent-text-header"
              />
              <span>{V10_WHAT_IF_COPY.courseOn}</span>
            </label>
            <select
              aria-label={V10_WHAT_IF_COPY.courseOption}
              data-testid="what-if-course-option"
              disabled={!p.course.on}
              value={courseOptionId ?? ''}
              onChange={(e) => p.onCourse({ ...p.course, optionId: e.target.value })}
              className={`${field} max-w-[11rem] disabled:text-text-light`}
            >
              {p.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input
              data-testid="what-if-course-pct"
              inputMode="decimal"
              aria-label={V10_WHAT_IF_COPY.coursePercent}
              disabled={!p.course.on}
              value={p.course.pct}
              onChange={(e) => p.onCourse({ ...p.course, pct: e.target.value.replace(/[^0-9.]/g, '') })}
              className={`${field} w-14 disabled:text-text-light`}
            />
            <span>%</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" data-testid="what-if-run" disabled={!p.canRun} onClick={p.onTry} className={p.canRun ? INK_BUTTON : INK_BUTTON_OFF}>
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
          {!p.result.paired && <p data-testid="what-if-not-paired" className={`${typography.panelMeta} text-text-light`}>{p.result.notPairedWords}</p>}
          <ul className="space-y-2">
            {p.result.rows.map((row) => (
              <li key={row.id} data-testid={`what-if-row-${row.id}`} className={`${typography.panelBody} space-y-0.5`}>
                <p className="text-text-header">{row.label}</p>
                <p><span className="text-text-light">{V10_WHAT_IF_COPY.saved}: </span><Cell cell={row.saved} /></p>
                <p><span className="text-text-light">{V10_WHAT_IF_COPY.whatIf}: </span><Cell cell={row.whatIf} /></p>
                {row.variationWords !== null && <p className={`${typography.panelMeta} text-text-light`}>{row.variationWords}</p>}
              </li>
            ))}
          </ul>
          <div className={`${typography.panelBody} flex flex-wrap items-center justify-between gap-2 text-text-body`} data-testid="what-if-course-row">
            <span className="inline-flex items-center gap-2">
              <Flag aria-hidden="true" className="h-3.5 w-3.5 text-text-light" />
              {courseRow !== null && point !== null
                ? V10_WHAT_IF_COPY.courseBelow(courseRow.label, point)
                : V10_WHAT_IF_COPY.courseUnset}
            </span>
            {courseRow !== null && point !== null && (
              <span data-testid="what-if-course-state" className={PILL}>{COURSE_WORDS[courseStateOf(courseRow.whatIf, point)]}</span>
            )}
          </div>
          <V10KeepBar
            held={p.held}
            onKept={p.onKept}
            sentence={(
              <p className={`${typography.panelBody} text-text-body`}>
                {courseRow !== null && `${V10_WHAT_IF_COPY.courseSetFirst} `}
                {V10_WHAT_IF_COPY.keepSentence(figureText({ value: p.held.whatIf, unit: p.held.unit }), figureText({ value: p.held.saved, unit: p.held.unit }))}
              </p>
            )}
          />
        </div>
      )}
    </div>
  )
}
