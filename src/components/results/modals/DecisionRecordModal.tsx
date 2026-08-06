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
 * Everything still lands in sessionStorage first, so a failed commit
 * degrades the record from "durable" to "on this device", never to "lost".
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
 * Mount once; open from anywhere via openDecisionRecord() (the commit
 * rec's INTENDED wiring — the spec flags the prototype's 'ask' routing as
 * a critical wiring bug not to copy).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useCanvasStore } from '../../../canvas/store'
import { commitDecisionRecord } from '../../../services/decisionRecordCommitService'
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
import { resolveScenarioKey } from './scenarioKey'
import {
  selectDecisionRecord,
  useDecisionRecordStore,
  type DecisionRecord,
} from './decisionRecordStore'

export const DECISION_RECORD_COPY = {
  title: 'Record the decision',
  subtitle: 'Capture the choice and what would justify revisiting it.',
  /**
   * ⚠ THIS NOTE USED TO SAY "Prototype only … Durable saving depends on
   * identity and Model Management." Leaving it would have been a FALSE
   * disclosure in the other direction: for a signed-in user the choice, the
   * confidence, the expectation and the review date now persist to their
   * account. The note names the split precisely rather than claiming more or
   * less than is true.
   */
  persistenceNote:
    'Your choice, confidence, expectation and review date are saved to your account. The rationale, assumption and revisit trigger stay on this device for this scenario.',
  guestNote:
    'Signed out, so this stays on this device for this scenario and ends with the browser session. Sign in to keep a durable record.',
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
    'Give a date and we set your review date to it. Give a trigger and we keep the text here and set the review date 90 days out.',
  rationaleLabel: 'Concise rationale',
  rationalePlaceholder: 'Why this is the best current choice',
  assumptionLabel: 'Key assumption to watch',
  assumptionPlaceholder: 'The assumption most likely to change the choice',
  cancel: 'Cancel',
  save: 'Record the decision',
  saving: 'Saving…',
  confidenceError: 'Add a confidence between 0 and 100.',
  expectationError: 'Add what you expect to happen.',
  rationaleError: 'Add a concise rationale.',
  assumptionError: 'Add the assumption most likely to change the choice.',
  revisitError: 'Add a revisit trigger or date.',
  toastSaved: 'Decision recorded and saved to your account.',
  toastSavedLocal: 'Decision recorded on this device.',
  toastSavedLocalAfterError:
    'Decision recorded on this device — we could not save it to your account.',
} as const

interface AnalysedOption {
  id: string
  label: string
  /** Stable number from optionNumbering, only when EVERY option has one. */
  number: number | null
}

function parseConfidence(raw: string): number {
  // NON-EMPTY strict parse — the prototype accepted '' because
  // Number('')===0; the spec flags that as a validation hole to close.
  const trimmed = raw.trim()
  return trimmed === '' ? NaN : Number(trimmed)
}

