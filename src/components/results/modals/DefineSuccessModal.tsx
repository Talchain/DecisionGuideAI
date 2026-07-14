/**
 * Define-success modal (prototype #successModal, build-ready v6).
 *
 * The single success-measure flow: metric / direction / threshold / unit /
 * timeframe / optional baseline, with a live assembled-sentence preview
 * (authored shape — see measureSentence.ts) and field-level validation
 * (brief §7.3: inline 11px danger errors + disabled Save — NEVER the hero
 * editor's silent no-op on invalid input).
 *
 * Save persists the FULL structured measure per scenario
 * (successMeasureStore, sessionStorage) and commits the numeric threshold
 * through the EXISTING canonical path — ONE setter
 * (useCanvasStore.setGoalThreshold) + ONE rerun (executeCanonicalRun with
 * the same source/parameters convention as OutputsDock.handleApplyThreshold)
 * — never a second rerun pipeline.
 *
 * HONESTY: only the threshold number reaches the analysis today
 * (UI-SEM-058 raw/cap). Direction, metric, timeframe and baseline are
 * captured for display/record only, and the modal says so.
 *
 * Mount once (e.g. next to AskOlumiDrawer); open from anywhere via
 * openDefineSuccess().
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { executeCanonicalRun } from '../../../canvas/analysis/canonicalRunRegistry'
import { capForUnit, resolveChipGoalThreshold, resolveActiveGoalNodeId } from '../../../canvas/hooks/useV2Run'
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
import {
  buildMeasureSentence,
  DIRECTION_OPTIONS,
  UNIT_OPTIONS,
} from './measureSentence'
import { resolveScenarioKey } from './scenarioKey'
import {
  selectSuccessMeasure,
  useSuccessMeasureStore,
  type SuccessDirection,
  type SuccessMeasure,
} from './successMeasureStore'

export const DEFINE_SUCCESS_COPY = {
  title: 'Define success',
  subtitle:
    'Keep the goal in plain language, then give Olumi a measurable test for Goal fit.',
  metricLabel: 'What outcome should improve?',
  directionLabel: 'Direction',
  thresholdLabel: 'Threshold',
  thresholdPlaceholder: '20',
  unitLabel: 'Unit',
  timeframeLabel: 'Timeframe',
  timeframePlaceholder: 'Within 6 months',
  baselineLabel: 'Baseline or evidence, optional',
  baselinePlaceholder: 'Current productivity or source',
  writeNote:
    'This updates the analysis success measure and reruns the analysis. It does not change the graph structure.',
  honestyNote: 'Only the target number affects the analysis today.',
  cancel: 'Cancel',
  save: 'Save and rerun',
  metricError: 'Add the outcome that should improve.',
  thresholdError: 'Add a number so Olumi can evaluate Goal fit.',
  timeframeError: 'Add a timeframe so Olumi can evaluate Goal fit.',
  toastSaved: 'Success measure saved. Rerunning analysis with the current model.',
  // Lane 1b (V-P0-1): when the threshold cannot be proven normalisable (non-%
  // unit, no producer/node scale), the parameter is omitted from the rerun —
  // the user must hear that honestly, not a plain "saved".
  toastSavedNoScale:
    'Success measure saved. The analysis cannot use this target yet — the measure has no known scale.',
  toastAlreadyRunning:
    'Success measure saved. Analysis is already running; your target applies on the next run.',
} as const

function parseThreshold(raw: string): number {
  // STRICT parse (write-boundary gate, same as the hero editor): empty,
  // partial or trailing-junk input ("", "20%", "abc") must never reach the
  // canonical apply route — Number() rejects anything that is not a complete
  // numeric literal. Negatives are legitimate (outcomes can be losses).
  const trimmed = raw.trim()
  return trimmed === '' ? NaN : Number(trimmed)
}

export function DefineSuccessModal() {
  const isOpen = useSuccessMeasureStore((s) => s.isOpen)
  const close = useSuccessMeasureStore((s) => s.close)
  const { showToast, toastElement } = useModalToast('define-success-toast')

  const titleId = useId()
  const metricId = useId()
  const directionId = useId()
  const thresholdId = useId()
  const unitId = useId()
  const timeframeId = useId()
  const baselineId = useId()
  const metricErrorId = useId()
  const thresholdErrorId = useId()
  const timeframeErrorId = useId()

  const [metric, setMetric] = useState('')
  const [direction, setDirection] = useState<SuccessDirection>('increase_by_at_least')
  const [threshold, setThreshold] = useState('')
  const [unit, setUnit] = useState<string>(UNIT_OPTIONS[0])
  const [timeframe, setTimeframe] = useState('')
  const [baseline, setBaseline] = useState('')
  const [touched, setTouched] = useState<{
    metric?: boolean
    threshold?: boolean
    timeframe?: boolean
  }>({})
  // Double-fire guard: one canonical commit per save (reset on each open).
  const saveFiredRef = useRef(false)

  // Hydrate on open: a previously saved measure wins (reopening keeps
  // values, per spec); otherwise the metric prefills from the live goal
  // node's label (NOT the prototype's 'Productivity' fixture) and the
  // threshold from the committed store value when one exists.
  useEffect(() => {
    if (!isOpen) return
    saveFiredRef.current = false
    const canvas = useCanvasStore.getState()
    const scenarioKey = resolveScenarioKey(canvas.currentScenarioId)
    const saved = selectSuccessMeasure(useSuccessMeasureStore.getState(), scenarioKey)
    if (saved) {
      setMetric(saved.metric)
      setDirection(saved.direction)
      setThreshold(String(saved.threshold))
      setUnit(saved.unit)
      setTimeframe(saved.timeframe)
      setBaseline(saved.baseline ?? '')
    } else {
      const goalNode = canvas.nodes.find(
        (n) =>
          n.type === 'goal' ||
          (n.data as Record<string, unknown> | undefined)?.type === 'goal',
      )
      const label = (goalNode?.data as Record<string, unknown> | undefined)?.label
      setMetric(typeof label === 'string' ? label : '')
      setDirection('increase_by_at_least')
      setThreshold(canvas.goalThreshold != null ? String(canvas.goalThreshold) : '')
      setUnit(UNIT_OPTIONS[0])
      setTimeframe('')
      setBaseline('')
    }
    setTouched({})
  }, [isOpen])

  const parsedThreshold = parseThreshold(threshold)
  const metricValid = metric.trim() !== ''
  const thresholdValid = Number.isFinite(parsedThreshold)
  const timeframeValid = timeframe.trim() !== ''
  const valid = metricValid && thresholdValid && timeframeValid

  const sentence = useMemo(
    () => buildMeasureSentence({ metric, direction, threshold, unit, timeframe }),
    [metric, direction, threshold, unit, timeframe],
  )

  // A saved unit from an older session may not be in the fixed option list —
  // keep it selectable rather than silently swapping the user's unit.
  const unitOptions = UNIT_OPTIONS.includes(unit) ? UNIT_OPTIONS : [unit, ...UNIT_OPTIONS]

  const handleSave = () => {
    // Belt-and-braces: Save is disabled while invalid, but this guard makes
    // silent-close structurally impossible even if the disabled state is
    // bypassed (e.g. programmatic click).
    if (!valid) {
      setTouched({ metric: true, threshold: true, timeframe: true })
      return
    }
    if (saveFiredRef.current) return
    saveFiredRef.current = true

    const canvas = useCanvasStore.getState()
    const scenarioKey = resolveScenarioKey(canvas.currentScenarioId)
    const measure: SuccessMeasure = {
      metric: metric.trim(),
      direction,
      threshold: parsedThreshold,
      unit,
      timeframe: timeframe.trim(),
      baseline: baseline.trim() === '' ? null : baseline.trim(),
      savedAt: Date.now(),
    }
    useSuccessMeasureStore.getState().saveMeasure(scenarioKey, measure)

    // Codex final-audit B2 — atomic commit: write the raw user-unit threshold
    // to the store AND the goal node's data in one action, so the goal node
    // stops showing "target missing" after a save (the bare setGoalThreshold
    // updated only the global value, leaving the node stale). Falls back to
    // the global-only setter when no goal node is resolvable. Lane 5: the ONE
    // shared, existence-validated resolver (never commits to a stale id).
    const goalNodeId = resolveActiveGoalNodeId(canvas)
    if (goalNodeId) {
      canvas.setGoalThresholdAndUpdateNode(goalNodeId, parsedThreshold)
    } else {
      canvas.setGoalThreshold(parsedThreshold)
    }
    // Codex final-audit B3 — the canonical/V5 chip must carry the NORMALISED
    // 0-1 threshold (buildPayload forwards chip params verbatim; a raw value
    // is silently ignored by PLoT). The cap resolves against the SAME node
    // the threshold was just committed to (test-practice audit: this
    // previously used store.outcomeNodeId — a different resolution from the
    // B2 commit three lines up, so a divergent outcomeNodeId dropped the
    // cap). UI-SEM-081: the user's own unit is the last-resort cap ("%" is
    // definitionally out of 100 — live drafts carry no producer/node scale).
    // OMIT when normalisation still can't be proven — fail closed, never raw.
    const normalisedThreshold = resolveChipGoalThreshold(parsedThreshold, {
      analysisReady: canvas.ceeAnalysisReady,
      nodes: canvas.nodes,
      goalNodeId,
      unitCap: capForUnit(unit),
    })
    close()
    void executeCanonicalRun({
      source: 'define-success-modal',
      ...(normalisedThreshold !== undefined
        ? { parameters: { goal_threshold: normalisedThreshold } }
        : {}),
    }).then((outcome) => {
      if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
        // The measure IS saved — say so, then the honest gate reason.
        showToast(`Success measure saved. ${outcome.reason}`)
      } else if (outcome.status === 'already-running') {
        showToast(DEFINE_SUCCESS_COPY.toastAlreadyRunning)
      } else if (normalisedThreshold === undefined) {
        // Lane 1b honesty: the rerun happened but WITHOUT the target — the
        // analysis never sees it (V-P0-1). Never imply otherwise.
        showToast(DEFINE_SUCCESS_COPY.toastSavedNoScale)
      } else {
        showToast(DEFINE_SUCCESS_COPY.toastSaved)
      }
    })
  }

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={close}
        title={DEFINE_SUCCESS_COPY.title}
        subtitle={DEFINE_SUCCESS_COPY.subtitle}
        titleId={titleId}
        testId="define-success-modal"
      >
        <div className="mt-[11px] grid grid-cols-2 gap-2">
          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={metricId}>{DEFINE_SUCCESS_COPY.metricLabel}</FieldLabel>
            <input
              id={metricId}
              data-autofocus
              data-testid="define-success-metric"
              type="text"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, metric: true }))}
              aria-invalid={touched.metric === true && !metricValid}
              aria-describedby={
                touched.metric === true && !metricValid ? metricErrorId : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <FieldError id={metricErrorId} show={touched.metric === true && !metricValid}>
              {DEFINE_SUCCESS_COPY.metricError}
            </FieldError>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={directionId}>
              {DEFINE_SUCCESS_COPY.directionLabel}
            </FieldLabel>
            <select
              id={directionId}
              data-testid="define-success-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as SuccessDirection)}
              className={FIELD_INPUT_CLASS}
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={thresholdId}>
              {DEFINE_SUCCESS_COPY.thresholdLabel}
            </FieldLabel>
            <input
              id={thresholdId}
              data-testid="define-success-threshold"
              type="text"
              inputMode="decimal"
              placeholder={DEFINE_SUCCESS_COPY.thresholdPlaceholder}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, threshold: true }))}
              aria-invalid={touched.threshold === true && !thresholdValid}
              aria-describedby={
                touched.threshold === true && !thresholdValid ? thresholdErrorId : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <FieldError
              id={thresholdErrorId}
              show={touched.threshold === true && !thresholdValid}
            >
              {DEFINE_SUCCESS_COPY.thresholdError}
            </FieldError>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={unitId}>{DEFINE_SUCCESS_COPY.unitLabel}</FieldLabel>
            <select
              id={unitId}
              data-testid="define-success-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={FIELD_INPUT_CLASS}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={timeframeId}>
              {DEFINE_SUCCESS_COPY.timeframeLabel}
            </FieldLabel>
            <input
              id={timeframeId}
              data-testid="define-success-timeframe"
              type="text"
              placeholder={DEFINE_SUCCESS_COPY.timeframePlaceholder}
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, timeframe: true }))}
              aria-invalid={touched.timeframe === true && !timeframeValid}
              aria-describedby={
                touched.timeframe === true && !timeframeValid ? timeframeErrorId : undefined
              }
              className={FIELD_INPUT_CLASS}
            />
            <FieldError
              id={timeframeErrorId}
              show={touched.timeframe === true && !timeframeValid}
            >
              {DEFINE_SUCCESS_COPY.timeframeError}
            </FieldError>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <FieldLabel htmlFor={baselineId}>
              {DEFINE_SUCCESS_COPY.baselineLabel}
            </FieldLabel>
            <input
              id={baselineId}
              data-testid="define-success-baseline"
              type="text"
              placeholder={DEFINE_SUCCESS_COPY.baselinePlaceholder}
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              className={FIELD_INPUT_CLASS}
            />
          </div>
        </div>

        {/* Live assembled-sentence preview — goal-yellow outlined box
            (border-only colour treatment per DS; bg stays panel). */}
        <p
          data-testid="measure-preview"
          className={`mt-[9px] rounded-[9px] border border-goal bg-panel px-[9px] py-2 ${typography.panelBody} text-text-body`}
        >
          {sentence}
        </p>

        <p className={`mt-[7px] ${typography.panelMeta} text-text-light`}>
          {DEFINE_SUCCESS_COPY.writeNote}
        </p>
        <p
          data-testid="define-success-honesty-note"
          className={`mt-1 ${typography.panelMeta} text-text-light`}
        >
          {DEFINE_SUCCESS_COPY.honestyNote}
        </p>

        <div className="mt-[11px] flex justify-end gap-[7px]">
          <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
            {DEFINE_SUCCESS_COPY.cancel}
          </button>
          <button
            type="button"
            data-testid="define-success-save"
            onClick={handleSave}
            disabled={!valid}
            className={PRIMARY_BUTTON_CLASS}
          >
            {DEFINE_SUCCESS_COPY.save}
          </button>
        </div>
      </ModalShell>
      {toastElement}
    </>
  )
}
