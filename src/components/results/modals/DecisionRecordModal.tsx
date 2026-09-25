/**
 * Record-the-decision modal — the elicitation end of the calibration loop
 * (calibration R0, ROADMAP 2.727).
 *
 * Captures chosen option / confidence 0-100 / **what the user expects to
 * happen** / concise rationale / key assumption to watch / revisit
 * trigger-or-date. The chosen-option select is populated READ-ONLY from the
 * live analysed option set (canvas option nodes + the stable optionNumbering
 * map) — never the prototype's four hardcoded fixtures.
 *
 * ⭐ WHAT CHANGED IN R0: THE RECORD IS NOW DURABLE. On save, a signed-in
 * user's chosen option, stated confidence, expectation and review date are
 * POSTed to CEE and persisted in `decision_records` with
 * `committed_by_user: true` and `confidence_source: 'user_stated'` — the
 * first user-stated calibration population this product has ever had.
 * Everything still lands in the browser store first, so a failed commit
 * degrades the record from "durable" to "on this device", never to "lost".
 *
 * ⚠ THAT STORE IS `localStorage`, NOT `sessionStorage`. Superseded text:
 * ~~Everything still lands in sessionStorage first~~. `decisionRecordStore`
 * moved on 7 Sep 2026 so a record survives to the LATER visit it exists to be
 * read back on; this sentence is corrected here rather than left as a stale
 * mirror of a file it does not own (CLAUDE.md trap 12). See that store's
 * header for the lifetime, and `scenarioKey.ts` for why its sibling
 * `successMeasureStore` did NOT move.
 *
 * ⭐ WHY AN "EXPECTATION" FIELD RATHER THAN REUSING THE RATIONALE. The
 * outcome is scored against `prediction.statement`, a FORWARD claim. A
 * rationale is backward-looking justification for the choice. Scoring one as
 * the other would be a semantic lie, and every calibration number built on it
 * would be meaningless — so the user is asked the forward question directly.
 *
 * Fail-closed: with no completed analysis or zero option nodes the form
 * renders disabled with honest copy — capture never fabricates an option
 * set. Validation closes the prototype's Number('')===0 hole: confidence
 * must be NON-EMPTY, finite and 0-100 inclusive.
 *
 * ⚠ NO ARITHMETIC ON PROBABILITIES HAPPENS HERE. The confidence goes over
 * the wire as the raw 0–100 number the user typed; CEE owns the /100. A
 * second place that rescales is a second place the scale can drift.
 *
 * ⭐ 24 SEP 2026: A POSITION, AND A NEXT ACTION. The first control is now a
 * choice between an option and "Not ready to choose" (a position, never a
 * decision; see the `position` state below for which fields it hides and
 * why), and every record may carry an optional next action. A signed-in save
 * sends the rationale, assumption and next action as additive keys; today's
 * CEE ignores them and refuses a not-ready commit before writing, so both
 * degrade to the local copy exactly as any failed commit does.
 *
 * Mount once; open from anywhere via openDecisionRecord() (the commit
 * rec's INTENDED wiring — the spec flags the prototype's 'ask' routing as
 * a critical wiring bug not to copy).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useCanvasStore } from '../../../canvas/store'
import { useAuth } from '../../../contexts/AuthContext'
import { sanitiseUserId } from '../../../lib/guestIdentity'
import {
  commitDecisionRecord,
  DECISION_RECORD_TEXT_MAX_CHARS,
} from '../../../services/decisionRecordCommitService'
import { typography } from '../../../styles/typography'
import {
  FIELD_INPUT_CLASS,
  FieldError,
  FieldLabel,
  GHOST_BUTTON_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  useModalToast,
} from './ModalShell'
import { selectAnalysedOptions, type AnalysedOption } from './analysedOptions'
import { resolveScenarioKey } from './scenarioKey'
import {
  isNotReadyRecord,
  NOT_READY_POSITION_LABEL,
  selectDecisionRecord,
  useDecisionRecordStore,
  type DecisionRecord,
  type DecisionRecordPosition,
} from './decisionRecordStore'

export const DECISION_RECORD_COPY = {
  title: 'Record the decision',
  subtitle: 'Capture the choice and what would justify revisiting it.',
  // Before save, identity licenses an attempt, not a claim of remote success.
  //
  // ⚠ Superseded text: ~~The rationale, assumption and revisit trigger stay on
  // this device for this scenario.~~ Since 24 Sep 2026 they are SENT with the
  // commit, so "stay on this device" would deny a transmission that happens.
  // What is still true, and all that is claimed BEFORE save: they are sent,
  // and they are kept here. Whether the account kept each one is known only
  // after save, from CEE's `stored_text_fields`, and is said by the read-back
  // (`storageSentenceFor`), never promised here.
  persistenceNote:
    'We’ll try to save your choice, confidence, expectation and review date to your account. The rationale, assumption, next action and revisit trigger are sent with them, and kept on this device for this scenario.',
  /** The same attempt, for "Not ready to choose": no choice, confidence or expectation exists. */
  notReadyPersistenceNote:
    'We’ll try to save your position to your account. The rationale, assumption, next action and revisit trigger are sent with it, and kept on this device for this scenario.',
  positionLegend: 'Your position',
  positionOption: 'Choose an option',
  positionNotReady: NOT_READY_POSITION_LABEL,
  /** Whose record this is. Nothing here is Olumi's decision, or the team's. */
  yourViewNote: 'Your view, not an agreed team decision.',
  notReadyRationalePlaceholder: 'Why you are not ready to choose yet',
  notReadyAssumptionPlaceholder: 'The assumption most likely to decide the choice',
  notReadyRevisitHelp: 'Enter a date, or what would make you ready to choose.',
  nextActionLabel: 'Next action',
  nextActionPlaceholder: 'What will you resolve, accept or monitor?',
  saveNotReady: 'Record your position',
  toastSavedNotReady: 'Your position is recorded and saved to your account.',
  toastSavedLocalNotReady: 'Your position is recorded on this device.',
  toastSavedLocalAfterErrorNotReady:
    'Your position is recorded on this device. We could not save it to your account.',
  guestNote:
    'Signed out: this record stays on this device for this scenario. It is not saved to an account.',
  identityPendingNote: 'We’re checking your sign-in. Account saving is not confirmed.',
  localOnlyNote: 'Account saving is unavailable for this model. The record stays on this device.',
  savedRemoteNote: 'Saved to your account.',
  emptyState:
    'Run an analysis first. There are no analysed options to record a decision against yet.',
  chosenOptionLabel: 'Chosen option',
  confidenceLabel: 'Confidence, 0–100',
  confidencePlaceholder: 'e.g. 70',
  expectationLabel: 'What do you expect to happen?',
  expectationPlaceholder: 'e.g. runway holds above 9 months through Q1',
  expectationHelp:
    'This is the claim we check back against — keep it something you could later call right or wrong.',
  revisitLabel: 'Revisit trigger or date',
  revisitPlaceholder: 'e.g. runway falls below 9 months, or 2026-12-01',
  revisitHelp:
    'If the account save succeeds, its review date is your recognised date or, when the text is not a recognised date, 90 days from now. Your text stays here.',
  localRevisitHelp:
    'Your date or trigger is kept as text in this record. No review date is set automatically.',
  identityPendingRevisitHelp: 'Enter a date or a trigger for revisiting this decision.',
  rationaleLabel: 'Concise rationale',
  rationalePlaceholder: 'Why you chose this option',
  assumptionLabel: 'Key assumption to watch',
  assumptionPlaceholder: 'The assumption most likely to change the choice',
  cancel: 'Cancel',
  /**
   * Beside the disabled Record button: what is still missing, by name. A
   * button that stays grey without saying why is a dead end (witnessed 25 Sep
   * on "Not ready to choose": three required fields, no sign which).
   */
  stillNeeded: (fields: readonly string[]): string =>
    `Still needed to record: ${
      fields.length <= 1 ? fields.join('') : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`
    }.`,
  missingField: {
    option: 'a chosen option',
    confidence: 'a confidence from 0 to 100',
    expectation: 'what you expect to happen',
    revisit: 'a revisit trigger or date',
    rationale: 'a rationale',
    assumption: 'an assumption to watch',
  },
  save: 'Record the decision',
  saving: 'Saving…',
  confidenceError: 'Add a confidence between 0 and 100.',
  expectationError: 'Add what you expect to happen.',
  rationaleError: 'Add a concise rationale.',
  assumptionError: 'Add the assumption most likely to change the choice.',
  revisitError: 'Add a revisit trigger or date.',
  toastSaved: 'Decision recorded and saved to your account.',
  toastNotKept: 'This record could not be kept. Please try again.',
  toastSavedLocal: 'Decision recorded on this device.',
  toastSavedLocalAfterError:
    'Decision recorded on this device — we could not save it to your account.',
} as const

function parseConfidence(raw: string): number {
  // NON-EMPTY strict parse — the prototype accepted '' because
  // Number('')===0; the spec flags that as a validation hole to close.
  const trimmed = raw.trim()
  return trimmed === '' ? NaN : Number(trimmed)
}

export function DecisionRecordModal() {
  const { user, loading } = useAuth()
  const isOpen = useDecisionRecordStore((s) => s.isOpen)
  const close = useDecisionRecordStore((s) => s.close)
  const { showToast, toastElement } = useModalToast('decision-record-toast')

  // READ-ONLY canvas reads: analysed options exist only once a run has
  // completed; labels come from the option nodes, numbers from the stable
  // optionNumbering map (all-or-nothing, mirroring ResultsBody — partial
  // coverage must not render fabricated numbers).
  const nodes = useCanvasStore((s) => s.nodes)
  const resultsStatus = useCanvasStore((s) => s.results.status)
  const analysisHash = useCanvasStore((s) => s.results.hash ?? null)
  const numbering = useCanvasStore((s) => s.optionNumbering)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  // Optional auth calls guests authenticated too; use the actual identity.
  // The commit service rechecks identity/capture and confirms a real save.
  const accountUserId = sanitiseUserId(user?.id)
  const canAttemptAccountSave = !loading && accountUserId !== null &&
    typeof currentScenarioId === 'string' && currentScenarioId !== ''

  /**
   * ⭐ THE FIRST CHOICE: an option, or "Not ready to choose". Not-ready HIDES
   * the chosen option, the confidence and the expectation, because each is a
   * claim about a CHOSEN option: the expectation is what that option's outcome
   * is scored against and the confidence is the user's belief in it. With no
   * choice, both would be claims about nothing. It KEEPS the rationale, the
   * assumption, the revisit trigger and the next action, which all make sense
   * of a position that is still open. Hidden drafts are kept, never cleared,
   * so switching back loses nothing; they are simply not saved or sent.
   */
  const [position, setPosition] = useState<DecisionRecordPosition>('option')
  const notReady = position === 'not_ready'

  const persistenceNote = loading
    ? DECISION_RECORD_COPY.identityPendingNote
    : accountUserId === null
      ? DECISION_RECORD_COPY.guestNote
      : canAttemptAccountSave
        ? notReady
          ? DECISION_RECORD_COPY.notReadyPersistenceNote
          : DECISION_RECORD_COPY.persistenceNote
        : DECISION_RECORD_COPY.localOnlyNote
  // ⚠ Not-ready never promises a review date: whether the account sets one for
  // a position without a choice is the server's call, and is not claimed here.
  const revisitHelp = notReady
    ? DECISION_RECORD_COPY.notReadyRevisitHelp
    : loading
      ? DECISION_RECORD_COPY.identityPendingRevisitHelp
      : canAttemptAccountSave
        ? DECISION_RECORD_COPY.revisitHelp
        : DECISION_RECORD_COPY.localRevisitHelp

  /**
   * ⚠⚠ THIS PREDICATE NOW LIVES IN `analysedOptions.ts` AND IS SHARED. It used
   * to be computed inline here, and the `DecisionRecorded` section offered its
   * door on `!isPreRun` instead — a DIFFERENT question ("has this session ever
   * completed a run?" vs "is there an analysed option set on screen now?").
   * The two diverge on every rerun, error and cancellation, because
   * `hasCompletedFirstRun` is monotonic while `resultsStart` preserves the
   * prior report — so the section rendered a door onto this fail-closed empty
   * state. Restating the condition there would have been a hand-maintained
   * mirror (CLAUDE.md trap 12); both surfaces derive it from one function.
   */
  const options = useMemo<AnalysedOption[]>(
    () => selectAnalysedOptions(nodes, resultsStatus, numbering),
    [nodes, resultsStatus, numbering],
  )

  const hasOptions = options.length > 0

  const titleId = useId()
  const missingId = useId()
  const optionId = useId()
  const confidenceId = useId()
  const expectationId = useId()
  const revisitId = useId()
  const rationaleId = useId()
  const assumptionId = useId()
  const nextActionId = useId()
  const positionName = useId()
  const confidenceErrorId = useId()
  const expectationErrorId = useId()
  const revisitErrorId = useId()
  const rationaleErrorId = useId()
  const assumptionErrorId = useId()

  const [chosenOptionId, setChosenOptionId] = useState('')
  const [confidence, setConfidence] = useState('')
  const [expectation, setExpectation] = useState('')
  const [revisit, setRevisit] = useState('')
  const [rationale, setRationale] = useState('')
  const [assumption, setAssumption] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState<{
    confidence?: boolean
    expectation?: boolean
    revisit?: boolean
    rationale?: boolean
    assumption?: boolean
  }>({})
  const saveFiredRef = useRef(false)

  // Hydrate on open: an existing record for this scenario prefills the form
  // (its option only if still analysed); otherwise default to the first
  // analysed option.
  useEffect(() => {
    if (!isOpen) return
    saveFiredRef.current = false
    setSaving(false)
    const scenarioKey = resolveScenarioKey(useCanvasStore.getState().currentScenarioId)
    const saved = selectDecisionRecord(useDecisionRecordStore.getState(), scenarioKey)
    if (saved && isNotReadyRecord(saved)) {
      // A not-ready record has no option, confidence or expectation to
      // prefill; the option picker starts where a fresh one would.
      setPosition('not_ready')
      setChosenOptionId(options[0]?.id ?? '')
      setConfidence('')
      setExpectation('')
      setRevisit(saved.revisitTrigger)
      setRationale(saved.rationale)
      setAssumption(saved.assumptionToWatch)
      setNextAction(saved.nextAction ?? '')
    } else if (saved) {
      setPosition('option')
      setChosenOptionId(
        options.some((o) => o.id === saved.optionId) ? saved.optionId : options[0]?.id ?? '',
      )
      setConfidence(String(saved.confidence))
      // `?? ''` because records persisted before the expectation field
      // existed are still readable — never a fabricated statement.
      setExpectation(saved.expectation ?? '')
      setRevisit(saved.revisitTrigger)
      setRationale(saved.rationale)
      setAssumption(saved.assumptionToWatch)
      setNextAction(saved.nextAction ?? '')
    } else {
      setPosition('option')
      setChosenOptionId(options[0]?.id ?? '')
      setConfidence('')
      setExpectation('')
      setRevisit('')
      setRationale('')
      setAssumption('')
      setNextAction('')
    }
    setTouched({})
    // options is deliberately read at open time only — a mid-edit analysis
    // completing must not clobber the user's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const parsedConfidence = parseConfidence(confidence)
  const confidenceValid =
    Number.isFinite(parsedConfidence) && parsedConfidence >= 0 && parsedConfidence <= 100
  const expectationValid = expectation.trim() !== ''
  const revisitValid = revisit.trim() !== ''
  const rationaleValid = rationale.trim() !== ''
  const assumptionValid = assumption.trim() !== ''
  const chosenOption = options.find((o) => o.id === chosenOptionId) ?? null
  // The next action is OPTIONAL in both positions; only its length is bounded.
  const trimmedNextAction = nextAction.trim()
  // ⚠ The analysed-option gate holds for BOTH positions: the door onto this
  // modal is gated on the same predicate, and CEE anchors every record to an
  // analysed graph.
  // The same conjuncts as `valid` below, named, so the button can say why it
  // is disabled. No options is the door's own gate, not a field to fill.
  const missing: string[] = !hasOptions
    ? []
    : [
        ...(!notReady && chosenOption === null ? [DECISION_RECORD_COPY.missingField.option] : []),
        ...(!notReady && !confidenceValid ? [DECISION_RECORD_COPY.missingField.confidence] : []),
        ...(!notReady && !expectationValid ? [DECISION_RECORD_COPY.missingField.expectation] : []),
        ...(!revisitValid ? [DECISION_RECORD_COPY.missingField.revisit] : []),
        ...(!rationaleValid ? [DECISION_RECORD_COPY.missingField.rationale] : []),
        ...(!assumptionValid ? [DECISION_RECORD_COPY.missingField.assumption] : []),
      ]
  const valid = notReady
    ? hasOptions && revisitValid && rationaleValid && assumptionValid
    : hasOptions &&
      chosenOption !== null &&
      confidenceValid &&
      expectationValid &&
      revisitValid &&
      rationaleValid &&
      assumptionValid

  const handleSave = () => {
    if (!valid || (!notReady && chosenOption === null)) {
      setTouched({
        confidence: true,
        expectation: true,
        revisit: true,
        rationale: true,
        assumption: true,
      })
      return
    }
    if (saveFiredRef.current) return
    saveFiredRef.current = true

    const scenarioId = useCanvasStore.getState().currentScenarioId
    const scenarioKey = resolveScenarioKey(scenarioId)
    const common = {
      rationale: rationale.trim(),
      assumptionToWatch: assumption.trim(),
      revisitTrigger: revisit.trim(),
      // A blank next action is never stored as '' — the key is simply absent.
      ...(trimmedNextAction !== '' ? { nextAction: trimmedNextAction } : {}),
      analysisHash,
      savedAt: Date.now(),
      remote: null,
    }
    const record: DecisionRecord = notReady || chosenOption === null
      ? { position: 'not_ready', ...common }
      : {
          optionId: chosenOption.id,
          optionLabel: chosenOption.label,
          optionNumber: chosenOption.number,
          confidence: parsedConfidence,
          expectation: expectation.trim(),
          ...common,
        }
    const copy = isNotReadyRecord(record)
      ? {
          saved: DECISION_RECORD_COPY.toastSavedNotReady,
          local: DECISION_RECORD_COPY.toastSavedLocalNotReady,
          localAfterError: DECISION_RECORD_COPY.toastSavedLocalAfterErrorNotReady,
        }
      : {
          saved: DECISION_RECORD_COPY.toastSaved,
          local: DECISION_RECORD_COPY.toastSavedLocal,
          localAfterError: DECISION_RECORD_COPY.toastSavedLocalAfterError,
        }
    // LOCAL FIRST, ALWAYS. Whatever happens on the network, the user's input
    // is already kept — a failed commit degrades the record from "durable" to
    // "on this device", never to "lost".
    // A stable per-save id: a retry of THIS save replays through CEE's dedupe
    // branch, while a genuinely new save gets a new id and is never swallowed
    // by the previous one.
    const clientCommitId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${scenarioKey}:${record.savedAt}`

    const capture = useDecisionRecordStore.getState().saveRecord(scenarioKey, record, clientCommitId)
    if (!capture) {
      saveFiredRef.current = false
      showToast(DECISION_RECORD_COPY.toastNotKept)
      return
    }

    if (typeof scenarioId !== 'string' || scenarioId === '') {
      // No persisted scenario ⇒ nothing CEE could anchor an owner to. Local
      // only, said plainly.
      close()
      showToast(copy.local)
      return
    }

    setSaving(true)
    const shared = {
      scenarioId,
      revisitTriggerOrDate: record.revisitTrigger,
      // ⚠ ADDITIVE KEYS — see the commit service's header for what today's CEE
      // does with them (reads none of them, refuses none of them) and for the
      // landing order against the reconciled CEE route.
      rationale: record.rationale,
      keyAssumption: record.assumptionToWatch,
      nextAction: record.nextAction,
      clientCommitId,
      expectedOwnerId: capture.ownerId,
      isCurrentCapture: () => useDecisionRecordStore.getState().isCurrentCapture(scenarioKey, capture),
    }
    void commitDecisionRecord(
      isNotReadyRecord(record)
        ? { ...shared, position: 'not_ready' }
        : {
            ...shared,
            chosenOptionId: record.optionId,
            chosenOptionLabel: record.optionLabel,
            // RAW 0–100 — CEE owns the /100 (no arithmetic on probabilities here).
            confidence0to100: record.confidence,
            expectationStatement: record.expectation ?? '',
          },
    ).then((result) => {
      // A different capture or account may now own this modal. An old response
      // must neither confirm its text nor close it or toast for the new user.
      if (!useDecisionRecordStore.getState().isCurrentCapture(scenarioKey, capture)) return
      setSaving(false)
      if (result.status === 'saved') {
        const promoted = useDecisionRecordStore.getState().attachRemote(scenarioKey, capture, {
          recordId: result.recordId,
          reviewDate: result.reviewDate,
          reviewDateSource: result.reviewDateSource,
          // CEE's per-field confirmation. Absent from the ack when empty, so
          // today's CEE (which sends none) leaves the ack byte-identical.
          ...(result.storedTextFields.length > 0 ? { storedTextFields: result.storedTextFields } : {}),
        })
        if (!promoted) return
        close()
        showToast(copy.saved)
        return
      }
      close()
      // Two DIFFERENT local outcomes, never merged: a guest was never going
      // to get a durable record (records require sign-in by design), while an
      // error means we tried and failed. Telling a signed-in user the guest
      // story would hide a real failure.
      showToast(result.status === 'guest' ? copy.local : copy.localAfterError)
    })
  }

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={close}
        title={DECISION_RECORD_COPY.title}
        subtitle={DECISION_RECORD_COPY.subtitle}
        titleId={titleId}
        testId="decision-record-modal"
      >
        <p
          data-testid="decision-record-note"
          className={`mt-2.5 rounded-[9px] border border-panel-border bg-panel px-[9px] py-2 ${typography.panelMeta} text-text-light`}
        >
          {persistenceNote}
        </p>

        {!hasOptions && (
          <p
            data-testid="decision-record-empty"
            className={`mt-2 ${typography.panelBody} text-text-body`}
          >
            {DECISION_RECORD_COPY.emptyState}
          </p>
        )}

        <div className="mt-[11px] grid grid-cols-2 gap-2">
          <fieldset
            className="col-span-2 m-0 flex flex-col gap-1 border-0 p-0"
            data-testid="decision-record-position"
          >
            <legend className={`${typography.panelMeta} text-text-light mb-1 p-0`}>
              {DECISION_RECORD_COPY.positionLegend}
            </legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(
                [
                  ['option', DECISION_RECORD_COPY.positionOption],
                  ['not_ready', DECISION_RECORD_COPY.positionNotReady],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`inline-flex min-h-[24px] items-center gap-1.5 ${typography.panelBody} text-text-body`}
                >
                  <input
                    type="radio"
                    name={positionName}
                    value={value}
                    data-testid={`decision-record-position-${value}`}
                    checked={position === value}
                    onChange={() => setPosition(value)}
                    disabled={!hasOptions}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p
              data-testid="decision-record-your-view"
              className={`${typography.panelMeta} text-text-light m-0`}
            >
              {DECISION_RECORD_COPY.yourViewNote}
            </p>
          </fieldset>

          {/* ⚠ HIDDEN, NOT DISABLED, for not-ready: a disabled confidence or
              expectation would still read as a question about a choice. */}
          {!notReady && (
          <>
          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={optionId}>
              {DECISION_RECORD_COPY.chosenOptionLabel}
            </FieldLabel>
            <select
              id={optionId}
              data-autofocus
              data-testid="decision-record-option"
              value={chosenOptionId}
              onChange={(e) => setChosenOptionId(e.target.value)}
              disabled={!hasOptions}
              className={FIELD_INPUT_CLASS}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number != null ? `${o.number}. ${o.label}` : o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={confidenceId}>
              {DECISION_RECORD_COPY.confidenceLabel}
            </FieldLabel>
            <input
              id={confidenceId}
              data-testid="decision-record-confidence"
              type="text"
              inputMode="numeric"
              placeholder={DECISION_RECORD_COPY.confidencePlaceholder}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confidence: true }))}
              disabled={!hasOptions}
              aria-invalid={touched.confidence === true && !confidenceValid}
              aria-describedby={
                touched.confidence === true && !confidenceValid
                  ? confidenceErrorId
                  : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <FieldError
              id={confidenceErrorId}
              show={touched.confidence === true && !confidenceValid}
            >
              {DECISION_RECORD_COPY.confidenceError}
            </FieldError>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={expectationId}>
              {DECISION_RECORD_COPY.expectationLabel}
            </FieldLabel>
            <input
              id={expectationId}
              data-testid="decision-record-expectation"
              type="text"
              placeholder={DECISION_RECORD_COPY.expectationPlaceholder}
              value={expectation}
              onChange={(e) => setExpectation(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, expectation: true }))}
              disabled={!hasOptions}
              aria-invalid={touched.expectation === true && !expectationValid}
              aria-describedby={
                touched.expectation === true && !expectationValid
                  ? expectationErrorId
                  : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <p
              data-testid="decision-record-expectation-help"
              className={`${typography.panelMeta} text-text-light`}
            >
              {DECISION_RECORD_COPY.expectationHelp}
            </p>
            <FieldError
              id={expectationErrorId}
              show={touched.expectation === true && !expectationValid}
            >
              {DECISION_RECORD_COPY.expectationError}
            </FieldError>
          </div>
          </>
          )}

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={revisitId}>{DECISION_RECORD_COPY.revisitLabel}</FieldLabel>
            <input
              id={revisitId}
              data-testid="decision-record-revisit"
              type="text"
              placeholder={DECISION_RECORD_COPY.revisitPlaceholder}
              maxLength={DECISION_RECORD_TEXT_MAX_CHARS}
              value={revisit}
              onChange={(e) => setRevisit(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, revisit: true }))}
              disabled={!hasOptions}
              aria-invalid={touched.revisit === true && !revisitValid}
              aria-describedby={
                touched.revisit === true && !revisitValid ? revisitErrorId : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <p
              data-testid="decision-record-revisit-help"
              className={`${typography.panelMeta} text-text-light`}
            >
              {revisitHelp}
            </p>
            <FieldError id={revisitErrorId} show={touched.revisit === true && !revisitValid}>
              {DECISION_RECORD_COPY.revisitError}
            </FieldError>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={rationaleId}>
              {DECISION_RECORD_COPY.rationaleLabel}
            </FieldLabel>
            <textarea
              id={rationaleId}
              data-testid="decision-record-rationale"
              rows={3}
              placeholder={
                notReady
                  ? DECISION_RECORD_COPY.notReadyRationalePlaceholder
                  : DECISION_RECORD_COPY.rationalePlaceholder
              }
              maxLength={DECISION_RECORD_TEXT_MAX_CHARS}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, rationale: true }))}
              disabled={!hasOptions}
              aria-invalid={touched.rationale === true && !rationaleValid}
              aria-describedby={
                touched.rationale === true && !rationaleValid ? rationaleErrorId : undefined
              }
              className={`${FIELD_INPUT_CLASS} min-h-[72px] resize-y`}
            />
            <FieldError
              id={rationaleErrorId}
              show={touched.rationale === true && !rationaleValid}
            >
              {DECISION_RECORD_COPY.rationaleError}
            </FieldError>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={assumptionId}>
              {DECISION_RECORD_COPY.assumptionLabel}
            </FieldLabel>
            <input
              id={assumptionId}
              data-testid="decision-record-assumption"
              type="text"
              placeholder={
                notReady
                  ? DECISION_RECORD_COPY.notReadyAssumptionPlaceholder
                  : DECISION_RECORD_COPY.assumptionPlaceholder
              }
              maxLength={DECISION_RECORD_TEXT_MAX_CHARS}
              value={assumption}
              onChange={(e) => setAssumption(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, assumption: true }))}
              disabled={!hasOptions}
              aria-invalid={touched.assumption === true && !assumptionValid}
              aria-describedby={
                touched.assumption === true && !assumptionValid
                  ? assumptionErrorId
                  : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <FieldError
              id={assumptionErrorId}
              show={touched.assumption === true && !assumptionValid}
            >
              {DECISION_RECORD_COPY.assumptionError}
            </FieldError>
          </div>

          {/* ⭐ NEXT ACTION: optional in both positions, bounded at the length
              the commit request allows. No error state: blank is a valid answer
              and `maxLength` makes an over-long one untypeable. */}
          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={nextActionId}>
              {DECISION_RECORD_COPY.nextActionLabel}
            </FieldLabel>
            <input
              id={nextActionId}
              data-testid="decision-record-next-action"
              type="text"
              placeholder={DECISION_RECORD_COPY.nextActionPlaceholder}
              maxLength={DECISION_RECORD_TEXT_MAX_CHARS}
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              disabled={!hasOptions}
              className={FIELD_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="mt-[11px] flex justify-end gap-[7px]">
          <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
            {DECISION_RECORD_COPY.cancel}
          </button>
          <button
            type="button"
            data-testid="decision-record-save"
            onClick={handleSave}
            disabled={!valid || saving}
            aria-describedby={missing.length > 0 ? missingId : undefined}
            className={PRIMARY_BUTTON_CLASS}
          >
            {saving
              ? DECISION_RECORD_COPY.saving
              : notReady
                ? DECISION_RECORD_COPY.saveNotReady
                : DECISION_RECORD_COPY.save}
          </button>
        </div>
        {missing.length > 0 ? (
          <p
            id={missingId}
            data-testid="decision-record-missing"
            className={`${typography.panelMeta} text-text-light mt-[5px] text-right`}
          >
            {DECISION_RECORD_COPY.stillNeeded(missing)}
          </p>
        ) : null}
      </ModalShell>
      {toastElement}
    </>
  )
}
