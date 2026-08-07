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

describe('formatGoalTarget', () => {
  it('renders a currency symbol as a prefix with thousand separators', () => {
    // The whole point of the 2.315(c) pair: £800,000, never "800000 £".
    expect(formatGoalTarget(800000, '£')).toBe('£800,000')
    expect(formatGoalTarget(1200, '$')).toBe('$1,200')
  })

  it('suppresses the "count" placeholder unit', () => {
    // `count` is the digit-string brief form's placeholder — a unit on no
    // scale. GoalNode and NodeInspector already drop it; this is the shared
    // rule that makes every surface agree.
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
