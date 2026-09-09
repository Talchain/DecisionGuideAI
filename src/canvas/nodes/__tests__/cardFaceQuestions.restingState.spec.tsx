/**
 * EVERY CARD ASKS ITS QUESTION IN THE RESTING STATE — no hover, default view.
 *
 * ─── WHY THIS FILE EXISTS AND `render-matrix.spec.tsx` COULD NOT ────────────
 *
 * `render-matrix.spec.tsx:66-70` MOCKS `NodePopover` into a plain
 * always-rendering `<div>`. That is deliberate and reasonable for what that
 * file pins (chip copy per node per phase per view) — but it removes the exact
 * gate that hides the chips from a user. `NodePopover.tsx:129` is
 * `if (!visible) return null`, so in the real component a closed popover's
 * children are ABSENT FROM THE DOM, not merely invisible.
 *
 * Consequence, measured on deployed `9748b336` (Standard view, post-analysis,
 * resting state): `What reduces this` 0, `Explore mitigation` 0, `What would we
 * see first` 0, `What would falsify` 0, `Explore more options` 0, `What could
 * go wrong` 0 — every coaching chip on the canvas, absent. Contrast controls in
 * the same probe: 71 `react-flow__node`, 26 `Influence`, so the probe could
 * read the page. Meanwhile the matrix suite was green on assertions like
 * "Standard post: same two chips".
 *
 * ⭐ A GREEN SUITE ABOUT CONTENT NOBODY CAN REACH. This file therefore does NOT
 * mock `NodePopover` — it renders the real one, closed, which is what a user
 * gets. It is the only place that can tell "on the card" from "behind a hover".
 *
 * ─── THE DISCRIMINATOR ──────────────────────────────────────────────────────
 *
 * Each case asserts a promoted question is PRESENT *and* a popover-only chip is
 * ABSENT in the same render. Without the absence half, this file would pass
 * just as happily if someone re-mocked the popover or moved every chip back
 * onto the card — it would no longer be discriminating between the two
 * locations, which is the single thing it exists to do (CLAUDE.md trap 13b: a
 * guard whose discrimination is unpinned agrees with itself).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { ActionNode } from '../ActionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))

// Spread the real flags module so a newly-added flag never goes silently
// absent and throws at render (CLAUDE.md trap 12 — derive, don't mirror).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

// ⚠ `NodePopover` is deliberately NOT mocked. That is the whole point.

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

type Phase = 'pre' | 'post'

function applyStore(phase: Phase, viewMode: 'standard' | 'expert' = 'standard') {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: phase === 'post' ? 'complete' : 'idle', report: phase === 'post' ? {} : null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode,
    }),
  )
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

const renderRisk = () => render(
  <ReactFlowProvider>
    <RiskNode {...baseProps} id="risk-1" type="risk" data={{ label: 'Key person dependency', type: 'risk' }} />
  </ReactFlowProvider>
)

const renderOutcome = () => render(
  <ReactFlowProvider>
    <OutcomeNode {...baseProps} id="outcome-1" type="outcome" data={{ label: 'Revenue growth', type: 'outcome' }} />
  </ReactFlowProvider>
)

const renderAction = () => render(
  <ReactFlowProvider>
    <ActionNode {...baseProps} id="action-1" type="action" data={{ label: 'Run a pilot', type: 'action', description: 'Two-week trial' }} />
  </ReactFlowProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
  } as any)
})

describe('Resting state — the card asks its question without a hover', () => {
  it.each(['pre', 'post'] as const)(
    'risk (%s): "What would we see first?" is on the CARD, while the reduce/mitigate pair stays behind the hover',
    (phase) => {
      applyStore(phase)
      renderRisk()
      // Promoted to the card face.
      expect(screen.getByText('What would we see first?')).toBeDefined()
      // ⭐ DISCRIMINATOR — these are popover-only, and the popover is closed.
      // If this ever passes, the file has stopped telling card from hover.
      expect(screen.queryByText('What reduces this?')).toBeNull()
      expect(screen.queryByText('Explore mitigation')).toBeNull()
    },
  )

  it.each(['pre', 'post'] as const)(
    'outcome (%s): "What would falsify this?" is on the CARD — including AFTER the run, which used to delete it',
    (phase) => {
      applyStore(phase)
      renderOutcome()
      expect(screen.getByText('What would falsify this?')).toBeDefined()
      // DISCRIMINATOR — popover-only in Standard view.
      expect(screen.queryByText('Explore consequences')).toBeNull()
    },
  )

  it.each(['pre', 'post'] as const)(
    'action (%s): the action card asks what has to be true — it previously asked nothing at all',
    (phase) => {
      applyStore(phase)
      renderAction()
      expect(screen.getByText('What has to be true?')).toBeDefined()
    },
  )

  /**
   * Detailed (expert) view is unchanged by this work: it renders the full chip
   * set inline, so the questions the Standard view keeps behind a hover are
   * reachable there without one. Asserted so a future edit cannot quietly
   * empty Detailed while this file's Standard cases stay green.
   */
  it('detailed view still renders the full risk chip set inline', () => {
    applyStore('post', 'expert')
    renderRisk()
    expect(screen.getByText('What would we see first?')).toBeDefined()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
  })
})
