import { useEffect, useId } from 'react'
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

export const COMPARE_OPTIONS_CHROME = {
  title: 'Compare options',
  first: 'First option',
  second: 'Second option',
  more: 'More on this aim',
  versions: 'Versions and what-ifs',
} as const

const RING = 'tool-compare-options'
const PICK = `${TYPE.body} min-w-0 rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body`
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
  const olumi = row?.kind === 'none' ? null : row?.olumi
  const likely = row?.kind === 'chance' ? row.likely : null

  return (
    <div data-compare-row={row?.kind ?? 'absent'} className="grid min-w-0 gap-1 rounded-sm py-1 hover:bg-panel-hover">
      <button type="button" onClick={() => pressCard(card.id)}
        className={`${TYPE.meta} flex min-w-0 items-baseline text-left text-text-header`}>
        <span className="olumi-look contents"><LetterChip letter={letter} /></span>
        <span className="min-w-0 break-words">{card.heading}</span>
      </button>
      {row === undefined ? null : (
        <Hover words={row.kind === 'none' ? row.text : row.title} data-compare-result="" className="flex min-w-0 items-center gap-2">
          {/* Reuse the canvas chance mark's ten-dot footprint wherever there's a result line. */}
          <span className="ok-face-mark-chance flex min-h-4 items-center" aria-hidden="true">
            {row.kind === 'none'
              ? <span className="ok-face-mark ok-face-mark-track" />
              : <ChanceDots chance={dotsOf(card, row)} />}
          </span>
          {row.kind === 'none' ? null : (
            <span className={`${TYPE.meta} min-w-0 break-words text-text-body`}>
              {likely == null ? null : <><GlyphMark mark={likely} className="text-text-header" />{' '}</>}
              {olumi == null ? null : <><GlyphMark mark={olumi} className={colourClass('--info')} />{' '}</>}
              <span>{row.value}</span>
            </span>
          )}
        </Hover>
      )}
    </div>
  )
}

function AimDetails({ model, entries, headingId }: {
  model: ViewModel
  entries: Pair<OptionEntry>
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
    <details>
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
  entries: Pair<OptionEntry>
}) {
  const id = useId()
  const headingId = aim === undefined ? undefined : id
  return (
    <div role="group" aria-labelledby={headingId} data-compare-aim={aimId ?? ''} className="grid gap-1 border-t border-panel-border pt-2">
      {aim === undefined ? null : <Hover as="h3" id={headingId} words={aim} className={`${TYPE.meta} m-0 truncate text-text-light`}>{aim}</Hover>}
      {entries.map((entry) => <OptionRow key={entry.card.id} {...entry} />)}
      <AimDetails model={model} entries={entries} headingId={headingId} />
    </div>
  )
}

function OptionComparison({ model, options, pair: [a, b], setPair }: {
  model: ViewModel
  options: ViewCard[]
  pair: Pair<ViewCard>
  setPair: (pair: Pair<string>) => void
}) {
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
          setPair([id, id === bId ? aId : bId])
        }}>
          {options.map((card) => <option key={card.id} value={card.id}>{letters.get(card.id)} {card.heading}</option>)}
        </select>
        <select aria-label={COMPARE_OPTIONS_CHROME.second} className={PICK} value={bId} onChange={(e) => {
          const id = e.currentTarget.value
          setPair([id === aId ? bId : aId, id])
        }}>
          {options.map((card) => <option key={card.id} value={card.id}>{letters.get(card.id)} {card.heading}</option>)}
        </select>
      </div>
      <div className="grid gap-2">
        {[...aims].map((aimId) => {
          const aRow = aRows.get(aimId)
          const bRow = bRows.get(aimId)
          if (aRow === undefined && bRow === undefined) return null
          const aim = (aRow?.kind === 'none' ? undefined : aRow?.aim)
            ?? (bRow?.kind === 'none' ? undefined : bRow?.aim)
            ?? cardOf(model, aimId)?.heading
          const entries: Pair<OptionEntry> = [
            { card: a, letter: letters.get(aId)!, row: aRow },
            { card: b, letter: letters.get(bId)!, row: bRow },
          ]

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
  if (!first || !second) return null
  return <OptionComparison model={model} options={options} pair={pickedA && pickedB ? [pickedA, pickedB] : [first, second]}
    setPair={(pair) => setPair(sid, pair)} />
}
