import { useContext, useState } from 'react'
import { DetailToggleContext } from '../../canvas/components/model-tab/DetailToggleContext'
import { getStrengthLabel } from '../../canvas/domain/vocabulary'
import { getConfidenceLabel, getExistenceLabel } from '../../canvas/components/model-tab/strengthBands'

export type ScienceQuantityKind = 'strength' | 'confidence' | 'probability'

export function scienceKindForField(field: string): ScienceQuantityKind | undefined {
  if (/^(weight|beliefStrength|strength_mean|strengthStd|belief)$/i.test(field)) return 'strength'
  if (/^(beliefExists|exists_probability|confidence|probability)$/i.test(field)) return 'probability'
  return undefined
}

export function scienceBand(kind: ScienceQuantityKind, value: number): string {
  if (kind === 'strength') return getStrengthLabel(Math.abs(value))
  if (kind === 'confidence') return getConfidenceLabel(value)
  return getExistenceLabel(value)
}

export function scienceQuantityText(kind: ScienceQuantityKind, value: number, advanced: boolean, open: boolean): string {
  if (!(advanced || open)) return scienceBand(kind, value)
  if (kind === 'probability') return `${Math.round(value * 100)}%`
  return Math.abs(value) < 0.0001 ? value.toString() : Number(value.toFixed(4)).toString()
}

/** Plain-string counterpart for producers that have no disclosure affordance. */
export function scienceChangeText(field: string, before: unknown, after: unknown): string | undefined {
  const kind = scienceKindForField(field)
  if (!kind || typeof before !== 'number' || typeof after !== 'number') return undefined
  const beforeBand = scienceBand(kind, before)
  const afterBand = scienceBand(kind, after)
  if (beforeBand !== afterBand) return `${beforeBand} → ${afterBand}`
  if (after > before) return `${afterBand} (slightly stronger)`
  if (after < before) return `${afterBand} (slightly weaker)`
  return afterBand
}

export function ScienceQuantity({ kind, value, label }: { kind: ScienceQuantityKind; value: number; label?: string }): JSX.Element {
  const { showDetail } = useContext(DetailToggleContext)
  const [open, setOpen] = useState(false)
  const exact = showDetail || open
  return (
    <span data-testid="science-quantity" data-kind={kind}>
      <span aria-hidden="true" className="mr-1">●</span>{label ? `${label}: ` : ''}{scienceQuantityText(kind, value, showDetail, open)}
      {!showDetail ? (
        <button type="button" className="ml-1 underline" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          {open ? 'Hide details' : 'Show details'}
        </button>
      ) : null}
      {exact ? <span className="sr-only"> Exact science value</span> : null}
    </span>
  )
}
