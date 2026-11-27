import { useEffect, useId, useRef } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import type { ViewCard, ViewModel, ViewRow } from '../../client'
import { optionCards } from '../../layout'
import { FOLD_SUMMARY, FoldChevron } from '../../look/FoldChevron'
import { GlyphMark, Hover } from '../../look/Hover'
import { colourClass, OkIcon } from '../../look/icons'
import '../../look/olumiLook.css'
import { cardOf, chartGroupsOf } from '../../port/pick'
import { TYPE } from '../../port/type'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { chanceForDots } from '../../resultRange'
import { useViewStore } from '../../store'
import { optionLetters } from '../cards/letters'
import { LetterChip } from '../cards/marks'
import { cardOfRecord, optionPathOf } from '../lenses/layers'
import { ChanceDots } from '../scale/ChanceDots'
import { useCompareSelection, type Pair } from './compareSelection'
import { useFocusSubject } from './focusAdapter'
import './compareOptions.css'

export const COMPARE_OPTIONS_CHROME = {
  title: 'Compare options',
  picker: 'Options to compare',
  more: 'More on this aim',
  versions: 'Versions and what-ifs',
} as const

const RING = 'tool-compare-options'
const PICK = `${TYPE.body} inline-flex min-h-7 min-w-0 max-w-full flex-none items-center gap-1 rounded-control border border-panel-border px-2 py-1 text-left text-text-header hover:bg-panel-hover aria-pressed:border-text-header aria-pressed:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
type OptionEntry = { card: ViewCard; letter: string; row: ViewRow | undefined }

function dotsOf(card: ViewCard, row: ViewRow | undefined): number | null {
  if (row?.kind !== 'chance') return null
  const headline = card.headline
  if (headline?.aim_id === row.aim_id &&
    (headline.state === 'none' || (headline.state === 'fixed' && row.chance === 0))) return null
  // Includes the row's own withheld, not-computable and fixed-miss states.
  return chanceForDots(row)
}

function OptionRow({ card, letter, row }: OptionEntry) {
  const result = row?.kind === 'none' ? undefined : row
  const words = row?.kind === 'none' ? row.text : row?.title
  const likely = result?.kind === 'chance' ? result.likely : null
  const ifApproved = result?.kind === 'chance' ? result.if_approved : null

  return (
    <div data-compare-row={row?.kind ?? 'absent'} className="compare-option-row col-span-full grid min-w-0 grid-cols-subgrid items-start rounded-sm py-1 transition-[transform,opacity] duration-fast ease-out hover:bg-panel-hover motion-reduce:transition-none">
      <button type="button" onClick={() => pressCard(card.id)}
        className={`${TYPE.meta} min-w-0 text-left text-text-header`}>
        <span className="olumi-look contents"><LetterChip letter={letter} /></span><wbr />
        <span>{card.heading}</span>
      </button>
      <Hover words={words} focusable={result === undefined} data-compare-result={result === undefined ? '' : undefined}
        className="ok-face-mark-chance flex min-h-4 items-center">
        <span className="contents" aria-hidden="true">
          {result === undefined
            ? <span className="ok-face-mark ok-face-mark-track" />
            : <ChanceDots chance={dotsOf(card, result)} />}
        </span>
      </Hover>
      <Hover words={result?.title} data-compare-result={result === undefined ? undefined : ''}
        className={`${TYPE.meta} min-w-0 text-text-body`}>
        {result === undefined ? null : (
          <>
            {likely == null ? null : <><GlyphMark mark={likely} className="text-text-header" />{' '}</>}
            {result.olumi == null ? null : <><GlyphMark mark={result.olumi} className={colourClass('--info')} />{' '}</>}
            {ifApproved == null ? null : <><GlyphMark mark={ifApproved} className={colourClass('--info')} />{' '}</>}
            <span>{result.value}</span>
          </>
        )}
      </Hover>
    </div>
  )
}

function AimDetails({ model, entries, headingId }: {
  model: ViewModel
  entries: readonly OptionEntry[]
  headingId: string | undefined
}) {
  const details = entries.map(({ card, letter, row }) => {
    if (row?.kind === 'none') return { card, letter, explanation: row.title }
    if (row?.kind !== 'chance') return null
    const figure = row.driver == null ? undefined : cardOfRecord(model, row.driver.figure)
    if (row.outcome == null && row.tail == null && figure == null) return null
    return { card, letter, outcome: row.outcome, tail: row.tail, figure }
  }).filter((detail) => detail !== null)
  if (details.length === 0) return null

  return (
    <details className="col-span-full min-w-0">
      <summary aria-describedby={headingId} className={`${FOLD_SUMMARY} ${TYPE.meta} cursor-pointer py-1 text-text-body`}>
        <FoldChevron />{COMPARE_OPTIONS_CHROME.more}
      </summary>
      <div className={`${TYPE.meta} grid gap-2 py-1 text-text-light`}>
        {details.map(({ card, letter, explanation, outcome, tail, figure }) => (
          <div key={card.id} className="flex min-w-0 items-baseline">
            <span className="olumi-look contents"><LetterChip letter={letter} /></span>
            <div className="grid min-w-0 gap-1 break-words">
              {explanation === undefined ? null : <span>{explanation}</span>}
              {outcome == null ? null : <Hover words={outcome.title}>{outcome.text}</Hover>}
              {tail == null ? null : <span>{tail.text}</span>}
              {figure == null ? null : (
                <span className="flex items-start gap-1">
                  <OkIcon id="why-moves" size={14} decorative />
                  <span className="min-w-0">{figure.heading}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function AimGroup({ model, aimId, aim, entries }: {
  model: ViewModel
  aimId: string | null
  aim: string | undefined
  entries: readonly OptionEntry[]
}) {
  const id = useId()
  const headingId = aim === undefined ? undefined : id
  return (
    <div role="group" aria-labelledby={headingId} data-compare-aim={aimId ?? ''} className="compare-aim-grid grid min-w-0 gap-1 border-t border-panel-border pt-2">
      {aim === undefined ? null : <Hover as="h3" id={headingId} words={aim} className={`${TYPE.meta} col-span-full m-0 truncate text-text-light`}>{aim}</Hover>}
      {entries.map((entry, i) => <OptionRow key={`${i}:${entry.card.id}`} {...entry} />)}
      {entries.length > 1 ? <AimDetails model={model} entries={entries} headingId={headingId} /> : null}
    </div>
  )
}

function OptionComparison({ model, options, a, b, setPair }: {
  model: ViewModel
  options: ViewCard[]
  a: ViewCard
  b: ViewCard | undefined
  setPair: (pair: Pair<string>) => void
}) {
  const aId = a.id
  const bId = b?.id
  const subject = useFocusSubject()
  const subjectId = subject?.source === 'canvas' && (subject.kind === 'option' || subject.kind === 'card') && options.some((card) => card.id === subject.id) ? subject.id : null
  const handledSubject = useRef<string | null>(null)
  const tool = useRef<HTMLElement>(null)
  const chips = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (handledSubject.current === subjectId) return
    handledSubject.current = subjectId
    if (subjectId === null || bId === undefined || subjectId === aId || subjectId === bId) return
    setPair([aId, subjectId])
    // Keep focus on a stable picker button if the canvas has it or the old row may disappear.
    const active = document.activeElement
    if (!tool.current?.contains(active) || active?.closest('[data-compare-option]') === null) {
      chips.current.get(subjectId)?.focus()
    }
  }, [aId, bId, setPair, subjectId])

  useEffect(() => {
    // Canvas emphasis is card-only in this slice. Links stay unlit.
    const aCards = optionPathOf(model, aId).cards
    ringFrom(RING, bId === undefined ? [...aCards] : [...aCards, ...optionPathOf(model, bId).cards])
  }, [model, aId, bId])
  useEffect(() => () => ringFrom(RING, []), [])

  const letters = optionLetters(model)
  // Lane B's Check gaps replace this one-option fallback at the join.
  const aRows = new Map(a.rows.filter((row) => b !== undefined || row.kind === 'none').map((row) => [row.aim_id, row]))
  const bRows = new Map(b?.rows.map((row) => [row.aim_id, row]))
  const aims = new Set([...chartGroupsOf(model).map((group) => group.aimId), ...aRows.keys(), ...bRows.keys()])

  return (
    <section ref={tool} aria-label={COMPARE_OPTIONS_CHROME.title} className="min-w-0 space-y-2" data-form="TT-compare" data-testid={RING} data-paired="false">
      <div role="group" aria-label={COMPARE_OPTIONS_CHROME.picker} className="flex flex-row flex-wrap gap-2">
        {options.map((card) => (
          <button type="button" key={card.id} data-compare-option={card.id} aria-pressed={card.id === aId || card.id === bId} className={PICK}
            ref={(button) => { if (button === null) chips.current.delete(card.id); else chips.current.set(card.id, button) }}
            onClick={() => {
              if (bId === undefined || card.id === bId) return
              setPair(card.id === aId ? [bId, aId] : [aId, card.id])
            }}>
            <span className="olumi-look contents"><LetterChip letter={letters.get(card.id)!} /></span>
            <NodeShapeIndicator nodeKind="option" />
            <span className="min-w-0 break-words">{card.heading}</span>
          </button>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2">
        {[...aims].map((aimId) => {
          const aRow = aRows.get(aimId)
          const bRow = bRows.get(aimId)
          if (aRow === undefined && bRow === undefined) return null
          const aim = (aRow?.kind === 'none' ? undefined : aRow?.aim)
            ?? (bRow?.kind === 'none' ? undefined : bRow?.aim)
            ?? cardOf(model, aimId)?.heading
          const entries: OptionEntry[] = [{ card: a, letter: letters.get(aId)!, row: aRow }]
          if (b !== undefined) entries.push({ card: b, letter: letters.get(b.id)!, row: bRow })

          return (
            <AimGroup key={aimId} model={model} aimId={aimId} aim={aim} entries={entries} />
          )
        })}
      </div>
    </section>
  )
}

export function CompareOptions({ model }: { model: ViewModel }) {
  const sid = useViewStore((s) => s.sid)
  const picked = useCompareSelection((s) => s.byScenario.get(sid))
  const setPair = useCompareSelection((s) => s.setPair)
  const options = optionCards(model)
  const pickedA = options.find((card) => card.id === picked?.[0])
  const pickedB = options.find((card) => card.id === picked?.[1])
  const missing = picked !== undefined && (!pickedA || !pickedB)
  useEffect(() => {
    if (missing) setPair(sid, null)
  }, [missing, setPair, sid])

  const [first, second] = options
  if (!first) return null
  return <OptionComparison model={model} options={options}
    a={pickedA && pickedB ? pickedA : first} b={pickedA && pickedB ? pickedB : second} setPair={(pair) => setPair(sid, pair)} />
}
