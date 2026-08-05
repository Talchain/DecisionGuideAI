/**
 * formatGoalTarget — the single unit-STRING mapping for goal-target display.
 *
 * ROADMAP 2.315(c). This is a CONSOLIDATION, not a new formatting authority:
 * every branch delegates rendering to `formatTargetValue` (the estate's
 * goal-target primitive, already used by GoalNode, NodeInspector and
 * SuccessTargetRow) and every unit decision comes from
 * `classifyUnit` (the single-source classifier in src/utils/unitClassifier).
 *
 * WHY IT WAS NEEDED
 * -----------------
 * `formatTargetValue` takes a STRUCTURED unit kind ('currency' | 'percent' |
 * 'count'), but CEE sends a unit STRING ('£', 'percent', 'count', 'months').
 * Every caller therefore grew its own string→kind mapping, and by 2026-08 the
 * three had drifted:
 *
 *   GoalNode.tsx      percent → rounded; 'count'/'' → bare; currency → symbol;
 *                     otherwise "N unit"                        ← correct
 *   NodeInspector.tsx ANY non-count, non-percent unit → 'currency', so a
 *                     "months" target renders as "months9"      ← latent bug
 *   GoalPanel.tsx     no mapping at all: `{value}{' ' + unit}`, so an
 *                     £800,000 target rendered "800000 £"       ← ROADMAP 2.315(c)
 *
 * The mapping below is GoalNode's — the surface that was already right —
 * extracted verbatim in behaviour so the canvas card and Inspector v2 cannot
 * state different strings about one goal.
 *
 * WHY `formatValueWithUnit` IS NOT USED HERE
 * -----------------------------------------
 * `src/canvas/utils/formatValueWithUnit.ts` turns any 0–1 magnitude carrying
 * no real unit into a QUALITATIVE WORD ("0.8" → "very high"). That is right
 * for a factor's observed state and catastrophic for a target sentence: a
 * goal still held on the normalised scale would read "Success means reaching
 * ≥ very high". (It is the same hazard #561 review item A3 pinned — the
 * qualitative branch keys on `classifyUnit(unit).kind` and the 0–1 bound, not
 * on whether the magnitude is raw.) The model-tab sibling
 * (`components/model-tab/utils.ts`) is scoped to observed states and has no
 * percent branch at all, so it would render "20 %".
 *
 * DECLARED, DELIBERATE INHERITANCE — ISO SPACING
 * ----------------------------------------------
 * An ISO code renders with NO space ("GBP800,000") because `formatTargetValue`
 * treats its third argument as a symbol. That is the canvas card's existing
 * output; preserving it keeps this extraction behaviour-preserving for the
 * card. It differs from `formatValueWithUnit`'s §2.4 spec ("ISO prefix WITH a
 * space") and is pinned in the spec so a future correction is a decision
 * rather than a drift.
 *
 * `'count'` IS SUPPRESSED, AND THAT IS THE ESTATE'S EXISTING RULE
 * --------------------------------------------------------------
 * The digit-string brief form mints `goal_threshold_unit: "count"` (the wire
 * type documents it: `adapters/cee/types.ts`, "e.g. \"count\", \"USD\""). It
 * is a placeholder on no real-world scale, and it is in neither COUNT_UNITS
 * (which is about whole-number ROUNDING of headcounts) nor
 * GENERIC_PLACEHOLDER_UNITS. Three existing authorities already drop it —
 * GoalNode (`u === 'count'`), NodeInspector (`unitStr !== 'count'`) and
 * `formatTargetValue`'s own 'count' kind, which decorates nothing. Inspector
 * v2 was the one surface printing it. This function makes the rule shared
 * rather than triplicated; it deliberately does NOT add 'count' to
 * GENERIC_PLACEHOLDER_UNITS, which would silently change factor and
 * intervention rendering estate-wide.
 */
import { classifyUnit } from '../../../utils/unitClassifier'
import { formatTargetValue } from './formatTargetValue'

/**
 * Render a goal target magnitude with its unit.
 *
 * @param value - the target magnitude, in the units `unit` describes
 * @param unit  - the unit string as the producer sent it (may be absent)
 * @returns the display string, or `null` when `value` is not a finite number —
 *          callers show no target rather than "≥ NaN".
 */
export function formatGoalTarget(value: number, unit: string | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const { kind, canonical } = classifyUnit(unit ?? null)

  // Percent: rounded to whole percentage points, as the canvas card does.
  if (kind === 'percent') return formatTargetValue(Math.round(value), 'percent')

  // No unit, or the 'count' placeholder — render the bare magnitude.
  const trimmed = typeof unit === 'string' ? unit.trim() : ''
  if (kind === 'none' || trimmed.toLowerCase() === 'count') return formatTargetValue(value)

  // Currency, symbol or ISO code, prefixed.
  if (kind === 'symbol' || kind === 'iso') return formatTargetValue(value, 'currency', canonical)

  // A real unit ('months', 'users', …) or a generic placeholder — suffixed.
  return `${value.toLocaleString()} ${canonical}`
}
