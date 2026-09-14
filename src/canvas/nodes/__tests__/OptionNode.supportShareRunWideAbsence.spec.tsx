import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { DecisionNode } from '../DecisionNode'
import { useCanvasStore } from '../../store'

/**
 * ⭐⭐ ONE ABSENCE, STATED ONCE — NOT ONCE PER OPTION.
 *
 * Measured on the deployed build `08a3724d` (`staging--olumi.netlify.app`):
 * every option card carried "Support percentage unavailable", identically, in
 * the position where the comparison belongs. Three cards, three copies of one
 * fact, and nothing a reader could act on.
 *
 * The distinction this file pins is between a fact about ONE OPTION and a fact
 * about THE RUN:
 *
 *   - some options resolved a share and this one did not  → say so on the card,
 *     because it is the only thing that distinguishes it from its siblings.
 *   - NO option resolved one                              → the cards yield the
 *     position and the Question node says it once.
 *
 * ⚠ EVERY ASSERTION BINDS BY NODE ID (`option-result-unavailable-<id>`), never
 * by a text predicate another card could satisfy. Three cards rendering one
 * string is exactly the shape a `getAllByText(...).toHaveLength(1)` would miss
 * or mis-attribute.
 */

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const option = (id: string, label: string) => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { label, type: 'option' },
})

const THREE = [
  option('5364a6e2', 'Build a Self-Serve Tier'),
  option('9c978d4d', 'Invest in Content Marketing'),
  option('a596e935', 'Hire Two Enterprise Sales Reps'),
]

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [], edges: [], ceeAnalysisReady: null,
    results: { status: 'idle', report: null }, viewMode: 'expert',
  } as never)
})
afterEach(cleanup)

function mountOptions(options: ReturnType<typeof option>[]) {
  return render(<ReactFlowProvider>{options.map(node =>
    <OptionNode key={node.id} {...baseProps} id={node.id} data={node.data} />,
  )}</ReactFlowProvider>)
}

// ReactFlow's `NodeProps` demands width/height/sourcePosition/targetPosition
// and friends that no unit mount supplies. The repo's existing DecisionNode
// specs cast for exactly this reason (`DecisionNode.restingState.spec.tsx`);
// one cast in one helper beats the same cast at every call site.
const decisionProps = {
  ...baseProps,
  type: 'decision',
  id: 'dec_1',
  data: { label: 'Which should we pursue?', type: 'decision' },
} as any

