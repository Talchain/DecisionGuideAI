/**
 * "What Olumi assumed" discloses the option→factor effect values THE MODEL CHOSE.
 *
 * THE DEFECT, journey-witnessed on the deployed build. A numberless "build vs
 * buy" brief reached a completed analysis whose 15 of 15 interventions carried
 * `source: 'cee_hypothesis'` / `value_confidence: 'low'`. The analysis rendered
 * 69.7% / 18.6% / 11.7% win probabilities and "…came out ahead in 70% of runs of
 * this model" — computed entirely from those 15 invented numbers. The Inspector
 * disclosed it; the analysis result surface did not, while its own subtitle
 * PROMISED it ("Top drivers, the values Olumi assumed, and what could change").
 *
 * Presence test on the deployed capture, contrast controls in the same run:
 *   `Behind this result`          = 1
 *   `the values Olumi assumed`    = 1   ← the promise
 *   `What Olumi assumed`          = 0   ← the group, absent
 *   `What could change`           = 2   ← sibling group, control ✅
 *   `Zephyr9f2a`                  = 0   ← negative control ✅
 *
 * ⭐⭐ THE MERGE GATE IS BOTH DIRECTIONS IN ONE RUN. This is the two-opposite-
 * harms shape (CLAUDE.md 22b): failing to label an invented value is a SILENT
 * LIE, and labelling a user-stated value as an Olumi estimate is the MACHINE
 * CLAIMING AUTHORSHIP OF THE USER'S OWN FIGURE. They cannot share one predicate
 * and neither may be traded for the other, so every case below has its
 * opposite-direction twin, and `T-BOTH-DIRECTIONS` asserts both on ONE fixture
 * drawn from the witnessed contrast draw (7 `cee_hypothesis` + 1
 * `brief_extraction`).
 *
 * ⚠ WHAT THIS FILE DOES NOT PROVE. jsdom proves PRESENCE IN THE DOM, never
 * visibility, layout or paint. The rung these render cases earn is MOUNTED —
 * that the surface the deployed flags already render now contains the
 * disclosure. `T-MOUNT-PATH` binds to the mount path itself so the binding REDs
 * if the group stops being rendered by `DecisionBriefSection`.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  selectEstimatedInterventions,
  formatEstimatedInterventionNote,
  ESTIMATED_INTERVENTION_MARK,
  type EstimatedInterventionNode,
} from '../estimatedInterventions'
import { DecisionBriefSection } from '../DecisionBriefSection'
import type { DecisionBriefViewModel } from '../decisionBriefViewModel'

const OPTION_ID = 'opt_build'
const OPTION_LABEL = 'Build in-house'
const FACTOR_ID = 'fac_ttm'
const FACTOR_LABEL = 'Time to market'

function factorNode(id: string, label: string): EstimatedInterventionNode {
  return { id, type: 'factor', data: { label } }
}

/**
 * An option node carrying interventions in the NESTED V3 form — the shape on
 * which the producer's `source` stamp survives to the canvas. Modelled on the
 * real capture shape in `starters/data/headcount-allocation.draft.json`.
 */
function optionNode(
  interventions: Record<string, unknown>,
  { id = OPTION_ID, label = OPTION_LABEL }: { id?: string; label?: string } = {},
): EstimatedInterventionNode {
  return { id, type: 'option', data: { label, interventions } }
}

const invented = (value = 0.6) => ({
  value,
  source: 'cee_hypothesis',
  value_confidence: 'low',
  reasoning: 'Olumi estimate via edge ae74222f; no stated figure is cited for this option→factor effect',
})

const fromBrief = (value = 0.4) => ({
  value,
  source: 'brief_extraction',
  value_confidence: 'high',
  reasoning: 'Direct from the brief',
})

const userSet = (value = 0.5) => ({ value, source: 'user_specified', value_confidence: 'high' })

