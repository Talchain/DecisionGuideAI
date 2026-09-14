/**
 * formatGoalTarget — the ONE goal-target unit-string mapping (ROADMAP 2.315(c)).
 *
 * WHY THIS EXISTS RATHER THAN A FOURTH FORMATTER
 * ----------------------------------------------
 * `formatTargetValue` is already the estate's goal-target primitive — named
 * for the job and used by the canvas GoalNode, NodeInspector and
 * SuccessTargetRow. But it takes a STRUCTURED unit kind
 * ('currency' | 'percent' | 'count'), never the unit STRING that CEE actually
 * sends, so every caller hand-rolled the string→kind mapping and the three
 * copies drifted:
 *
 *   GoalNode.tsx      percent → round; 'count'/'' → bare; currency → symbol;
 *                     else "N unit"
 *   NodeInspector.tsx percent → as-is; ANY non-count unit → 'currency'
 *                     (so "months" renders as a currency symbol)
 *   GoalPanel.tsx     no mapping at all — `{value}{' ' + unit}`
 *
 * This module is that mapping, extracted from GoalNode (the surface that was
 * already correct) so the canvas card and Inspector v2 cannot state different
 * strings for one goal. It renders NOTHING itself: every branch delegates to
 * `formatTargetValue`, and unit classification comes from the single-source
 * `classifyUnit`. It is a consolidation, not a new authority.
 *
 * DELIBERATELY PRESERVED FROM GoalNode, NOT "FIXED" HERE
 * -----------------------------------------------------
 * An ISO code renders WITHOUT a space ("GBP800,000") because
 * `formatTargetValue` treats the third argument as a symbol. That is the
 * canvas card's existing output and changing it is a separate, visible copy
 * change; it is pinned below so the choice is deliberate and any future fix
 * is a decision rather than a drift.
 */
import { describe, it, expect } from 'vitest'
import { formatGoalTarget } from '../formatGoalTarget'
import { unitIsDisplayable } from '../../../../utils/unitClassifier'

describe('formatGoalTarget', () => {
  it('renders a currency symbol as a prefix with thousand separators', () => {
    // The whole point of the 2.315(c) pair: £800,000, never "800000 £".
    expect(formatGoalTarget(800000, '£')).toBe('£800,000')
    expect(formatGoalTarget(1200, '$')).toBe('$1,200')
  })

  it('suppresses the "count" placeholder unit', () => {
    /**
     * `count` is the digit-string brief form's sentinel — a unit on no scale.
     *
     * ⚠ THIS COMMENT USED TO CLAIM THIS WAS "the shared rule that makes every
     * surface agree", and it was not: the rule lived here as a hand-written
     * `=== 'count'` literal, `goalConstraintText` and `NodeInspector` kept
     * their own, and the Model tab outline had none and printed "800,000
     * count" at a reader for weeks. Since 11 Sep 2026 the rule genuinely is
     * shared — `unitIsDisplayable` — and this function consumes it.
     */
    expect(formatGoalTarget(800000, 'count')).toBe('800,000')
    expect(formatGoalTarget(42, 'Count')).toBe('42')
    expect(formatGoalTarget(42, '  count ')).toBe('42')
  })

  it('suppresses an absent, empty or whitespace-only unit', () => {
    expect(formatGoalTarget(800000, null)).toBe('800,000')
    expect(formatGoalTarget(800000, undefined)).toBe('800,000')
    expect(formatGoalTarget(800000, '')).toBe('800,000')
    // Pristine GoalNode left a trailing space here (it lower-cased without
    // trimming); trimming is the same direction the U2 fix already took.
    expect(formatGoalTarget(800000, '   ')).toBe('800,000')
  })

  it('renders percent through classifyUnit, including the words CEE emits', () => {
    expect(formatGoalTarget(85, '%')).toBe('85%')
    expect(formatGoalTarget(85, 'percent')).toBe('85%')
    expect(formatGoalTarget(85, 'percentage')).toBe('85%')
    // Rounded, exactly as the canvas card does.
    expect(formatGoalTarget(84.6, '%')).toBe('85%')
  })

  it('renders a real unit as a trailing suffix', () => {
    expect(formatGoalTarget(9, 'months')).toBe('9 months')
    expect(formatGoalTarget(1500, 'users')).toBe('1,500 users')
  })

  it('suppresses a generic placeholder unit, as every sibling surface does', () => {
    /**
     * ⭐ A BEHAVIOUR CHANGE, MADE BY ROADMAP 2.315(c) LIMB (c) ON 11 Sep 2026,
     * AND IT WAS NEVER PINNED BEFORE — this file had no placeholder row at all,
     * so "8 scale" was untested behaviour falling through the suffix tail.
     *
     * It made this function the OUTLIER. `computeSuccessState:84`,
     * `goalConstraintText:24`, `flipThresholdDisplay:78`,
     * `canvas/utils/formatValueWithUnit:147`, `FactorsSection:548`,
     * `AllImprovements:1039` and `ScientificEditor:250` all already drop a
     * placeholder unit. Reached by GoalNode, GoalPanel and SuccessTargetLine.
     */
    expect(formatGoalTarget(8, 'scale')).toBe('8')
    expect(formatGoalTarget(8, 'index')).toBe('8')
    expect(formatGoalTarget(8, 'score')).toBe('8')
    expect(formatGoalTarget(8, 'units')).toBe('8')
    // The magnitude survives: the defect is the dangling word, not the number.
    expect(formatGoalTarget(800000, 'scale')).toBe('800,000')
  })

  it('takes its unit decision from the ONE predicate, not a local literal', () => {
    /**
     * The suppression rule is `unitIsDisplayable`; this pins the agreement so a
     * future edit cannot quietly reintroduce a fifth hand-written copy of
     * "is this unit worth showing?". Expectations are literal strings, so this
     * is not the predicate agreeing with itself — it asserts the OUTPUT SHAPE
     * that the predicate's two verdicts must produce.
     */
    for (const suppressed of ['count', 'scale', 'index', 'norm', 'normalised', '']) {
      expect(unitIsDisplayable(suppressed), suppressed).toBe(false)
      expect(formatGoalTarget(4200, suppressed), suppressed).toBe('4,200')
    }
    for (const shown of ['months', 'users', 'FTE']) {
      expect(unitIsDisplayable(shown), shown).toBe(true)
      expect(formatGoalTarget(4200, shown), shown).toBe(`4,200 ${shown}`)
    }
  })

  it('pins the ISO-code spacing inherited from the canvas card (declared, not endorsed)', () => {
    // Documented departure from formatValueWithUnit's §2.4 spec ("ISO prefix
    // WITH a space"). Preserved so this extraction is behaviour-preserving for
    // the canvas card; changing it is a separate copy decision.
    expect(formatGoalTarget(800000, 'GBP')).toBe('GBP800,000')
  })

  it('returns null for a non-finite value rather than rendering "NaN" at the user', () => {
    // The caller decides what to show instead; a target sentence reading
    // "Success means reaching ≥ NaN" is worse than no sentence. Callers that
    // already have their own non-finite handling (GoalNode, which echoes the
    // original string) keep it and never reach this branch.
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(formatGoalTarget(bad, '£')).toBeNull()
    }
    expect(formatGoalTarget(0, '£')).toBe('£0')
  })
})
