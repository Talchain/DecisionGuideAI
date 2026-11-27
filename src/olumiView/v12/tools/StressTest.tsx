import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { typography } from '../../../styles/typography'
import type { View, ViewCard, ViewModel, ViewRow } from '../../client'
import { FoldChevron, FOLD_SUMMARY } from '../../look/FoldChevron'
import { Hover } from '../../look/Hover'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { chanceForDots } from '../../resultRange'
import { currentModel, useViewStore } from '../../store'
import { optionLetters } from '../cards/letters'
import { LetterChip } from '../cards/marks'
import { cardOfRecord } from '../lenses/layers'
import { ChanceDots } from '../scale/ChanceDots'
import { RangeBar } from '../scale/RangeBar'

export const STRESS_STEPS = { low: 'Lower values', saved: 'As saved', high: 'Higher values' } as const

export const STRESS_WORDS = {
  figure: 'Figure',
  values: 'Figure values',
  empty: 'Stress-testing needs a worked-out chance first.',
  held: 'Stress-test starts once a version is approved.',
  details: 'How these were worked out',
  other: 'Olumi tested this against another figure',
  none: 'Olumi found no figure this moves with',
  savedLabel: 'As saved',
} as const

type Step = keyof typeof STRESS_STEPS
type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
type OptionReading = { option: ViewCard; row: ChanceRow }
type DriverFigure = { record: string; card: ViewCard }

const STEPS: readonly Step[] = ['low', 'saved', 'high']
const RING_SOURCE = 'tool-stress'
const META = `${typography.viewPanelMeta} text-text-light`
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

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

  const figures: DriverFigure[] = []
  for (const record of records) {
    const card = cardOfRecord(model, record)
    if (card !== undefined) figures.push({ record, card })
  }
  const order = new Map(model.cards.map((card, index) => [card, index] as const))
  figures.sort((a, b) => order.get(a.card)! - order.get(b.card)!)
  return { aims, figures }
}