describe('selectEstimatedInterventions — the model-chosen values', () => {
  it('T-DISCLOSE: a cee_hypothesis intervention is disclosed, bound by option and factor identity', () => {
    const rows = selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: invented() }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])

    expect(rows).toHaveLength(1)
    // IDENTITY, never a value predicate another row could satisfy (trap 19).
    expect(rows[0].optionId).toBe(OPTION_ID)
    expect(rows[0].factorId).toBe(FACTOR_ID)
    expect(rows[0].optionLabel).toBe(OPTION_LABEL)
    expect(rows[0].factorLabel).toBe(FACTOR_LABEL)
  })

  it('T-SILENT-BRIEF: a brief_extraction value is NOT labelled an Olumi estimate', () => {
    const rows = selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: fromBrief() }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])
    expect(rows).toEqual([])
  })

  it('T-SILENT-USER: a user_specified value is NOT labelled an Olumi estimate', () => {
    const rows = selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: userSet() }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])
    expect(rows).toEqual([])
  })

  /**
   * The bare flattened form CEE sends on `analysis_ready` carries no provenance,
   * and `normaliseOptionFromCEE` no longer invents one. An unstamped record is
   * therefore silent — the honest answer, not a convenient one.
   */
  it('T-SILENT-ABSENT: an intervention with no source stamp discloses nothing', () => {
    expect(selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: { value: 0.6 } }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])).toEqual([])

    // The bare-number form, straight off the wire.
    expect(selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: 0.6 }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])).toEqual([])
  })

  it('T-SILENT-UNKNOWN: an unrecognised source literal fails closed', () => {
    expect(selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: { value: 0.6, source: 'some_future_literal' } }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])).toEqual([])
  })

  /**
   * ⭐⭐ THE MERGE GATE. One fixture, both directions, drawn from the witnessed
   * contrast draw: the same brief WITH figures produced `cee_hypothesis`/low
   * rows alongside a `brief_extraction`/high row. The invented values must be
   * named AND the user's own figure must not be.
   */
  it('T-BOTH-DIRECTIONS: on one node, invented values are disclosed and the user-stated one is not', () => {
    const rows = selectEstimatedInterventions([
      optionNode({
        fac_ttm: invented(0.6),
        fac_cost: invented(0.3),
        fac_control: fromBrief(0.8),
      }),
      factorNode('fac_ttm', 'Time to market'),
      factorNode('fac_cost', 'Total cost'),
      factorNode('fac_control', 'Engineering control'),
    ])

    expect(rows.map(r => r.factorId).sort()).toEqual(['fac_cost', 'fac_ttm'])
    // The user's stated figure is absent from the disclosure entirely — asserted
    // on the rendered NOTES too, not only on the row set, because the note is
    // what a user reads.
    const notes = rows.map(r => r.note).join(' ')
    expect(notes).toContain('Time to market')
    expect(notes).toContain('Total cost')
    expect(notes).not.toContain('Engineering control')
  })

  it('T-NO-VALUE: an intervention with no usable number discloses nothing', () => {
    expect(selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: { source: 'cee_hypothesis', value: null } }),
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])).toEqual([])
  })

  it('T-NON-OPTION: interventions hung on a non-option node are not described as an option effect', () => {
    expect(selectEstimatedInterventions([
      { id: 'fac_x', type: 'factor', data: { label: 'A factor', interventions: { [FACTOR_ID]: invented() } } },
      factorNode(FACTOR_ID, FACTOR_LABEL),
    ])).toEqual([])
  })

  it('T-UNNAMED: a row whose factor or option cannot be named honestly is dropped, never id-filled', () => {
    // Factor absent from the graph entirely.
    expect(selectEstimatedInterventions([
      optionNode({ missing_factor: invented() }),
    ])).toEqual([])

    // Id-shaped label — withheld, never prettified.
    expect(selectEstimatedInterventions([
      optionNode({ [FACTOR_ID]: invented() }),
      factorNode(FACTOR_ID, '3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
    ])).toEqual([])
  })

  it('T-CAP: more model-chosen values than the cap TRUNCATE, never empty the group', () => {
    const interventions: Record<string, unknown> = {}
    const factors: EstimatedInterventionNode[] = []
    for (let i = 0; i < 15; i += 1) {
      interventions[`fac_${i}`] = invented()
      factors.push(factorNode(`fac_${i}`, `Factor ${i}`))
    }
    const rows = selectEstimatedInterventions([optionNode(interventions), ...factors])
    expect(rows).toHaveLength(10)
  })

  it('T-EMPTY: no nodes, or a malformed nodes argument, is an empty disclosure not a throw', () => {
    expect(selectEstimatedInterventions([])).toEqual([])
    expect(selectEstimatedInterventions(null)).toEqual([])
    expect(selectEstimatedInterventions(undefined)).toEqual([])
  })
})

describe('the copy', () => {
  const note = formatEstimatedInterventionNote(OPTION_LABEL, FACTOR_LABEL)

  it('T-VOCAB: reuses the shipped Inspector phrasing rather than minting a third synonym', () => {
    expect(note).toContain(ESTIMATED_INTERVENTION_MARK)
    expect(ESTIMATED_INTERVENTION_MARK).toBe('Estimated by Olumi')
  })

  it('T-AUTHOR: says plainly that Olumi supplied the number and the user did not', () => {
    expect(note).toContain('No figure for this was stated in your brief')
    expect(note).toContain(OPTION_LABEL)
    expect(note).toContain(FACTOR_LABEL)
  })

  /**
   * The wire says `value_confidence: 'low'`. This copy neither upgrades it nor
   * renders it: a score or percentage would be a second invented quantity
   * layered over the first.
   */
  it('T-NO-CLAIM: invents no confidence, probability or numeric score', () => {
    expect(note).not.toMatch(/\d/)
    expect(note).not.toMatch(/%/)
    expect(note).not.toMatch(/confidence|probability|likely|certain|robust|recommend/i)
  })
})

