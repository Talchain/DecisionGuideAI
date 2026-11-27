import { controls } from '../../../styles/controls'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { typography } from '../../../styles/typography'
import { TeamApiError } from '../../../olumiCore/team/api'
import type { View, ViewCard, ViewModel, ViewRow } from '../../client'
import { FigureEdit } from '../../FigureEdit'
import { FoldChevron, FOLD_SUMMARY } from '../../look/FoldChevron'
import { Hover } from '../../look/Hover'
import { resultFigureCardsOf } from './stressFigures'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { chanceForDots } from '../../resultRange'
import { shownModel, useViewStore } from '../../store'
import { optionLetters } from '../cards/letters'
import { LetterChip } from '../cards/marks'
import { figureRange } from '../contract'
import { cardOfRecord } from '../lenses/layers'
import { ChanceDots } from '../scale/ChanceDots'
import { RangeBar } from '../scale/RangeBar'
import { useFocusSubject } from '../../focus/subject'
import { stressTrialKey, tryStressValue, useStressTrials, type TrialStep } from './stressTrials'

export const STRESS_STEPS = { low: 'Lower values', saved: 'As saved', high: 'Higher values' } as const

export const STRESS_WORDS = {
  figure: 'Figure',
  values: 'Figure values',
  empty: 'Stress-testing needs a worked-out chance first.',
  held: 'Stress-test starts once a version is approved.',
  unavailable: 'The latest results could not be read.',
  details: 'How these were worked out',
  other: 'Olumi tested this against another figure',
  none: 'Olumi names no figure for this option here',
  savedLabel: 'As saved',
  tryValue: 'Try a value',
  try: 'Try',
  trying: 'Trying…',
  trialUnavailable: 'This trial could not be read.',
  fill: 'Fill figure',
} as const

type BaseStep = keyof typeof STRESS_STEPS
type Step = BaseStep | TrialStep
type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
type OptionReading = { option: ViewCard; row: ChanceRow }
type DriverFigure = { record: string; label: string; card: ViewCard; ordinal?: number }

const STEPS: readonly BaseStep[] = ['low', 'saved', 'high']
const RING_SOURCE = 'tool-stress'
const META = `${typography.viewPanelMeta} text-text-light`
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
const MOTION = 'motion-safe:transition-colors motion-safe:duration-fast'
const DOT_MOTION = 'motion-safe:[&_[data-chance-dot]]:transition-colors motion-safe:[&_[data-chance-dot]]:duration-fast'
const TICK_MOTION = 'motion-safe:[&_.ok-scale-tried]:transition-[left] motion-safe:[&_.ok-scale-tried]:duration-fast'