export function StressTest({ model, view }: { model: ViewModel; view: View }) {
  const { aims, figures } = useMemo(() => stressReadings(model), [model])
  const letters = useMemo(() => optionLetters(model), [model])
  const [record, setRecord] = useState<string>()
  const [step, setStep] = useState<Step>('saved')
  const stepButtons = useRef<Partial<Record<Step, HTMLButtonElement | null>>>({})
  const selected = figures.find((figure) => figure.record === record) ?? figures[0]
  const moving = useMemo(() => selected === undefined ? [] : [...aims.values()].flat()
    .filter(({ row }) => row.driver?.figure === selected.record), [aims, selected])

  useEffect(() => {
    const ids = selected === undefined ? [] : [selected.card.id, ...new Set(moving.map(({ option }) => option.id))]
    ringFrom(RING_SOURCE, ids)
  }, [selected, moving])
  useEffect(() => () => ringFrom(RING_SOURCE, []), [])

  function moveStep(event: KeyboardEvent<HTMLButtonElement>, from: Step) {
    const { key } = event
    const direction = key === 'ArrowRight' || key === 'ArrowDown' ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const next = STEPS[(STEPS.indexOf(from) + direction + STEPS.length) % STEPS.length]
    setStep(next)
    stepButtons.current[next]?.focus()
  }

  if (selected === undefined) {
    return <div data-form="TT-stress" data-testid="tool-stress" className={META}>{STRESS_WORDS.empty}</div>
  }

  const figure = selected.record === selected.card.id ? selected.card.figure : null
  return (
    <div data-form="TT-stress" data-testid="tool-stress" className="grid min-w-0 gap-3">
      <select aria-label={STRESS_WORDS.figure} value={selected.record} onChange={(event) => setRecord(event.target.value)}
        className={`${typography.viewPanelBody} ${FOCUS} min-h-7 w-fit min-w-0 max-w-full rounded-md border border-panel-border bg-panel px-2 text-text-header`}>
        {figures.map(({ record, card }) => <option key={record} value={record}>{card.heading}</option>)}
      </select>

      <div role="radiogroup" aria-label={STRESS_WORDS.values} className="grid grid-cols-3 gap-1 rounded-md border border-panel-border p-1">
        {STEPS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={step === value} tabIndex={step === value ? 0 : -1}
            ref={(button) => { stepButtons.current[value] = button }}
            onClick={() => setStep(value)} onKeyDown={(event) => moveStep(event, value)}
            className={`${typography.viewPanelHeading} ${FOCUS} min-h-7 cursor-pointer rounded-sm border border-transparent px-1 text-text-body hover:bg-panel-hover aria-checked:border-panel-border aria-checked:bg-panel-hover aria-checked:text-text-header`}>
            {STRESS_STEPS[value]}
          </button>
        ))}
      </div>

      {figure != null && (
        <div className="grid auto-cols-fr grid-flow-col items-center gap-2">
          <RangeBar card={selected.card} view={view} />
          <Hover words={figure.title} className={`${META} min-w-0 break-words`}>{figure.text}</Hover>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_max-content_minmax(0,1fr)] gap-x-2 gap-y-1">
        {[...aims].map(([aimId, readings]) => (
          <Fragment key={aimId}>
            <h3 className={`${typography.viewPanelHeading} col-span-3 m-0 mt-2 text-text-header`}>{readings[0].row.aim}</h3>
            {readings.map(({ option, row }) => {
              const driver = row.driver
              const computed = driver == null ? 'none' : driver.figure === selected.record ? 'true' : 'other'
              const chance = computed === 'true' && driver != null
                ? step === 'saved' ? chanceForDots(row) : driver[step]
                : null
              return (
                <Hover key={option.id} as="button" type="button"
                  words={computed === 'true' ? undefined : STRESS_WORDS[computed]}
                  onClick={() => pressCard(option.id)}
                  data-stress-computed={computed} data-stress-chance={chance ?? undefined}
                  className={`${typography.viewPanelBody} ${FOCUS} col-span-3 grid min-h-7 cursor-pointer grid-cols-subgrid items-center rounded-sm py-1 text-left hover:bg-panel-hover`}>
                  <span className="flex min-w-0 items-center gap-1 text-text-header">
                    <span aria-hidden="true"><LetterChip letter={letters.get(option.id)!} /></span>
                    <span className="min-w-0 break-words">{option.heading}</span>
                  </span>
                  {computed === 'true' && <span className="col-start-2"><ChanceDots chance={chance} /></span>}
                  {(computed !== 'true' || step === 'saved') && (
                    <span className={`${computed === 'true' ? 'text-text-body' : 'text-text-light'} col-start-3 break-words`}>{row.value}</span>
                  )}
                </Hover>
              )
            })}
          </Fragment>
        ))}
      </div>

      <details className="border-t border-panel-border">
        <summary className={`${FOLD_SUMMARY} ${typography.viewPanelMeta} ${FOCUS} cursor-pointer py-2.5 text-text-body`}>
          <FoldChevron />{STRESS_WORDS.details}
        </summary>
        <ul className={`${typography.viewPanelBody} m-0 grid list-none gap-2 p-0 text-text-body`}>
          {moving.map(({ option, row }) => (
            <li key={`${option.id}:${row.aim_id}`} className="grid gap-1">
              <span className={`${typography.viewPanelHeading} text-text-header`}>{option.heading}</span>
              <span>{selected.card.heading}</span>
              <span>{row.title}</span>
              {step !== 'saved' && <div><div className={META}>{STRESS_WORDS.savedLabel}</div><div>{row.value}</div></div>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export function StressTestTab() {
  const view = useViewStore((state) => state.view)
  const model = useViewStore(currentModel)
  return (
    <div data-testid="core-stress-tab" className="mx-auto grid w-full max-w-[440px] grid-cols-1 gap-4 p-3">
      {model !== null && view !== null
        ? <StressTest model={model} view={view} />
        : <div className={META}>{view?.proposal != null ? STRESS_WORDS.held : STRESS_WORDS.empty}</div>}
    </div>
  )
}
