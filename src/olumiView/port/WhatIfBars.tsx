import { WHATIF_LEGEND_SAVED, WHATIF_LEGEND_TRIED } from '../../canvas/artefacts/whatIfCopy'
import type { ViewCard, ViewModel, ViewRow } from '../client'
import { optionCards } from '../layout'
import type { WhatIfVariant } from '../whatif'
import { trackPct } from './pick'
import { TYPE } from './type'

const RING = 'h-3 w-3 rounded-full border-2 border-text-body bg-panel'
const DOT = 'h-3 w-3 rounded-full bg-option'
const MARK = 'absolute top-1/2 -translate-x-1/2 -translate-y-1/2'

const hasPair = (saved: number | null, tried: number | null): boolean =>
  saved != null && tried != null && Number.isFinite(saved) && Number.isFinite(tried)

type Facts = WhatIfVariant['facts']

// The tried chance as a number: the row's own when core sends it, else core's chance fact for this option and aim, bound by both ids
// (core 55c0c03f sends what-if rows in words only; measured 10 Nov). Never read from the words.
function triedOf(card: ViewCard, row: Extract<ViewRow, { kind: 'chance' }>, facts: Facts): number | null {
  // A chance core sends, null included (its own "no chance here"), stands; only an absent key falls back to the fact.
  if ((row.chance as number | null | undefined) !== undefined) return row.chance
  if (row.aim_id == null) return null
  const fact = (facts ?? []).find((f) => f.about?.kind === 'chance' && f.about.option === card.id && f.about.goal === row.aim_id)
  return fact?.about?.chance ?? null
}

// UI recovery B4, DL 10 Nov: compare the same aim, even when core changes its row order.
function pairsOf(card: ViewCard, rows: ViewRow[], facts: Facts) {
  return rows.flatMap((row, i) => {
    if (row.kind !== 'chance') return []
    const saved = row.aim_id == null ? card.rows[i] : card.rows.find((r) => r.kind === 'chance' && r.aim_id === row.aim_id)
    const tried = triedOf(card, row, facts)
    return saved?.kind === 'chance' && hasPair(saved.chance, tried)
      ? [{ i, saved: saved.chance, tried }]
      : []
  })
}

export function WhatIfTrack({ saved, tried }: { saved: number | null; tried: number | null }) {
  if (!hasPair(saved, tried)) return null
  const savedPct = trackPct(saved!), triedPct = trackPct(tried!)
  const left = Math.min(savedPct, triedPct), width = Math.abs(triedPct - savedPct)
  return (
    <div className="relative my-2 h-3 w-full" data-testid="view-whatif-track" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 w-px bg-panel-border" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-panel-border" />
      <span className="absolute inset-y-0 left-full w-px bg-panel-border" />
      {width === 0 ? null : <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-option" style={{ left: `${left}%`, width: `${width}%` }} data-testid="view-whatif-span" />}
      <span className={`${MARK} ${RING}`} style={{ left: `${savedPct}%` }} data-testid="view-whatif-saved" />
      <span className={`${MARK} ${DOT}`} style={{ left: `${triedPct}%` }} data-testid="view-whatif-tried" />
    </div>
  )
}

export function WhatIfBars({ card, rows, facts }: { card: ViewCard; rows: ViewRow[]; facts?: Facts }) {
  return <>{pairsOf(card, rows, facts).map(({ i, saved, tried }) => <WhatIfTrack key={i} saved={saved} tried={tried} />)}</>
}

export function WhatIfAxis({ model, rows, facts }: { model: ViewModel; rows: WhatIfVariant['rows']; facts?: Facts }) {
  const cards = optionCards(model)
  const drawn = rows.some((o) => {
    const card = cards.find((c) => c.id === o.option_id)
    return card !== undefined && pairsOf(card, o.rows, facts).length > 0
  })
  if (!drawn) return null
  return (
    <>
      <div className={`${TYPE.meta} relative h-[18px] text-text-body`} data-testid="view-whatif-axis">
        <span className="absolute left-0">0%</span>
        <span className="absolute left-1/2 -translate-x-1/2">50%</span>
        <span className="absolute right-0">100%</span>
      </div>
      <div className={`${TYPE.meta} flex items-center gap-3 text-text-body`} data-testid="view-whatif-legend">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`${RING} shrink-0`} />{WHATIF_LEGEND_SAVED}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`${DOT} shrink-0`} />{WHATIF_LEGEND_TRIED}</span>
      </div>
    </>
  )
}
