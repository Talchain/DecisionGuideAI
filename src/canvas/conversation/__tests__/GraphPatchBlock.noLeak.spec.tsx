/**
 * GraphPatchBlock no-leak tests — Workstream 1 G4.
 *
 * The V4 graph_patch path renders through `describeOperation` (with a
 * 4-tier label fallback chain) and `safeRichText` for any CEE-provided
 * summary. This suite proves that V4 `update_node` / `update_edge`
 * receipts never fall through to raw JSON, raw schema keys, or
 * unfamiliar internal terms — including when the operation payload is
 * malformed or unfamiliar.
 *
 * Mocks the canvas store with a small controlled node set so the label
 * fallback paths are deterministic. Mirrors the mock pattern in
 * `GraphPatchBlock.spec.tsx`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { GraphPatchBlock } from '../types'
import { expectNoReceiptUserFacingTextLeaks } from '../../../test/helpers/expectNoReceiptLeaks'

const storeMocks = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  selectNodes: vi.fn(),
  setShowInspectorPanel: vi.fn(),
  setHighlightedNodes: vi.fn(),
  setHighlightedEdges: vi.fn(),
  canvasNodes: [] as Array<{ id: string; data?: { label?: string } }>,
  canvasEdges: [] as Array<{ id: string; source: string; target: string }>,
}))

vi.mock('../../store', () => {
  const mockState = {
    get nodes() { return storeMocks.canvasNodes },
    get edges() { return storeMocks.canvasEdges },
    selectNodeWithoutHistory: storeMocks.selectNodeWithoutHistory,
    selectNodes: storeMocks.selectNodes,
    setShowInspectorPanel: storeMocks.setShowInspectorPanel,
    setHighlightedNodes: storeMocks.setHighlightedNodes,
    setHighlightedEdges: storeMocks.setHighlightedEdges,
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

import { InlineBlocks } from '../InlineBlocks'

function patchBlock(overrides: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-noleak-1',
    // Empty summary by default — receipt then falls back to the
    // contextual "Review the suggested change." line, which is clean.
    // Tests that intend to assert OPERATION-derived rendering must keep
    // summary empty so the assertion is not satisfied by the summary text.
    summary: '',
    operations: [],
    target_graph_hash: 'hash-x',
    ...overrides,
  }
}

function expectNoLeakInPatchCard(): void {
  // The V4 card carries a deterministic testid based on patch_id. Use a
  // prefix-resilient selector so future patch_id formats don't break this.
  // We assert against the USER-FACING text surface only (textContent +
  // aria-labels) — V4 retains the `block-graph-patch-{patch_id}` testid
  // and `graphPatchBlock` CSS module classes by design, and those
  // implementation-detail attributes are not part of the user-facing
  // contract. A regression that puts schema terms into rendered text
  // (or aria-labels read by assistive tech) WILL still trip this.
  const card = document.querySelector('[data-testid^="block-graph-patch-"]') as HTMLElement | null
  expect(card, 'V4 graph_patch card not found in DOM').not.toBeNull()
  expectNoReceiptUserFacingTextLeaks(card!)
}

beforeEach(() => {
  vi.clearAllMocks()
  storeMocks.canvasNodes = [
    { id: 'fac_morale', data: { label: 'team morale' } },
    { id: 'goal_outcome', data: { label: 'overall outcome' } },
  ]
  storeMocks.canvasEdges = [
    { id: 'edge_morale_to_outcome', source: 'fac_morale', target: 'goal_outcome' },
  ]
})

describe('V4 GraphPatchBlock — G4 update_node no-leak', () => {
  it('renders friendly receipt for happy-path update_node (resolved label + known field)', () => {
    const block = patchBlock({
      operations: [
        { op: 'update_node', target_id: 'fac_morale', data: { label: 'team morale revised' } },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    // Friendly description should mention the resolved node label.
    // describeOperation emits markdown bold around the label; safeRichText
    // renders it as <strong>. Assert via textContent so the markdown
    // syntax is irrelevant.
    const list = screen.getByTestId('patch-proposal-list')
    expect(list.textContent).toContain('team morale')
    expect(list.textContent?.toLowerCase()).toContain('label')
    expectNoLeakInPatchCard()
  })

  it('renders friendly receipt when update_node carries empty data (no priority field)', () => {
    const block = patchBlock({
      operations: [
        { op: 'update_node', target_id: 'fac_morale', data: {} },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    // Falls to "Update **{label}**" with no trailing field.
    expect(list.textContent).toContain('team morale')
    expectNoLeakInPatchCard()
  })

  it('renders generic receipt when update_node target_id is unmapped AND data is empty', () => {
    // No node label resolves; describeOperation falls back to genericForOp
    // which derives element type from the id prefix word ("factor" /
    // "option" / "goal" / "decision" / "outcome" / "constraint"). The raw
    // id MUST NOT appear in the rendered DOM.
    const block = patchBlock({
      operations: [
        { op: 'update_node', target_id: 'unmapped_id_with_no_known_prefix', data: {} },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    expect(list.textContent?.toLowerCase()).toContain('update factor')
    // The raw id substring must not leak.
    expect(list.outerHTML).not.toContain('unmapped_id_with_no_known_prefix')
    expectNoLeakInPatchCard()
  })

  it('renders generic receipt and does not leak unfamiliar field keys when update_node data is malformed', () => {
    // Defensive: a future schema drift puts a foreign object in
    // op.data. The receipt must not serialise the foreign object's
    // keys/values into the DOM.
    //
    // The `as unknown as Record<…>` cast below is a deliberate
    // wire-shape simulation, NOT an endorsed schema example. The V4
    // PatchOperation type's `data` field is typed narrowly; this cast
    // forces a malformed shape past the compile-time check so the
    // runtime receipt path can be exercised against schema drift.
    const block = patchBlock({
      operations: [
        {
          op: 'update_node',
          target_id: 'fac_morale',
          data: {
            // Foreign keys that should never appear in user-facing copy.
            weirdInternalKey: { nested: 'should-not-leak' },
            anotherSecret: 'pending_xyz',
          } as unknown as Record<string, unknown>,
        },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    // Friendly label still renders.
    expect(list.textContent).toContain('team morale')
    // Receipt collapses to the bare label — no field suffix rendered
    // because the unfamiliar keys fail the `isAllowlistedFieldKey` gate
    // in friendlyOperation.ts.
    expect(list.textContent?.toLowerCase()).not.toContain(':')
    // Raw camelCase keys must not leak.
    expect(list.outerHTML).not.toContain('weirdInternalKey')
    expect(list.outerHTML).not.toContain('anotherSecret')
    // Humanised forms of the unknown keys must ALSO not leak — without
    // the allowlist gate, friendlyFieldName would render
    // "Another secret" / "Weird internal key" — a friendly-looking leak
    // of an internal field name. Same regression class as raw IDs.
    const lowered = list.outerHTML.toLowerCase()
    expect(lowered).not.toContain('another secret')
    expect(lowered).not.toContain('weird internal key')
    // Foreign value content must not leak either.
    expect(list.outerHTML).not.toContain('should-not-leak')
    expect(list.outerHTML).not.toContain('pending_xyz')
    expect(lowered).not.toContain('pending xyz')
    expectNoLeakInPatchCard()
  })
})

describe('V4 GraphPatchBlock — G4 update_edge no-leak', () => {
  it('renders friendly receipt for happy-path update_edge (resolved endpoints)', () => {
    const block = patchBlock({
      operations: [
        {
          op: 'update_edge',
          target_id: 'edge_morale_to_outcome',
          data: { weight: 0.5 },
        },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    expect(list.textContent).toContain('team morale')
    expect(list.textContent).toContain('overall outcome')
    expectNoLeakInPatchCard()
  })

  it('renders generic "Update connection" when update_edge endpoints cannot be resolved AND data is empty', () => {
    const block = patchBlock({
      operations: [
        { op: 'update_edge', target_id: 'edge_unknown_unmapped', data: {} },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    expect(list.textContent?.toLowerCase()).toContain('update connection')
    // Raw id must not leak.
    expect(list.outerHTML).not.toContain('edge_unknown_unmapped')
    expectNoLeakInPatchCard()
  })

  it('does not leak unfamiliar field keys when update_edge data is malformed', () => {
    // The `as unknown as Record<…>` cast forces a malformed wire-shape
    // simulation past the compile-time PatchOperation `data` typing —
    // it is NOT an endorsed schema example. Same defensive intent as
    // the corresponding update_node malformed test above.
    const block = patchBlock({
      operations: [
        {
          op: 'update_edge',
          target_id: 'edge_morale_to_outcome',
          data: {
            weirdEdgeMeta: { internal: true, ref: 'pending_internal_ref' },
          } as unknown as Record<string, unknown>,
        },
      ],
    })
    render(<InlineBlocks blocks={[block]} />)
    const list = screen.getByTestId('patch-proposal-list')
    // Endpoints render safely.
    expect(list.textContent).toContain('team morale')
    expect(list.textContent).toContain('overall outcome')
    // Receipt collapses to the bare connection label — no field suffix.
    expect(list.textContent?.toLowerCase()).not.toContain(':')
    // Raw camelCase keys must not leak.
    expect(list.outerHTML).not.toContain('weirdEdgeMeta')
    expect(list.outerHTML).not.toContain('pending_internal_ref')
    // Humanised forms must ALSO not leak — same regression class as
    // raw keys, just dressed up in sentence case.
    const lowered = list.outerHTML.toLowerCase()
    expect(lowered).not.toContain('weird edge meta')
    expect(lowered).not.toContain('pending internal ref')
    expectNoLeakInPatchCard()
  })
})
