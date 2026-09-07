/**
 * ⭐⭐ THE ACT — "record what you decided", and read it back.
 *
 * The panel's second terminal state, and the half that was unserved. Every
 * section above this one READS the model; this is the only place the team
 * writes down what they are going to do about it, and the only place a later
 * session can read that back.
 *
 * ── WHY IT IS A SECTION OF ITS OWN ─────────────────────────────────────────
 * The act used to hang off `ModelHeldUp` as an optional `onRecord` button. That
 * component's predicate answers "did this model hold up?" — a five-limb
 * conjunction over robustness, evidence, staleness and completeness. Recording
 * a decision answers a different question: "may I write down what we chose?"
 * Under one predicate, the second question inherited the first one's answer,
 * so the act was reachable ONLY on a run that held up.
 *
 * That is exactly backwards. A fragile, mixed, sensitive or stale result is
 * when writing down your reasoning matters MOST — it is the run whose
 * assumptions you will want to re-read in three months. Two questions under one
 * name (CLAUDE.md trap 21), and the cost was the entire ACT half of the panel
 * on every run but the rare clean one.
 *
 * So the gate here is the weakest honest one: A RUN EXISTS. Nothing about its
 * quality, because nothing about its quality bears on whether a team may record
 * what they chose.
 *
 * ── WHAT IT REFUSES TO SAY ─────────────────────────────────────────────────
 * 1. IT NEVER STATES A FIELD THE RECORD DOES NOT CARRY. Every free-text field
 *    renders through `Field`, which returns null on absent-or-blank. No
 *    placeholder, no em dash, no "not recorded" row, and above all no zero —
 *    an empty labelled row reads as "they recorded nothing here", which is a
 *    different claim from "this record predates that field".
 *
 * 2. IT NEVER SAYS "RUN". `useDecisionRecordForScenario` keys on
 *    `currentScenarioId` and nothing else, so it cannot tell whether the record
 *    was captured against the analysis on screen or an earlier one. The record
 *    carries `analysisHash`, but comparing it is a claim this component does
 *    not make — so the copy is scoped to the SCENARIO, which is what the
 *    selector licenses, and stops there.
 *
 * 3. IT NEVER INFERS WHY A RECORD IS LOCAL-ONLY. `remote === null` has three
 *    documented routes (guest, offline, a failed commit). It licenses exactly
 *    one sentence — there is no record id, so no account claim — and it does
 *    not license "sign in to keep this", which would be false for the
 *    signed-in user whose commit failed.
 *
 * 4. IT NEVER INVENTS A DATE. `formatRecordedOn` returns null on a
 *    non-finite or unparseable `savedAt` and the line is withheld.
 */
import { ClipboardCheck } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import type { DecisionRecord } from '../../modals'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

export interface DecisionRecordedProps {
  /** Pre-run there is no decision to record — the options are not analysed. */
  isPreRun: boolean
  /**
   * The record for the CURRENT scenario, or null. Passed in rather than read
   * here so both states can be driven directly in a test, the way
   * `ModelHeldUp` exports its condition.
   */
  record: DecisionRecord | null
  /** Opens the capture modal. Required — this door is never decorative. */
  onRecord: () => void
  testId: string
}

/**
 * A label/value pair, or nothing at all.
 *
 * ⚠ THE BLANK CHECK IS NOT DEFENSIVE PADDING, IT IS THE HONESTY RULE. `record`
 * is a user-authored object persisted across versions: `expectation` is
 * optional on the type (records written before it existed are still readable),
 * and any of the strings can be whitespace. A labelled row over an empty value
 * asserts the user left it blank; withholding the row asserts nothing.
 */
function Field({
  label,
  value,
  testId,
}: {
  label: string
  value: string | undefined
  testId: string
}) {
  const text = value?.trim()
  if (!text) return null
  return (
    <div className="mt-1.5" data-testid={testId}>
      <p className={`${typography.panelMeta} text-text-light m-0`}>{label}</p>
      <p className={`${typography.panelBody} text-text-body m-0`}>{text}</p>
    </div>
  )
}

/**
 * ⚠ NULL RATHER THAN A FALLBACK STRING. `savedAt` is `Date.now()` at capture
 * and should always be sound, but "should always" is not a guarantee about a
 * value read back out of storage that a user could have edited. An unreadable
 * timestamp gets no line; it never gets today's date, and never gets "unknown",
 * which would be a claim that the record lacks one.
 */