export function DecisionRecordModal() {
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

  const options = useMemo<AnalysedOption[]>(() => {
    if (resultsStatus !== 'complete') return []
    const optionNodes = nodes.filter(
      (n) =>
        n.type === 'option' ||
        (n.data as Record<string, unknown> | undefined)?.kind === 'option',
    )
    if (optionNodes.length === 0) return []
    const allNumbered = optionNodes.every((n) => numbering[n.id] != null)
    const mapped = optionNodes.map((n) => {
      const label = (n.data as Record<string, unknown> | undefined)?.label
      return {
        id: n.id,
        label: typeof label === 'string' && label.trim() !== '' ? label : n.id,
        number: allNumbered ? numbering[n.id] : null,
      }
    })
    return allNumbered
      ? [...mapped].sort((a, b) => (a.number as number) - (b.number as number))
      : mapped
  }, [nodes, resultsStatus, numbering])

  const hasOptions = options.length > 0

  const titleId = useId()
  const optionId = useId()
  const confidenceId = useId()
  const expectationId = useId()
  const revisitId = useId()
  const rationaleId = useId()
  const assumptionId = useId()
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
    if (saved) {
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
    } else {
      setChosenOptionId(options[0]?.id ?? '')
      setConfidence('')
      setExpectation('')
      setRevisit('')
      setRationale('')
      setAssumption('')
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
  const valid =
    hasOptions &&
    chosenOption !== null &&
    confidenceValid &&
    expectationValid &&
    revisitValid &&
    rationaleValid &&
    assumptionValid

  const handleSave = () => {
    if (!valid || chosenOption === null) {
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
    const record: DecisionRecord = {
      optionId: chosenOption.id,
      optionLabel: chosenOption.label,
      optionNumber: chosenOption.number,
      confidence: parsedConfidence,
      expectation: expectation.trim(),
      rationale: rationale.trim(),
      assumptionToWatch: assumption.trim(),
      revisitTrigger: revisit.trim(),
      analysisHash,
      savedAt: Date.now(),
      remote: null,
    }
    // LOCAL FIRST, ALWAYS. Whatever happens on the network, the user's input
    // is already kept — a failed commit degrades the record from "durable" to
    // "on this device", never to "lost".
    useDecisionRecordStore.getState().saveRecord(scenarioKey, record)

    // A stable per-save id: a retry of THIS save replays through CEE's dedupe
    // branch, while a genuinely new save gets a new id and is never swallowed
    // by the previous one.
    const clientCommitId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${scenarioKey}:${record.savedAt}`

    if (typeof scenarioId !== 'string' || scenarioId === '') {
      // No persisted scenario ⇒ nothing CEE could anchor an owner to. Local
      // only, said plainly.
      close()
      showToast(DECISION_RECORD_COPY.toastSavedLocal)
      return
    }

    setSaving(true)
    void commitDecisionRecord({
      scenarioId,
      chosenOptionId: chosenOption.id,
      chosenOptionLabel: chosenOption.label,
      // RAW 0–100 — CEE owns the /100 (no arithmetic on probabilities here).
      confidence0to100: parsedConfidence,
      expectationStatement: record.expectation ?? '',
      revisitTriggerOrDate: record.revisitTrigger,
      clientCommitId,
    }).then((result) => {
      setSaving(false)
      if (result.status === 'saved') {
        useDecisionRecordStore.getState().attachRemote(scenarioKey, {
          recordId: result.recordId,
          reviewDate: result.reviewDate,
          reviewDateSource: result.reviewDateSource,
        })
        close()
        showToast(DECISION_RECORD_COPY.toastSaved)
        return
      }
      close()
      // Two DIFFERENT local outcomes, never merged: a guest was never going
      // to get a durable record (records require sign-in by design), while an
      // error means we tried and failed. Telling a signed-in user the guest
      // story would hide a real failure.
      showToast(
        result.status === 'guest'
          ? DECISION_RECORD_COPY.toastSavedLocal
          : DECISION_RECORD_COPY.toastSavedLocalAfterError,
      )
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
          className={`mt-[10px] rounded-[9px] border border-panel-border bg-panel px-[9px] py-2 ${typography.panelMeta} text-text-light`}
        >
          {DECISION_RECORD_COPY.persistenceNote}
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

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={revisitId}>{DECISION_RECORD_COPY.revisitLabel}</FieldLabel>
            <input
              id={revisitId}
              data-testid="decision-record-revisit"
              type="text"
              placeholder={DECISION_RECORD_COPY.revisitPlaceholder}
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
              {DECISION_RECORD_COPY.revisitHelp}
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
              placeholder={DECISION_RECORD_COPY.rationalePlaceholder}
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
              placeholder={DECISION_RECORD_COPY.assumptionPlaceholder}
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
            className={PRIMARY_BUTTON_CLASS}
          >
            {saving ? DECISION_RECORD_COPY.saving : DECISION_RECORD_COPY.save}
          </button>
        </div>
      </ModalShell>
      {toastElement}
    </>
  )
}
