/**
 * BaseNode — the "Needs input" StatusPill joins the corner stack that OWNS the
 * top-right corner.
 *
 * StatusPill hand-wrote `absolute -top-2 -right-1 z-10` — one pixel from, and at
 * the SAME z as, `node-corner-stack-{id}` (`absolute -top-2 -right-2 z-10`), the
 * container built specifically to abolish same-corner overlap. That is the
 * fourth occupant of this corner to arrive with its own positioning authority,
 * after rank vs coaching (Codex P1-5) and the edited-since-run dot (Codex P2).
 *
 * ⭐ MEASURED, NOT ARGUED (real Chromium, `e2e/geometry/statusPillCorner.measure.ts`,
 * 1440x900, committed starters `vendor-selection` and `build-vs-buy`):
 * with a prior run in history — the state left by an import/reset, which sets
 * `results.status` to 'idle' while run history persists in localStorage — the
 * goal node rendered BOTH the pill and the edited-since-run dot, and the pill
 * covered 15px² of the dot's 25px² (60%). The no-run-history arm of the same run
 * measured zero co-occurrence, so the probe discriminates.
 *
 * ⚠ THE PAIR THAT CANNOT HAPPEN, pinned below rather than assumed: the
 * sensitivity-rank badge requires `results.status === 'complete'`
 * (`isResultsMode`, declared in `useNodeDisplayMetadata.ts`) and the pill
 * requires `results.status !== 'complete'` (`isPreRunMode`, declared in
 * `BaseNode.tsx`) — exact complements on ONE store field, so rank and pill are
 * structurally unable to co-occur. Both were line offsets until 2026-09-04;
 * `#1175` moved the hook's and the corner-stack change moved BaseNode's, so
 * both pointed at unrelated lines within days. Symbols do not move. This file
 * does NOT mock `useNodeDisplayMetadata`, so nothing here can manufacture a state
 * the product cannot reach (CLAUDE.md trap 16-inverse — a fixture you wrote
 * yourself is not evidence about the product).
 *
 * ⚠ BUT NOT MOCKING THE HOOK IS NOT ITSELF A PIN, and claiming it was is the one
 * thing this file got wrong first time round. A rendered ABSENCE of the rank
 * badge here is over-determined — this mock's `report` is null and the node is a
 * goal, and either alone suppresses the badge whatever the status gate does — so
 * a mutant forcing `isResultsMode = true` SURVIVED the original render-based pin.
 * The complement is asserted at the SOURCE instead, in the last test. See its
 * header for the full account.
 *
 * ORDER: pill · rank · edited-dot · coaching, widest-first. The stack is
 * right-anchored and grows leftward, so widest-first keeps the small badges
 * clear of the corner and leaves the interactive coaching marker as the
 * rightmost, easiest click target. The pill is by far the widest child
 * (measured 67.9px against the dot's 5px at the same zoom).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const { selectNodeWithoutHistory, editedNodeIds } = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  editedNodeIds: new Set<string>(),
}))

// `results.status: 'idle'` is the state an import/reset leaves (store.ts:3903,
// store.ts:4358) — pre-run mode, which is what mounts the pill. Run history is a
// SEPARATE localStorage authority that survives both, which is why the edited
// dot can be present at the same time.
vi.mock('../../store', () => {
  const state = {
    edges: [],
    nodes: [{ id: 'node-a' }],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: editedNodeIds,
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    ceeAnalysisReady: null,
    lodRung: 'full',
    viewMode: 'expert',
    selectNodeWithoutHistory,
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

const baseProps = {
  id: 'node-a',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Reach profitability', type: 'goal' },
}

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...overrides,
  }
}

const renderNode = () =>
  render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as unknown as Parameters<typeof GoalNode>[0])} />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})

describe('BaseNode — "Needs input" pill joins the corner stack', () => {
  it('the pill renders INSIDE the corner stack, not as its own positioned element', () => {
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    expect(stack).toContainElement(pill)
  })

  it('the pill carries NO positioning authority of its own', () => {
    renderNode()
    const pill = screen.getByTestId('needs-input-pill')
    // The precise classes that made it a rival authority in this corner.
    expect(pill.className).not.toContain('absolute')
    expect(pill.className).not.toContain('-top-2')
    expect(pill.className).not.toContain('-right-1')
    expect(pill.className).not.toContain('z-10')
  })

  it('MEASURED PAIR — pill and edited-since-run dot are ordered siblings, pill first (widest-first)', () => {
    editedNodeIds.add('node-a')
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    const edited = screen.getByTestId('edited-since-run-node-a')
    expect(stack).toContainElement(pill)
    expect(stack).toContainElement(edited)
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(2)
    // Bind by IDENTITY, never by position alone.
    expect(kids[0]).toBe(pill)
    expect(kids[1]).toBe(edited)
  })

  it('pill · edited-dot · coaching are three ordered siblings, coaching rightmost', () => {
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    const edited = screen.getByTestId('edited-since-run-node-a')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(3)
    expect(kids[0]).toBe(pill)
    expect(kids[1]).toBe(edited)
    expect(kids[2]).toBe(coaching)
    expect(coaching.className).not.toContain('absolute')
  })

  /**
   * ⚠ THIS PIN IS SOURCE-DERIVED, AND THE FIRST VERSION OF IT WAS VACUOUS.
   *
   * It began as a RENDER assertion — mount the pill, assert no rank badge. A
   * mutant that forced `isResultsMode = true` in `useNodeDisplayMetadata`
   * SURVIVED it. Two confounds in this file's own fixture, either of which
   * alone makes the rank badge absent no matter what the status gate says:
   *   1. the hook short-circuits on `!report`, and this mock's report is null;
   *   2. the rank badge is FACTOR-only and the node under test is a goal.
   * So the render could never have been sensitive to the complement it claimed
   * to pin — a guard whose discrimination came entirely from its fixture
   * (CLAUDE.md trap 13b).
   *
   * The claim worth pinning is a STRUCTURAL one about two gates in two files,
   * so it is asserted where it actually lives. If either expression changes,
   * this REDs and the next session must re-derive whether the pill and the rank
   * badge can now co-occur — and, if they can, measure that pair's geometry
   * rather than inheriting this file's verdict.
   */
  it('IMPOSSIBILITY PIN: the pill gate and the rank gate are exact complements on one store field', () => {
    const baseNode = readFileSync(
      resolve(__dirname, '../BaseNode.tsx'), 'utf8')
    const metadataHook = readFileSync(
      resolve(__dirname, '../../hooks/useNodeDisplayMetadata.ts'), 'utf8')

    // Positive control: prove the reader can SEE this file's content at all,
    // so a false zero cannot pass as a satisfied assertion.
    expect(baseNode).toContain('node-corner-stack-')
    expect(metadataHook).toContain('useNodeDisplayMetadata')

    // The pill mounts only in pre-run mode...
    expect(baseNode).toContain("const isPreRunMode = resultsStatus !== 'complete'")
    // ...and the rank badge only in results mode. One field, opposite tests.
    expect(metadataHook).toContain("const isResultsMode = resultsStatus === 'complete'")
  })
})
