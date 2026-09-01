/**
 * `resolveLodMetricLine` — what a card still says below the legibility floor.
 *
 * ⭐ THE MEASUREMENT THIS PINS. Driven as a guest on deployed `ec4cba73`, below
 * zoom 0.5: **15 of 15 factor bodies hidden, ZERO reduced lines rendered.** The
 * reduced line existed and was correct; it asked every factor for a STATED
 * VALUE, and on a real model most factors have never been given one. So the
 * first test here is the deployed defect written down: a factor with no stated
 * value, which used to render nothing and must now render its influence.
 *
 * ⚠ WHY A UNIT SPEC AND NOT A RENDER SPEC. jsdom cannot prove visibility
 * (CLAUDE.md trap 3), so a render test of a low-zoom card proves less than it
 * appears to. What is actually decidable here is the RULE — which datum a node
 * type falls back to, and when a figure must be withheld — and that is a pure
 * function. Whether the line reaches the screen is pinned by the existing
 * `BaseNode.lodBodyLine.spec.tsx` (mounting) and belongs, for the geometry
 * claim, to the real-browser harness.
 */
import { describe, it, expect } from 'vitest'
import { resolveLodMetricLine } from '../lodMetricLine'
import type { NodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

/** Everything null — each test turns on exactly the field it is about. */
const NOTHING: NodeDisplayMetadata = {
  sensitivityRank: null,
  influence: null,
  influenceProvenance: null,
  confidence: null,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  achievementProbabilityBasis: null,
  jointGoalProbability: null,
  stabilityPercentage: null,
  winRate: null,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
  isResultsMode: false,
} as unknown as NodeDisplayMetadata

const meta = (o: Partial<NodeDisplayMetadata>): NodeDisplayMetadata =>
  ({ ...NOTHING, ...o }) as NodeDisplayMetadata

describe('the deployed defect: a factor with no stated value said nothing', () => {
  it('falls back to the influence score the card already shows', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Team capacity' },
        label: 'Team capacity',
        displayMetadata: meta({ influence: 0.62, influenceProvenance: 'influence_score' as never }),
      }),
    ).toBe('Influence 62%')
  })

  it('CONTRAST CONTROL — the same node with NO influence still says nothing, so the line above is the influence and not a default', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Team capacity' },
        label: 'Team capacity',
        displayMetadata: meta({ influence: null, influenceProvenance: 'influence_score' as never }),
      }),
    ).toBeNull()
  })

  it('fails CLOSED without provenance — the same gate FactorNode’s own influence row uses', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Team capacity' },
        label: 'Team capacity',
        displayMetadata: meta({ influence: 0.62, influenceProvenance: null }),
      }),
    ).toBeNull()
  })

  it('influence is a FALLBACK, never a replacement: a stated value still wins', () => {
    const line = resolveLodMetricLine({
      nodeType: 'factor',
      // ⚠ `raw_value`, not `{ value, unit }`. My first fixture used the latter
      // and `factorDisplayText` returned null for it, so the test failed while
      // the CLAIM was right — the second time in this lane a test failed for
      // being pointed at the wrong bytes. Probed rather than assumed.
      data: { label: 'Unit cost', observedState: { raw_value: '£26,000' } },
      label: 'Unit cost',
      displayMetadata: meta({ influence: 0.62, influenceProvenance: 'influence_score' as never }),
    })
    expect(line).not.toBeNull()
    expect(line).not.toContain('Influence')
    expect(line).toContain('26')
  })
})

describe('the other three types, which rendered nothing at any zoom before', () => {
  it('an option says where it stands, as a figure and not the comparative sentence', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'option',
        data: { label: 'Build' },
        label: 'Build',
        displayMetadata: meta({ isResultsMode: true, winRate: 0.47 }),
      }),
    ).toBe('Ahead 47%')
  })

  it('and says nothing before a run — a win share with no run behind it is a fabrication', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'option',
        data: { label: 'Build' },
        label: 'Build',
        displayMetadata: meta({ isResultsMode: false, winRate: 0.47 }),
      }),
    ).toBeNull()
  })

  it('a risk says its severity band — qualitative, so it needs no caveat and no unit', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Vendor lock-in', probability: 0.8, impact: 'high' },
        label: 'Vendor lock-in',
        displayMetadata: NOTHING,
      }),
    ).toBe('High risk')
  })

  it('a risk missing half its inputs says nothing rather than guessing a band', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Vendor lock-in', probability: 0.8 },
        label: 'Vendor lock-in',
        displayMetadata: NOTHING,
      }),
    ).toBeNull()
  })
})

