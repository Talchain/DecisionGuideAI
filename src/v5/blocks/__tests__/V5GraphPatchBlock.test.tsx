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
import { RAW_ID_PATTERN } from '../../../canvas/conversation/friendlyOperation'

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

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: { nodes: unknown; edges: unknown }) => unknown) =>
    selector({ nodes: NODES, edges: EDGES }),
}))

// Mock the freshness hook so each test can control the verdict
// independently. Default is the neutral 'unknown' verdict (no hint).
import type { AnalysisFreshnessState } from '../../../lib/analysisFreshnessState'

const mockFreshnessState = vi.fn<[], AnalysisFreshnessState>(() => ({
  freshness: 'unknown',
  reason: null,
  recommendedAction: 'continue_editing',
  inputsMissing: [],
}))

vi.mock('../../../lib/useAnalysisFreshnessState', () => ({
  useAnalysisFreshnessState: () => mockFreshnessState(),
}))

// Import AFTER the mock so the component uses the mocked store.
import { V5GraphPatchBlock } from '../V5GraphPatchBlock'

// Forbidden internal terms in default UI surfaces. Extended after
// code-review NR1 to cover schema field names that real CEE blocks
// carry (constraint_id, node_id, provenance, raw_value) plus the
// edge-strength object's internals (mean, std). Mathematical
// operator glyphs (≤ / ≥ / <=) are also forbidden — receipts use
// decision-language phrases ("at most" / "at least") per the
// CEE format-confirmation table.
const FORBIDDEN_TERMS = [
  'target_id',
  'operator',
  'noop',
  'fact_type',
  'graph_hash',
  'set_factor_value',
  'add_constraint',
  'adjust_edge_strength',
  'before',
  'after',
  // NR1 additions — schema field names emitted on CEE block payloads
  // that real receipts must never surface.
  'constraint_id',
  'node_id',
  'provenance',
  'raw_value',
  'mean',
  'std',
  // Second-round B2 additions — schema/handler-mechanics terms.
  // The previous data-testid="v5-graph-patch" leaked "graph-patch"
  // into outerHTML. Renamed to v5-change-receipt + the gate now
  // catches any future regression that re-introduces the schema
  // term in the rendered DOM.
  'graph-patch',
  'graph_patch',
  'graphpatch',
]

// Operator-glyph guard. Decision-language only — no `<=` / `>=` /
// `≤` / `≥` / `lte` / `gte` strings should reach the default DOM.
// A separate const because `'<='` / `'>='` literals are short and a
// single regex over outerHTML is the cheapest assertion.
const FORBIDDEN_OPERATOR_GLYPHS = /(?:<=|>=|≤|≥|\blte\b|\bgte\b)/i

function expectNoLeakInDOM(): void {
  const card = screen.getByTestId('v5-change-receipt')
  // Assert against outerHTML — covers attribute-level leaks (e.g. a
  // future `data-operation="add_constraint"` regression) as well as
  // text content. Pure textContent only catches innerText leaks and
  // missed the data-operation regression caught in code review.
  const rendered = card.outerHTML
  expect(rendered).not.toMatch(RAW_ID_PATTERN)
  expect(rendered).not.toMatch(FORBIDDEN_OPERATOR_GLYPHS)
  for (const term of FORBIDDEN_TERMS) {
    expect(rendered.toLowerCase()).not.toContain(term)
  }
}

beforeEach(() => {
  cleanup()
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
