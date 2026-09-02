/**
 * GoalNode ⇄ GoalPanel — one goal, one target string (ROADMAP 2.315(c)).
 *
 * The staging walk saw the canvas card and Inspector v2 print DIFFERENT
 * strings for the same goal, because each surface hand-rolled its own
 * unit-string mapping over `formatTargetValue`. Both now route through the
 * shared `formatGoalTarget` — CLAUDE.md #12, derive don't mirror.
 *
 * ⚠ WHAT IS STRUCTURAL IS THE FORMATTER, NOT THE AGREEMENT. An earlier draft
 * of this header claimed the two surfaces are byte-identical "by
 * construction". That is overstated and the correction matters. Only the
 * RENDERING is shared; the INPUTS are two different sources — the panel reads
 * the store scalar `goalThreshold`, the card reads `node.data`. Same string
 * out only while those two agree.
 *
 * One reachable divergence, named so nobody mistakes this file for a proof it
 * cannot give: a later graph_patch RAISING the target updates the node through
 * the ungated backfill while the store gate (raw is not superseded by raw)
 * leaves the scalar stale. The card then shows the new figure, the panel the
 * old — and the run sends the old. This is PRE-EXISTING, not a regression:
 * the pristine gate (`goalThreshold == null`, store.ts:4013 at cb957c8c) blocks
 * the same refresh identically, and 2.315 deliberately did not widen it
 * further. Rowed separately by the paired review.
 *
 * So: given equal inputs, the two surfaces cannot disagree — that is what this
 * file pins, and it is the half that was actually broken.
 *
 * This file pins the CARD half. The PANEL half is
 * `src/canvas/ui/inspector-v2/__tests__/GoalPanel.goalTarget.spec.tsx`, which
 * asserts the same literals against the real store and the real panel. Each
 * case here asserts BOTH a hard literal (so a broken helper cannot make the
 * two surfaces agree on garbage) and equality with the helper (so a surface
 * that stops deferring to it REDs).
 *
 * Scope limit (CLAUDE.md trap 3): jsdom pins the rendered string only, never
 * that the card's target line is visible or laid out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
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

import { useCanvasStore } from '../../store'
import type { LodRung } from '../../utils/zoomLegibility'

const baseProps = {
  id: 'goal-1',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderCard(data: Record<string, unknown>, lodRung: LodRung = 'full') {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState({ lodRung }) as never),
  )
  const { container, unmount } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Grow annual revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return {
    text: container.textContent ?? '',
    lodLine: container.querySelector('[data-testid="node-lod-line"]')?.textContent ?? null,
    unmount,
  }
}

function cardText(data: Record<string, unknown>) {
  return renderCard(data).text
}

describe('GoalNode target string — the canvas half of the one-goal-one-string pair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  it('renders a currency target as a prefixed, separated magnitude', () => {
    const text = cardText({ goal_threshold_raw: 800000, goal_threshold_unit: '£' })
    expect(text).toContain('£800,000')
    expect(text).toContain(formatGoalTarget(800000, '£'))
    expect(text).not.toContain('800000 £')
  })

  it('suppresses the "count" placeholder — the string Inspector v2 was printing', () => {
    const text = cardText({ goal_threshold_raw: 800000, goal_threshold_unit: 'count' })
    expect(text).toContain('800,000')
    expect(text).toContain(formatGoalTarget(800000, 'count'))
    expect(text).not.toContain('count')
  })

  it('renders a real unit as a suffix', () => {
    const text = cardText({ goal_threshold_raw: 9, goal_threshold_unit: 'months' })
    expect(text).toContain('9 months')
    expect(text).toContain(formatGoalTarget(9, 'months'))
  })

  it('renders percent as a rounded percentage', () => {
    const text = cardText({ goal_threshold_raw: 84.6, goal_threshold_unit: 'percent' })
    expect(text).toContain('85%')
    expect(text).toContain(formatGoalTarget(84.6, 'percent'))
  })
})

/**
 * ⭐⭐ THE THIRD AGREEMENT, AND THE ONE THAT ACTUALLY BROKE — the goal card
 * against ITSELF, one zoom step apart.
 *
 * The file above pins card ⇄ Inspector panel. On 1 Sep 2026 the card acquired a
 * reduced line for low zoom, written as a SECOND HAND-COPY of its own full-zoom
 * string — and the copy dropped the colon. The same goal read `Target: 15%` at
 * full zoom and `Target 15%` one step out, with the full-zoom body hidden
 * behind it so nothing on screen could contradict it. Three sites (body line,
 * reduced line, the file's own docblock) and two of them disagreed.
 *
 * ⛔ SO THIS PINS THE LOW-ZOOM LINE AGAINST THE FULL-ZOOM RENDER, NOT AGAINST A
 * LITERAL — which is the whole point. A test spelling `'Target: 15%'` would
 * have to be edited in step with any wording change, i.e. it would be a THIRD
 * hand-maintained copy of the string it is guarding (CLAUDE.md trap 12). This
 * one cannot drift: it renders the card twice and asserts the reduced line is
 * text the card already shows. Change the wording anywhere and it stays green;
 * change it in only ONE place and it REDs, which is the only event worth
 * catching.
 */
