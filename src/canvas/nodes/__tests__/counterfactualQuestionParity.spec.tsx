/**
 * Counterfactual affordance — THE QUESTION A USER READS IS THE QUESTION THAT IS SENT.
 *
 * ⛔ THE DEFECT THIS SPEC EXISTS TO PIN. Both cards composed the "What if …
 * worsens?" question TWICE, at two adjacent lines, and the two copies had
 * drifted:
 *
 *   RiskNode.tsx:179  rendered the subject sliced to 18 chars + "..." INSIDE the
 *                     sentence  ·  :175 sent the full untruncated subject
 *   FactorNode.tsx:964 rendered `cleanedLabel.toLowerCase()`
 *                     ·  :960 sent `cleanedLabel` un-lowercased, PLUS a trailing
 *                     "How should I plan for that scenario?" shown nowhere
 *
 * A user clicked a question they had read and a different question was asked on
 * their behalf. It is invisible unless you diff two adjacent lines, which is why
 * all three drifts shipped.
 *
 * ⚠ WHAT THIS SPEC ASSERTS, AND WHY IT IS SHAPED THIS WAY.
 * The load-bearing assertion is `rendered === sent` — an EQUALITY between the two
 * representations, not a match against a sentence this spec spells out itself. A
 * spec that hardcoded the expected sentence would go green the day someone
 * changed the copy in both places and would say nothing about the two staying
 * ONE string. Equality is the invariant; the wording is not.
 *
 * ⚠ EVERY FIXTURE PINS ITS OWN PRECONDITION IN-TEST (see `assertFixtureExercises*`).
 * A label shortened below 19 chars, or flattened to lower case, would silently
 * stop exercising the defect path and leave this suite green over a reopened
 * defect. The preconditions RED instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { FactorNode } from '../FactorNode'
import { composeCounterfactualQuestion } from '../shared/counterfactualQuestion'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

// ---------------------------------------------------------------------------
// Fixtures. Both are long enough to have triggered RiskNode's 18-char slice and
// mixed-case enough to have triggered FactorNode's `.toLowerCase()`, so ONE pair
// of fixtures exercises BOTH historical drifts on whichever card carries them.
// ---------------------------------------------------------------------------
const RISK_SUBJECT = 'Regional Supplier Reliability'
const FACTOR_SUBJECT = 'Regional Supplier Reliability'

/**
 * Pins the fixture's discriminating power IN-TEST. Without this, shortening or
 * lower-casing the fixture would make the equality assertion pass trivially —
 * a green suite over a reopened defect (the "guard agreeing with itself" shape).
 */
const assertFixtureExercisesBothDrifts = (subject: string) => {
  expect(
    subject.length,
    'fixture must exceed 18 chars or it cannot exercise the historical slice path',
  ).toBeGreaterThan(18)
  expect(
    subject,
    'fixture must contain upper case or it cannot exercise the historical toLowerCase path',
  ).not.toBe(subject.toLowerCase())
}

const baseProps = {
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const setStore = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'complete', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      viewMode: 'expert', // Detailed → layer-2 content renders inline, no hover needed
      ...overrides,
    }),
  )
}

/**
 * Binds to the affordance BY IDENTITY, not by a value predicate another element
 * could satisfy: it asserts there is EXACTLY ONE "… worsens?" control on the
 * card before returning it. If a second one ever appears, this REDs rather than
 * silently measuring whichever came first.
 *
 * ⚠ "worsens" also discriminates against the neighbouring "What if this
 * changes?" chip on FactorNode, which is a DIFFERENT affordance with its own
 * message and is deliberately out of this spec's scope.
 */
const theCounterfactualControl = (): HTMLElement => {
  const matches = screen
    .getAllByRole('button')
    .filter((b) => /worsens\?/.test(b.textContent ?? ''))
  expect(
    matches.map((m) => m.textContent),
    'expected exactly one "… worsens?" affordance on this card',
  ).toHaveLength(1)
  return matches[0]
}

/** The single assertion this spec exists for. */
const expectReadEqualsSent = (): { rendered: string; sent: string } => {
  const control = theCounterfactualControl()
  const rendered = control.textContent ?? ''
  expect(rendered.length, 'the affordance rendered no text').toBeGreaterThan(0)

  const sent = vi.fn()
  useGuidanceStore.setState({ _sendMessage: sent } as never)
  fireEvent.click(control)

  expect(sent, 'clicking the affordance sent no message').toHaveBeenCalledTimes(1)
  const sentText = sent.mock.calls[0][0] as string

  expect(
    sentText,
    'THE DEFECT: the sentence rendered on the card and the sentence sent on the ' +
      "user's behalf are not the same string",
  ).toBe(rendered)

  return { rendered, sent: sentText }
}

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.setState({ _sendMessage: null } as never)
  setStore()
})

