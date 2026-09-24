/**
 * ⭐ A HALF-FULL BAR MUST NOT BE DRAWN FOR A STRENGTH NOBODY SET.
 *
 * THE DEFECT, WITNESSED ON A REAL USER'S SCREEN (3 Sep 2026). Five cards on one
 * canvas — MRR Growth Rate, Trial-to-Paid Conversion Uplift, Churn Rate
 * Deterioration, Customer Acquisition Cost, Runway Depletion Risk — each read
 * `Strength 50% est.` and each drew a progress bar EXACTLY HALF FULL: the bar
 * length encodes a magnitude on the same scale an option's computed win share
 * uses, and the only qualification was `est.` at 7px.
 *
 * ⚠ NOT "THE NO-INFORMATION DEFAULT" — that reading is REFUTED by measurement
 * and withdrawn. The canonical root-cause record is
 * `shared/metricVocabulary.ts` and is deliberately not restated here.
 *
 * ⛔ THE PREDICATE IS `strengthIsHumanSettled`, AND CHOOSING IT OVER
 * `weightSource === 'user'` IS THE POINT OF ROUND 2. Those two answer DIFFERENT
 * QUESTIONS: `weightSource` is VALUE provenance (*whose number is this?*) while
 * this row's copy claims *nobody has set it* — a claim about a PERSON'S ACT.
 * They diverge on a state a live affordance produces, and the divergence is
 * pinned as its own case below rather than argued. `edgeStrengthSettlement.ts`
 * is the ONE admission; minting a second answer here would be this estate's
 * signature defect (CLAUDE.md trap 21).
 *
 * ⚠ THE NUMBER IS DEMOTED, NOT DELETED. A producer's assumed figure still
 * reaches the reader — on the row's `title` and its screen-reader phrase, where
 * it is stated as an assumption. What it loses is the bar and the face-value
 * percentage, which are the two elements that claim measurement.
 *
 * ⚠ AND THE ROW STAYS. Deleting it would read as "nothing to see"; the reader
 * needs to know the connection exists and that its strength is an open
 * question. The three cases are pinned as a set below, because a fix that
 * closes a lie by opening a gap is this estate's trap 22b.
 *
 * ⛔⛔ SUPERSEDED BY CONTRACT v3.1 (VC-01, gap U1, 24 Sep 2026) — THE ROW IS NOW
 * DELETED, AND THE TWO PARAGRAPHS ABOVE ARE KEPT AS THE RECORD OF WHY IT
 * SURVIVED UNTIL NOW. v3.1: "Outcome/risk records are distinct from the strength
 * of their connections"; strength is "a different fact, inspectable on the
 * edge". The connection itself (its line, hover, `EdgePills`, `EdgePanel`) is
 * what tells a reader the link exists and whether its strength is settled — so
 * "an absent row reads as nothing to see" no longer holds on the card.
 *
 * What this file pins now is the stronger claim the deletion makes true: in
 * EVERY provenance state it used to discriminate (person, Olumi, template,
 * adjudicated, dismissed, none), on both cards and at both rungs, the card draws
 * no bar, prints no figure and names no link strength — so the witnessed defect
 * (a half-full bar for a strength nobody set) cannot recur here. The F1
 * precondition (two authorities, two facts) is kept: `strengthIsHumanSettled`
 * is still the connection's admission (`EdgePills`, `StyledEdge`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { OutcomeNode } from '../OutcomeNode'
import { LINK_STRENGTH_COPY } from '../shared/metricVocabulary'
import { NodeMetricRow } from '../shared/NodeMetricRow'
import { strengthIsHumanSettled } from '../../domain/edgeStrengthSettlement'
import { edgeValueSource } from '../../domain/edgeValueProvenance'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    influenceProvenance: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * The bridge edge in three provenance states, in the shapes a PRODUCER actually
 * sends (derived from `lodMetric.riskOutcome.spec.tsx`'s measured fixture, not
 * from the type definition):
 *
 *   'cee'     `strength_mean` present, no explicit stamp — the documented
 *             producer-only fallback, and the state the five witnessed cards
 *             were in.
 *   'user'    an explicit `weightSource: 'user'` stamp, written only by the
 *             strength editor.
 *   'none'    a bare `weight`, which every `DEFAULT_EDGE_DATA` edge carries and
 *             which `resolveEdgeSignedStrengthDisplay` refuses.
 */
type Provenance = 'cee' | 'user' | 'none' | 'adjudicated' | 'dismissed' | 'template'

