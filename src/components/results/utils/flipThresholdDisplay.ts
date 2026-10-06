/**
 * flipThresholdDisplay — ONE formatter, ONE direction rule and ONE copy
 * register for a producer flip threshold, shared by every surface that
 * renders one.
 *
 * ROADMAP 2.291. The formatter and the direction rule moved VERBATIM out of
 * `analysis-hero/buildHeroModel.ts`, and the flip sentences moved VERBATIM
 * out of `analysis-hero/heroCopy.ts` (which now delegates to this register —
 * pinned by `heroCopyDelegation.spec.ts`), because the V7 signal chip renders
 * the same producer rows. They live HERE, outside the hero module, because
 * the hero is mount-guarded (`analysis-hero/__tests__/inertness.spec.ts`
 * permits exactly two importers of `analysis-hero/**` repo-wide) — the
 * dependency arrow must point out of the guarded module, never into it.
 * buildHeroModel's own comment states the invariant: "one threshold must
 * never render two ways in one panel" — now held across surfaces, not just
 * within the hero.
 *
 * Direction rule (UI-SEM-074, Codex B3 tightened): a direction claim needs
 * BOTH values, and only a STRICT inequality earns one. Equality — and
 * therefore also any upstream missing-baseline default when the flip value is
 * 0 — falls back to the direction-neutral "crosses" wording. With no producer
 * baseline at all the direction is unknowable, so "crosses" is the only
 * honest option.
 */

import { classifyUnit, compactUnitParts, joinCompactUnitParts } from '@/utils/unitClassifier'

/**
 * The flip-threshold sentences and tokens, exactly as `HERO_COPY.evidence`
 * has always rendered them (ROADMAP 1.267 discipline preserved: the
 * alternative-winner NAME is data and survives a withheld run; only the
 * designation VERB changes with the verdict).
 */
export const FLIP_THRESHOLD_COPY = {
  /** Switch-probability meta beside a flip row, e.g. "48% switch". */
  switchMeta: (pct: string) => `${pct} switch`,
  fallsBelow: 'falls below',
  risesAbove: 'rises above',
  // Direction-neutral fallback (UI-SEM-074): used when a direction claim
  // would not be honestly determinable.
  crosses: 'crosses',
  flipRiskWithAlternative: (
    factor: string,
    direction: string,
    value: string,
    alternative: string,
    designationsWithheld: boolean,
  ) =>
    // Science d5 (#87 6008165771): PLoT binary-searches where the argmax of the win shares changes — a CROSSING POINT,
    // not a probability, so no "likely"; "about" because the search is Monte Carlo (precision 0.01). Named labels are
    // quoted and the model is named.
    designationsWithheld
      ? `If ‘${factor}’ ${direction} about ${value}, the comparison shifts towards ‘${alternative}’, in this model.`
      : `If ‘${factor}’ ${direction} about ${value}, ‘${alternative}’ becomes the most-supported option, in this model.`,
  flipRiskNoAlternative: (
    factor: string,
    direction: string,
    value: string,
    designationsWithheld: boolean,
  ) =>
    designationsWithheld
      ? `If ‘${factor}’ ${direction} about ${value}, the comparison changes, in this model.`
      : `If ‘${factor}’ ${direction} about ${value}, the most-supported option changes, in this model.`,
} as const

/**
 * Format a flip-threshold factor value with its OWN unit string (factor
 * space, not outcome space). Unit placement follows the app-wide
 * classifyUnit convention (symbol prefix, ISO space-prefix, % suffix,
 * generic space-suffix) — but unlike formatValueWithUnit, the value ALWAYS
 * renders as a number: a "crosses <value>" sentence must never substitute
 * a qualitative word for the producer's numeric threshold. Display
 * formatting only; the value itself is unchanged.
 */
export function formatFlipValue(value: number, unit?: string): string {
  const rendered = value.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  const { kind, canonical } = classifyUnit(unit ?? null)
  if (kind === 'symbol') return `${canonical}${rendered}`
  if (kind === 'iso') return `${canonical} ${rendered}`
  if (kind === 'percent') return `${rendered}%`
  if (kind === 'none' || kind === 'placeholder') return rendered
  return `${rendered} ${canonical}`
}

/**
 * ⭐ A TURNING POINT'S FIGURE, IN THE CARD'S NOTATION (post-run DIFF item 10,
 * 28 Sep 2026: the planted MRR track read `Below 700 GBP MRR added per month`
 * where the contract reads `Below 6.5%`).
 *
 * The same digits as `formatFlipValue` (en-GB, at most one decimal — nothing
 * re-rounded here), placed by the ONE compact-unit owner the factor card
 * reads (`compactUnitParts`), so the track and the value line above it spell
 * one unit one way: `GBP per month` → `£54.5`, `GBP MRR added per month` →
 * `£700`, `percent per month` → `7%`. A compound's remaining words (`/ month`,
 * `MRR added / month`) are the card's value line's, and are said in full by
 * `formatFlipReading` wherever a sentence names the unit. Any unit the owner
 * does not recognise prints exactly what `formatFlipValue` prints.
 */
export function formatFlipFigure(value: number, unit?: string): string {
  const rendered = value.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  const compact = compactUnitParts(rendered, unit ?? null)
  return compact !== null ? compact.figure : formatFlipValue(value, unit)
}

/** `formatFlipFigure` with the compound's words kept: `£700 MRR added / month`. */
export function formatFlipReading(value: number, unit?: string): string {
  const rendered = value.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  const compact = compactUnitParts(rendered, unit ?? null)
  return compact !== null ? joinCompactUnitParts(compact) : formatFlipValue(value, unit)
}

/**
 * The register wording for a threshold's direction against the current value:
 * `falls below` / `rises above` on a strict inequality with a numeric
 * baseline; `crosses` otherwise. Returns the register tokens so consumers
 * cannot drift apart on the words.
 */
export function flipDirectionWording(
  currentValue: number | null | undefined,
  flipValue: number,
): string {
  if (typeof currentValue === 'number' && flipValue < currentValue) {
    return FLIP_THRESHOLD_COPY.fallsBelow
  }
  if (typeof currentValue === 'number' && flipValue > currentValue) {
    return FLIP_THRESHOLD_COPY.risesAbove
  }
  return FLIP_THRESHOLD_COPY.crosses
}
