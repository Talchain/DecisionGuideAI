import { useEffect, useState } from 'react'
import type { ViewCard, ViewModel, ViewRow } from '../../client'
import { optionCards } from '../../layout'
import { FOLD_SUMMARY, FoldChevron } from '../../look/FoldChevron'
import { GlyphMark, Hover } from '../../look/Hover'
import { colourClass } from '../../look/icons'
import '../../look/olumiLook.css'
import { cardOf, chartGroupsOf } from '../../port/pick'
import { TYPE } from '../../port/type'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { chanceForDots } from '../../resultRange'
import { optionLetters } from '../cards/letters'
import { LetterChip } from '../cards/marks'
import { cardOfRecord, optionPathOf } from '../lenses/layers'
import { ChanceDots } from '../scale/ChanceDots'

export const COMPARE_OPTIONS_CHROME = {
  title: 'Compare options',
  first: 'First option',
  second: 'Second option',
  more: 'More on this aim',
  versions: 'Versions and what-ifs',
} as const

const RING = 'tool-compare-options'
const PICK = `${TYPE.body} min-w-0 rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body`
type Pair<T> = readonly [T, T]

function dotsOf(card: ViewCard, row: ViewRow | undefined): number | null {
  if (row?.kind !== 'chance') return null
  const headline = card.headline
  if (headline?.aim_id === row.aim_id &&
    (headline.state === 'none' || (headline.state === 'fixed' && row.chance === 0))) return null
  // Includes the row's own withheld, not-computable and fixed-miss states.
  return chanceForDots(row)
}

function OptionRow({ card, letter, row }: { card: ViewCard; letter: string; row: ViewRow | undefined }) {
  const olumi = row?.kind === 'none' ? null : row?.olumi
  const likely = row?.kind === 'chance' ? row.likely : null

  return (
    <Hover as="button" type="button" words={row?.title} onClick={() => pressCard(card.id)}
      className="col-span-3 grid min-w-0 grid-cols-subgrid items-center rounded-sm py-1 text-left hover:bg-panel-hover">
      <span className={`${TYPE.meta} flex min-w-0 items-baseline text-text-header`}>
        <span className="olumi-look contents"><LetterChip letter={letter} /></span>
        <span className="min-w-0 break-words">{card.heading}</span>
      </span>
      <span className="min-w-0" aria-hidden="true">
        {row === undefined
          ? <span className="ok-face-mark ok-face-mark-track min-w-12" />
          : <ChanceDots chance={dotsOf(card, row)} />}
      </span>
      <span className={`${TYPE.meta} min-w-0 break-words ${row?.kind === 'none' ? 'text-text-light' : 'text-text-body'}`}>
        {likely == null ? null : <><GlyphMark mark={likely} tip={false} className="text-text-header" />{' '}</>}
        {olumi == null ? null : <><GlyphMark mark={olumi} tip={false} className={colourClass('--info')} />{' '}</>}
        {row === undefined ? null : <span>{row.kind === 'none' ? row.text : row.value}</span>}
      </span>
    </Hover>
  )
}