function TrialForm({ scope, pending, isCurrent, onTrial }: {
  scope: Parameters<typeof tryStressValue>[0]; pending: boolean; isCurrent: () => boolean; onTrial: (step: TrialStep) => void
}) {
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const id = useId()

  async function submit() {
    if (pending || typed.trim() === '') return
    setNotice(null)
    try {
      const result = await tryStressValue(scope, typed, isCurrent)
      if (!isCurrent()) return
      if (result !== null && 'step' in result) {
        setTyped('')
        onTrial(result.step)
      } else setNotice(result?.notice ?? STRESS_WORDS.trialUnavailable)
    } catch (error) {
      if (isCurrent()) setNotice(error instanceof TeamApiError ? error.message : STRESS_WORDS.trialUnavailable)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="grid gap-1">
      <label htmlFor={id} className={META}>{STRESS_WORDS.tryValue}</label>
      <div className="flex gap-1">
        <input id={id} value={typed} readOnly={pending} onChange={(event) => setTyped(event.target.value)}
          className={`${typography.viewPanelBody} ${FOCUS} min-h-7 min-w-0 grow rounded-sm border border-panel-border bg-panel px-2 text-text-body`} />
        <button type="submit" disabled={pending || typed.trim() === ''}
          className={`${controls.chipText} ${FOCUS} ${MOTION} border border-panel-border text-text-header hover:bg-panel-hover disabled:text-text-light`}>
          {pending ? STRESS_WORDS.trying : STRESS_WORDS.try}
        </button>
      </div>
      {notice !== null && <span role="status" className={META}>{notice}</span>}
    </form>
  )
}

function stressReadings(model: ViewModel) {
  const aims = new Map<string, OptionReading[]>()
  const records = new Set<string>()
  for (const option of model.cards) {
    if (option.family !== 'option') continue
    for (const row of option.rows) {
      if (row.kind !== 'chance') continue
      const group = aims.get(row.aim_id) ?? []
      group.push({ option, row })
      aims.set(row.aim_id, group)
      if (row.driver != null) records.add(row.driver.figure)
    }
  }

  // Badge records are IDs only. A folded record can take its own label from Core's results.
  const run = model.run
  const namedFigures = [
    ...(run?.rests ?? []).flatMap((rest) => rest.figures ?? []),
    ...(run?.tipping ?? []).map((tip) => tip.figure),
    ...(run?.failure ?? []).flatMap((failure) => failure.figures),
    ...(run?.find_out ?? []).flatMap((aim) => aim.figures),
  ]
  const figures: DriverFigure[] = []
  const counts = new Map<string, number>()
  let unlabelled = 0
  for (const record of records) {
    const card = cardOfRecord(model, record)
    if (card === undefined) continue
    const label = card.id === record ? card.heading : namedFigures.find((figure) => figure.id === record && figure.label)?.label
    if (!label) unlabelled += 1
    figures.push({ record, label: label || card.heading, card })
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
  }
  const order = new Map(model.cards.map((card, index) => [card.id, index] as const))
  const recordOrder = ({ card, record }: DriverFigure) => card.id === record ? -1 : card.badge!.records.indexOf(record)
  figures.sort((a, b) => order.get(a.card.id)! - order.get(b.card.id)! || recordOrder(a) - recordOrder(b))
  const ordinals = new Map<string, number>()
  for (const figure of figures) {
    const { id } = figure.card
    if (counts.get(id)! < 2) continue
    figure.ordinal = (ordinals.get(id) ?? 0) + 1
    ordinals.set(id, figure.ordinal)
  }
  return { aims, figures, unlabelled }
}

export function StressTest({ model, view }: { model: ViewModel; view: View }) {
  const { aims, figures, unlabelled } = useMemo(() => stressReadings(model), [model])
  const letters = useMemo(() => optionLetters(model), [model])
  const subject = useFocusSubject()
  const subjectId = subject?.source === 'canvas' ? subject.id : undefined
  const subjectRecord = (figures.find((figure) => figure.record === subjectId) ??
    figures.find((figure) => figure.card.id === subjectId))?.record
  const [record, setRecord] = useState<string>()
  const [choice, setChoice] = useState<{ step: Step; scope?: string }>({ step: 'saved' })
  const aimHeading = useId()
  const stepButtons = useRef(new Map<Step, HTMLButtonElement>())
  const subjectObserved = useRef(false)
  const held = view.proposal != null
  const selected = held ? undefined : figures.find((figure) => figure.record === record) ?? figures[0]
  const selectedRecord = selected?.record
  const base = model.edit_base ?? view.version?.id
  const scope = base == null || selectedRecord === undefined ? null
    : { sid: view.id, base, record: selectedRecord }
  const scopeKey = scope === null ? null : stressTrialKey(scope)
  const activeScope = useRef<string | null>(null)
  const history = useStressTrials((state) => scopeKey === null ? undefined : state.histories.get(scopeKey))
  const trials = history?.trials ?? []
  const selectedTrial = choice.scope === scopeKey ? trials.find((trial) => trial.step === choice.step) : undefined
  const step = selectedTrial?.step ?? (choice.scope === undefined ? choice.step : 'saved')
  const points = [
    ...STEPS.map((value) => ({ step: value, words: STRESS_STEPS[value] })),
    ...trials,
  ]
  const moving = useMemo(() => selectedRecord === undefined ? [] : [...aims].flatMap(([id, readings]) => {
    const rows = readings.filter(({ row }) => row.driver?.figure === selectedRecord)
    return rows.length === 0 ? [] : [{ id, aim: readings[0].row.aim, rows }]
  }), [aims, selectedRecord])

  useEffect(() => {
    if (record !== selectedRecord) setRecord(selectedRecord)
  }, [record, selectedRecord])
  useEffect(() => {
    if (subjectRecord !== undefined) {
      setRecord(subjectRecord)
      setChoice({ step: 'saved' })
      if (subjectObserved.current) stepButtons.current.get('saved')?.focus()
    }
    subjectObserved.current = true
  }, [subjectId, subjectRecord])
  useLayoutEffect(() => {
    activeScope.current = scopeKey
    return () => { activeScope.current = null }
  }, [scopeKey])
  useEffect(() => {
    const ids = new Set<string>()
    if (selected !== undefined) ids.add(selected.card.id)
    for (const group of moving) for (const { option } of group.rows) ids.add(option.id)
    ringFrom(RING_SOURCE, [...ids])
  }, [selected, moving])
  useEffect(() => () => ringFrom(RING_SOURCE, []), [])

  function chooseStep(value: Step) {
    const scope = value.startsWith('trial-') ? scopeKey ?? undefined : undefined
    setChoice((current) => current.step === value && current.scope === scope ? current : { step: value, scope })
  }

  function moveStep(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const { key } = event
    const direction = key === 'ArrowRight' || key === 'ArrowDown' ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const next = points[(index + direction + points.length) % points.length].step
    chooseStep(next)
    stepButtons.current.get(next)?.focus()
  }

  if (selected === undefined) {
    if (held && figures.length > 0) return <div className={META}>{STRESS_WORDS.held}</div>
    const resultFigures = resultFigureCardsOf(model, view)
    return (
      <div data-form="TT-stress" data-testid="tool-stress" data-stress-unlabelled={unlabelled}>
        {resultFigures.length === 0 ? <span className={META}>{STRESS_WORDS.empty}</span>
          : <ul role="list" className="m-0 grid list-none grid-cols-3 gap-2 p-0">
            {resultFigures.map((card) => {
              const { figure } = card
              const range = figureRange(card)
              const unknown = figure == null || figure.state === 'waits' || (figure.text === '' && range === null)
              return (
                <li key={card.id} className="col-span-3 grid grid-cols-subgrid items-center"
                  onMouseEnter={() => ringFrom(RING_SOURCE, [card.id])} onMouseLeave={() => ringFrom(RING_SOURCE, [])}
                  onFocus={() => ringFrom(RING_SOURCE, [card.id])} onBlur={() => ringFrom(RING_SOURCE, [])}>
                  <span className={`${typography.viewPanelHeading} break-words text-text-header`}>{card.heading}</span>
                  {unknown ? (
                    <>
                      <span aria-hidden="true" className="ok-face-mark ok-face-mark-track" />
                      {figure?.edit != null && <FigureEdit id={card.id} edit={figure.edit} label={STRESS_WORDS.fill} place="tool-stress" />}
                    </>
                  ) : range !== null ? <RangeBar card={card} view={model} showFlat />
                    : <Hover words={figure.title} className={`${META} col-start-3 min-w-0 break-words`}>{figure.text}</Hover>}
                </li>
              )
            })}
          </ul>}
      </div>
    )
  }

  const figureCard = selected.record === selected.card.id ? selected.card : undefined
  return (
    <div data-form="TT-stress" data-testid="tool-stress" data-stress-unlabelled={unlabelled} className="grid min-w-0 gap-3">
      <div role="group" aria-label={STRESS_WORDS.figure} className="flex flex-wrap gap-1">
        {figures.map(({ record, label, ordinal }) => (
          <button key={record} type="button" aria-pressed={selected.record === record} onClick={() => setRecord(record)}
            className={`${controls.chipText} ${FOCUS} ${MOTION} inline-flex min-w-0 items-center gap-1 border border-panel-border text-left text-text-header hover:bg-panel-hover aria-pressed:bg-panel-hover aria-pressed:border-text-header`}>
            <span className="min-w-0 break-words">{label}</span>
            {ordinal !== undefined && <span data-stress-ordinal="" className={`${META} shrink-0 rounded-full border border-panel-border px-1`}>{ordinal}</span>}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label={STRESS_WORDS.values} className="grid grid-cols-3 gap-1 rounded-md border border-panel-border p-1">
        {points.map(({ step: value, words }, index) => (
          <button key={value} type="button" role="radio" aria-checked={step === value} tabIndex={step === value ? 0 : -1}
            ref={(button) => { if (button === null) stepButtons.current.delete(value); else stepButtons.current.set(value, button) }}
            onClick={() => chooseStep(value)} onKeyDown={(event) => moveStep(event, index)}
            className={`${controls.chipText} ${FOCUS} ${MOTION} font-medium cursor-pointer break-words border border-transparent text-text-body hover:bg-panel-hover aria-checked:border-panel-border aria-checked:bg-panel-hover aria-checked:text-text-header`}>
            {words}
          </button>
        ))}
      </div>
      {scope !== null && model.edit_base != null && (
        <TrialForm key={scopeKey} scope={scope} pending={history?.pending === true}
          isCurrent={() => activeScope.current === scopeKey}
          onTrial={(value) => setChoice((current) => current === choice ? { step: value, scope: scopeKey ?? undefined } : current)} />
      )}

      {figureCard?.figure != null && (
        <div className={`grid auto-cols-fr grid-flow-col items-center gap-2 ${TICK_MOTION}`}>
          <RangeBar card={figureCard} view={view} tried={selectedTrial?.tried} />
          <Hover words={figureCard.figure.title} className={`${META} min-w-0 break-words`}>{figureCard.figure.text}</Hover>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_max-content_minmax(0,1fr)] gap-x-2 gap-y-1">
        {[...aims].map(([aimId, readings], index) => (
          <div key={aimId} role="group" aria-labelledby={`${aimHeading}-${index}`} className="col-span-3 grid grid-cols-subgrid gap-y-1">
            <h3 id={`${aimHeading}-${index}`} className={`${typography.viewPanelHeading} col-span-3 m-0 mt-2 text-text-header`}>{readings[0].row.aim}</h3>
            {readings.map(({ option, row }) => {
              const driver = row.driver
              const computed = driver == null ? 'none' : driver.figure === selected.record ? 'true' : 'other'
              const saved = chanceForDots(row)
              const fact = selectedTrial?.variant.facts?.find(({ about }) =>
                about?.kind === 'chance' && about.option === option.id && about.goal === aimId)
              const chance = computed !== 'true' || driver == null ? null
                : step === 'saved' ? saved
                : step === 'low' || step === 'high' ? driver[step]
                : fact?.about?.chance ?? null
              return (
                <Hover key={option.id} as="button" type="button"
                  words={computed === 'true' ? undefined : STRESS_WORDS[computed]}
                  onClick={() => pressCard(option.id)}
                  data-stress-computed={computed} data-stress-chance={chance ?? undefined}
                  className={`${controls.chipText} ${FOCUS} ${MOTION} col-span-3 grid cursor-pointer grid-cols-subgrid items-center text-left hover:bg-panel-hover`}>
                  <span className="flex min-w-0 items-center gap-1 text-text-header">
                    <span className="olumi-look contents" aria-hidden="true"><LetterChip letter={letters.get(option.id)!} /></span>
                    <span className="min-w-0 break-words">{option.heading}</span>
                  </span>
                  {computed === 'true' ? (
                    <span className={`col-span-2 col-start-2 grid grid-cols-subgrid items-center gap-y-1 ${DOT_MOTION}`}>
                      {step !== 'saved' && <>
                        <span data-stress-reading="saved"><ChanceDots chance={saved} /></span>
                        <span className={META}>{STRESS_WORDS.savedLabel}</span>
                      </>}
                      <span data-stress-reading="step" className="col-start-1"><ChanceDots chance={chance} /></span>
                      {step === 'saved' && <span className="break-words text-text-body">{row.value}</span>}
                    </span>
                  ) : (
                    <span className="col-start-3 break-words text-text-light">{row.value}</span>
                  )}
                </Hover>
              )
            })}
          </div>
        ))}
      </div>

      <details className="border-t border-panel-border">
        <summary className={`${FOLD_SUMMARY} ${typography.viewPanelMeta} ${FOCUS} cursor-pointer py-2.5 text-text-body`}>
          <FoldChevron />{STRESS_WORDS.details}
        </summary>
        <div className="grid gap-2">
          {moving.map(({ id, aim, rows }, index) => (
            <div key={id} role="group" aria-labelledby={`${aimHeading}-details-${index}`} className="grid gap-1">
              <h3 id={`${aimHeading}-details-${index}`} className={`${typography.viewPanelHeading} m-0 text-text-header`}>{aim}</h3>
              <ul className={`${typography.viewPanelBody} m-0 grid list-none gap-2 p-0 text-text-body`}>
                {rows.map(({ option, row }) => (
                  <li key={option.id} className="grid gap-1">
                    <span className={`${typography.viewPanelHeading} text-text-header`}>{option.heading}</span>
                    <span>{selected.label}</span>
                    <span>{row.title}</span>
                    {step !== 'saved' && <div><div className={META}>{STRESS_WORDS.savedLabel}</div><div>{row.value}</div></div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

export function StressTestTab() {
  const view = useViewStore((state) => state.view)
  const model = useViewStore(shownModel)
  const failed = useViewStore((state) => state.status === 'error' || state.error !== null)
  const held = view?.proposal != null
  const fallback = failed ? STRESS_WORDS.unavailable
    : held ? STRESS_WORDS.held
    : view === null ? STRESS_WORDS.empty : STRESS_WORDS.unavailable
  return (
    <div data-testid="core-stress-tab" className="mx-auto grid w-full max-w-[440px] grid-cols-1 gap-4 p-3">
      {model !== null && view !== null && !failed
        ? <StressTest model={model} view={view} />
        : <div className={META}>{fallback}</div>}
    </div>
  )
}
