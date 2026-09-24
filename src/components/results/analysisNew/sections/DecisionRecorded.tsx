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
 * So the gate here is the weakest HONEST one — and "honest" is doing the work.
 * Nothing about a run's QUALITY belongs in it: a fragile, mixed or stale
 * result is exactly when the reasoning is worth keeping. But the gate must
 * still be a claim the product can keep, and "a run happened at some point in
 * this session" is not one.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS COMPONENT GATED ON `!isPreRun` ALONE, AND THAT
 * WAS DECORATIVE ON A REACHABLE PATH. `isPreRun` is `!hasCompletedFirstRun`, a
 * monotonic flag; the capture modal fails closed on
 * `results.status !== 'complete'`; and `resultsStart` preserves the previous
 * report while setting `'preparing'`. During any rerun, error or cancellation
 * the door therefore rendered onto a modal that opened fully disabled saying
 * "Run an analysis first." to a user who had. The gate is now `!isPreRun` AND
 * `canCapture`, the latter derived from the modal's own predicate — see the
 * prop, and `modals/analysedOptions.ts`.
 *
 * ⚠ THE READ-BACK IS NOT GATED ON IT. Only the DOOR and the UPDATE control
 * are. A stored record renders in every post-run state, because reading it
 * back needs nothing from the analysis.
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
 * 3. IT NEVER INFERS WHY A RECORD IS LOCAL-ONLY, AND NEVER ASSERTS THAT IT IS
 *    NOWHERE ELSE. `remote === null` has three documented routes (guest,
 *    offline, a failed commit). It does not license "sign in to keep this",
 *    which would be false for the signed-in user whose commit failed — and it
 *    does not license "it is not on your account" either, because a FAILED
 *    COMMIT is a dispatched POST that CEE may have written (hence
 *    `clientCommitId`'s dedupe). Absence of a record id is absence of
 *    CONFIRMATION, not absence of a row, and the copy says exactly that.
 *
 * 4. IT NEVER INVENTS A DATE. `formatRecordedOn` returns null on a
 *    non-finite or unparseable `savedAt` and the line is withheld.
 */
import { ClipboardCheck } from 'lucide-react'
// ⭐ ADOPTED RATHER THAN DECLARED: these two buttons were already
// `rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover`
// — `ACTION_TIER.neutral` character for character. A hand-rolled copy of a
// tier is the arrangement `everyActIsReachableByTouch` exists to end, and it is
// how the 133x15 review-estimates control happened in this same directory.
import { action } from '../panelSurfaces'
import { typography } from '../../../../styles/typography'
import type { DecisionRecord } from '../../modals'
import {
  isNotReadyRecord,
  NOT_READY_POSITION_LABEL,
  type DecisionRecordTextField,
} from '../../modals/decisionRecordStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { surface, icon } from '../panelSurfaces'

/**
 * ⭐ READ-BACK COPY FOR THE POSITION AND THE NEXT ACTION (24 Sep 2026).
 *
 * Kept here, not in `analysisNewCopy.ts`, because that file belongs to the tab
 * body's owner. Every string is rendered, so none carries an em dash or winner
 * vocabulary (both are swept over this file).
 *
 * ⚠ A NOT-READY RECORD NEVER READS AS A DECISION. It gets its own heading, its
 * position line says "Not ready to choose", and it has no option, confidence
 * or expectation row because the record carries none.
 *
 * ⚠ THE STORAGE SENTENCES NAME ONLY WHAT THE SERVER CONFIRMED. `remote.recordId`
 * licenses the account half (the position, or the choice and confidence). A
 * TEXT field (rationale, assumption, next action, revisit trigger) is said to
 * be on the account ONLY when `remote.storedTextFields` names it — CEE's own
 * per-field confirmation that the stored row holds those exact words. Every
 * other text is stated on this device. With no confirmed text at all (today's
 * CEE, and every record saved before the field existed) the sentence is the
 * fixed one it has always been, byte for byte. The account half of each
 * sentence is the one `COPY.decisionRecord.storedRemote*` already says; a spec
 * pins the two together so the variant cannot drift from its original.
 */
export const DECISION_POSITION_COPY = {
  notReadyHeading: 'Your recorded view',
  nextActionLabel: 'Next action',
  yourView: 'Your view, not an agreed team decision.',
  storedRemoteNotReady:
    'Your position is on your account. The rationale, assumption and revisit trigger are on this device.',
  storedRemoteNotReadyWithNextAction:
    'Your position is on your account. The rationale, assumption, next action and revisit trigger are on this device.',
  storedRemoteWithNextAction:
    'Your choice and confidence are on your account, with a review date. The rationale, assumption, next action and revisit trigger are on this device.',
  storedRemoteWithExpectationAndNextAction:
    'Your choice, confidence and expectation are on your account, with a review date. The rationale, assumption, next action and revisit trigger are on this device.',
  /**
   * The ACCOUNT halves, used when CEE confirmed at least one text. Each is the
   * first sentence of its fixed counterpart above (pinned by a spec).
   */
  accountNotReady: 'Your position is on your account.',
  accountOption: 'Your choice and confidence are on your account, with a review date.',
  accountOptionWithExpectation:
    'Your choice, confidence and expectation are on your account, with a review date.',
} as const

/**
 * The text fields a record can carry, in the order every storage sentence
 * names them, each with its wire name (what CEE confirms), its reader and its
 * name in a sentence.
 */
const TEXT_FIELD_SENTENCE_ORDER: ReadonlyArray<{
  readonly field: DecisionRecordTextField
  readonly name: string
  readonly read: (record: DecisionRecord) => string | undefined
}> = [
  { field: 'rationale', name: 'rationale', read: (r) => r.rationale },
  { field: 'key_assumption', name: 'assumption', read: (r) => r.assumptionToWatch },
  { field: 'next_action', name: 'next action', read: (r) => r.nextAction },
  { field: 'revisit_trigger', name: 'revisit trigger', read: (r) => r.revisitTrigger },
]

/** "a", "a and b", "a, b and c" — the house list style of the fixed sentences. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export interface DecisionRecordedProps {
  /** Pre-run there is no decision to record — the options are not analysed. */
  isPreRun: boolean
  /**
   * ⭐⭐ CAN THE CAPTURE MODAL ACTUALLY ACCEPT A RECORD RIGHT NOW? Derived by
   * `hasAnalysedOptions` — the SAME function the modal builds its option list
   * from — and it is not the same question as `!isPreRun`.
   *
   * ⚠⚠ THIS PROP EXISTS BECAUSE THE DOOR WAS DECORATIVE ON A REACHABLE PATH,
   * which falsified this component's own contract below. `isPreRun` is
   * `!hasCompletedFirstRun`, a MONOTONIC flag — once a session has completed
   * one run it never goes back. But `resultsStart` sets
   * `results.status = 'preparing'` and DELIBERATELY preserves the previous
   * report so the panel does not flash empty, and the modal fails CLOSED on
   * `results.status !== 'complete'`. So during any rerun — and on `'error'`
   * and `'cancelled'` — the section rendered a door, and the modal behind it
   * opened fully disabled saying "Run an analysis first. There are no analysed
   * options to record a decision against yet." **to a user who had just run
   * one.** Two questions under one name (CLAUDE.md trap 21).
   *
   * ⚠ IT GATES THE DOOR, NEVER THE READ-BACK. Reading a stored record back is
   * a pure read of the browser store: it needs no analysed option set, and
   * hiding it mid-rerun would delete the user's own writing from the screen
   * exactly when they are re-running to test it.
   */
  canCapture: boolean
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
  // ⚠ A NOT-READY RECORD NAMES NO OPTION. Any surface that prints this line
  // (the Reasoning V2 commitment row reuses it) must say the position, never
  // an empty string or a remembered option id.
  if (isNotReadyRecord(record)) return NOT_READY_POSITION_LABEL
  const label = record.optionLabel?.trim()
  const named = label && label !== '' ? label : record.optionId
  return record.optionNumber != null ? `Option ${record.optionNumber}: ${named}` : named
}

