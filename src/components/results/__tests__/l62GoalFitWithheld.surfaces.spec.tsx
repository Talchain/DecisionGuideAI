import { CHANCE_NOT_SHOWN_YET } from '../../../canvas/runView/runView'
/**
 * L62 — the withheld state, at the surfaces the user actually reads.
 *
 * The selector-level pins live in
 * `utils/__tests__/selectGoalProbability.l62Withhold.spec.ts`. This file pins
 * what the screens do with that decision, because a correct selector rendered
 * by a surface that falls back to a percentage, a placeholder glyph or the
 * wrong sentence is not a fix.
 *
 * Three surfaces, chosen because each was named in the diagnosis:
 *
 *  1. `buildGoalFitRows` — the Model tab's goal card. This is the surface in
 *     L60 screenshot 05, which printed "< 1% chance of meeting every target
 *     this run scored" four times directly under "Target: 250,000".
 *  2. `WinGauge` — the results panel's goal block, and the one place where
 *     "no goal number" previously collapsed into the NO-TARGET invitation.
 *  3. `SuccessTargetRow` — the only render of `failure_margin_median` in the
 *     repo: "Typically misses by {N}", the fabricated distance.
 *
 * #2747 re-scope 2 (DL ruling (A)): surface 2, `WinGauge`, is deleted in C (it drew raw win shares); its rows are deleted.
 *
 * Fixtures are producer bytes (see `utils/__tests__/fixtures/`). Assertions
 * bind by identity — exact option id, exact test id — never by a value
 * predicate a sibling option could satisfy (CLAUDE.md trap 19).
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): jsdom proves PRESENCE and ABSENCE of strings and
 * nodes in the rendered output. It proves nothing about layout or visibility.
 */

import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildGoalFitRows } from '../../../canvas/components/model-tab/buildGoalFitRows'
import { selectGoalProbability } from '../utils/selectGoalProbability'
import {
  L60_PRICING_OPTIONS,
  L60_PEOPLE_OPTIONS,
  L60_PROBE_OPTIONS,
} from '../utils/__tests__/fixtures/l60ProducerShapes'

const SHAPES = [
  ['pricing (draft-minted fraction, decision_grade FALSE)', L60_PRICING_OPTIONS],
  ['people (chat-minted count, decision_grade TRUE)', L60_PEOPLE_OPTIONS],
  ['probe (goal-target level, decision_grade TRUE)', L60_PROBE_OPTIONS],
] as const

type ProducerOption = { id: string; label: string; probability_of_joint_goal?: number }

/** `option_probabilities` keyed by node id, exactly as the report carries it. */
function asOptionProbabilities(options: readonly ProducerOption[]): Record<string, unknown> {
  return Object.fromEntries(options.map((o) => [o.id, o]))
}

function asOptionNodes(options: readonly ProducerOption[]): Node[] {
  return options.map((o) => ({
    id: o.id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label: o.label },
  })) as Node[]
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Model tab goal card — the screenshot-05 surface
// ───────────────────────────────────────────────────────────────────────────

describe('L62 / Model tab goal card (buildGoalFitRows)', () => {
  for (const [name, options] of SHAPES) {
    it(`returns NO rows for the witnessed shape — ${name}`, () => {
      // Control first: the fixture really is the substituting shape, so a
      // `null` below cannot be an artefact of an empty or malformed input.
      for (const o of options as readonly ProducerOption[]) {
        expect(selectGoalProbability(o).jointSubstitutionWithheld, o.id).toBe(true)
      }

      const rows = buildGoalFitRows(
        asOptionNodes(options as readonly ProducerOption[]),
        asOptionProbabilities(options as readonly ProducerOption[]),
      )
      // `GoalSection` renders the goal-fit block on
      // `goalFitRows && goalFitRows.length > 0`, so null is the honest-absence
      // state: no rows, no percentages, no "chance of meeting every target".
      expect(rows).toBeNull()
    })
  }

  it('raw goal probabilities without a licence produce withheld rows, bound by id', () => {
    const honest = (L60_PRICING_OPTIONS as readonly ProducerOption[]).map((o, i) => ({
      ...o,
      probability_of_goal: 0.12 + i * 0.17,
    }))
    const rows = buildGoalFitRows(asOptionNodes(honest), asOptionProbabilities(honest))

    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(honest.length)
    for (const o of honest) {
      // IDENTITY-bound: the row for THIS option, found by id, carries THIS
      // option's probability. A `rows.find(r => r.probability === x)` would
      // pass on a builder that scrambled the pairing.
      const row = rows!.find((r) => r.id === o.id)
      expect(row, o.id).toBeDefined()
      expect(row!.probability).toBeNull()
      expect(row!.chanceCell).toEqual({ kind: 'withheld', text: CHANCE_NOT_SHOWN_YET })
      expect(row!.chanceCell.text).not.toMatch(/\d+%/)
      expect(row!.chanceCell.text).not.toContain('Why?')
      expect(row!.isSubstitutedJoint, o.id).toBe(false)
    }
  })
})

// 2. WinGauge — #2747 re-scope 2 (DL ruling (A)): rows deleted, their only subject (WinGauge) was removed in C:
//    'renders the honest-absence state, not a percentage and not the no-target invitation — <shape>' (×3 shapes);
//    'POSITIVE CONTROL: an honest goal probability still draws the goal block, per option by id';
//    'POSITIVE CONTROL: a genuine NO-TARGET run still gets the no-target invitation, not the withheld sentence'.

// 3. SuccessTargetRow (the fabricated shortfall) was deleted by #2747 r2: it had no render site and showed constraint
//    probabilities no canonical cell licenses. Its absence is the guard.
