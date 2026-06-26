/**
 * V5GraphPatchBlock DOM tests — Workstream 1 (Journey 3 / Journey 6).
 *
 * Asserts the receipt rendering does NOT leak raw IDs, schema field names,
 * operator codes, or before/after JSON keys into the default UI surface.
 *
 * Mocks `useCanvasStore` so the component sees a controlled set of nodes
 * for label resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../../canvas/conversation/types'
import { expectNoReceiptLeaks } from '../../../test/helpers/expectNoReceiptLeaks'

// Mock the canvas store so the block uses our controlled nodes/edges.
// Includes both the underscore-prefixed ids used by simpler fixtures
// and the dash-prefixed ids CEE adjust_edge_strength emits inside its
// `from→to` arrow-form target_id (e.g. `f-budget→g-revenue`).
const NODES = [
  { id: 'fac_team_morale', data: { label: 'team morale' } },
  { id: 'fac_morale', data: { label: 'team morale' } },
  { id: 'goal_outcome', data: { label: 'overall outcome' } },
  { id: 'f-budget', data: { label: 'Marketing budget' } },
  { id: 'g-revenue', data: { label: 'Revenue' } },
]
const EDGES = [
  { id: 'edge_morale_to_outcome', source: 'fac_morale', target: 'goal_outcome' },
]

// Each test controls the CEE freshness verdict independently. The component
// reads the `analysisFreshness` slice (+ dirty overlay) from the store and runs
// the real `classifyFreshnessForDisplay`; the hint shows only on 'changed'
// (CEE 'stale' OR a retained-fresh-now-dirtied). Default 'unknown' → no hint.
import type { AnalysisFreshnessState } from '../../../lib/analysisFreshnessState'

const mockFreshnessState = vi.fn<[], AnalysisFreshnessState>(() => ({
  freshness: 'unknown',
  reason: null,
  recommendedAction: 'continue_editing',
  inputsMissing: [],
}))
// Controls the dirty overlay (default clean; set true to exercise the
// fresh→changed downgrade path).
let mockAnalysisFreshnessDirty = false

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (
    selector: (s: {
      nodes: unknown
      edges: unknown
      analysisFreshness: { freshness: string } | null
      analysisFreshnessDirty: boolean
    }) => unknown,
  ) =>
    selector({
      nodes: NODES,
      edges: EDGES,
      analysisFreshness: { freshness: mockFreshnessState().freshness },
      analysisFreshnessDirty: mockAnalysisFreshnessDirty,
    }),
}))

// Import AFTER the mock so the component uses the mocked store.
import { V5GraphPatchBlock } from '../V5GraphPatchBlock'

// Inline FORBIDDEN_TERMS / FORBIDDEN_OPERATOR_GLYPHS / expectNoLeakInDOM
// were consolidated into the shared `expectNoReceiptLeaks` helper so V4
// and V5 receipt tests share one source of truth. Cited terms appear in
// failure messages — see `src/test/helpers/expectNoReceiptLeaks.ts`.
// The shared list now includes the block-type discriminator
// (`graph-patch` / `graph_patch` / `graphpatch`) — V5's renamed testid
// (`v5-change-receipt`) and Tailwind-only styling means full outerHTML
// stays clean against that term, so no V5-local exception is needed.
function expectNoLeakInDOM(): void {
  expectNoReceiptLeaks(screen.getByTestId('v5-change-receipt'))
}

beforeEach(() => {
  cleanup()
  mockAnalysisFreshnessDirty = false
  mockFreshnessState.mockReturnValue({
    freshness: 'unknown',
    reason: null,
    recommendedAction: 'continue_editing',
    inputsMissing: [],
  })
})

describe('V5GraphPatchBlock — clean receipt rendering', () => {
  it('renders set_factor_value as "Updated factor" + entity + numeric diff', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Updated factor')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('team morale')
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('0.5 → 0.7')
    expect(screen.getByTestId('v5-change-status').textContent).toBe('Applied')
    expectNoLeakInDOM()
  })

  it('renders add_constraint as "Added constraint" + label + value with currency', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'add_constraint',
      target_id: 'con_budget',
      before: null,
      after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Added constraint')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('budget')
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('at most £50,000')
    expectNoLeakInDOM()
  })

  it('renders adjust_edge_strength as "Adjusted connection" + endpoints + numeric diff', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_morale_to_outcome',
      before: { strength: 0.3 },
      after: { strength: 0.6 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Adjusted connection')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('team morale → overall outcome')
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('0.3 → 0.6')
    expectNoLeakInDOM()
  })

  it('renders noop as "No change" with the no-change action label', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'noop',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.7 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-status').textContent).toBe('No change')
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Factor already at this value')
    expect(screen.queryByTestId('v5-change-summary')).toBeNull()
    expectNoLeakInDOM()
  })

  it('falls back to generic element type when canvas-store label is missing (no leak)', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_unmapped_factor',
      before: { value: 0.5 },
      after: { value: 0.8 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('factor')
    expectNoLeakInDOM()
  })

  it('does not render entity row when no friendly label resolves at all', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_unknown',
      before: { strength: 0.3 },
      after: { strength: 0.6 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.queryByTestId('v5-change-entity')).toBeNull()
    expectNoLeakInDOM()
  })

  it('shows freshness hint when applied and prior analysis is now stale', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-freshness-hint').textContent).toBe(
      'Latest analysis is now out of date.',
    )
    expectNoLeakInDOM()
  })

  it('does NOT show freshness hint when freshness is fresh / none / unknown', () => {
    for (const freshness of ['fresh', 'none', 'unknown'] as const) {
      mockFreshnessState.mockReturnValue({
        freshness,
        reason: null,
        recommendedAction: freshness === 'fresh' ? 'view_results' : 'continue_editing',
        inputsMissing: [],
      })
      const block: V5GraphPatchBlockType = {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac_team_morale',
        before: { value: 0.5 },
        after: { value: 0.7 },
      }
      const { unmount } = render(<V5GraphPatchBlock block={block} />)
      expect(screen.queryByTestId('v5-change-freshness-hint')).toBeNull()
      unmount()
    }
  })

  it('does NOT show freshness hint on noop status (no impact change to surface)', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'noop',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.7 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.queryByTestId('v5-change-freshness-hint')).toBeNull()
  })
})

// Single bug-bar test that fails on any of the three regressions caught
// in code review (P1.1 data-operation attribute leak, P1.2 raw_value/unit
// rendering, P1.3 currency-symbol formatting). Uses the exact CEE block
// shape so the test is the regression contract — no synthetic shape that
// happens to pass while the real shape regresses.
describe('V5GraphPatchBlock — code-review regression bar (P1.1 / P1.2 / P1.3)', () => {
  it('renders the actual CEE add_constraint shape (£ symbol + "<=" operator) with no attribute leak', () => {
    // Exact shape CEE add-constraint emits: unit is the user-supplied
    // symbol '£' (not 'GBP'), operator is '<=' from TYPE_TO_OPERATOR,
    // before is null on a brand-new constraint, after carries the
    // GoalConstraintT shape.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'add_constraint',
      target_id: 'gc-budget-uuid',
      before: null,
      after: {
        constraint_id: 'gc-budget-uuid',
        node_id: 'f-budget',
        operator: '<=',
        value: 50000,
        label: 'Marketing budget',
        unit: '£',
        provenance: 'explicit',
      },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Added constraint')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('Marketing budget')
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('at most £50,000')
    // outerHTML check catches: data-operation="add_constraint" attribute
    // leak (P1.1), trailing-symbol "50,000 £" (P1.3), and raw constraint
    // ids (RAW_ID_PATTERN).
    expectNoLeakInDOM()
  })

  it('renders the actual CEE set_factor_value shape (raw_value + unit) without normalised-decimal leak', () => {
    // Exact shape CEE set_factor_value emits (set-factor-value.ts:263):
    // ObservedSnapshot with both normalised value (0.05) and user-facing
    // raw_value (5) + unit ('%'). The receipt MUST render the
    // user-facing pair.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5, raw_value: 50, unit: '%', cap: 100 },
      after: { value: 0.7, raw_value: 70, unit: '%', cap: 100 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Updated factor')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe('team morale')
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('50% → 70%')
    // Critical: never the normalised decimals in the visible text.
    // (outerHTML would also catch styling tokens like `px-2.5` /
    // `py-0.5` from the design system, which are not leaks; assert
    // against the change row's textContent specifically.)
    const change = screen.getByTestId('v5-change-summary').textContent ?? ''
    expect(change).not.toContain('0.5')
    expect(change).not.toContain('0.7')
    expectNoLeakInDOM()
  })

  // NR2 — realistic adjust_edge_strength shape. CEE emits
  // `target_id` as `from→to` (handler ts:262) and `before/after` as
  // { from, to, strength: { mean, std }, effect_direction }
  // (handler ts:205–220). The earlier scalar-only path silently
  // produced a blank change summary on real CEE payloads.
  it('renders the actual CEE adjust_edge_strength shape (object strength + arrow target_id) without mean/std leak', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'f-budget→g-revenue',
      before: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: 0.3, std: 0.1 },
        effect_direction: 'positive',
      },
      after: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: 0.6, std: 0.1 },
        effect_direction: 'positive',
      },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Adjusted connection')
    expect(screen.getByTestId('v5-change-entity').textContent).toBe(
      'Marketing budget → Revenue',
    )
    // Renders the `mean` magnitudes — std (the confidence band) is a
    // schema field that does not belong in the receipt.
    expect(screen.getByTestId('v5-change-summary').textContent).toBe('0.3 → 0.6')
    // Comprehensive leak check covers mean/std + raw ids in outerHTML.
    expectNoLeakInDOM()
  })

  it('renders direction-flip hint when adjust_edge_strength changes effect_direction', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'f-budget→g-revenue',
      before: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: 0.4, std: 0.1 },
        effect_direction: 'positive',
      },
      after: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: -0.4, std: 0.1 },
        effect_direction: 'negative',
      },
    }
    render(<V5GraphPatchBlock block={block} />)
    const change = screen.getByTestId('v5-change-summary').textContent ?? ''
    expect(change).toContain('0.4')
    expect(change).toContain('-0.4')
    expect(change).toContain('direction now negative')
    expectNoLeakInDOM()
  })

  it('does NOT render a silent blank change summary for the object-strength shape', () => {
    // Regression: prior scalar-only resolver returned '' for an object
    // strength, producing an entityLabel-only receipt with no change
    // summary. Assert the change row is present and non-empty.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'f-budget→g-revenue',
      before: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: 0.2, std: 0.05 },
        effect_direction: 'positive',
      },
      after: {
        from: 'f-budget',
        to: 'g-revenue',
        strength: { mean: 0.5, std: 0.05 },
        effect_direction: 'positive',
      },
    }
    render(<V5GraphPatchBlock block={block} />)
    const change = screen.queryByTestId('v5-change-summary')
    expect(change).not.toBeNull()
    expect((change!.textContent ?? '').trim().length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// G2 — V5 receipt no-leak across all four freshness verdicts.
// ---------------------------------------------------------------------------
//
// The component renders a stale-only inline hint
// (`Latest analysis is now out of date.`) when status='applied' AND
// freshness='stale'. The other three verdicts must render without any
// freshness wording — these tests prove the per-state outerHTML stays
// clean and that `none` does not imply analysis exists, while `unknown`
// avoids false certainty.
// ---------------------------------------------------------------------------

describe('V5GraphPatchBlock — G2 freshness no-leak across all four verdicts', () => {
  const FRESHNESS_VERDICTS = ['fresh', 'stale', 'none', 'unknown'] as const

  it.each(FRESHNESS_VERDICTS)(
    'outerHTML stays clean when freshness verdict is "%s"',
    (verdict) => {
      mockFreshnessState.mockReturnValue({
        freshness: verdict,
        reason: null,
        recommendedAction:
          verdict === 'stale'
            ? 'rerun_analysis'
            : verdict === 'fresh'
              ? 'view_results'
              : 'continue_editing',
        inputsMissing: [],
      })
      const block: V5GraphPatchBlockType = {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac_team_morale',
        before: { value: 0.5, raw_value: 50, unit: '%' },
        after: { value: 0.7, raw_value: 70, unit: '%' },
      }
      render(<V5GraphPatchBlock block={block} />)
      expectNoLeakInDOM()
    },
  )

  it('on freshness=none, the receipt does not imply an analysis exists', () => {
    // 'none' means no analysis has run yet — the receipt must not say
    // "out of date" / "rerun" / "analysis", which would imply prior
    // results the user could view.
    mockFreshnessState.mockReturnValue({
      freshness: 'none',
      reason: 'no_options_yet',
      recommendedAction: 'continue_editing',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    const card = screen.getByTestId('v5-change-receipt')
    const text = (card.textContent ?? '').toLowerCase()
    expect(text).not.toContain('out of date')
    expect(text).not.toContain('analysis')
    expect(text).not.toMatch(/\brerun\b|\bre-run\b/)
    // Hint testid should not render at all.
    expect(screen.queryByTestId('v5-change-freshness-hint')).toBeNull()
    expectNoLeakInDOM()
  })

  it('on freshness=unknown, the receipt avoids false certainty', () => {
    // 'unknown' means the verdict cannot be derived — the receipt must
    // not assert either "up to date" OR "out of date".
    mockFreshnessState.mockReturnValue({
      freshness: 'unknown',
      reason: null,
      recommendedAction: 'continue_editing',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    const card = screen.getByTestId('v5-change-receipt')
    const text = (card.textContent ?? '').toLowerCase()
    expect(text).not.toContain('out of date')
    expect(text).not.toContain('up to date')
    expect(screen.queryByTestId('v5-change-freshness-hint')).toBeNull()
    expectNoLeakInDOM()
  })
})

// ---------------------------------------------------------------------------
// G3 — adjust_edge_strength missing/malformed before/after stays graceful.
// ---------------------------------------------------------------------------

describe('V5GraphPatchBlock — G3 adjust_edge_strength graceful fallback', () => {
  it('renders generic action label when before AND after are both null', () => {
    // Worst-case: no payload to extract from. The receipt must still
    // render the action label cleanly with no change summary and no
    // raw shape leakage.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_morale_to_outcome',
      before: null,
      after: null,
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Adjusted connection')
    // Endpoints resolve via the canvas store fallback (edge id is in EDGES).
    expect(screen.getByTestId('v5-change-entity').textContent).toBe(
      'team morale → overall outcome',
    )
    // No raw shape — change summary is suppressed when scalars cannot be derived.
    expect(screen.queryByTestId('v5-change-summary')).toBeNull()
    expectNoLeakInDOM()
  })

  it('renders generic receipt when target_id does not resolve to a known edge AND before/after are both null', () => {
    // Worst-case fallback: payload empty AND id is unmapped. The
    // receipt must remain generic; nothing about the edge shape, no
    // change summary, no entity row, no raw id in DOM. The `edge_`
    // prefix is intentionally not in the production RAW_ID_PATTERN
    // (V5 receipts resolve edges via from/to labels) — so we assert
    // explicitly that the unmapped target_id never reaches DOM, on top
    // of the helper's RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN check.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_unknown_unmapped',
      before: null,
      after: null,
    }
    render(<V5GraphPatchBlock block={block} />)
    const card = screen.getByTestId('v5-change-receipt')
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Adjusted connection')
    expect(screen.queryByTestId('v5-change-entity')).toBeNull()
    expect(screen.queryByTestId('v5-change-summary')).toBeNull()
    expect(card.outerHTML).not.toContain('edge_unknown_unmapped')
    expectNoLeakInDOM()
  })

  it('renders gracefully when after is a scalar/string (malformed shape)', () => {
    // Defensive: a malformed `after` value (string instead of object)
    // must not throw and must not fall through to raw rendering. The
    // strengthScalar() null path keeps the change summary suppressed.
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_morale_to_outcome',
      before: null,
      // Cast through unknown — V5 wire schema disallows this in
      // production, but the UI must be defensive against any
      // schema-package drift that loosens the type at runtime.
      after: 'oops' as unknown as null,
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-change-action').textContent).toBe('Adjusted connection')
    expect(screen.queryByTestId('v5-change-summary')).toBeNull()
    expectNoLeakInDOM()
  })
})
