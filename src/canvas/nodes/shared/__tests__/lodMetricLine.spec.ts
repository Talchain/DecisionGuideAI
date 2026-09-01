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
  // ⚠⚠ THIS BLOCK ONCE PINNED `goal` AND `decision` AS RENDERING NOTHING; THIS
  // BRANCH THEN REPLACED THOSE PINS WITH ARMS OF ITS OWN; AND BOTH ARE NOW GONE
  // AGAIN, WHICH IS THE HONEST OUTCOME AND NOT A RETREAT.
  //
  // Neither card is blank any more — #1085 shipped both lines through
  // `BaseNode`'s `lodMetric` prop, which WINS over this resolver. A `goal` or
  // `decision` case here would therefore be code the mount can never reach, and
  // a spec asserting its precedence would be GREEN ABOUT NOTHING (CLAUDE.md
  // trap 13b). Proven by a mutant pair on the sibling risk arm: neutering the
  // resolver left the component spec green; neutering the component's own
  // `lodMetric` REDs it.
  //
  // So the scope this file pins is now exactly the two types it still owns
  // end-to-end — factor and option — and `action`, which nothing owns.
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

  // ⛔ THE TWO ARMS THAT WERE DELETED GET A PIN OF THEIR OWN, BECAUSE A
  // DELETION LEAVES NOTHING TO NOTICE IF IT COMES BACK. `goal` and `decision`
  // must resolve to `null` HERE — their lines are their owners' to declare, and
  // an arm re-added in this file would silently take precedence over nothing
  // while a reader believed it was live.
  //
  // ⚠⚠ THE FIXTURE IS DELIBERATELY OVER-SUPPLIED, AND THAT IS THE ONLY REASON
  // THIS GUARD DISCRIMINATES. My first version passed a bare `data` and no
  // `facts` at all — and a re-added decision arm SURVIVED it, measured, because
  // the arm read a fact the fixture did not carry and withheld for the wrong
  // reason. The test agreed with itself (CLAUDE.md trap 13b): it would have
  // reported a closed hole while the hole was open. So the inputs below carry
  // everything a goal arm or a decision arm could possibly read — a user-set
  // threshold, a CEE-backfilled one, a unit, and an option count — cast past
  // the narrowed `LodMetricFacts` PRECISELY BECAUSE the type no longer admits
  // the count, which is itself the thing being pinned.
  const OVER_SUPPLIED = {
    decisionOptionCount: 4,
    bridgeStrength: { signedMean: 0.45, bridgeStrengthPct: 45, bridgeIsEstimated: true },
    optionInterventionCount: 2,
    optionIsBaseline: false,
  } as unknown as Parameters<typeof resolveLodMetricLine>[0]['facts']

  it('goal and decision resolve to nothing HERE, even handed every fact an arm could want', () => {
    const goal = resolveLodMetricLine({
      nodeType: 'goal',
      data: {
        label: 'Grow ARR',
        threshold_source: 'user',
        success_threshold: 15,
        goal_threshold_raw: 15,
        goal_threshold_unit: 'percent',
      },
      label: 'Grow ARR',
      displayMetadata: NOTHING,
      facts: OVER_SUPPLIED,
    })
    const decision = resolveLodMetricLine({
      nodeType: 'decision',
      data: { label: 'Choose' },
      label: 'Choose',
      displayMetadata: NOTHING,
      facts: OVER_SUPPLIED,
    })
    // CONTRAST CONTROL, same call, same file, same `facts`: a type this module
    // DOES own. Without it, a resolver that had broken and returned `null` for
    // everything would pass the two assertions above.
    // ⚠ `raw_value`, not `{ value, unit }` — see the note on the stated-value
    // test above. My first fixture here used the latter, `factorDisplayText`
    // returned null for it, and this control caught it. Third time in this file.
    const factor = resolveLodMetricLine({
      nodeType: 'factor',
      data: { label: 'Unit cost', observedState: { raw_value: '£26,000' } },
      label: 'Unit cost',
      displayMetadata: NOTHING,
      facts: OVER_SUPPLIED,
    })
    expect(goal).toBeNull()
    expect(decision).toBeNull()
    expect(factor).not.toBeNull()
  })
})

describe('the pre-analysis arms, and the opposite-direction twin for each', () => {
  // ⚠ RISK AND OUTCOME ARE ABSENT FROM THIS BLOCK ON PURPOSE. They had
  // pre-analysis arms here (a bridge strength read from their edge to the
  // goal), with a twin apiece. #1074 shipped the same capability through
  // `RiskNode`/`OutcomeNode`'s own `lodMetric`, which wins before this function
  // is called — so those arms and their tests came out together. Their
  // behaviour is pinned where it actually renders, in
  // `__tests__/lodMetric.riskOutcome.spec.tsx`.

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