function AimDetails({ model, entries }: {
  model: ViewModel
  entries: readonly { card: ViewCard; letter: string; row: ViewRow | undefined }[]
}) {
  const details = entries.flatMap(({ card, letter, row }) => {
    if (row?.kind !== 'chance') return []
    const figure = row.driver == null ? undefined : cardOfRecord(model, row.driver.figure)
    if (row.outcome == null && row.tail == null && figure == null) return []
    return [{ card, letter, outcome: row.outcome, tail: row.tail, figure }]
  })
  if (details.length === 0) return null

  return (
    <details className="col-span-3">
      <summary className={`${FOLD_SUMMARY} ${TYPE.meta} cursor-pointer py-1 text-text-body`}>
        <FoldChevron />{COMPARE_OPTIONS_CHROME.more}
      </summary>
      <div className={`${TYPE.meta} grid gap-2 py-1 text-text-light`}>
        {details.map(({ card, letter, outcome, tail, figure }) => (
          <div key={card.id} className="flex min-w-0 items-baseline">
            <span className="olumi-look contents"><LetterChip letter={letter} /></span>
            <div className="grid min-w-0 gap-1 break-words">
              {outcome == null ? null : <Hover words={outcome.title}>{outcome.text}</Hover>}
              {tail == null ? null : <span>{tail.text}</span>}
              {figure == null ? null : <span>{figure.heading}</span>}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function OptionComparison({ model, options, defaults }: { model: ViewModel; options: ViewCard[]; defaults: Pair<ViewCard> }) {
  const [picked, setPicked] = useState<Pair<string> | null>(null)
  const pickedA = options.find((card) => card.id === picked?.[0])
  const pickedB = options.find((card) => card.id === picked?.[1])
  const [a, b] = pickedA && pickedB ? [pickedA, pickedB] : defaults
  if (picked !== null && (!pickedA || !pickedB)) setPicked(null)

  const aId = a.id
  const bId = b.id
  useEffect(() => {
    // Canvas emphasis is card-only in this slice. Links stay unlit.
    ringFrom(RING, [...optionPathOf(model, aId).cards, ...optionPathOf(model, bId).cards])
  }, [model, aId, bId])
  useEffect(() => () => ringFrom(RING, []), [])

  const letters = optionLetters(model)
  const aRows = new Map(a.rows.map((row) => [row.aim_id, row]))
  const bRows = new Map(b.rows.map((row) => [row.aim_id, row]))
  const aims = new Set([...chartGroupsOf(model).map((group) => group.aimId), ...aRows.keys(), ...bRows.keys()])

  return (
    <section aria-label={COMPARE_OPTIONS_CHROME.title} className="min-w-0 space-y-2" data-form="TT-compare" data-testid={RING} data-paired="false">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label={COMPARE_OPTIONS_CHROME.first} className={PICK} value={aId} onChange={(e) => {
          const id = e.currentTarget.value
          setPicked([id, id === bId ? aId : bId])
        }}>
          {options.map((card) => <option key={card.id} value={card.id}>{letters.get(card.id)} {card.heading}</option>)}
        </select>
        <select aria-label={COMPARE_OPTIONS_CHROME.second} className={PICK} value={bId} onChange={(e) => {
          const id = e.currentTarget.value
          setPicked([id === aId ? bId : aId, id])
        }}>
          {options.map((card) => <option key={card.id} value={card.id}>{letters.get(card.id)} {card.heading}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 gap-y-2">
        {[...aims].map((aimId) => {
          const aRow = aRows.get(aimId)
          const bRow = bRows.get(aimId)
          if (aRow === undefined && bRow === undefined) return null
          const aim = (aRow?.kind === 'none' ? undefined : aRow?.aim)
            ?? (bRow?.kind === 'none' ? undefined : bRow?.aim)
            ?? cardOf(model, aimId)?.heading
          const entries = [
            { card: a, letter: letters.get(aId)!, row: aRow },
            { card: b, letter: letters.get(bId)!, row: bRow },
          ]

          return (
            <div key={aimId} data-compare-aim={aimId ?? ''} className="col-span-3 grid grid-cols-subgrid gap-y-1 border-t border-panel-border pt-2">
              {aim === undefined ? null : <Hover as="h3" words={aim} className={`${TYPE.meta} col-span-3 m-0 truncate text-text-light`}>{aim}</Hover>}
              {entries.map((entry) => <OptionRow key={entry.card.id} {...entry} />)}
              <AimDetails model={model} entries={entries} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CompareOptions({ model }: { model: ViewModel }) {
  const options = optionCards(model)
  const [first, second] = options
  if (!first || !second) return null
  return <OptionComparison model={model} options={options} defaults={[first, second]} />
}
