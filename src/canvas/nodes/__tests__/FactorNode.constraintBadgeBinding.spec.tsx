/**
 * FactorNode constraint badge — BINDS BY `node_id`, NOT BY LABEL STRING.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 * `constraintTooltip` matched goal constraints to factors by LABEL STRING
 * EQUALITY (`c.label?.toLowerCase().trim() === cleanedLabel...`). But `label` is
 * OPTIONAL on the wire and the type's own doc says it is "genuinely absent in
 * practice" — CEE's producer schema and the @talchain/schemas draft contract
 * both declare `label: z.string().optional()`.
 *
 * So a constraint carrying a perfectly good `node_id` and no label produced NO
 * BADGE. Measured on a real model:
 *
 *   { label: "Keep budget at or below £200,000", value: 200000, unit: "£",
 *     operator: "<=", node_id: "4f6bec86", provenance: "explicit" }
 *
 * — the user's own £200,000 limit never appeared on the graph.
 *
 * This is CLAUDE.md trap 19 verbatim: a VALUE PREDICATE where an IDENTITY
 * BINDING was needed. `node_id` is the field the producer writes and the field
 * PLoT's own preflight resolves against `graph.nodes`
 * (`validation/preflight-v2.ts`; a label there is CONSTRAINT_TARGET_NOT_FOUND).
 * `GoalPanel` already writes and reads it (`panels/GoalPanel.tsx:233,269`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE OPPOSITE-DIRECTION TWIN — WHY THE LABEL LEG IS NOT SIMPLY WIDENED
 * ─────────────────────────────────────────────────────────────────────────────
 * Two opposite harms sit under this one predicate and they cannot share a
 * window (standing brief §3):
 *
 *   · MISSING  — a constraint that DOES reference this factor shows no badge
 *                (the reported defect).
 *   · INVENTED — a constraint that does NOT reference this factor shows one
 *                anyway, telling the user they set a limit they never set.
 *
 * A label leg that runs alongside `node_id` reopens the second: two factors can
 * carry the same label, and a constraint bound to the OTHER one would badge
 * this one. So the label leg is a FALLBACK, reached only when a constraint
 * carries no `node_id` at all — legacy persisted graphs minted before GoalPanel
 * captured node ids, which is the only case anyone could show needs it. A
 * constraint that names a node has ALREADY answered the question; its label is
 * not consulted, and must not be.
 *
 * ⚠ FLAG POSTURE. `constraintTooltip` returns null when
 * `isGraphBadgesEnabled()` is false, so these tests are meaningless unless the
 * flag is on. It IS on for a fresh deployed user: derived 2026-08-29 at the
 * DEPLOYED bundle (not the repo — the value is set in the Netlify dashboard, so
 * `netlify.toml` does not carry it), immutable permalink
 * `6a932774ead2e80008a48712--olumi.netlify.app`, `/version.json` commit
 * `9308a30c`, chunk `assets/AppPoC-O9R1tlTq.js`:
 *
 *   VITE_FEATURE_GRAPH_BADGES:"true"
 *
 * against 44 sibling keys in the same compiled object reading `void 0`
 * (`VITE_FEATURE_COMMENTS:void 0`, `VITE_FEATURE_GUIDED_V1:void 0`, ...) — a
 * three-way discrimination a blind probe cannot fake. The compiled `makeFlag`
 * env branch accepts `"true"` as well as `"1"`, checked at the same bytes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** Mutable across tests — the store mock reads this on every render. */
let goalConstraints: unknown[] = []

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints,
      viewMode: 'expert',
    })
  ),
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

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => true),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const baseProps = {
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  // React Flow's NodeProps requires these three. Sibling FactorNode specs omit
  // them and sit in the typecheck baseline for it; a new file must not add to
  // that ratchet.
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The factor under test. Its ID is the identity the badge must bind to. */
const THIS_NODE = '4f6bec86'
const OTHER_NODE = 'a1b2c3d4'

const renderFactor = (id: string, data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} id={id} data={data} />
    </ReactFlowProvider>
  )

