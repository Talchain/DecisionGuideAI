/**
 * Adversarial-review round — D1, D2, D3 and the promoted advisory.
 *
 * Every case here exists because the FIRST round's corpus could not see the
 * defect. That is the finding worth keeping: each original test was correct
 * about the case it named and blind to the case beside it.
 *
 *   D1  the rename kit only ever tested FRESH MOUNTS, so it could not observe
 *       a shell that is RETARGETED from one node to another — which is what
 *       the live inspector actually does.
 *   D2  the impact fixture used a ONE-option comparison, the only shape in
 *       which the new copy fires. A real run has two or more.
 *   D3  the decision fixture was OUTBOUND-ONLY, and the canvas permits an
 *       inbound `option → decision` edge.
 *
 * That is trap 22 three times over: a corpus drawn from the author's head
 * cannot see the class the author did not imagine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { InspectorShell } from '../InspectorShell'
import { OptionPanel } from '../panels/OptionPanel'
import { DecisionPanel } from '../panels/DecisionPanel'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { requestNodeRename, clearNodeRename } from '../renameIntent'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { EMPTY_STATES, OPTION_STRINGS, DECISION_STRINGS } from '../inspectorStrings'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
const mockDisplayMetadata = useNodeDisplayMetadata as ReturnType<typeof vi.fn>

const baseMetadata = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  valueOfInformation: null,
  inSensitivityAnalysis: false,
  winRate: null,
}

function setStore(patch: Record<string, unknown>) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    results: { status: 'none', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...patch,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  clearNodeRename()
  mockDisplayMetadata.mockReturnValue(baseMetadata)
  useGuidanceStore.setState({
    guidanceItems: [],
    _sendMessage: null,
    _prefillChat: null,
    _dispatchAction: null,
  } as never)
})

// ─────────────────────────────────────────────────────────────────────
// D1 · the rename intent must not leak onto the next selected node
// ─────────────────────────────────────────────────────────────────────

describe('D1 · a rename intent is bound to its node across a RETARGET, not just a fresh mount', () => {
  const shellBase = {
    topBarColor: 'var(--option)',
    nodeKind: 'option' as const,
    typePill: 'Option',
    techMode: false,
    onTechToggleChange: vi.fn(),
    onClose: vi.fn(),
  }

  /**
   * The live inspector does NOT remount per selection — `InspectorModal` keeps
   * one `InspectorRouter`/`InspectorShell` mounted and changes `nodeId`. The
   * first round's tests all rendered fresh, which is exactly why they stayed
   * green while this was live.
   */
  it('does not open node B in editing state when the intent was for node A', () => {
    requestNodeRename('optA')
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    // Precondition pinned in-test: A really did arm. Without this the
    // assertion below could pass on a shell that never armed at all.
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()

    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )

    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
    expect(screen.getByTestId('inspector-rename-trigger')).toBeTruthy()
  })

  /**
   * THE MEASURED HARM, and the reason this is P0-class: an editor left open
   * across a retarget still holds the PREVIOUS element's text, so the blur-save
   * writes node A's label onto node B. A silent, wrong, persisted rename.
   */
  it('never writes node A’s label onto node B', () => {
    const saveA = vi.fn()
    const saveB = vi.fn()
    requestNodeRename('optA')

    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={saveA}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()

    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={saveB}>
        <div>body</div>
      </InspectorShell>,
    )

    // Whatever the panel now shows, it must not be a live editor carrying A's
    // text, and nothing may be saved onto B.
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
    expect(saveB).not.toHaveBeenCalled()
    expect(saveB).not.toHaveBeenCalledWith('Option A')
  })

  it('discards an in-flight edit when the shell is retargeted mid-rename', () => {
    // No intent at all — the user opened the editor by hand, typed, then
    // clicked a different node on the canvas. The draft must not follow.
    const saveA = vi.fn()
    const saveB = vi.fn()
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={saveA}>
        <div>body</div>
      </InspectorShell>,
    )
    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    fireEvent.change(screen.getByTestId('inspector-rename-input'), {
      target: { value: 'Half-typed new name' },
    })

    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={saveB}>
        <div>body</div>
      </InspectorShell>,
    )

    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
    expect(saveB).not.toHaveBeenCalled()
    expect(screen.getByTestId('inspector-rename-trigger').textContent).toContain('Option B')
  })

  it('does not re-arm when the user navigates BACK to the renamed node', () => {
    // The intent is one-shot. Returning to A must not reopen the editor under
    // a user who has moved on.
    requestNodeRename('optA')
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()

    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    rerender(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )

    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
  })

  /**
   * ─── Paul's required cases (D1 refinement, 16 Aug) ───────────────
   *
   * The mechanism, end to end: `autoEditLabel` was a boolean that never reset;
   * `EditableLabel`'s effect deps include `onSave`, whose identity is rebuilt
   * per `[nodeId, updateNode, getNode]` by `useInspectorMutations`; and the
   * chain InspectorRouter → InspectorShell (InspectorModal:174,
   * ReactFlowGraph:2232-2238) is UNKEYED with `showFullInspector` persisting
   * across selections — so the shell re-renders in place on node→node.
   *
   * `setLabel`'s own `trimmed !== node.data?.label` guard cannot save you:
   * "Option A" !== "Option B", so the cross-node write sails straight through.
   *
   * These pass a NEW onLabelChange identity on the retarget, because that
   * identity change is half the trigger.
   */
  it('POSITIVE CONTROL · node A’s editor does open with the intent', () => {
    // Without this the two absence assertions below could both pass on a
    // shell that never armed at all (trap 13).
    requestNodeRename('optA')
    render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()
  })

  it('A→B on a MOUNTED shell with a NEW onLabelChange identity never opens or saves on B', () => {
    requestNodeRename('optA')
    const saveA = vi.fn()
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={saveA}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()

    // A DIFFERENT function object, exactly as useInspectorMutations produces
    // when nodeId changes.
    const saveB = vi.fn()
    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={saveB}>
        <div>body</div>
      </InspectorShell>,
    )

    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
    expect(saveB).not.toHaveBeenCalled()
  })

  it('an editor closed with Escape STAYS closed when onLabelChange identity changes', () => {
    requestNodeRename('optA')
    const save1 = vi.fn()
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={save1}>
        <div>body</div>
      </InspectorShell>,
    )
    const input = screen.getByTestId('inspector-rename-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()

    // Same node, new callback identity — an ordinary re-render. The editor
    // must not spring back open under the user.
    rerender(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
  })

  it('STILL arms the requested node on a retarget INTO it', () => {
    // Discriminating twin: the fix must not be "never arm on a retarget",
    // which would break the workspace lane's double-click on any node other
    // than the one already selected.
    const { rerender } = render(
      <InspectorShell {...shellBase} nodeId="optA" label="Option A" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()

    requestNodeRename('optB')
    rerender(
      <InspectorShell {...shellBase} nodeId="optB" label="Option B" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )

    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────
// D2 · the add-path impact copy must fire on a REAL (multi-option) run
// ─────────────────────────────────────────────────────────────────────

describe('D2 · an option added after a multi-option run gets the honest copy', () => {
  const optionProps = { nodeId: 'optNew', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

  /**
   * The mainline shape, and the one the first round missed: a run that
   * compared TWO options, then the user adds a third. `hasImpactContent`'s
   * third disjunct was RUN-level, so the new option rendered the other two
   * options' bars — foreign data under its own name — and never reached the
   * "added after the last analysis" branch.
   */
  function setPostRunAddStore() {
    setStore({
      nodes: [
        { id: 'optNew', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Newly added option' } },
        { id: 'optA', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Existing A' } },
        { id: 'optB', type: 'option', position: { x: 2, y: 0 }, data: { label: 'Existing B' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          option_comparison: [
            { option_id: 'optA', win_probability: 0.62, label: 'Existing A' },
            { option_id: 'optB', win_probability: 0.38, label: 'Existing B' },
          ],
        },
      },
    })
  }

  it('says it was added after the last run, on a TWO-option comparison', () => {
    setPostRunAddStore()
    mockDisplayMetadata.mockReturnValue({ ...baseMetadata, winRate: null })
    render(<OptionPanel {...optionProps} />)
    expect(screen.getByTestId('option-impact-not-in-run')).toBeTruthy()
  })

  it('shows NO foreign option rows under this option’s own Impact heading', () => {
    setPostRunAddStore()
    mockDisplayMetadata.mockReturnValue({ ...baseMetadata, winRate: null })
    const { container } = render(<OptionPanel {...optionProps} />)
    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact).not.toBeNull()
    // The other options' names and numbers belong to THEM, not to this node.
    expect(impact?.textContent).not.toContain('Existing A')
    expect(impact?.textContent).not.toContain('Existing B')
    expect(impact?.textContent).not.toContain('62%')
    expect(impact?.textContent).not.toContain(OPTION_STRINGS.impactUnavailable)
  })

  it('STILL shows the comparison to an option the run DID cover', () => {
    // Discriminating twin: the fix must suppress foreign data for a node the
    // run never saw, not delete the comparison for nodes it did.
    setStore({
      nodes: [
        { id: 'optNew', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Covered option' } },
        { id: 'optA', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Existing A' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          option_comparison: [
            { option_id: 'optNew', win_probability: 0.55, label: 'Covered option' },
            { option_id: 'optA', win_probability: 0.45, label: 'Existing A' },
          ],
        },
      },
    })
    mockDisplayMetadata.mockReturnValue({ ...baseMetadata, winRate: 0.55 })
    const { container } = render(<OptionPanel {...optionProps} />)
    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact?.textContent).toContain('Existing A')
    expect(screen.queryByTestId('option-impact-not-in-run')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// D3 · the decision must count edges in BOTH directions
// ─────────────────────────────────────────────────────────────────────

describe('D3 · an inbound option → decision edge is not invisible', () => {
  const decisionProps = { nodeId: 'dec1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

  /**
   * `connectedOptions` filtered on `source === nodeId` and `otherConnections`
   * dropped option-kind nodes, so an `option → decision` edge — which the
   * canvas's own `isValidConnection` permits a user to draw — fell through
   * BOTH lists and the panel reported "No connections yet." while the canvas
   * drew two edges.
   */
  function setInboundStore() {
    setStore({
      nodes: [
        { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Launch strategy' } },
        { id: 'optA', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Option A', interventions: {} } },
        { id: 'optB', type: 'option', position: { x: 2, y: 0 }, data: { label: 'Option B', interventions: {} } },
      ],
      // Both drawn INTO the decision — the direction the first corpus omitted.
      edges: [
        { id: 'e1', source: 'optA', target: 'dec1', data: {} },
        { id: 'e2', source: 'optB', target: 'dec1', data: {} },
      ],
    })
  }

  it('lists inbound options in the Input group', () => {
    setInboundStore()
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const input = container.querySelector('[data-panel-group="input"]')
    expect(input?.textContent).toContain('Option A')
    expect(input?.textContent).toContain('Option B')
  })

  it('does NOT claim "No connections yet." while two edges are on the canvas', () => {
    setInboundStore()
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const connections = container.querySelector('[data-panel-group="connections"]')
    expect(connections?.textContent).not.toContain(EMPTY_STATES.noConnectionsFlat)
    expect(screen.getByTestId('decision-connections-are-options').textContent).toContain('2')
  })

  it('counts an option connected in BOTH directions exactly once', () => {
    setStore({
      nodes: [
        { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Launch strategy' } },
        { id: 'optA', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Option A', interventions: {} } },
      ],
      edges: [
        { id: 'e1', source: 'dec1', target: 'optA', data: {} },
        { id: 'e2', source: 'optA', target: 'dec1', data: {} },
      ],
    })
    render(<DecisionPanel {...decisionProps} />)
    expect(screen.getByTestId('decision-connections-are-options').textContent).toContain('1')
    expect(screen.getAllByText('Option A')).toHaveLength(1)
  })

  it('STILL reports a genuinely unconnected decision honestly', () => {
    // Discriminating twin: widening the filter must not make every decision
    // claim connections it does not have.
    setStore({
      nodes: [{ id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Untouched' } }],
      edges: [],
    })
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const connections = container.querySelector('[data-panel-group="connections"]')
    expect(connections?.textContent).toContain(EMPTY_STATES.noConnectionsFlat)
    expect(screen.queryByTestId('decision-connections-are-options')).toBeNull()
  })

  it('exposes the count copy for both directions from ONE constant', () => {
    expect(DECISION_STRINGS.connectionsAreOptions).toContain('{count}')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4 · no auto-sending control may be labelled as an ask
// ─────────────────────────────────────────────────────────────────────

describe('4 · a run_exercise action is labelled for what it does', () => {
  const coachingProps = {
    elementId: 'node-1',
    panelType: 'factor-controllable',
    fallbackText: 'Static coaching fallback text',
    labelContext: { label: 'Marketing Budget' },
  }

  function exerciseItem(): GuidanceItem {
    return {
      item_id: 'g1',
      signal_code: 'evidence_gap',
      category: 'should_fix',
      source: 'analysis',
      title: 'Try a pre-mortem on this',
      detail: '',
      primary_action: { type: 'run_exercise', exercise: 'pre_mortem' },
      target_object: { type: 'node', id: 'node-1', label: 'Test Factor' },
      priority: 80,
    } as GuidanceItem
  }

  it('labels it "Try it" — the estate’s existing label for this action class', () => {
    useGuidanceStore.setState({
      guidanceItems: [exerciseItem()],
      _sendMessage: vi.fn(),
      _prefillChat: vi.fn(),
    } as never)
    render(<InspectorCoaching {...coachingProps} />)
    expect(screen.getByText('Try it')).toBeTruthy()
    // The defect: an AUTO-SENDING control wearing the ask label, which is the
    // exact semantic this PR unified.
    expect(screen.queryByText('Ask about this')).toBeNull()
  })

  it('still sends the command when that label is clicked', () => {
    const send = vi.fn()
    useGuidanceStore.setState({
      guidanceItems: [exerciseItem()],
      _sendMessage: send,
      _prefillChat: vi.fn(),
    } as never)
    render(<InspectorCoaching {...coachingProps} />)
    fireEvent.click(screen.getByText('Try it'))
    expect(send).toHaveBeenCalledWith('/exercise pre_mortem')
  })

  it('leaves the genuine ask labelled as an ask', () => {
    // Discriminating twin: only the command class is relabelled.
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<InspectorCoaching {...coachingProps} />)
    expect(screen.getByText('Ask about this')).toBeTruthy()
    expect(screen.queryByText('Try it')).toBeNull()
  })
})
