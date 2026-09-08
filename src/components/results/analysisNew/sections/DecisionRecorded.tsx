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
 * ⚠⚠ BUT "A RUN EXISTS" WAS THE WRONG FACT FOR THE DOOR, AND THE DOCSTRING'S
 * OLD CLAIM THAT "this door is never decorative" WAS FALSE. `isPreRun` is
 * `!hasCompletedFirstRun` — a MONOTONIC latch. The modal behind the door needs
 * `results.status === 'complete'` AND at least one option node. After a failed
 * rerun (`store.ts :: resultsError` sets `status: 'error'` and DELIBERATELY
 * retains the prior report, so this panel stays mounted), the latch was still
 * true, the door still rendered, and the modal opened fully disabled saying
 * "Run an analysis first." — to a user who had run one. Same on `cancelled`
 * and on an in-flight `preparing`.
 *
 * `canRecord` is the modal's OWN precondition, threaded in from the one shared
 * expression (`modals/analysedOptions.ts`) rather than recomputed here — the
 * door and the room read the same function, so they cannot drift apart.
 *
 * ⚠ AND IT IS STILL NOT A QUALITY GATE. `canRecord` asks "is there an analysed
 * option set to record a decision AGAINST?" and nothing else. Robustness,
 * evidence, staleness and completeness stay irrelevant, which is the whole
 * point of the act being decoupled from `ModelHeldUp`.
 *
 * ⚠⚠ THE READ-BACK IS NOT GATED ON IT. A captured record is stored data keyed
 * on the scenario; reading it back is honest whatever the current run is doing,
 * and a user whose rerun just failed is exactly the user who wants to re-read
 * what they decided. Only the CAPTURE controls depend on `canRecord`.
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
 *    ⚠ AND IT DOES NOT SAY "SCENARIO" WHEN THERE IS NOT ONE.
 *    `resolveScenarioKey` falls back to the single shared `__unscoped__`
 *    literal before the first scenario exists, so on an unsaved canvas the
 *    phrase "for this scenario" named an object the model does not have.
 *    `isScenarioScoped` drops it. See `scenarioKey.ts` for what remains open
 *    at that key — a product decision, deliberately not taken here.
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
  /**
   * Whether a real scenario backs this record. False before the first scenario
   * exists, when `resolveScenarioKey` falls back to the shared `__unscoped__`
   * key — and then the copy may not say "for this scenario", because there is
   * not one.
   */
  isScenarioScoped: boolean
  /**
   * Whether the capture modal can actually capture — `canCaptureDecision` from
   * `modals/analysedOptions`, the modal's own precondition. False on a failed,
   * cancelled or in-flight rerun, and on a completed run with no option nodes.
   * When false the capture controls are withheld, so no control leads to the
   * modal's "Run an analysis first." refusal.
   */
  canRecord: boolean
  /** Opens the capture modal. Only ever rendered when `canRecord`. */
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

export function DecisionRecorded({
  isPreRun,
  record,
  isScenarioScoped,
  canRecord,
  onRecord,
  testId,
}: DecisionRecordedProps) {
  // Pre-run there are no analysed options, so there is nothing to have chosen.
  if (isPreRun) return null

  /**
   * ⚠ NOTHING TO SHOW AND NOTHING TO OFFER. With no record and no capturable
   * option set, the section would render "Nothing recorded for this scenario
   * yet." beside a door that leads to a refusal — furniture pointing at a
   * locked room. Withholding the section asserts nothing; the old behaviour
   * asserted something false.
   */
  if (record === null && !canRecord) return null

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
                {COPY.decisionRecord.none(isScenarioScoped)}
              </p>
              {/* Unreachable with `canRecord === false` — the section itself is
                  withheld above in that case — but the condition stays explicit
                  so the door's precondition is stated where the door is. */}
              {canRecord ? (
                <button
                  type="button"
                  onClick={onRecord}
                  className={`${typography.panelMeta} mt-1.5 rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-open`}
                >
                  {COPY.decisionRecord.open}
                </button>
              ) : null}
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
              {/* ⚠⚠ THE UNIT IS COMPOSED ONLY AFTER THE NUMBER IS CHECKED, AND
                  THAT ORDER IS THE POINT. `parseConfidence` validates at
                  CAPTURE, so a record written by this build has a real number —
                  but this value is read back out of `localStorage`, where an
                  older build, a partial write or a hand-edited store can put
                  anything. Composing the string first made `Field`'s blank
                  check unfalsifiable (`"undefined of 100"` is not blank), so
                  the surface would print a unit over a number nobody supplied.
                  Checked here, an unreadable confidence gets no row — the same
                  rule `formatRecordedOn` applies to a date. */}
              <Field
                label={COPY.decisionRecord.confidenceLabel}
                value={
                  typeof record.confidence === 'number' && Number.isFinite(record.confidence)
                    ? `${record.confidence} ${COPY.decisionRecord.confidenceSuffix}`
                    : undefined
                }
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
                  ? COPY.decisionRecord.storedRemote({
                      /* Asked the way `Field` asks it, so the sentence cannot
                         name a row the panel withheld. */
                      hasExpectation: (record.expectation ?? '').trim() !== '',
                      reviewDate: record.remote.reviewDate,
                      reviewDateSource: record.remote.reviewDateSource,
                    })
                  : COPY.decisionRecord.storedLocal(isScenarioScoped)}
              </p>
              {/* ⚠ THE UPDATE CONTROL IS A CAPTURE CONTROL. It opens the same
                  modal, so on an uncapturable run it would lead to the same
                  false refusal. The read-back above stays; only the way back
                  into the form is withheld. */}
              {canRecord ? (
                <button
                  type="button"
                  onClick={onRecord}
                  className={`${typography.panelMeta} mt-1.5 rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-update`}
                >
                  {COPY.decisionRecord.update}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
