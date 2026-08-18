/**
 * NO WIRE TOKEN ON SCREEN — the "log language reaching the user" class.
 *
 * Five surfaces in the Olumi conversation rendered a PRODUCER TOKEN straight
 * into the DOM. Each is small on its own; together they are the reason the
 * conversation reads like a log file at exactly the moments it is telling the
 * user something went wrong:
 *
 *   1. a rejected patch printed `VALIDATION_FAILED: Patch validation failed`
 *   2. the unsupported-operation message embedded the raw op enum (`add_node`)
 *   3. a proposal change printed its raw `operation` token in a pill
 *   4. a proposal change printed the raw target ENTITY ID (`fac_x7`) as the
 *      pill's visible label AND inside its aria-label
 *   5. an unsurfaced V5 block printed its wire `blockType` in a pill
 *
 * plus one runtime hole: `GuidanceStrip`'s `actionLabel` switch had no
 * `default`, so an unmodelled wire `primary_action.type` produced the
 * aria-label "undefined: <title>" and an empty button face.
 *
 * ── HOW THESE ASSERTIONS BIND ──────────────────────────────────────────────
 * By IDENTITY, never by a value predicate another element could satisfy
 * (platform trap 19): every case pins its own testid and asserts on THAT
 * element's text, and every "must not appear" is paired with a POSITIVE
 * CONTROL asserting the honest replacement IS present — an absence assertion
 * with nothing proving the surface rendered at all is vacuous (trap 13).
 *
 * ⚠ The diagnostic channels are asserted to SURVIVE. Removing a token from
 * the user's eyes must not remove it from an operator's reach, or the next
 * lane re-adds the leak to get its diagnosis back. `data-rejection-code` and
 * `data-block-type` are that channel and are pinned here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { GraphPatchBlock as GraphPatchBlockType, ProposalBlock } from '../types'
import { humaniseWireToken } from '../friendlyOperation'

const storeMocks = vi.hoisted(() => ({
  canvasNodes: [] as Array<{ id: string; data?: { label?: string } }>,
  canvasEdges: [] as Array<{ id: string; source: string; target: string }>,
  noop: vi.fn(),
}))

vi.mock('../../store', () => {
  const mockState = {
    get nodes() { return storeMocks.canvasNodes },
    get edges() { return storeMocks.canvasEdges },
    selectNodeWithoutHistory: storeMocks.noop,
    selectNodes: storeMocks.noop,
    setShowInspectorPanel: storeMocks.noop,
    setHighlightedNodes: storeMocks.noop,
    setHighlightedEdges: storeMocks.noop,
    currentScenarioLastResultHash: undefined,
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

import { GraphPatchBlockRenderer, ProposalBlockRenderer } from '../blocks/GraphPatchBlockRenderer'
import { V5UnsupportedBlock } from '../../../v5/blocks/V5UnsupportedBlock'

beforeEach(() => {
  storeMocks.canvasNodes = []
  storeMocks.canvasEdges = []
})

// ---------------------------------------------------------------------------
// The shared authority
// ---------------------------------------------------------------------------

describe('humaniseWireToken — the one authority', () => {
  it('folds a SCREAMING_SNAKE code to sentence case', () => {
    expect(humaniseWireToken('VALIDATION_FAILED')).toBe('Validation failed')
    expect(humaniseWireToken('UNSUPPORTED_OPERATION')).toBe('Unsupported operation')
  })

  it('folds a snake_case enum to sentence case', () => {
    expect(humaniseWireToken('add_node')).toBe('Add node')
    expect(humaniseWireToken('v5_flip_analysis')).toBe('V5 flip analysis')
  })

  it('⭐ returns null for an ENTITY ID rather than a prettier leak', () => {
    // The load-bearing case. `Fac x7` reads as a name the user is meant to
    // recognise, which is worse than the raw id, so the caller must omit.
    expect(humaniseWireToken('fac_x7')).toBeNull()
    expect(humaniseWireToken('option_hire_tech_lead')).toBeNull()
    expect(humaniseWireToken('opt_a')).toBeNull()
  })

  it('returns null for anything with no content to show', () => {
    expect(humaniseWireToken('')).toBeNull()
    expect(humaniseWireToken('   ')).toBeNull()
    expect(humaniseWireToken('___')).toBeNull()
    expect(humaniseWireToken(undefined)).toBeNull()
    expect(humaniseWireToken(42)).toBeNull()
  })

  it('leaves mixed-case producer prose alone (never a downgrade)', () => {
    expect(humaniseWireToken('Patch validation failed')).toBe('Patch validation failed')
  })
})

// ---------------------------------------------------------------------------
// 1 + the diagnostic channel
// ---------------------------------------------------------------------------

function rejectedPatch(): GraphPatchBlockType {
  return {
    type: 'graph_patch',
    patch_id: 'patch-leak-1',
    summary: 'Add a factor for supplier risk.',
    operations: [],
  } as unknown as GraphPatchBlockType
}

describe('a rejected patch does not print its rejection CODE at the user', () => {
  it('shows the message and withholds the code', () => {
    render(
      <GraphPatchBlockRenderer
        block={rejectedPatch()}
        turnId="turn-1"
        patchBlockStates={new Map([['turn-1:patch-leak-1', 'rejected']])}
        patchRejections={new Map([[
          'turn-1:patch-leak-1',
          { code: 'VALIDATION_FAILED', message: 'Patch validation failed' },
        ]])}
      />,
    )
    const status = screen.getByTestId('patch-status-rejected')
    // POSITIVE CONTROL — the surface rendered and still says what happened.
    expect(status.textContent).toContain('Patch validation failed')
    // The defect: `VALIDATION_FAILED: Patch validation failed`
    expect(status.textContent).not.toContain('VALIDATION_FAILED')
  })

  it('keeps the code reachable for operators on a data attribute', () => {
    render(
      <GraphPatchBlockRenderer
        block={rejectedPatch()}
        turnId="turn-1"
        patchBlockStates={new Map([['turn-1:patch-leak-1', 'rejected']])}
        patchRejections={new Map([[
          'turn-1:patch-leak-1',
          { code: 'VALIDATION_FAILED', message: 'Patch validation failed' },
        ]])}
      />,
    )
    expect(screen.getByTestId('patch-rejection-detail')).toHaveAttribute(
      'data-rejection-code',
      'VALIDATION_FAILED',
    )
  })

  it('falls back to the HUMANISED code when the producer sent no message', () => {
    render(
      <GraphPatchBlockRenderer
        block={rejectedPatch()}
        turnId="turn-1"
        patchBlockStates={new Map([['turn-1:patch-leak-1', 'rejected']])}
        patchRejections={new Map([[
          'turn-1:patch-leak-1',
          { code: 'UNSUPPORTED_OPERATION', message: '' },
        ]])}
      />,
    )
    const status = screen.getByTestId('patch-status-rejected')
    expect(status.textContent).toContain('Unsupported operation')
    expect(status.textContent).not.toContain('UNSUPPORTED_OPERATION')
  })
})

// ---------------------------------------------------------------------------
// 3 + 4
// ---------------------------------------------------------------------------

function proposal(changes: ProposalBlock['changes']): ProposalBlock {
  return {
    type: 'proposal',
    action_type: 'edit_graph',
    description: 'Two changes to the model.',
    proposal_id: 'prop-leak-1',
    changes,
  }
}

describe('a proposal change does not print raw wire tokens', () => {
  it('humanises the operation token in its pill', () => {
    render(<ProposalBlockRenderer block={proposal([
      { operation: 'add_edge', target: 'Supplier risk', detail: 'Link supplier risk to margin.' },
    ])} />)
    const card = screen.getByTestId('block-proposal')
    // POSITIVE CONTROL — the change itself still renders.
    expect(card.textContent).toContain('Link supplier risk to margin.')
    expect(card.textContent).toContain('Add edge')
    expect(card.textContent).not.toContain('add_edge')
  })

  it('⭐ withholds an unresolvable ENTITY ID instead of rendering it as a label', () => {
    // No node matches, so `resolveTarget` returns null and the old code
    // rendered the bare id.
    render(<ProposalBlockRenderer block={proposal([
      { operation: 'update_node', target: 'fac_x7', detail: 'Raise the supplier-risk weight.' },
    ])} />)
    const card = screen.getByTestId('block-proposal')
    expect(card.textContent).toContain('Raise the supplier-risk weight.')
    expect(card.textContent).not.toContain('fac_x7')
    expect(card.innerHTML).not.toContain('fac_x7')
  })

  it('still shows a RESOLVED target by its human label, and never by its id', () => {
    storeMocks.canvasNodes = [{ id: 'fac_x7', data: { label: 'Supplier risk' } }]
    render(<ProposalBlockRenderer block={proposal([
      { operation: 'update_node', target: 'Supplier risk', detail: 'Raise the weight.' },
    ])} />)
    const card = screen.getByTestId('block-proposal')
    // POSITIVE CONTROL for the resolved branch — the pill is present…
    expect(card.textContent).toContain('Supplier risk')
    // …and it carries the label, not the id.
    expect(card.innerHTML).not.toContain('>fac_x7<')
  })
})

// ---------------------------------------------------------------------------
// 5
// ---------------------------------------------------------------------------

describe('an unsurfaced V5 block does not print its wire kind', () => {
  it('keeps the honest sentence and drops the token pill', () => {
    render(
      <V5UnsupportedBlock
        block={{ type: 'v5_unsupported', blockType: 'v5_flip_analysis', raw: {} } as never}
      />,
    )
    const card = screen.getByTestId('v5-unsupported-block')
    // POSITIVE CONTROL — the user still gets the explanation.
    expect(card.textContent).toContain("can't display this part of the response yet")
    expect(card.textContent).not.toContain('v5_flip_analysis')
    // Operators keep the kind.
    expect(card).toHaveAttribute('data-block-type', 'v5_flip_analysis')
  })
})
