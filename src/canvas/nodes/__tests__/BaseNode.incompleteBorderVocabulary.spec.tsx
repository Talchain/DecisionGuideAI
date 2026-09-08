/**
 * THE BORDER VOCABULARY, AFTER PAUL'S RE-RULING (8 Sep 2026).
 *
 * `DESIGN_SYSTEM.md` §"Border vocabulary (ratified, wireframe v4)" named two
 * border modifiers:
 *
 *   · **Dashed border = "outside your control"** (external factors).
 *   · **Amber border = "needs your judgement"** (a controllable node missing
 *     its value; the goal missing its target).
 *
 * ── WHAT THIS FILE USED TO PIN, AND WHY IT CHANGED ─────────────────────────
 * It pinned `border-warning` ON the incomplete card, in both directions
 * (incomplete loses the dash · external keeps it). That amber-REPLACES-the-hue
 * treatment carried an OPEN QUESTION in `DESIGN_SYSTEM.md` (flagged
 * 2026-07-16, "Paul to rule"), recorded here as ΔE2000 = 13.9 between
 * `--warning` and `--danger`.
 *
 * ⭐ PAUL HAS NOW RULED, AND THE MEASUREMENT THAT PROMPTED IT NAMED THE WRONG
 * COLLISION. Risk was never the worst case:
 *
 *   amber vs …      normal   deuteranopia   protanopia
 *   risk/danger      13.9        8.9           12.2
 *   GOAL             17.0        5.5            8.7      ← worst, both
 *   factor           22.0       20.6           17.5
 *   outcome/success  43.6       19.8           12.7
 *   option           42.9       53.7           50.5
 *
 * ⭐ RE-DERIVED 8 Sep 2026 THROUGH `canvas/edges/cvdContrast.ts` (`deltaE2000`;
 * CIEDE2000 over a Viénot–Brettel–Mollon 1999 dichromat simulation) — the
 * repo's own instrument, and now PINNED in `polarityContrast.spec` so these
 * cells are regression-guarded rather than prose. The first cut came from an
 * ad-hoc script whose simulation step nothing validated; five of the nine
 * cells were off by 0.1–0.2 and the ranking was unchanged. The rule
 * explicitly covers *"the goal missing its target"*, so the treatment was least
 * distinguishable precisely on the node class it most often applies to. And
 * amber-replacing-the-hue made COLOUR the SOLE channel for the state, which the
 * design system's own Developer Checklist forbids.
 *
 * ── THE RULING, AS IMPLEMENTED ─────────────────────────────────────────────
 * The kind hue STAYS (`border-goal`, `border-option`, `border-factor`, … from
 * `colors.ts`). "Needs your judgement" moves to the amber `StatusPill` that
 * already carried it for factor and goal — now rendered for EVERY node type
 * `isIncomplete` admits, so the state has ONE carrier rather than a hue for two
 * node types and a pill for two others.
 *
 * ── WHY BOTH DIRECTIONS ARE STILL ASSERTED ─────────────────────────────────
 * Unchanged, and it is the reason this file exists rather than a new one.
 * Deleting the dash everywhere would be the easy wrong fix: the dash is a REAL
 * signal that external factors depend on. So every case here has its twin — the
 * incomplete node must LOSE the dash, and the external factor must KEEP it, in
 * the same file, or a change that flattened the whole channel would pass.
 *
 * ⭐ AND THE RE-RULING ADDS A THIRD DIRECTION, which is strictly more than this
 * file checked before: the incomplete card must KEEP ITS KIND HUE **and** carry
 * the badge. A re-ruling that swapped one assertion for a weaker one would be a
 * regression wearing a decision's clothes.
 *
 * ⚠ ASSERTIONS BIND TO EXACT CLASS TOKENS, NOT SUBSTRINGS. `toContain` on the
 * className string would let `hover:border-option/80` satisfy a
 * `'border-option'` assertion — a value predicate a different token can meet
 * (CLAUDE.md trap 19). The card's class list is split and matched token-exact.
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

/* ReactFlow's NodeProps requires a dozen fields no assertion here reads; the
   casts below are the sibling node specs' own pattern. */
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

/**
 * The card element every assertion below binds to, by role — never by class —
 * returned as its EXACT class tokens so no assertion can be satisfied by a
 * longer token that merely contains the one it names.
 */
const cardTokens = (container: HTMLElement) =>
  container.querySelector('[role="group"]')!.className.split(/\s+/).filter(Boolean)

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

describe('an incomplete node keeps its kind hue and says so in words', () => {
  it('OPTION — keeps border-option, is NOT amber, is NOT dashed, and carries the badge', () => {
    const { container } = renderIncompleteOption()
    // Pin the precondition IN-TEST: without this the class assertions below
    // could pass on a node that simply never entered the incomplete state.
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    const tokens = cardTokens(container)
    // ⭐ THE RE-RULING. This assertion replaces `toContain('border-warning')`
    // and is strictly stronger: it names the hue that must SURVIVE, so a future
    // change that swapped amber for any other single colour would RED here.
    expect(tokens).toContain('border-option')
    expect(tokens).not.toContain('border-warning')
    expect(tokens).not.toContain('border-dashed')
    // ⭐ AND THE CHANNEL THE HUE NO LONGER CARRIES. Without this the ruling is
    // half-implemented: the amber would be gone and the state unannounced.
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
  })

  it('FACTOR (controllable, no value) — keeps border-factor, not amber, not dashed, and carries the badge', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
    })
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    const tokens = cardTokens(container)
    expect(tokens).toContain('border-factor')
    expect(tokens).not.toContain('border-warning')
    expect(tokens).not.toContain('border-dashed')
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
  })
})

describe('⛔ THE TWIN — the dash still means what it has always meant', () => {
  /**
   * The harm the ruling above must not cause. Same component, same missing
   * value; only `category` differs — so a pass here cannot be explained by the
   * change having simply deleted a treatment, only by the dash still being
   * bound to "outside your control".
   */
  it('EXTERNAL factor with no value — dashed, NEVER amber, and NO badge', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
    })
    const tokens = cardTokens(container)
    expect(tokens).toContain('border-dashed')
    expect(tokens).not.toContain('border-warning')
    // And it is not incomplete at all — `isFactorNeedsInput` exempts external
    // factors, which is what keeps "external NEVER gets amber" true upstream of
    // the border expression rather than only inside it.
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
    // ⭐ THE EXEMPTION HAD TO SURVIVE THE MOVE. Amber leaving the border is not
    // an excuse to let it arrive as a badge: an external factor is not missing
    // the user's judgement, it is outside it.
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })

  it('a factor that has its value is neither amber nor dashed, and carries no badge', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.7, source: 'user_override' },
    })
    const tokens = cardTokens(container)
    expect(tokens).not.toContain('border-warning')
    expect(tokens).not.toContain('border-dashed')
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })
})
