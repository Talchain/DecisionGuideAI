/**
 * ⭐⭐ THE RISK CARD STATES ITS OWN SIZE — and a domain test cannot see whether
 * it does.
 *
 * `domain/__tests__/nodeRecordedValue.spec.ts` proves the reader resolves a
 * value. It is structurally incapable of proving anything reaches a screen: the
 * capability this repo has shipped dark most often is a correct function with no
 * mounted consumer, and a component test is the only instrument that can observe
 * that darkness. Deleting the render below must RED this file and leave that one
 * fully green. That pair is the point of having two.
 *
 * ⛔ THE DEFECT, MEASURED. `RiskNode` carried **zero** `observedState`
 * references against a contrast of **20** in `FactorNode`, so a risk labelled
 * "Time to Reach Customer Target" holding `raw_value: 12, unit: "months"` in its
 * own data rendered a bridge strength and nothing else. Meanwhile the figure the
 * card IS built around — `probability` × `impact` — is present on **0 of 23**
 * risk nodes across every capture in this repo.
 *
 * ⚠ THE FIXTURES BELOW ARE THE MEASURED WIRE SHAPE, NOT THE TYPE DEFINITION.
 * `lodMetric.riskOutcome.spec.tsx` records what happens otherwise: its
 * predecessor supplied `probability`/`impact` because the type declared them, so
 * the corpus shared the code's blind spot and certified it. Every risk here
 * carries NO probability and NO impact, which is what staging actually sends.
 *
 * ⚠ CLAUDE.md trap 3 — jsdom cannot prove visibility. Mounting and text only.
 * ⚠ CLAUDE.md trap 19 — every assertion binds by node identity and exact string.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'

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
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'risk', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

/** The real payload for this risk, from `golden-path-staging-2026-04-05.json`. */
const TIME_TO_TARGET = {
  label: 'Time to Reach Customer Target',
  type: 'risk',
  observedState: {
    value: 0.5, unit: 'months', source: 'brief_extraction',
    raw_value: 12, cap: 24, extractionType: 'explicit', factor_type: 'time',
  },
}

/** Its sibling in the same capture, so a mix-up between the two would show. */
const COMPLIANCE = {
  label: 'Compliance Deadline Miss',
  type: 'risk',
  observedState: {
    value: 0.5, unit: 'months', source: 'cee_inference',
    raw_value: 4, cap: 24, extractionType: 'explicit', factor_type: 'time',
  },
}

/** A bridge edge in the shape a producer sends — `strength_mean`, not a bare weight. */
const withBridge = (nodeId: string, strength: number) => ({
  nodes: [{ id: nodeId, type: 'risk', data: { type: 'risk' } }, { id: 'goal-1', data: { type: 'goal' } }],
  edges: [{ id: 'e1', source: nodeId, target: 'goal-1', data: { strength_mean: strength, direction: 'negative', beliefExists: null } }],
})

const draw = (id: string, data: Record<string, unknown>, store: Record<string, unknown> = {}) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(makeStoreState(store) as never))
  return render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as never)} id={id} data={data} />
    </ReactFlowProvider>,
  )
}

const recorded = () => screen.queryByTestId('risk-recorded-value')?.textContent ?? null
const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

describe('a risk card states the size it records', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks() })

  it('⭐ THE MUTANT TARGET: the recorded magnitude reaches the card, in its own unit', () => {
    draw('risk-1', TIME_TO_TARGET)
    expect(recorded()).toBe('12 months')
  })

  it('binds to THIS node — the sibling in the same capture renders its own figure, not this one', () => {
    // A discriminating pair (trap 19): both risks share kind, unit, cap and
    // `factor_type`, so nothing but identity separates them. A render that
    // resolved "a risk's value" rather than "this risk's value" passes the test
    // above and fails here.
    draw('risk-2', COMPLIANCE)
    expect(recorded()).toBe('4 months')
    expect(recorded()).not.toBe('12 months')
  })

  it('renders NOTHING when the model records no size — no placeholder, no zero', () => {
    draw('risk-3', { label: 'Existing customers churn on the price rise', type: 'risk' })
    expect(screen.queryByTestId('risk-recorded-value')).toBeNull()
  })

  it('⭐ TWO ABSENCES ARE NOT POOLED: an unset connection strength never stands in for an unrecorded size', () => {
    // The card may say "Not set yet" about a strength somebody can settle. It
    // may not say it about a magnitude nobody has estimated — different causes,
    // different next steps. Derived from the register, never a literal I typed.
    draw('risk-4', { label: 'Existing customers churn on the price rise', type: 'risk' }, withBridge('risk-4', 0.5))
    expect(screen.getByTestId('risk-strength-row').textContent).toContain(METRIC_UNSET.standalone)
    expect(screen.queryByTestId('risk-recorded-value')).toBeNull()
  })

  it('⭐ the reduced line speaks where it used to render an empty box', () => {
    // No bridge edge: this branch returned null, so below the legibility floor
    // the card was blank. It now states the datum it already displays at full
    // zoom — and needs no run to do it.
    draw('risk-5', TIME_TO_TARGET, { lodRung: 'line' })
    expect(lodLine()).toBe('12 months')
  })

  it('⛔ CONTRAST — STRICTLY ADDITIVE: a card that was already speaking says exactly what it said before', () => {
    // The whole safety argument for the change above. If this ever reads the
    // recorded value, the new arm has started overriding a branch that was not
    // silent, which is the opposite-direction twin (CLAUDE.md trap 22b).
    draw('risk-6', TIME_TO_TARGET, { ...withBridge('risk-6', 0.5), lodRung: 'line' })
    const line = lodLine()
    expect(line).not.toBe('12 months')
    expect(line, 'precondition: the pre-existing branch still produces a line at all').toBeTruthy()
    expect(line!.toLowerCase()).toContain('strength')
  })
})
