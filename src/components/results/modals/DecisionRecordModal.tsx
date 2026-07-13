/**
 * Record-the-decision modal (prototype #decisionModal, build-ready v6).
 *
 * Captures chosen option / confidence 0-100 / concise rationale / key
 * assumption to watch / revisit trigger-or-date into decisionRecordStore
 * (sessionStorage, scenario-keyed, with the analysed graph hash). The
 * chosen-option select is populated READ-ONLY from the live analysed
 * option set (canvas option nodes + the stable optionNumbering map) —
 * never the prototype's four hardcoded fixtures.
 *
 * Fail-closed: with no completed analysis or zero option nodes the form
 * renders disabled with honest copy — capture never fabricates an option
 * set. Validation closes the prototype's Number('')===0 hole: confidence
 * must be NON-EMPTY, finite and 0-100 inclusive.
 *
 * HONESTY: no backend persistence exists (blocked on identity + Model
 * Management) — the note line says the record lives on this device for
 * this scenario.
 *
 * Mount once; open from anywhere via openDecisionRecord() (the commit
 * rec's INTENDED wiring — the spec flags the prototype's 'ask' routing as
 * a critical wiring bug not to copy).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useCanvasStore } from '../../../canvas/store'
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
  prototypeNote:
    'Prototype only. Saved on this device for this scenario. Durable saving depends on identity and Model Management.',
  emptyState:
    'Run an analysis first. There are no analysed options to record a decision against yet.',
  chosenOptionLabel: 'Chosen option',
  confidenceLabel: 'Confidence, 0–100',
  confidencePlaceholder: 'e.g. 70',
  revisitLabel: 'Revisit trigger or date',
  revisitPlaceholder: 'e.g. runway falls below 9 months',
  rationaleLabel: 'Concise rationale',
  rationalePlaceholder: 'Why this is the best current choice',
  assumptionLabel: 'Key assumption to watch',
  assumptionPlaceholder: 'The assumption most likely to change the choice',
  cancel: 'Cancel',
  save: 'Capture prototype record',
  confidenceError: 'Add a confidence between 0 and 100.',
  rationaleError: 'Add a concise rationale.',
  assumptionError: 'Add the assumption most likely to change the choice.',
  revisitError: 'Add a revisit trigger or date.',
  toastSaved: 'Prototype decision record captured in this session.',
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
  const revisitId = useId()
  const rationaleId = useId()
  const assumptionId = useId()
  const confidenceErrorId = useId()
  const revisitErrorId = useId()
  const rationaleErrorId = useId()
  const assumptionErrorId = useId()

  const [chosenOptionId, setChosenOptionId] = useState('')
  const [confidence, setConfidence] = useState('')
  const [revisit, setRevisit] = useState('')
  const [rationale, setRationale] = useState('')
  const [assumption, setAssumption] = useState('')
  const [touched, setTouched] = useState<{
    confidence?: boolean
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
    const scenarioKey = resolveScenarioKey(useCanvasStore.getState().currentScenarioId)
    const saved = selectDecisionRecord(useDecisionRecordStore.getState(), scenarioKey)
    if (saved) {
      setChosenOptionId(
        options.some((o) => o.id === saved.optionId) ? saved.optionId : options[0]?.id ?? '',
      )
      setConfidence(String(saved.confidence))
      setRevisit(saved.revisitTrigger)
      setRationale(saved.rationale)
      setAssumption(saved.assumptionToWatch)
    } else {
      setChosenOptionId(options[0]?.id ?? '')
      setConfidence('')
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
  const revisitValid = revisit.trim() !== ''
  const rationaleValid = rationale.trim() !== ''
  const assumptionValid = assumption.trim() !== ''
  const chosenOption = options.find((o) => o.id === chosenOptionId) ?? null
  const valid =
    hasOptions &&
    chosenOption !== null &&
    confidenceValid &&
    revisitValid &&
    rationaleValid &&
    assumptionValid

  const handleSave = () => {
    if (!valid || chosenOption === null) {
      setTouched({ confidence: true, revisit: true, rationale: true, assumption: true })
      return
    }
    if (saveFiredRef.current) return
    saveFiredRef.current = true

    const scenarioKey = resolveScenarioKey(useCanvasStore.getState().currentScenarioId)
    const record: DecisionRecord = {
      optionId: chosenOption.id,
      optionLabel: chosenOption.label,
      optionNumber: chosenOption.number,
      confidence: parsedConfidence,
      rationale: rationale.trim(),
      assumptionToWatch: assumption.trim(),
      revisitTrigger: revisit.trim(),
      analysisHash,
      savedAt: Date.now(),
    }
    useDecisionRecordStore.getState().saveRecord(scenarioKey, record)
    close()
    showToast(DECISION_RECORD_COPY.toastSaved)
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
          {DECISION_RECORD_COPY.prototypeNote}
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

          <div className="flex flex-col gap-1">
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
            disabled={!valid}
            className={PRIMARY_BUTTON_CLASS}
          >
            {DECISION_RECORD_COPY.save}
          </button>
        </div>
      </ModalShell>
      {toastElement}
    </>
  )
}