describe('⛔ the caveat gate: a figure that needs a disclosure may not ride one line', () => {
  /*
   * THE DISCRIMINATING PAIR. Same node, same probability, two bases. If the
   * gate were dead, both would render; if the figure were simply absent, both
   * would be null. Only a live gate gives one of each — which is what makes
   * this pair evidence and either test alone worthless.
   */
  const data = { label: 'Margin holds' }
  const probability = 0.7

  it('shows the figure on the basis that carries no mandatory caveat', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'outcome',
        data,
        label: 'Margin holds',
        displayMetadata: meta({
          achievementProbability: probability,
          achievementProbabilityIsModelledBasis: false,
        }),
      }),
    ).toBe('Achievement 70%')
  })

  it('WITHHOLDS it on the modelled basis, where OutcomeNode is required to render the caveat beside it', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'outcome',
        data,
        label: 'Margin holds',
        displayMetadata: meta({
          achievementProbability: probability,
          achievementProbabilityIsModelledBasis: true,
        }),
      }),
    ).toBeNull()
  })
})

describe('scope, pinned so it cannot widen by accident', () => {
  // ⚠ THIS BLOCK USED TO PIN `decision` AND `goal` AS RENDERING NOTHING, AND
  // THAT PIN WAS CORRECT WHEN WRITTEN AND IS NOW WRONG. Both were "deliberately
  // not attempted" — and the consequence, measured in a browser on deployed
  // `f3b1ca87`, was that the goal (the most important card on the canvas) and
  // the decision (its anchor) were BLANK BOXES on every pre-analysis model at
  // every zoom below 0.5. A deliberate non-attempt is still a blank card to the
  // person looking at it. The pins are REPLACED, not deleted, so the scope stays
  // stated rather than drifting.
  it('action is still deliberately not attempted — the one type this change does not touch', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'action',
        data: { label: 'x', probability: 0.8, impact: 'high' },
        label: 'x',
        displayMetadata: meta({
          influence: 0.9,
          influenceProvenance: 'influence_score' as never,
          isResultsMode: true,
          winRate: 0.5,
        }),
      }),
    ).toBeNull()
  })

  it('a goal with no target says so — the state EVERY model is in before somebody sets one', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'goal',
        data: { label: 'Grow ARR' },
        label: 'Grow ARR',
        displayMetadata: NOTHING,
      }),
    ).toBe('No target set')
  })

  it('a goal WITH a user-set target states it, through the shared unit authority', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'goal',
        data: {
          label: 'Grow ARR',
          threshold_source: 'user',
          success_threshold: 15,
          goal_threshold_unit: 'percent',
        },
        label: 'Grow ARR',
        displayMetadata: NOTHING,
      }),
    ).toBe('Target: 15%')
  })

  it('CONTRAST CONTROL — a CEE-backfilled threshold is read too, so the line is not keyed to one field', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'goal',
        data: { label: 'Grow ARR', goal_threshold_raw: 800000, goal_threshold_unit: '£' },
        label: 'Grow ARR',
        displayMetadata: NOTHING,
      }),
    ).toBe('Target: £800,000')
  })

  it('a decision counts the options it compares', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'decision',
        data: { label: 'Choose' },
        label: 'Choose',
        displayMetadata: NOTHING,
        facts: { decisionOptionCount: 4 },
      }),
    ).toBe('4 options')
  })

  it('singular is not a plural with an s bolted on', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'decision',
        data: { label: 'Choose' },
        label: 'Choose',
        displayMetadata: NOTHING,
        facts: { decisionOptionCount: 1 },
      }),
    ).toBe('1 option')
  })

  it('⛔ WITHHOLD vs ZERO — an UNKNOWN count says nothing; a KNOWN zero says the model has no options yet', () => {
    // The two must never collapse. A decision with no options linked is a real
    // and useful thing to be told; a decision whose count could not be
    // established must not be told as "none".
    const withUnknown = resolveLodMetricLine({
      nodeType: 'decision',
      data: { label: 'Choose' },
      label: 'Choose',
      displayMetadata: NOTHING,
      facts: {},
    })
    const withZero = resolveLodMetricLine({
      nodeType: 'decision',
      data: { label: 'Choose' },
      label: 'Choose',
      displayMetadata: NOTHING,
      facts: { decisionOptionCount: 0 },
    })
    expect(withUnknown).toBeNull()
    expect(withZero).toBe('No options linked yet')
  })
})

