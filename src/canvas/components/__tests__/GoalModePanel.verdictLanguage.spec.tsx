/**
 * GoalModePanel — the computed intervention path is not "Recommended"
 * (ROADMAP 2.724).
 *
 * Doctrine (Paul-ratified): the product recommends what to INVESTIGATE, never
 * what to CHOOSE. Crowning a computed intervention sequence "Recommended Path"
 * turns a feasibility calculation into an instruction. "Path to goal" states
 * exactly what was computed; NO information is lost, because the feasibility
 * qualifier the heading was leaning on is rendered in the badge beside it
 * ("easy/moderate/difficult to implement") and is asserted here so a future
 * edit cannot resolve the doctrine by deleting the qualifier instead.
 *
 * ── HONEST SCOPE (trap 3b — this is NOT a live surface at this tip) ───────
 * Derived, not assumed, at tip `a81121d1`:
 *   · `GoalModePanel` has exactly one importer: `src/canvas/CanvasToolbar.tsx`
 *     (:32 lazy import, :573 render).
 *   · `CanvasToolbar` has ZERO production JSX usages — `rg '<CanvasToolbar'`
 *     over `src/` returns three hits, all in DOM specs. Its own source says so
 *     at `CanvasToolbar.tsx:435`: "CanvasToolbar is production-unmounted today
 *     (mounted only in DOM tests)".
 *   · Served-bundle corroboration: the deployed staging build at that same tip
 *     (`/version.json` commit == `a81121d1c401a8d51bc4c32e53d1d0e63a7640a3`,
 *     83-chunk transitive closure crawled from the served entry) contains
 *     neither "Recommended Path", nor "Find Path to Goal", nor any
 *     GoalModePanel chunk.
 * The source audit filed this as a LIVE UI violation "mounted via
 * CanvasToolbar.tsx:573" — that is repo mount-path presence, not deployed
 * mount. Measured here, no user sees this heading today.
 *
 * The copy is fixed anyway: an unmounted verdict string is a loaded weapon, and
 * a remount would ship it. But this file is a REGRESSION PIN on dormant copy
 * and is deliberately not described as protecting a live surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ContrastiveExplanationResponse } from '../../../adapters/isl/types'

const mockExplanation = vi.hoisted(() => ({
  data: null as ContrastiveExplanationResponse | null,
}))

vi.mock('../../../hooks/useContrastiveExplanation', () => ({
  useContrastiveExplanation: () => ({
    data: mockExplanation.data,
    loading: false,
    error: null,
    findPath: vi.fn(),
  }),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ nodes: [], edges: [] })),
}))

import { GoalModePanel } from '../GoalModePanel'

const PATH_RESULT: ContrastiveExplanationResponse = {
  path: [
    {
      nodeId: 'factor-1',
      nodeLabel: 'Team size',
      currentValue: 5,
      targetValue: 8,
      change: 3,
      effort: 'moderate',
      impact: { sideEffects: [] },
    },
  ] as never,
  totalCost: 3,
  feasibility: 'moderate',
  expectedOutcome: { nodeId: 'outcome-1', value: 0.8, confidence: 0.6 },
}

describe('GoalModePanel — computed path is described, not prescribed (ROADMAP 2.724)', () => {
  beforeEach(() => {
    mockExplanation.data = null
  })

  it('heads the computed path with "Path to goal", never "Recommended Path"', () => {
    mockExplanation.data = PATH_RESULT
    render(<GoalModePanel onClose={() => {}} />)

    // Precondition pin (trap 13b): prove the results branch actually rendered,
    // so the absence assertion below cannot pass on an empty panel.
    expect(screen.getByText('Team size', { exact: false })).toBeDefined()

    expect(screen.getByRole('heading', { name: 'Path to goal' })).toBeDefined()
    expect(screen.queryByText('Recommended Path')).toBeNull()
    expect(screen.queryByText(/recommend/i)).toBeNull()
  })

  it('keeps the feasibility qualifier — information preserved, only framing removed', () => {
    mockExplanation.data = PATH_RESULT
    render(<GoalModePanel onClose={() => {}} />)

    expect(screen.getByText('moderate to implement')).toBeDefined()
  })
})
