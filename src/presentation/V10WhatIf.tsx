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
 * ⛔ No number is invented and no verdict is composed. Results are CEE's cells verbatim. The change-course point is the
 *   person's own, shown BESIDE CEE's figure with no judgement word: the person compares them, the host never decides
 *   "reached" for them.
 * ⛔ Keep it never says the figure changed until the edit's own settlement says the model holds it (`valueCommitSettlementWord`,
 *   the factor card's reading). A refusal restores the old value, so it says "Couldn't keep it" and keeps the what-if held.
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
import { resolveValueInputSeed } from '../canvas/conversation/factorValueEdit'
import { needsSavedModelRead, valueCommitSettlementWord } from '../canvas/conversation/valueCommitSettlement'
import { useCanvasStore } from '../canvas/store'
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
  yourPoint: (pct: number) => `Your change-course point: below ${pct}%`,
  keepSentence: (figure: string, saved: string) => `Keep it to make ${figure} your figure, or let it go to go back to ${saved}.`,
  sent: 'Sent. The chat says when it is saved.',
  kept: (label: string, figure: string) => `Kept. ${label} is now ${figure}.`,
  keptDeviceOnly: 'Kept on this device only. It was not sent to your model.',
  keepFailed: "Couldn't keep it. Nothing was saved.",
  saved: 'Saved',
  whatIf: 'What if',
} as const

/** The person's typed point as a percentage, or null when it is empty or not a number from 0 to 100. */
export function readCoursePoint(typed: string): number | null {
  if (typed.trim() === '') return null
  const n = Number(typed)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

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

/** What Keep it last said. `sent` is neutral and permanent until the model moves; only `kept` may say the figure changed. */
export type KeepNote = { readonly kind: 'sent' | 'kept' | 'failed'; readonly text: string } | null

const SENT: KeepNote = { kind: 'sent', text: V10_WHAT_IF_COPY.sent }
const FAILED: KeepNote = { kind: 'failed', text: V10_WHAT_IF_COPY.keepFailed }

/**
 * Keep it / Let it go. Mounted only while a result is on screen; Keep it is the saved path's own writer. The what-if stays
 * held until the edit's settlement says the model holds the figure (then it is cleared), so a refusal leaves it to retry.
 */
export function V10KeepBar({ held, note, onNote, sentence }: { held: HeldWhatIf; note: KeepNote; onNote: (note: KeepNote) => void; sentence?: ReactNode }) {
  const authority = useModelEditAuthority(held.nodeId)
  const viewer = useIsViewer()
  const keep = () => {
    onNote(SENT)
    const readNow = () => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === held.nodeId)
      return node ? resolveValueInputSeed(node.data).seed ?? null : null
    }
    const outcome = authority.proposeFactorValue(held.whatIf, {
      ...(held.level ? { unit: held.unit } : {}),
      onSendSettled: (settlement, detail) => {
        // A refusal on a moved base may still have landed (lost reply): say nothing more than "Sent".
        if (needsSavedModelRead(settlement, detail)) return
        // A goal's today level has no card value to read back, so it can only be refused or left neutral.
        if (held.level) { if (settlement === 'refused') onNote(FAILED); return }
        const word = valueCommitSettlementWord(settlement, held.saved, held.whatIf, readNow, detail)
        if (word === 'refused' || word === 'not_applied' || word === 'revision_conflict' || word === 'refused_unread') { onNote(FAILED); return }
        if (word === null && settlement === 'sent') {
          useWhatIfStore.getState().clear()
          onNote({ kind: 'kept', text: V10_WHAT_IF_COPY.kept(held.label, figureText({ value: held.whatIf, unit: held.unit })) })
        }
      },
    })
    if (outcome === 'local_only') onNote({ kind: 'sent', text: V10_WHAT_IF_COPY.keptDeviceOnly })
    else if (outcome === 'not_encodable') onNote(FAILED)
  }
  return (
    <div className="space-y-2" data-testid="what-if-keep-bar">
      {sentence}
      <div className="flex items-center gap-2">
        {!viewer && note?.kind !== 'sent' && (
          <button type="button" data-testid="what-if-keep" onClick={keep} className={INK_BUTTON}>{V10_WHAT_IF_COPY.keepIt}</button>
        )}
        <button
          type="button"
          data-testid="what-if-let-go"
          onClick={() => { useWhatIfStore.getState().clear(); onNote(null) }}
          className={`${typography.panelBody} ${action('secondary')} rounded-full px-3 py-1`}
        >
          {V10_WHAT_IF_COPY.letGo}
        </button>
      </div>
    </div>
  )
}

function NoteLine({ note }: { note: NonNullable<KeepNote> }) {
  return (
    <p data-testid="what-if-kept" role="status" className={`${typography.panelBody} flex items-start gap-2 text-text-body`}>
      {note.kind === 'kept' && <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" />}
      <span>{note.text}</span>
    </p>
  )
}

/** Folded, the lens bar's one line: what is being tried, marked "Not saved", with Keep it / Let it go once there is a result. */
export function V10Legend({ held, hasResult, note, onNote }: { held: HeldWhatIf | null; hasResult: boolean; note: KeepNote; onNote: (note: KeepNote) => void }) {
  return (
    <div className="space-y-2" data-testid="what-if-legend">
      <p className={`${typography.panelBody} flex flex-wrap items-center gap-2 text-text-body`}>
        <span>
          {held ? V10_WHAT_IF_COPY.legendHeld(held.label, figureText({ value: held.whatIf, unit: held.unit })) : V10_WHAT_IF_COPY.legendEmpty}
        </span>
        {held && <span className={PILL}>{V10_WHAT_IF_COPY.notSaved}</span>}
      </p>
      {held && hasResult && <V10KeepBar held={held} note={note} onNote={onNote} />}
      {note !== null && <NoteLine note={note} />}
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
  readonly note: KeepNote
  readonly onNote: (note: KeepNote) => void
}

export function V10WhatIfBody(p: V10BodyProps) {
  const savedFigure = figureText({ value: p.picked.saved, unit: p.picked.unit })
  const point = p.course.on ? readCoursePoint(p.course.pct) : null
  // The point belongs to the option the person chose; if that option is gone there is no point (never moved to another).
  const courseOptionId = p.options.find((o) => o.id === p.course.optionId)?.id ?? null
  const courseRow = point !== null && courseOptionId !== null ? p.result?.rows.find((r) => r.id === courseOptionId) ?? null : null
  const field = `${typography.panelBody} rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`
  return (
    <div data-testid="what-if-key" className="space-y-3">
      <p className={`${typography.panelBody} text-text-body`}>{V10_WHAT_IF_COPY.what}</p>
      {p.note !== null && <NoteLine note={p.note} />}
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
                {courseRow !== null && courseRow.id === row.id && point !== null && (
                  <p data-testid="what-if-course-point" className="inline-flex items-center gap-1 text-text-body">
                    <Flag aria-hidden="true" className="h-3 w-3 text-text-light" />
                    {V10_WHAT_IF_COPY.yourPoint(point)}
                  </p>
                )}
                {row.variationWords !== null && <p className={`${typography.panelMeta} text-text-light`}>{row.variationWords}</p>}
              </li>
            ))}
          </ul>
          {courseRow === null && (
            <p className={`${typography.panelBody} inline-flex items-center gap-2 text-text-body`} data-testid="what-if-course-row">
              <Flag aria-hidden="true" className="h-3.5 w-3.5 text-text-light" />
              {V10_WHAT_IF_COPY.courseUnset}
            </p>
          )}
          <V10KeepBar
            held={p.held}
            note={p.note}
            onNote={p.onNote}
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