/**
 * ⚠ THE STORAGE SENTENCE NAMES ONLY FIELDS THE RECORD CARRIES. `expectation`
 * is optional on `DecisionRecord`, and `Field` withholds its row when it is
 * absent or blank — so naming it in a fixed sentence would tell the user their
 * expectation is on their account while the row for it is withheld for want of
 * one. Same rule as every other row here, applied to the sentence that
 * describes the rows.
 */
export function storageSentenceFor(record: DecisionRecord): string {
  if (!record.remote?.recordId) return COPY.decisionRecord.storedLocal
  const confirmed = record.remote.storedTextFields ?? []
  if (confirmed.length > 0) return confirmedStorageSentence(record, confirmed)
  const hasNextAction = Boolean(record.nextAction?.trim())
  if (isNotReadyRecord(record)) {
    return hasNextAction
      ? DECISION_POSITION_COPY.storedRemoteNotReadyWithNextAction
      : DECISION_POSITION_COPY.storedRemoteNotReady
  }
  if (record.expectation?.trim()) {
    return hasNextAction
      ? DECISION_POSITION_COPY.storedRemoteWithExpectationAndNextAction
      : COPY.decisionRecord.storedRemoteWithExpectation
  }
  return hasNextAction
    ? DECISION_POSITION_COPY.storedRemoteWithNextAction
    : COPY.decisionRecord.storedRemote
}

/**
 * The storage sentence once CEE has confirmed at least one text. Only texts
 * the record CARRIES are named (same rule as `Field`): a confirmed field the
 * record holds no text for is not mentioned, and a carried field CEE did not
 * confirm is stated on this device.
 */
