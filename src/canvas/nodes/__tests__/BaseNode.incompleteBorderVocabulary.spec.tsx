/**
 * TWO RATIFIED BORDER MODIFIERS, NEVER BOTH AT ONCE.
 *
 * `DESIGN_SYSTEM.md` §"Border vocabulary (ratified, wireframe v4)":
 *
 *   · **Dashed border = "outside your control"** (external factors).
 *   · **Amber border = "needs your judgement"** (a controllable node missing
 *     its value; the goal missing its target).
 *   · "New states must reuse this vocabulary, not invent a third border
 *     treatment."
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `BaseNode` rendered `isIncomplete ? 'border-warning border-dashed'` — BOTH
 * modifiers, on one card, for one state. So every incomplete node also claimed
 * to be **outside the user's control**. On the founder's pre-analysis
 * screenshot four of five OPTIONS rendered that way, and an option is the most
 * within-the-user's-control object on the canvas: the sentence the card was
 * making is not merely clumsy, it is false.
 *
 * ⚠ THE AMBER IS NOT THE DEFECT AND IS DELIBERATELY UNTOUCHED. Amber-on-
 * incomplete is ratified. `DESIGN_SYSTEM.md` records an OPEN QUESTION about it
 * (flagged 2026-07-16, "Paul to rule") — amber `#FFA656` sits close to the risk
 * border `#EA7B4B`, and the alternative (kind hue + amber badge) would mean
 * re-ruling wireframe v4. That is his call, not this lane's. Measured for it:
 * **ΔE2000 = 13.9** (ΔE76 = 20.1) between `--warning` and `--danger`.
 *
 * ── WHY BOTH DIRECTIONS ARE ASSERTED ───────────────────────────────────────
 * Deleting the dash everywhere would be the easy wrong fix: the dash is a REAL
 * signal that external factors depend on. So every case here has its twin — the
 * incomplete node must LOSE the dash, and the external factor must KEEP it, in
 * the same file, or a change that flattened the whole channel would pass.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'

/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors the sibling node
   specs: ReactFlow's NodeProps requires a dozen fields no assertion here reads. */
const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const OPTION_ID = 'opt_rebuild'
const FACTOR_ID = 'fac_hiring'

function mockStore(over: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
      ...over,
    } as never),
  )
}

/** The card element every assertion below binds to, by role — never by class. */
const card = (container: HTMLElement) =>
  container.querySelector('[role="group"]')!.className

function renderFactor(data: Record<string, unknown>) {
  mockStore({ nodes: [{ id: FACTOR_ID, type: 'factor', data }] })
  return render(
    <ReactFlowProvider>
      <FactorNode {...(baseProps as any)} type="factor" id={FACTOR_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

function renderIncompleteOption() {
  const data = { label: 'Rebuild', type: 'option' }
  mockStore({
    nodes: [{ id: OPTION_ID, type: 'option', data }],
    // `status: 'ready'` is load-bearing: a BLOCKED analysis is not allowed to
    // mark options incomplete at all, so a fixture without it would assert the
    // border of a node that is not in the state under test.
    ceeAnalysisReady: {
      options: [{ id: OPTION_ID, label: 'Rebuild', interventions: {} }],
      goal_node_id: 'goal_1',
      status: 'ready',
    },
  })
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} type="option" id={OPTION_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('an incomplete node needs judgement — it is not "outside your control"', () => {
  it('OPTION — amber, and NOT dashed', () => {
    const { container } = renderIncompleteOption()
    // Pin the precondition IN-TEST: without this the class assertions below
    // could pass on a node that simply never entered the incomplete state.
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    const cls = card(container)
    expect(cls).toContain('border-warning')
    expect(cls).not.toContain('border-dashed')
  })

  it('FACTOR (controllable, no value) — amber, and NOT dashed', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
    })
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    const cls = card(container)
    expect(cls).toContain('border-warning')
    expect(cls).not.toContain('border-dashed')
  })
})

describe('⛔ THE TWIN — the dash still means what it has always meant', () => {
  /**
   * The harm the fix above must not cause. Same component, same missing value;
   * only `category` differs — so a pass here cannot be explained by the fix
   * having simply deleted the dashed treatment, only by the dash still being
   * bound to "outside your control".
   */
  it('EXTERNAL factor with no value — dashed, and NEVER amber', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
    })
    const cls = card(container)
    expect(cls).toContain('border-dashed')
    expect(cls).not.toContain('border-warning')
    // And it is not incomplete at all — `isFactorNeedsInput` exempts external
    // factors, which is what keeps "external NEVER gets amber" true upstream of
    // the border expression rather than only inside it.
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
  })

  it('a factor that has its value is neither amber nor dashed', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.7, source: 'user_override' },
    })
    const cls = card(container)
    expect(cls).not.toContain('border-warning')
    expect(cls).not.toContain('border-dashed')
  })
})