describe('a missing support percentage is stated once, not once per option', () => {
  it('renders the per-card notice on NO card when no option resolves a share', () => {
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {} } },
    } as never)
    mountOptions(THREE)

    // Bound by identity, per card. Pre-fix all three of these were present.
    for (const node of THREE) {
      expect(
        screen.queryByTestId(`option-result-unavailable-${node.id}`),
        `card ${node.id} still states the run-wide absence on itself`,
      ).toBeNull()
    }
  })

  it('reproduces the LIVE failure mode: a label-keyed report misses every id-keyed node', () => {
    // `mapV5AnalysisToReport` path B keys `option_probabilities` by
    // `win_probabilities` keys VERBATIM, which are human LABELS on real staging
    // payloads, while canvas nodes are id-keyed. The map is FULL of finite
    // numbers and EVERY node lookup misses. A predicate over the map's VALUES
    // would read "shares present" here; this one resolves through node ids, as
    // the card does.
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {
        'Build a Self-Serve Tier': { status: 'computed', win_probability: 0.51 },
        'Invest in Content Marketing': { status: 'computed', win_probability: 0.29 },
        'Hire Two Enterprise Sales Reps': { status: 'computed', win_probability: 0.20 },
      } } },
    } as never)
    mountOptions(THREE)

    for (const node of THREE) {
      expect(
        screen.queryByTestId(`option-result-unavailable-${node.id}`),
        `card ${node.id} states the run-wide absence on itself under path-B keying`,
      ).toBeNull()
      expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
    }
  })

  /**
   * ⭐⭐⭐ THE WITNESSED WIRE SHAPE. Not a hypothesis and not a fixture I wrote:
   * captured from a live fresh journey on staging, 7 Sep 2026
   * (`CORE-HANDOVER-2026-09-07/.../codex-fresh-journey-C2/C2-context-response.json`).
   *
   * The producer sent THREE `enrichment.option_comparison` entries whose key
   * set is exactly:
   *
   *     ["downside","id","label","option_id","option_label","outcome","status"]
   *
   * `win_probability` is **ABSENT** — not null, not zero, the key is not there
   * — on every entry, while `option_comparison_status` reads `"computed"`,
   * `status` reads `"computed"` per option, `outcome` is fully populated, and
   * the sibling `leading_option_id` is `null`. The string `win_probabilities`
   * does not occur anywhere in that response.
   *
   * ⚠ ABSENT, NULL AND ZERO ARE THREE DIFFERENT FACTS. This case is ABSENT, and
   * it is the one that reaches the user: every card's `winRate` resolves null
   * while `winComputationFailed` stays false, because the producer's status
   * token says the option computed fine. Pre-fix that is three identical
   * failure notices where the comparison belongs.
   *
   * The missing field is UPSTREAM and is not repaired here. What is repaired is
   * the canvas stating one absence once per card.
   */
  it('WIRE-WITNESSED: option_comparison computed with win_probability ABSENT on every entry', () => {
    const witnessed = [
      option('4242a3ba', 'Status Quo (No New Hire)'),
      option('be215545', 'Two Developers'),
      option('e70301eb', 'Hire a Tech Lead'),
    ]
    useCanvasStore.setState({
      nodes: witnessed,
      results: { status: 'complete', report: { option_probabilities: {
        // Keys, and the ABSENCE of `win_probability`, exactly as captured.
        '4242a3ba': { status: 'computed', outcome: { mean: 0, p10: 0, p50: 0, p90: 0 } },
        'be215545': { status: 'computed', outcome: { mean: 0.4604578774475891, p10: 0.2, p50: 0.46, p90: 0.7 } },
        'e70301eb': { status: 'computed', outcome: { mean: 0.31651156735119257, p10: 0.1, p50: 0.31, p90: 0.6 } },
      } } },
    } as never)
    mountOptions(witnessed)

    for (const node of witnessed) {
      expect(
        screen.queryByTestId(`option-result-unavailable-${node.id}`),
        `card ${node.id} repeats the run-wide absence on itself`,
      ).toBeNull()
      // An absent share is not a failed computation: the producer said computed.
      expect(screen.queryByTestId(`option-not-computed-${node.id}`)).toBeNull()
      expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
    }
  })

  /**
   * ⭐ THE DISCRIMINATING HALF. Loosening the gate for ALL options must RED the
   * test above; loosening it for a DIFFERENT option only must leave this one
   * GREEN. Without this arm, deleting the notice outright would pass every
   * assertion in this file.
   */
  it('KEEPS the per-card notice when a sibling DID resolve a share', () => {
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {
        // Only this one resolves. The run is not share-less, so the other two
        // cards carry a fact that genuinely distinguishes them.
        a596e935: { status: 'computed', win_probability: 0.62 },
      } } },
    } as never)
    mountOptions(THREE)

    expect(screen.getByTestId('option-result-unavailable-5364a6e2')).toBeInTheDocument()
    expect(screen.getByTestId('option-result-unavailable-9c978d4d')).toBeInTheDocument()
    // The resolver states its figure and never the absence.
    expect(screen.queryByTestId('option-result-unavailable-a596e935')).toBeNull()
    expect(screen.getByTestId('option-win-readout-a596e935')).toBeInTheDocument()
  })

  it('does not count a producer-FAILED option as a resolved share', () => {
    // `status: 'failed'` is `n_valid === 0`. It carries its own distinct
    // notice and must not make the run look share-bearing to the other cards.
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {
        a596e935: { status: 'failed', win_probability: 0 },
      } } },
    } as never)
    mountOptions(THREE)

    expect(screen.queryByTestId('option-result-unavailable-5364a6e2')).toBeNull()
    expect(screen.queryByTestId('option-result-unavailable-9c978d4d')).toBeNull()
    // The failed option keeps its own, different disclosure.
    expect(screen.getByTestId('option-not-computed-a596e935')).toBeInTheDocument()
  })

  it('states the absence EXACTLY ONCE, on the node that frames the comparison', () => {
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {} } },
    } as never)
    render(
      <ReactFlowProvider>
        <DecisionNode {...decisionProps} />
        {THREE.map(node => (
          <OptionNode key={node.id} {...baseProps} id={node.id} data={node.data} />
        ))}
      </ReactFlowProvider>,
    )

    expect(screen.getAllByTestId('decision-support-share-absent')).toHaveLength(1)
    for (const node of THREE) {
      expect(screen.queryByTestId(`option-result-unavailable-${node.id}`)).toBeNull()
    }
  })

  it('does not state the absence when the run DID produce shares', () => {
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {
        '5364a6e2': { status: 'computed', win_probability: 0.51 },
        '9c978d4d': { status: 'computed', win_probability: 0.29 },
        'a596e935': { status: 'computed', win_probability: 0.20 },
      } } },
    } as never)
    render(
      <ReactFlowProvider>
        <DecisionNode {...decisionProps} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByTestId('decision-support-share-absent')).toBeNull()
  })

  it('does not state the absence before a run has completed', () => {
    useCanvasStore.setState({ nodes: THREE } as never)
    mountOptions(THREE)
    for (const node of THREE) {
      expect(screen.queryByTestId(`option-result-unavailable-${node.id}`)).toBeNull()
    }
    expect(screen.queryByTestId('decision-support-share-absent')).toBeNull()
  })

  it('holds the ratified copy rulings on both surfaces', () => {
    useCanvasStore.setState({
      nodes: THREE,
      results: { status: 'complete', report: { option_probabilities: {
        a596e935: { status: 'computed', win_probability: 0.62 },
      } } },
    } as never)
    const { container } = render(
      <ReactFlowProvider>
        <DecisionNode {...decisionProps} />
        {THREE.map(node => (
          <OptionNode key={node.id} {...baseProps} id={node.id} data={node.data} />
        ))}
      </ReactFlowProvider>,
    )

    const card = screen.getByTestId('option-result-unavailable-5364a6e2')
    // Conditions on the data. It is a thinking tool, not an oracle.
    expect(card.textContent).toContain('On the data so far')
    // ⚠ Negative copy assertions are CASE-SENSITIVE, so lower-case the subject.
    const text = (container.textContent ?? '').toLowerCase()
    for (const banned of ['winner', 'wins', 'runner-up', 'beats', 'ahead of', 'leader', 'first place', 'second place']) {
      expect(text, `race framing "${banned}" reached the canvas copy`).not.toContain(banned)
    }
    // No em dashes in product content.
    expect(container.textContent ?? '').not.toContain('—')
  })
})
