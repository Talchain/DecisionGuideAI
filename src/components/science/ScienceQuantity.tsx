import { useContext, useState } from 'react'
import { DetailToggleContext } from '../../canvas/components/model-tab/DetailToggleContext'
import { getStrengthLabel } from '../../canvas/domain/vocabulary'
import { getConfidenceLabel, getExistenceLabel } from '../../canvas/components/model-tab/strengthBands'
import { influenceTierLabel } from '../results/driverDisplayModel'

export type ScienceQuantityKind = 'strength' | 'confidence' | 'probability' | 'influence'

/**
 * An influence (set-relative, 0–1) in the Drivers panel's words, on the one owner of its thresholds
 * (`influenceTierLabel`: 0.50 / 0.20). An influence is not a confidence: "Low confidence" on an influence bar said the
 * wrong thing about the right number.
 */
const INFLUENCE_WORDS = { strong: 'High-impact driver', moderate: 'Moderate influence', minor: 'Lower influence' } as const

export function scienceKindForField(field: string): ScienceQuantityKind | undefined {
  if (/^(weight|beliefStrength|strength_mean|strengthStd|belief)$/i.test(field)) return 'strength'
  if (/^(beliefExists|exists_probability|confidence|probability)$/i.test(field)) return 'probability'
  return undefined
}

export function scienceBand(kind: ScienceQuantityKind, value: number): string {
  if (kind === 'strength') return getStrengthLabel(Math.abs(value))
  if (kind === 'confidence') return getConfidenceLabel(value)
  if (kind === 'influence') return INFLUENCE_WORDS[influenceTierLabel(value)]
  return getExistenceLabel(value)
}

export function scienceQuantityText(kind: ScienceQuantityKind, value: number, advanced: boolean, open: boolean): string {
  if (!(advanced || open)) return scienceBand(kind, value)
  if (kind === 'probability' || kind === 'influence') return `${Math.round(value * 100)}%`
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

/**
 * The ONE gate for "may this surface print the exact science figure?": the
 * advanced toggle (`DetailToggleContext`, or a surface's own advanced prop) or
 * an opened `Show details` disclosure. For surfaces that already carry their own
 * plain-word band and visual indicator (so must not print a second band word).
 */
export function useScienceExact(open: boolean, advanced = false): boolean {
  const { showDetail } = useContext(DetailToggleContext)
  return showDetail || advanced || open
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