const EMPTY_BRIEF: DecisionBriefViewModel = {
  topDrivers: [{ label: 'Time to market' }],
  keyAssumptions: [],
  whatWouldChange: ['Support response time improvement → Retention'],
  // ⭐ EMPTY, exactly as on the witnessed run. This is what made the group
  // disappear: its only source was the producer's `defaulted_assumptions`.
  defaultedAssumptions: [],
  robustnessCaveat: null,
}

describe('DecisionBriefSection renders the disclosure on the mounted surface', () => {
  it('T-MOUNT-PATH: the group heading and the note render inside the mounted brief section', () => {
    render(
      <DecisionBriefSection
        brief={EMPTY_BRIEF}
        leaderClaimPermitted
        estimatedInterventions={[formatEstimatedInterventionNote(OPTION_LABEL, FACTOR_LABEL)]}
      />,
    )

    // The mount path itself, so this REDs if the group stops being rendered here
    // rather than merely if the text moves.
    const section = screen.getByTestId('decision-brief-section')
    const group = screen.getByTestId('decision-brief-defaulted')
    expect(section).toContainElement(group)

    // The promise in the subtitle is now kept.
    expect(screen.getByText('What Olumi assumed')).toBeInTheDocument()
    expect(group).toHaveTextContent(ESTIMATED_INTERVENTION_MARK)
    expect(group).toHaveTextContent(OPTION_LABEL)
    expect(group).toHaveTextContent(FACTOR_LABEL)
  })

  /**
   * ⚠ THE SECTION-LEVEL GUARD IN `DecisionBriefSection.spec.tsx` NEVER SEES THIS
   * COPY. It renders a fixture with no disclosure, so its assertion that the
   * section carries no "confidence"/"probability" language and no "%" is silent
   * about the one string this PR adds. Asserted here on the RENDERED SECTION,
   * with the disclosure present — the string-level `T-NO-CLAIM` above proves the
   * sentence is clean, this proves the SURFACE still is once it carries it.
   */
  it('T-NO-CLAIM-RENDERED: the section asserts no confidence or probability once the disclosure is on it', () => {
    render(
      <DecisionBriefSection
        brief={EMPTY_BRIEF}
        leaderClaimPermitted
        estimatedInterventions={[formatEstimatedInterventionNote(OPTION_LABEL, FACTOR_LABEL)]}
      />,
    )
    const section = screen.getByTestId('decision-brief-section')
    expect(section).toHaveTextContent(ESTIMATED_INTERVENTION_MARK)
    expect(section).not.toHaveTextContent(/recommend|winner|leading option|probability|confidence|robust/i)
    expect(section).not.toHaveTextContent('%')
  })

  it('T-NO-DISCLOSURE: with nothing model-chosen, the group stays absent — no empty promise', () => {
    render(
      <DecisionBriefSection brief={EMPTY_BRIEF} leaderClaimPermitted estimatedInterventions={[]} />,
    )
    expect(screen.queryByText('What Olumi assumed')).toBeNull()
    expect(screen.queryByTestId('decision-brief-defaulted')).toBeNull()
  })

  /**
   * The two sources answer the SAME question ("what did Olumi supply that you
   * did not?") and share one group. Both must survive the join — a producer
   * default must not be displaced by the canvas rows or vice versa.
   */
  it('T-JOIN: producer defaults and model-chosen values both render, neither displacing the other', async () => {
    const user = userEvent.setup()
    const brief: DecisionBriefViewModel = {
      ...EMPTY_BRIEF,
      defaultedAssumptions: [
        { factorLabel: 'Available Growth Budget', note: 'No starting value was provided for "Available Growth Budget".' },
      ],
    }
    render(
      <DecisionBriefSection
        brief={brief}
        leaderClaimPermitted
        estimatedInterventions={[formatEstimatedInterventionNote(OPTION_LABEL, FACTOR_LABEL)]}
      />,
    )

    // ⭐ THE MODEL-CHOSEN VALUE LEADS THE GROUP. The producer's defaults are a
    // real answer to the same question, but the invented option→factor effects
    // are the ones the win probabilities were computed from, so they are what
    // the un-expanded preview must show.
    const group = screen.getByTestId('decision-brief-defaulted')
    expect(group).toHaveTextContent(ESTIMATED_INTERVENTION_MARK)
    expect(group).toHaveTextContent('+1 more')

    // Neither source displaces the other once the disclosure is opened.
    await user.click(screen.getByRole('button', { name: 'Show all brief details' }))
    expect(group).toHaveTextContent(ESTIMATED_INTERVENTION_MARK)
    expect(group).toHaveTextContent('Available Growth Budget')
  })
})
