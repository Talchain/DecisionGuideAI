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
  it.each(['decision', 'goal', 'action'])(
    '%s renders no reduced line — not done, deliberately not attempted (rowed)',
    kind => {
      expect(
        resolveLodMetricLine({
          nodeType: kind,
          data: { label: 'x', probability: 0.8, impact: 'high' },
          label: 'x',
          displayMetadata: meta({
            influence: 0.9,
            influenceProvenance: 'influence_score' as never,
            isResultsMode: true,
            winRate: 0.5,
            achievementProbability: 0.5,
            achievementProbabilityIsModelledBasis: false,
          }),
        }),
      ).toBeNull()
    },
  )
})