function confirmedStorageSentence(
  record: DecisionRecord,
  confirmed: readonly DecisionRecordTextField[],
): string {
  const accountHalf = isNotReadyRecord(record)
    ? DECISION_POSITION_COPY.accountNotReady
    : record.expectation?.trim()
      ? DECISION_POSITION_COPY.accountOptionWithExpectation
      : DECISION_POSITION_COPY.accountOption
  const carried = TEXT_FIELD_SENTENCE_ORDER.filter((t) => Boolean(t.read(record)?.trim()))
  const onAccount = carried.filter((t) => confirmed.includes(t.field)).map((t) => t.name)
  const onDevice = carried.filter((t) => !confirmed.includes(t.field)).map((t) => t.name)
  const parts: string[] = [accountHalf]
  if (onAccount.length > 0) {
    parts.push(`The ${joinNames(onAccount)} ${onAccount.length === 1 ? 'is' : 'are'} on your account too.`)
  }
  if (onDevice.length > 0) {
    parts.push(`The ${joinNames(onDevice)} ${onDevice.length === 1 ? 'is' : 'are'} on this device.`)
  }
  return parts.join(' ')
}

/**
 * ⚠ THE CONFIDENCE ROW IS WITHHELD ON A NON-FINITE NUMBER, and the guard has
 * to live HERE rather than in `Field`. `Field` tests the string it is handed,
 * and this row hands it a COMPOSED string — `${confidence} of 100` — which is
 * never blank whatever the number is. An `undefined` or `NaN` confidence read
 * back out of an editable browser store would therefore render "NaN of 100"
 * or "undefined of 100" past a blank check that cannot see it.
 *
 * This is the same class as `formatRecordedOn`'s: capture validates the field,
 * but "validated at capture" is not a guarantee about a value that has since
 * been through `localStorage`, where a user can edit it. It is the value class
 * the corpus omitted (CLAUDE.md trap 22) applied to the one row the component
 * rendered unconditionally.
 */
export function formatConfidence(confidence: number | undefined): string | null {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null
  return `${confidence} ${COPY.decisionRecord.confidenceSuffix}`
}

export function DecisionRecorded({
  isPreRun,
  canCapture,
  record,
  onRecord,
  testId,
}: DecisionRecordedProps) {
  // Pre-run there are no analysed options, so there is nothing to have chosen.
  if (isPreRun) return null

  /**
   * ⚠⚠ NOTHING AT ALL WHEN THERE IS NEITHER A RECORD TO SHOW NOR A CAPTURE TO
   * OFFER. This is the gate that keeps the contract above true: an empty
   * section whose only control opens a disabled modal is worse than no
   * section, because it invites an act the product will then refuse. The
   * read-back is unaffected — a record already captured renders in every
   * post-run state, including mid-rerun.
   */
  if (record === null && !canCapture) return null

  const recordedOn = record ? formatRecordedOn(record.savedAt) : null
  const notReady = record !== null && isNotReadyRecord(record)
  const heading = notReady ? DECISION_POSITION_COPY.notReadyHeading : COPY.decisionRecord.recorded

  return (
    <section
      className={surface('neutral')}
      data-testid={testId}
      aria-label={record ? heading : COPY.decisionRecord.open}
    >
      <div className="flex items-start gap-2">
        <ClipboardCheck className={`${icon('section')} mt-[1px] shrink-0 text-text-light`} aria-hidden="true" />
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
                className={`${typography.panelMeta} mt-1.5 ${action('neutral')} focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
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
                {heading}
              </p>
              {notReady ? (
                /* ⚠ THE POSITION, NOT AN OPTION. A different testid from the
                   option line, so nothing bound to `-option` can ever read a
                   not-ready record as a choice. */
                <p
                  className={`${typography.panelBody} text-text-body mt-1 mb-0`}
                  data-testid={`${testId}-position`}
                >
                  {NOT_READY_POSITION_LABEL}
                </p>
              ) : (
                /* The choice itself, given the heading's weight — it is the one
                   thing a reader returning to this scenario came for. */
                <p
                  className={`${typography.panelBody} text-text-body mt-1 mb-0`}
                  data-testid={`${testId}-option`}
                >
                  {recordedOptionText(record)}
                </p>
              )}
              {/* Whose record this is: the user's own view. Never Olumi's, never the team's. */}
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-your-view`}
              >
                {DECISION_POSITION_COPY.yourView}
              </p>
              {/* ⚠ GUARDED BEFORE COMPOSITION — see `formatConfidence`. A
                  composed string is never blank, so `Field`'s blank check
                  cannot see a NaN or absent confidence behind it. */}
              <Field
                label={COPY.decisionRecord.confidenceLabel}
                value={formatConfidence(record.confidence) ?? undefined}
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
                label={DECISION_POSITION_COPY.nextActionLabel}
                value={record.nextAction}
                testId={`${testId}-next-action`}
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
                {storageSentenceFor(record)}
              </p>
              {/* ⚠ THE UPDATE CONTROL OBEYS THE SAME GATE AS THE DOOR. Updating
                  a record goes through the same capture modal, whose chosen-
                  option select is populated from the analysed option set — so
                  with no set on screen it opens just as disabled, and offering
                  it would be the same decorative control one state along. The
                  record itself stays fully readable. */}
              {canCapture ? (
                <button
                  type="button"
                  onClick={onRecord}
                  className={`${typography.panelMeta} mt-1.5 ${action('neutral')} focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
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