describe('the reduced line is DERIVED from the full-zoom card, never hand-copied beside it', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  const CASES: Array<{ name: string; data: Record<string, unknown> }> = [
    { name: 'a percent target', data: { goal_threshold_raw: 15, goal_threshold_unit: 'percent' } },
    { name: 'a currency target', data: { goal_threshold_raw: 800000, goal_threshold_unit: '£' } },
    { name: 'a real-unit target', data: { goal_threshold_raw: 9, goal_threshold_unit: 'months' } },
    // ⭐ THE NO-TARGET CARD IS A CASE, NOT AN EDGE CASE. It is the state every
    // model is in before somebody sets a target — the commonest goal card there
    // is — and below the floor it used to be an empty box, which is
    // indistinguishable from a broken render.
    { name: 'no target at all', data: {} },
  ]

  for (const c of CASES) {
    it(`${c.name}: the low-zoom line is text the full-zoom card already shows`, () => {
      const full = renderCard(c.data, 'full')
      const fullText = full.text
      full.unmount()

      const low = renderCard(c.data, 'line')
      const line = low.lodLine
      low.unmount()

      // ⛔ POSITIVE CONTROLS FIRST (CLAUDE.md trap 13). `toContain` is trivially
      // satisfied by an empty needle, and an unrendered card gives an empty
      // haystack — so BOTH halves are proven non-vacuous before the comparison
      // that matters. Without these, a GoalNode that threw on mount would make
      // this assertion pass forever while checking nothing.
      expect(fullText).toContain('Grow annual revenue')
      expect(line).not.toBeNull()
      expect(line!.trim().length).toBeGreaterThan(0)

      // THE PIN. No literal anywhere: the reduced line has to be a substring of
      // what this same card renders at ordinary zoom.
      expect(fullText).toContain(line!)
    })
  }

  it('CONTRAST CONTROL — the reduced line exists ONLY below the floor, so this is a zoom behaviour and not a second body', () => {
    // Without this, every assertion above could be satisfied by a card that
    // renders the line at all times, and the pin would be about a duplicated
    // body rather than about the reduced line.
    const full = renderCard({ goal_threshold_raw: 15, goal_threshold_unit: 'percent' }, 'full')
    expect(full.lodLine).toBeNull()
    full.unmount()

    const low = renderCard({ goal_threshold_raw: 15, goal_threshold_unit: 'percent' }, 'line')
    expect(low.lodLine).not.toBeNull()
    low.unmount()
  })

  it('CONTRAST CONTROL — two different targets produce two different lines, so the line is read and never defaulted', () => {
    const a = renderCard({ goal_threshold_raw: 15, goal_threshold_unit: 'percent' }, 'line')
    const lineA = a.lodLine
    a.unmount()
    const b = renderCard({ goal_threshold_raw: 9, goal_threshold_unit: 'months' }, 'line')
    const lineB = b.lodLine
    b.unmount()
    expect(lineA).not.toBeNull()
    expect(lineB).not.toBeNull()
    expect(lineA).not.toBe(lineB)
  })
})
