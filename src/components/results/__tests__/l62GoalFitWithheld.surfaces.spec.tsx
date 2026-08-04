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
 * Fixtures are producer bytes (see `utils/__tests__/fixtures/`). Assertions
 * bind by identity — exact option id, exact test id — never by a value
 * predicate a sibling option could satisfy (CLAUDE.md trap 19).
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): jsdom proves PRESENCE and ABSENCE of strings and
 * nodes in the rendered output. It proves nothing about layout or visibility.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { WinGauge } from '../WinGauge'
import { SuccessTargetRow } from '../SuccessTargetRow'
import { buildGoalFitRows } from '../../../canvas/components/model-tab/buildGoalFitRows'
import { GOAL_ANCHOR_COPY } from '../utils/goalAnchorCopy'
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

  it('POSITIVE CONTROL: an honest goal probability still produces one row per option, bound by id', () => {
    const honest = (L60_PRICING_OPTIONS as readonly ProducerOption[]).map((o, i) => ({
      ...o,
      probability_of_goal: 0.12 + i * 0.17,
    }))
    const rows = buildGoalFitRows(asOptionNodes(honest), asOptionProbabilities(honest))

    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(honest.length)
    for (const [i, o] of honest.entries()) {
      // IDENTITY-bound: the row for THIS option, found by id, carries THIS
      // option's probability. A `rows.find(r => r.probability === x)` would
      // pass on a builder that scrambled the pairing.
      const row = rows!.find((r) => r.id === o.id)
      expect(row, o.id).toBeDefined()
      expect(row!.probability).toBe(0.12 + i * 0.17)
      // And it is NOT flagged as a withheld/substituted voice: the possessive
      // is earned here.
      expect(row!.isSubstitutedJoint, o.id).toBe(false)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2. WinGauge — the results panel's goal block
// ───────────────────────────────────────────────────────────────────────────

function gaugeShares(options: readonly ProducerOption[]) {
  return options.map((o, i) => {
    // The hook's mapping, and only the hook's mapping — the flags come out of
    // the REAL selector, never hand-set, so this pins the producer shape
    // through the real chooser into the real component.
    const d = selectGoalProbability(o)
    return {
      id: o.id,
      label: o.label,
      winProbability: 0.4 - i * 0.05,
      isWinner: i === 0,
      goalProbability: d.goalProbability,
      nValidSamples: 10000,
      goalFitIsSubstitutedJoint:
        d.goalProbability != null && !d.mayUsePossessiveGoalFraming,
      goalFitWithheld: d.jointSubstitutionWithheld,
    }
  })
}

describe('L62 / WinGauge goal block', () => {
  for (const [name, options] of SHAPES) {
    it(`renders the honest-absence state, not a percentage and not the no-target invitation — ${name}`, () => {
      const { container } = render(
        <WinGauge shares={gaugeShares(options as readonly ProducerOption[])} />,
      )
      const text = container.textContent ?? ''

      // The withheld sentence, by test id and verbatim register copy.
      const block = container.querySelector('[data-testid="win-gauge-goal-not-scored"]')
      expect(block).not.toBeNull()
      expect(block!.textContent).toContain(GOAL_ANCHOR_COPY.notScored)
      expect(block!.textContent).toContain(GOAL_ANCHOR_COPY.notScoredReason)

      // NOT the no-target invitation: the user set a target / the run carried
      // limits, and asking them to set one would blame them for our silence.
      expect(container.querySelector('[data-testid="win-gauge-no-target"]')).toBeNull()
      expect(text).not.toContain(GOAL_ANCHOR_COPY.noTarget)
      expect(text).not.toContain(GOAL_ANCHOR_COPY.noTargetCta)

      // No goal figure at all — neither the number nor its label.
      expect(container.querySelector('[data-testid="win-gauge-goal-block"]')).toBeNull()
      expect(text).not.toContain(GOAL_ANCHOR_COPY.label(true))
      expect(text).not.toContain('< 1%')
      for (const o of options as readonly ProducerOption[]) {
        expect(container.querySelector(`[data-testid="goal-pct-${o.id}"]`), o.id).toBeNull()
      }

      // The comparative block is untouched — the gate withholds one claim, it
      // does not blank the panel.
      expect(container.querySelector('[data-testid="win-gauge-comparative-block"]')).not.toBeNull()
    })
  }

  it('POSITIVE CONTROL: an honest goal probability still draws the goal block, per option by id', () => {
    const honest = (L60_PRICING_OPTIONS as readonly ProducerOption[]).map((o, i) => ({
      ...o,
      probability_of_goal: 0.12 + i * 0.17,
    }))
    const { container } = render(<WinGauge shares={gaugeShares(honest)} />)
    const text = container.textContent ?? ''

    expect(container.querySelector('[data-testid="win-gauge-goal-block"]')).not.toBeNull()
    // The possessive is EARNED here, so the label is the possessive form.
    expect(text).toContain(GOAL_ANCHOR_COPY.label(false))
    expect(container.querySelector('[data-testid="win-gauge-goal-not-scored"]')).toBeNull()
    for (const o of honest) {
      expect(container.querySelector(`[data-testid="goal-pct-${o.id}"]`), o.id).not.toBeNull()
    }
  })

  it('POSITIVE CONTROL: a genuine NO-TARGET run still gets the no-target invitation, not the withheld sentence', () => {
    // No goal figure AND no joint figure — the ordinary state of a run the
    // user set no target on. Without this control, wiring every empty goal
    // block to the withheld copy would pass every test above.
    const noTarget = (L60_PRICING_OPTIONS as readonly ProducerOption[]).map((o, i) => ({
      id: o.id,
      label: o.label,
      winProbability: 0.4 - i * 0.05,
      isWinner: i === 0,
      goalProbability: null,
      nValidSamples: 10000,
      goalFitIsSubstitutedJoint: false,
      goalFitWithheld: false,
    }))
    const { container } = render(<WinGauge shares={noTarget} />)

    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-not-scored"]')).toBeNull()
    expect(container.textContent ?? '').toContain(GOAL_ANCHOR_COPY.noTarget)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 3. SuccessTargetRow — the fabricated shortfall
// ───────────────────────────────────────────────────────────────────────────

describe('L62 / the fabricated "typically misses by" distance', () => {
  it('does not render a shortfall for a missed constraint, in the user units or otherwise', () => {
    // The margin values are the producer's own, from the pricing run's
    // `constraint_margins` (a fraction) and the people run's (a head-count) —
    // the two cases the removed line rendered as bare, unitless digits.
    const { container } = render(
      <SuccessTargetRow
        goalThreshold={250000}
        constraintAnalysis={{
          joint_probability: 0,
          constraints: [
            {
              node_id: 'out_gross_margin',
              operator: '>=',
              threshold: 0.8,
              label: 'Gross Margin',
              prob_satisfied: 0,
              failure_margin_median: 0.5630574027128157,
              near_miss_fraction: 0,
              binding: true,
            },
            {
              node_id: 'risk_ae_attrition',
              operator: '<=',
              threshold: 2,
              label: 'Account executives lost',
              prob_satisfied: 0,
              failure_margin_median: 18.002137272472513,
              near_miss_fraction: 0,
              binding: false,
            },
          ],
        }}
      />,
    )
    const text = container.textContent ?? ''

    // Control: the rows themselves DID render, so the absences below are
    // about the shortfall line and not about an empty component.
    expect(container.querySelector('[data-testid="constraint-row-out_gross_margin"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="constraint-row-risk_ae_attrition"]')).not.toBeNull()

    // The removed claim, by wording and by value.
    expect(text).not.toContain('Typically misses by')
    expect(text).not.toContain('0.5630574027128157')
    expect(text).not.toContain('18.002137272472513')
    // …and no rounded rendering of either sneaking back in.
    expect(text).not.toMatch(/misses by/i)
  })
})