export function formatRecordedOn(savedAt: number): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  const d = new Date(savedAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * ⚠ THE NUMBER IS ONLY EVER SHOWN WHEN THE PRODUCER GAVE ONE. `optionNumber` is
 * null whenever the option set was not wholly numbered (`optionNumbering` is
 * all-or-nothing, mirroring the capture modal and `ResultsBody`), and a
 * fabricated "Option 1" over an unnumbered set would make the record name an
 * option the canvas does not.
 */
export function recordedOptionText(record: DecisionRecord): string {
  const label = record.optionLabel?.trim()
  const named = label && label !== '' ? label : record.optionId
  return record.optionNumber != null ? `Option ${record.optionNumber} — ${named}` : named
}

export function DecisionRecorded({ isPreRun, record, onRecord, testId }: DecisionRecordedProps) {
  // Pre-run there are no analysed options, so there is nothing to have chosen.
  // This is the ONLY gate — see the header for why nothing about the run's
  // quality belongs in it.
  if (isPreRun) return null

  const recordedOn = record ? formatRecordedOn(record.savedAt) : null

  return (
    <section
      className="rounded-lg border border-panel-border px-3 py-2.5"
      data-testid={testId}
      aria-label={record ? COPY.decisionRecord.recorded : COPY.decisionRecord.open}
    >
      <div className="flex items-start gap-2">
        <ClipboardCheck className="w-4 h-4 mt-[1px] shrink-0 text-text-light" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {record === null ? (
            <>
              {/* ⚠ THE STATE, NOT AN EXPLANATION. A standing sentence about why
                  recording is worthwhile would be identical on every instance
                  of this surface forever — furniture, under the P2 ruling. This
                  line is the negative half of a state pair and flips the moment
                  a record exists, which is what earns it. */}
              <p
                className={`${typography.panelBody} text-text-light m-0`}
                data-testid={`${testId}-none`}
              >
                {COPY.decisionRecord.none}
              </p>
              <button
                type="button"
                onClick={onRecord}
                className={`${typography.panelMeta} mt-1.5 rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testId}-open`}
              >
                {COPY.decisionRecord.open}
              </button>
            </>
          ) : (
            <>
              <p
                className={`${typography.panelHeader} text-text-header m-0`}
                data-testid={`${testId}-title`}
              >
                {COPY.decisionRecord.recorded}
              </p>
              {/* The choice itself, given the heading's weight — it is the one
                  thing a reader returning to this scenario came for. */}
              <p
                className={`${typography.panelBody} text-text-body mt-1 mb-0`}
                data-testid={`${testId}-option`}
              >
                {recordedOptionText(record)}
              </p>
              {/* ⚠ RENDERED UNCONDITIONALLY BECAUSE IT IS VALIDATED AT CAPTURE.
                  `parseConfidence` rejects an empty string (the prototype's
                  `Number('') === 0` hole is closed there), so a record that
                  exists has a real number — unlike the free-text fields below,
                  where absence is a genuine state. */}
              <Field
                label={COPY.decisionRecord.confidenceLabel}
                value={`${record.confidence} ${COPY.decisionRecord.confidenceSuffix}`}
                testId={`${testId}-confidence`}
              />
              <Field
                label={COPY.decisionRecord.expectationLabel}
                value={record.expectation}
                testId={`${testId}-expectation`}
              />
              <Field
                label={COPY.decisionRecord.rationaleLabel}
                value={record.rationale}
                testId={`${testId}-rationale`}
              />
              <Field
                label={COPY.decisionRecord.assumptionLabel}
                value={record.assumptionToWatch}
                testId={`${testId}-assumption`}
              />
              <Field
                label={COPY.decisionRecord.revisitLabel}
                value={record.revisitTrigger}
                testId={`${testId}-revisit`}
              />
              {recordedOn !== null ? (
                <p
                  className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
                  data-testid={`${testId}-savedat`}
                >
                  {`${COPY.decisionRecord.recordedOnPrefix} ${recordedOn}`}
                </p>
              ) : null}
              {/* ⚠⚠ THE ONE FACT THAT DECIDES WHICH SENTENCE: `remote.recordId`.
                  It is CEE's own proof the durable half landed, so it is the
                  only thing that can license an account claim. Anything softer
                  — a signed-in flag, a successful-looking response — would let
                  the surface say "on your account" about a write that did not
                  happen. */}
              <p
                className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
                data-testid={`${testId}-storage`}
              >
                {record.remote?.recordId
                  ? COPY.decisionRecord.storedRemote
                  : COPY.decisionRecord.storedLocal}
              </p>
              <button
                type="button"
                onClick={onRecord}
                className={`${typography.panelMeta} mt-1.5 rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testId}-update`}
              >
                {COPY.decisionRecord.update}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