const edgeDataFor = (provenance: Provenance, strength: number): Record<string, unknown> => {
  const base = { direction: 'negative', beliefExists: null }
  switch (provenance) {
    case 'user':
      return { ...base, weight: strength, weightSource: 'user' }
    case 'cee':
      return { ...base, strength_mean: strength }
    case 'template':
      return { ...base, weight: strength, weightSource: 'template' }
    // ⛔ THE F1 STATE, AND IT IS NOT A SYNTHETIC ONE. `ContestedEdgeCard`'s
    // "Accept review" → `ModelTabBody.handleResolveContested` writes EXACTLY
    // this pair: `weightSource: 'cee'` (deliberate — the accepted value really
    // is the producer's pass-2 mean; routing it through `setStrength` would be
    // "provenance laundering", that handler's own words) TOGETHER WITH the
    // user's adjudication in `validation`.
    case 'adjudicated':
      return {
        ...base,
        weight: strength,
        weightSource: 'cee',
        validation: { user_action: 'accepted_pass2', resolved_by: 'user' },
      }
    // ⛔ THE TWIN THAT PROVES THE PREDICATE IS NOT JUST READING `resolved_by`.
    // `handleResolveContested` stamps `resolved_by: 'user'` on ALL FOUR
    // actions, `dismissed` included — which the contract defines as "user chose
    // not to engage". Declining to settle is not settling.
    case 'dismissed':
      return {
        ...base,
        weight: strength,
        weightSource: 'cee',
        validation: { user_action: 'dismissed', resolved_by: 'user' },
      }
    default:
      return { ...base, weight: strength }
  }
}

const modelWithBridge = (
  nodeId: string,
  kind: string,
  provenance: Provenance,
  strength = 0.5,
  lodRung: 'full' | 'line' = 'full',
) => ({
  lodRung,
  nodes: [
    { id: nodeId, type: kind, data: { type: kind } },
    { id: 'goal-1', data: { type: 'goal' } },
  ],
  edges: [
    {
      id: 'e1',
      source: nodeId,
      target: 'goal-1',
      data: edgeDataFor(provenance, strength),
    },
  ],
})

const mountRisk = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(state as any))
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} type="risk" id="risk-1" data={{ label: 'Runway Depletion Risk', type: 'risk' }} />
    </ReactFlowProvider>,
  )
}

const mountOutcome = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(state as any))
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} type="outcome" id="outcome-1" data={{ label: 'MRR Growth Rate', type: 'outcome' }} />
    </ReactFlowProvider>,
  )
}

const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

/**
 * A drawn proportional bar: `NodeMetricRow`'s fill is a div whose inline width
 * carries a PERCENTAGE (`max(4px, 50%)`). Read over the whole card, since the
 * row that owned it is gone. The instrument control below proves it sees one.
 */
const barsIn = (): HTMLElement[] =>
  Array.from(document.body.querySelectorAll<HTMLElement>('div[style]')).filter(el => /\d%/.test(el.style.width))

beforeEach(() => { vi.clearAllMocks() })

const PROVENANCES: Provenance[] = ['user', 'cee', 'template', 'adjudicated', 'dismissed', 'none']

it('INSTRUMENT CONTROL — the bar probe sees a real `NodeMetricRow` fill (so an empty result is a finding)', () => {
  render(<NodeMetricRow label="Probe" value={0.5} formatted="50%" fillClass="bg-success" testId="probe-row" />)
  expect(barsIn()).toHaveLength(1)
})

describe('⛔ contract v3.1 — no provenance state puts the connection’s strength on the card', () => {
  it.each(PROVENANCES)('risk, %s: no row, no bar, no figure, no link-strength words', (provenance) => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', provenance, 0.5)))
    // CONTRAST, same render: the card and its OWN unset statement are there.
    expect(screen.getByTestId('risk-exposure-unset')).toBeTruthy()
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
    expect(barsIn()).toEqual([])
    expect(document.body.textContent).not.toContain('50%')
    expect(document.body.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
    expect(document.body.textContent).not.toContain(LINK_STRENGTH_COPY.olumiEstimate)
  })

  it.each(PROVENANCES)('outcome, %s: no row, no bar, no figure, no link-strength words', (provenance) => {
    mountOutcome(makeStoreState(modelWithBridge('outcome-1', 'outcome', provenance, 0.5)))
    expect(screen.getByText('MRR Growth Rate')).toBeTruthy()
    expect(screen.queryByTestId('outcome-strength-row')).toBeNull()
    expect(barsIn()).toEqual([])
    expect(document.body.textContent).not.toContain('50%')
    expect(document.body.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
  })

  it.each(PROVENANCES)('reduced rung, %s: neither card speaks the link’s strength', (provenance) => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', provenance, 0.5, 'line')))
    expect(lodLine()).toBeNull()
    expect(document.body.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
    document.body.innerHTML = ''
    mountOutcome(makeStoreState(modelWithBridge('outcome-1', 'outcome', provenance, 0.5, 'line')))
    expect(lodLine()).toBeNull()
    expect(document.body.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
  })
})

describe('the settlement predicate the CONNECTION still reads (F1, kept)', () => {
  it('⭐ PRECONDITION — the two authorities return DIFFERENT facts on the adjudicated payload', () => {
    // `strengthIsHumanSettled` no longer drives a card row, but `EdgePills` and
    // the edge still read it, and the divergence it was built for is a property
    // of the payload, not of the card.
    const data = edgeDataFor('adjudicated', 0.5)
    expect(edgeValueSource(data, 'weight')).toBe('cee')   // whose NUMBER is it → the producer's
    expect(strengthIsHumanSettled(data)).toBe(true)       // has a PERSON settled it → yes
    expect(edgeValueSource(data, 'weight') === 'user').not.toBe(strengthIsHumanSettled(data))
    // …and its opposite-direction twin: a dismissed review is not a settlement.
    expect(strengthIsHumanSettled(edgeDataFor('dismissed', 0.5))).toBe(false)
  })
})