describe('the pre-analysis arms, and the opposite-direction twin for each', () => {
  it('a risk with neither probability nor impact reads its strength to the goal', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Churn' },
        label: 'Churn',
        displayMetadata: NOTHING,
        facts: { bridgeStrength: { signedMean: -0.45, bridgeStrengthPct: 45, bridgeIsEstimated: true } },
      }),
    ).toBe('Strength 45% · est.')
  })

  it('TWIN — a risk that HAS a severity band still says the band, unchanged', () => {
    // The new arm may only be reached where the old one returned null. A fix
    // for a blank card must not change a card that was already speaking.
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Churn', probability: 0.8, impact: 'high' },
        label: 'Churn',
        displayMetadata: NOTHING,
        facts: { bridgeStrength: { signedMean: -0.45, bridgeStrengthPct: 45, bridgeIsEstimated: true } },
      }),
    ).toBe('High risk')
  })

  it('a user-stated strength carries no estimate marker — the marker is a claim about provenance', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Churn' },
        label: 'Churn',
        displayMetadata: NOTHING,
        facts: { bridgeStrength: { signedMean: 0.45, bridgeStrengthPct: 45, bridgeIsEstimated: false } },
      }),
    ).toBe('Strength 45%')
  })

  it('CONTRAST CONTROL — no bridge edge, no line: the strength is read and never defaulted', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { label: 'Churn' },
        label: 'Churn',
        displayMetadata: NOTHING,
        facts: { bridgeStrength: null },
      }),
    ).toBeNull()
  })

  it('an outcome whose achievement figure is WITHHELD by the caveat gate falls back to strength, never to the withheld number', () => {
    const line = resolveLodMetricLine({
      nodeType: 'outcome',
      data: { label: 'ARR' },
      label: 'ARR',
      displayMetadata: meta({
        achievementProbability: 0.62,
        achievementProbabilityIsModelledBasis: true,
      }),
      facts: { bridgeStrength: { signedMean: 0.65, bridgeStrengthPct: 65, bridgeIsEstimated: true } },
    })
    expect(line).toBe('Strength 65% · est.')
    // The gate still holds: the withheld figure does not appear by any route.
    expect(line).not.toContain('62')
  })

  it('TWIN — an outcome on a clean basis still states its achievement probability', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'outcome',
        data: { label: 'ARR' },
        label: 'ARR',
        displayMetadata: meta({
          achievementProbability: 0.62,
          achievementProbabilityIsModelledBasis: false,
        }),
        facts: { bridgeStrength: { signedMean: 0.65, bridgeStrengthPct: 65, bridgeIsEstimated: true } },
      }),
    ).toBe('Achievement 62%')
  })

  it('a baseline option says what its card says, and NOT what its backfilled interventions say', () => {
    // Measured: the Headcount starter backfills interventions onto all four
    // options, the status-quo one included. Reading the count alone produced
    // "Changes 2 factors" on the card whose body reads "No changes to factors".
    expect(
      resolveLodMetricLine({
        nodeType: 'option',
        data: { label: 'Freeze Hiring (Status Quo)' },
        label: 'Freeze Hiring (Status Quo)',
        displayMetadata: NOTHING,
        facts: { optionIsBaseline: true, optionInterventionCount: 2 },
      }),
    ).toBe('No changes to factors')
  })

  it('a non-baseline option states how many factors it changes', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'option',
        data: { label: 'Hire Four' },
        label: 'Hire Four',
        displayMetadata: NOTHING,
        facts: { optionIsBaseline: false, optionInterventionCount: 2 },
      }),
    ).toBe('Changes 2 factors')
  })

  it('TWIN — after a run the win share still wins, whatever the change count is', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'option',
        data: { label: 'Hire Four' },
        label: 'Hire Four',
        displayMetadata: meta({ isResultsMode: true, winRate: 0.41 }),
        facts: { optionIsBaseline: false, optionInterventionCount: 2 },
      }),
    ).toBe('Ahead 41%')
  })

  it('a factor with a prior range reads it when it has no stated value and no influence', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Attrition', category: 'external', prior: { range_min: 0.3, range_max: 0.9 } },
        label: 'Attrition',
        displayMetadata: NOTHING,
      }),
    ).toBe('Range: 0.3 to 0.9')
  })

  it('TWIN — influence still outranks the range, so no post-analysis card changes', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Attrition', category: 'external', prior: { range_min: 0.3, range_max: 0.9 } },
        label: 'Attrition',
        displayMetadata: meta({ influence: 0.67, influenceProvenance: 'influence_score' as never }),
      }),
    ).toBe('Influence 67%')
  })

  it('CONTRAST CONTROL — a CONTROLLABLE factor with the same prior says nothing, so the arm is the external gate and not a default', () => {
    expect(
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Attrition', category: 'controllable', prior: { range_min: 0.3, range_max: 0.9 } },
        label: 'Attrition',
        displayMetadata: NOTHING,
      }),
    ).toBeNull()
  })
})