// ---------------------------------------------------------------------------

describe('RiskNode counterfactual affordance', () => {
  const renderRiskWithTopFactor = (subject: string) => {
    setStore({
      nodes: [{ id: 'factor-1', type: 'factor', data: { label: subject } }],
      edges: [{ id: 'edge-1', source: 'factor-1', target: 'risk-1', data: {} }],
    })
    return render(
      <ReactFlowProvider>
        <RiskNode
          {...(baseProps as any)}
          id="risk-1"
          type="risk"
          data={{ label: 'Delivery slippage', type: 'risk' }}
        />
      </ReactFlowProvider>,
    )
  }

  it('sends exactly the question it renders', () => {
    assertFixtureExercisesBothDrifts(RISK_SUBJECT)
    renderRiskWithTopFactor(RISK_SUBJECT)

    const { rendered } = expectReadEqualsSent()

    // Pins the SLICE drift specifically: the whole subject must survive into the
    // sentence the user reads. An equality assertion alone would be satisfied by
    // truncating BOTH sides, which would still hide the subject from the reader.
    expect(
      rendered,
      'the subject must reach the reader whole — truncation belongs in CSS, never in the sentence',
    ).toContain(RISK_SUBJECT)
    expect(rendered).not.toContain('...')
  })

  it('offers no affordance when the top factor has a blank label', () => {
    setStore({
      nodes: [{ id: 'factor-1', type: 'factor', data: { label: '   ' } }],
      edges: [{ id: 'edge-1', source: 'factor-1', target: 'risk-1', data: {} }],
    })
    render(
      <ReactFlowProvider>
        <RiskNode
          {...(baseProps as any)}
          id="risk-1"
          type="risk"
          data={{ label: 'Delivery slippage', type: 'risk' }}
        />
      </ReactFlowProvider>,
    )
    expect(
      screen.queryAllByRole('button').filter((b) => /worsens\?/.test(b.textContent ?? '')),
      'a blank subject must withhold the affordance, never render "What if  worsens?"',
    ).toHaveLength(0)
  })
})

describe('FactorNode counterfactual affordance', () => {
  const renderExternalFactor = (subject: string) =>
    render(
      <ReactFlowProvider>
        <FactorNode
          {...(baseProps as any)}
          id="factor-1"
          type="factor"
          data={{ label: subject, type: 'factor', category: 'external' }}
        />
      </ReactFlowProvider>,
    )

  it('sends exactly the question it renders', () => {
    assertFixtureExercisesBothDrifts(FACTOR_SUBJECT)
    renderExternalFactor(FACTOR_SUBJECT)

    const { rendered, sent } = expectReadEqualsSent()

    // Pins the CASE drift specifically: an equality assertion alone would be
    // satisfied by lower-casing BOTH sides, which would still corrupt proper
    // nouns and acronyms in the question the user asks.
    expect(
      rendered,
      'the subject must keep the case it was authored in',
    ).toContain(FACTOR_SUBJECT)

    // Pins the HIDDEN-TRAILER drift specifically. This one is invisible to the
    // equality assertion in the other direction: showing the trailer on the card
    // would also satisfy equality, so it is asserted as an absence on BOTH
    // channels — the user is not asking a question they cannot see.
    expect(sent).not.toContain('How should I plan for that scenario?')
    expect(rendered).not.toContain('How should I plan for that scenario?')
  })

  it('offers no affordance when the label is blank', () => {
    renderExternalFactor('   ')
    expect(
      screen.queryAllByRole('button').filter((b) => /worsens\?/.test(b.textContent ?? '')),
      'a blank subject must withhold the affordance, never render "What if  worsens?"',
    ).toHaveLength(0)
  })
})

describe('composeCounterfactualQuestion', () => {
  it('keeps the subject whole however long it is', () => {
    // The forward contract forbids a consumer-side slice. A future `name` field
    // will supply a short subject; until then, length is a PRESENTATION concern.
    const long = 'A'.repeat(200)
    expect(composeCounterfactualQuestion(long)).toBe(`What if ${long} worsens?`)
  })

  it('keeps the subject in the case it was authored in', () => {
    expect(composeCounterfactualQuestion('EU Tariffs')).toBe('What if EU Tariffs worsens?')
  })

  it('withholds the question for an absent or blank subject', () => {
    expect(composeCounterfactualQuestion('   ')).toBeNull()
    expect(composeCounterfactualQuestion('')).toBeNull()
    expect(composeCounterfactualQuestion(null)).toBeNull()
    expect(composeCounterfactualQuestion(undefined)).toBeNull()
  })
})
