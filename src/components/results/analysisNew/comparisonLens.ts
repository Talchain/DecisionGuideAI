/**
 * "How the options compare" (V2): the two lenses, and what each has to draw.
 *
 * PURE, AND IT READS ONLY WHAT THE VIEW MODEL ALREADY BUILT. Nothing here
 * computes a figure: the ranges are `outcomeRange` (the producer's own p10 /
 * p50 / p90 per option) and the goal figures are `goalReadout` / `goalFraction`,
 * whose every gate (UI-SEM-071, the complete-field rule, the substituted-joint
 * suppression) is the view model's. This module only answers "is there
 * anything to draw under this lens?", so the section and the tab body ask
 * that question one way.
 *
 * ⛔ NO LENS REORDERS ANYTHING. The rows are rendered in the order the view
 * model gave them (`utils/optionDisplayOrder.ts`, ROADMAP 1.267). A lens
 * changes which figure sits under each name, never which name comes first.
 */
import type { ComparisonOption, OptionsComparisonSection } from './analysisNewTypes'

export const COMPARISON_LENSES = ['outcome', 'goal'] as const
export type ComparisonLens = (typeof COMPARISON_LENSES)[number]

export interface OutcomeRangeScale {
  lo: number
  hi: number
  span: number
  /** The four axis values at 0, 1/3, 2/3 and 1 of the domain, rounded to the step (no float residue). */
  ticks?: readonly [number, number, number, number]
}

/**
 * ONE SCALE FOR EVERY RANGE, OR THE RANGES LIE. Moved verbatim from
 * `OptionsComparison.tsx` so the lens availability and the drawing share it.
 *
 * `null` unless at least two analysed rows carry a range (a lone band has
 * nothing to be compared against) and the domain has width (every option on
 * one p10 and one p90 gives a zero denominator, and no honest band).
 *
 * `!= null`, LOOSE: `outcomeRange` is required on the type, but fixtures and
 * older cached view models arrive without it, so at runtime it is `undefined`.
 */
export function outcomeRangeScale(rows: readonly ComparisonOption[]): OutcomeRangeScale | null {
  const ranges = rows.flatMap((r) =>
    r.kind === 'analysed' && r.outcomeRange != null ? [r.outcomeRange] : [],
  )
  if (ranges.length < 2) return null
  const lo = Math.min(...ranges.map((r) => r.p10))
  const hi = Math.max(...ranges.map((r) => r.p90))
  if (!(hi > lo)) return null
  return niceDomain(lo, hi)
}

/** Multipliers a reader takes as round steps (per power of ten). */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8] as const

/**
 * ⭐ A ROUND DOMAIN FOR THE AXIS (V2 prototype `chartHTML()`: 0% · 10% · 20% · 30%).
 * The four ticks sit at 0, 1/3, 2/3 and 1 of the domain. On the raw data range
 * they read "0 · 0.0463 · 0.0925 · 0.139" (Panel's prototype comparison, served
 * 1a8afc11, 26 Sep 2026). So the domain is widened, never narrowed, to the
 * smallest round step whose three intervals contain [lo, hi]. The ticks then
 * read "0 · 0.05 · 0.1 · 0.15". Every band is still fractioned against this one
 * domain, so positions stay true, and no value is moved or rounded.
 */
export function niceDomain(lo: number, hi: number): OutcomeRangeScale {
  const raw = (hi - lo) / 3
  const base = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const mag of [base / 10, base, base * 10]) {
    for (const m of NICE_STEPS) {
      const step = m * mag
      if (step < raw) continue
      const decimals = Math.max(0, 2 - Math.floor(Math.log10(step)))
      const clean = (v: number) => Number(v.toFixed(decimals)) + 0
      const niceLo = clean(Math.floor(lo / step + 1e-9) * step)
      const niceHi = clean(niceLo + 3 * step)
      if (niceHi >= hi - 1e-12) {
        const ticks = [niceLo, clean(niceLo + step), clean(niceLo + 2 * step), niceHi] as const
        return { lo: niceLo, hi: niceHi, span: niceHi - niceLo, ticks }
      }
    }
  }
  return { lo, hi, span: hi - lo }
}

/**
 * Does any analysed option carry a goal figure? The view model nulls EVERY
 * option's figure when any one lacks it (the complete-field rule), so "any"
 * and "all" are the same answer here; `any` is the cheaper spelling.
 */
export function goalFitAvailable(rows: readonly ComparisonOption[]): boolean {
  return rows.some(
    (r) => r.kind === 'analysed' && r.goalReadout !== null && r.goalFraction !== null,
  )
}

export type ComparisonLensAvailability = Record<ComparisonLens, boolean>

export function comparisonLensAvailability(
  section: OptionsComparisonSection,
): ComparisonLensAvailability {
  return {
    outcome: outcomeRangeScale(section.rows) !== null,
    goal: goalFitAvailable(section.rows),
  }
}

/**
 * The lens a reader meets first.
 *
 * ⭐ GOAL FIT WHEN IT EXISTS. It answers the question the person set ("does
 * this reach my target?"), it is absolute per option (the figures do not
 * partition, so they do not read as a ranking), and it prints a figure the
 * reader can check. The modelled-outcome band carries no unit on the view
 * model, so it prints no number. Where there is no goal figure, the modelled
 * outcome is the only lens with anything to draw.
 *
 * `null` when neither lens has anything to draw: no control is offered over
 * two views of nothing.
 */
export function initialComparisonLens(
  availability: ComparisonLensAvailability,
): ComparisonLens | null {
  if (availability.goal) return 'goal'
  if (availability.outcome) return 'outcome'
  return null
}

/**
 * Does the section draw ANY per-option figure at rest? For a host that decides
 * whether opening the section supplies something (the tab body's
 * `defaultOpen`). Since the win shares left the resting view, a row's
 * `winReadout` no longer answers this.
 */
export function comparisonDrawsAFigure(section: OptionsComparisonSection): boolean {
  return initialComparisonLens(comparisonLensAvailability(section)) !== null
}

/**
 * The strings this lens control adds. Each is a label for a control or a
 * statement about the drawing; none is a finding about an option.
 *
 * ⚠ There is no "Goal fit is locked" string any more: the section cannot tell
 * WHY goal figures are absent (no user target, UI-SEM-071, or an option without
 * a figure, the complete-field rule), so it offers no lens control rather than
 * a locked arm stating a cause it cannot know (ChatGPT's V2 ruling, #63
 * 5806258826 §2). The Success row owns target-setting.
 */
export const COMPARISON_LENS_COPY = {
  groupLabel: 'Compare the options by',
  arms: {
    outcome: 'Modelled outcome',
    goal: 'Goal fit',
  } satisfies Record<ComparisonLens, string>,
  rowActions: (label: string): string => `Show actions for ${label}`,
  inspectInModel: (label: string): string => `Inspect ${label} in Model`,
  focusOnCanvas: (label: string): string => `Focus ${label} on the canvas`,
  askOlumi: (label: string): string => `Ask Olumi about ${label}`,
} as const