const badgeTitle = (container: HTMLElement): string | null =>
  container
    .querySelector('[data-testid="constraint-badge-hover"]')
    ?.getAttribute('title') ?? null

const hasBadge = (container: HTMLElement): boolean =>
  container.querySelector('[data-testid="constraint-badge"]') !== null

describe('FactorNode constraint badge binds by node_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    goalConstraints = []
  })

  it('MISSING-direction: an UNLABELLED constraint carrying this node_id renders the badge', () => {
    // The measured shape, minus the label — `label` is optional on the wire and
    // "genuinely absent in practice" (adapters/cee/types.ts CEEGoalConstraint).
    goalConstraints = [
      {
        constraint_id: 'constraint_4f6bec86_max',
        node_id: THIS_NODE,
        operator: '<=',
        value: 200000,
        unit: '£',
        provenance: 'explicit',
      },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000, unit: '£' },
    })
    expect(hasBadge(container)).toBe(true)
  })

  it('MISSING-direction: the unlabelled constraint tooltip names the FACTOR, never "undefined"', () => {
    goalConstraints = [
      { constraint_id: 'c-1', node_id: THIS_NODE, operator: '<=', value: 200000 },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000 },
    })
    const title = badgeTitle(container)
    expect(title).not.toBeNull()
    expect(title).not.toContain('undefined')
    expect(title).toBe('Constrained: Marketing budget <= 200000')
  })

  it('the LABELLED constraint carrying this node_id still renders its own label', () => {
    goalConstraints = [
      {
        constraint_id: 'c-1',
        node_id: THIS_NODE,
        label: 'Keep budget at or below £200,000',
        operator: '<=',
        value: 200000,
      },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000 },
    })
    expect(badgeTitle(container)).toBe(
      'Constrained: Keep budget at or below £200,000 <= 200000'
    )
  })

  it('INVENTED-direction TWIN: a constraint whose node_id names ANOTHER factor renders NO badge, even when its label matches this one exactly', () => {
    // Two factors sharing a label is ordinary. The constraint has already said
    // which node it binds to; a label leg running alongside node_id would badge
    // the wrong factor and claim a limit the user never set on it.
    goalConstraints = [
      {
        constraint_id: 'c-1',
        node_id: OTHER_NODE,
        label: 'Marketing budget',
        operator: '<=',
        value: 200000,
      },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000 },
    })
    expect(hasBadge(container)).toBe(false)
  })

  it('INVENTED-direction TWIN: a constraint referencing no factor at all renders NO badge', () => {
    goalConstraints = [
      { constraint_id: 'c-1', label: 'Something else entirely', operator: '>=', value: 10 },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000 },
    })
    expect(hasBadge(container)).toBe(false)
  })

  it('LEGACY FALLBACK: a constraint with NO node_id still matches on label', () => {
    // Constraints minted before GoalPanel captured node ids, and any legacy
    // persisted graph. GoalPanel keeps the same fallback for exactly this
    // reason (`constrainedTargets`, panels/GoalPanel.tsx:229-237).
    goalConstraints = [
      { id: 'c1', label: 'Marketing budget', operator: '<=', value: 200000 },
    ]
    const { container } = renderFactor(THIS_NODE, {
      label: 'Marketing budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 150000 },
    })
    expect(hasBadge(container)).toBe(true)
  })

  it('an empty-string label on a node_id-less constraint never matches an empty cleaned label', () => {
    // `cleanFactorLabel('')` is '', and '' === '' would badge every unnamed
    // factor. Guard the empty case explicitly.
    goalConstraints = [{ id: 'c1', label: '', operator: '>=', value: 1 }]
    const { container } = renderFactor(THIS_NODE, {
      label: '',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 1 },
    })
    expect(hasBadge(container)).toBe(false)
  })
})
