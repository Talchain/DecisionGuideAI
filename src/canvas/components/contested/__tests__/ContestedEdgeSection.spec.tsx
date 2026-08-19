/**
 * ContestedEdgeSection — the rehomed adjudication vertical.
 *
 * ⚠ FOUR OF THESE TESTS ARE NOT NEW. They were `RelationshipsSection.spec.tsx`'s
 * "contested integration" block and MOVED here with the behaviour they cover —
 * the no-cap rule, the priority ordering, the shared-target case and the
 * resolve-handler wiring. A rehome that dropped them would have deleted four
 * real behaviours while every remaining suite stayed green, which is exactly the
 * failure mode a rehome is supposed to avoid.
 *
 * The new material is the part the move itself put at risk: the detail-toggle
 * context (this section renders OUTSIDE `ModelTabHeader`'s provider now) and the
 * no-handler case.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'
import { ContestedEdgeSection, isPendingContested } from '../ContestedEdgeSection'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const { mockStoreState } = vi.hoisted(() => ({
  mockStoreState: {
    updateEdge: vi.fn(),
    setHighlightedEdges: vi.fn(),
    setHighlightedNodes: vi.fn(),
    highlightedEdges: new Set<string>(),
    selectEdgeWithoutHistory: vi.fn(),
    edges: [] as unknown[],
  },
}))

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusEdgeById: vi.fn(),
  focusNodeById: vi.fn(),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

vi.mock('../../../ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: () => <input type="range" data-testid="mock-strength-slider" />,
}))

function makeNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

const nodes = [makeNode('f1', 'Factor A'), makeNode('f2', 'Factor B')]

function makeContested(
  id: string,
  source: string,
  target: string,
  vmOverrides: Partial<ValidationMetadata> = {},
): Edge {
  const vm: ValidationMetadata = {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35,
      strength_std: 0.12,
      exists_probability: 0.7,
      reasoning: 'Test reasoning',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...vmOverrides,
  }
  return {
    id,
    source,
    target,
    data: {
      weight: 0.6,
      direction: 'positive',
      beliefExists: 0.7,
      provenance: 'assumption',
      validation: vm,
    },
  }
}

/** A plain, uncontested edge — the contrast every absence assertion needs. */
function makePlain(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    data: { weight: 0.5, direction: 'positive', beliefExists: 0.7, provenance: 'assumption' },
  }
}

// ── The predicate ────────────────────────────────────────────────────────────

describe('isPendingContested — ONE predicate, so the count and the list agree', () => {
  it('is true only for contested AND pending', () => {
    expect(isPendingContested(makeContested('a', 'f1', 'f2'))).toBe(true)
  })

  it('is false once a user has settled it', () => {
    expect(
      isPendingContested(makeContested('a', 'f1', 'f2', { user_action: 'accepted_pass1' })),
    ).toBe(false)
  })

  it('is false when the two passes agreed', () => {
    expect(isPendingContested(makeContested('a', 'f1', 'f2', { status: 'agreed' }))).toBe(false)
  })

  it('is false when there is no validation block at all', () => {
    expect(isPendingContested(makePlain('a', 'f1', 'f2'))).toBe(false)
  })
})

// ── MOVED from RelationshipsSection.spec.tsx ─────────────────────────────────

describe('ContestedEdgeSection — behaviours moved with the vertical', () => {
  it('renders a card for a pending contested edge and IGNORES plain edges', () => {
    render(
      <ContestedEdgeSection
        edges={[makePlain('en', 'f2', 'f1'), makeContested('ec', 'f1', 'f2')]}
        nodes={nodes}
        onResolveContested={vi.fn()}
      />,
    )
    expect(screen.getByTestId('contested-card-ec')).toBeInTheDocument()
    // The section renders ONLY the contested ones — it is not a second edge list.
    expect(screen.queryByTestId('contested-card-en')).not.toBeInTheDocument()
  })

  it('renders EVERY pending contested edge even when they share a target node', () => {
    // The model tab does NOT apply the one-per-target-node cap — that policy
    // belongs to the pre-analysis panel. The full audit keeps every pending
    // edge directly actionable.
    render(
      <ContestedEdgeSection
        edges={[
          makeContested('ec1', 'f1', 'f2', { max_divergence: 0.8 }),
          makeContested('ec2', 'f1', 'f2', { max_divergence: 0.4 }),
        ]}
        nodes={nodes}
        onResolveContested={vi.fn()}
      />,
    )
    expect(screen.getByTestId('contested-card-ec1')).toBeInTheDocument()
    expect(screen.getByTestId('contested-card-ec2')).toBeInTheDocument()
  })

  it('orders shared-target contested edges by max_divergence desc', () => {
    render(
      <ContestedEdgeSection
        edges={[
          makeContested('ec1', 'f1', 'f2', { max_divergence: 0.3 }),
          makeContested('ec2', 'f1', 'f2', { max_divergence: 0.9 }),
          makeContested('ec3', 'f1', 'f2', { max_divergence: 0.6 }),
        ]}
        nodes={nodes}
        onResolveContested={vi.fn()}
      />,
    )
    const cards = screen.getAllByTestId(/^contested-card-/)
    expect(cards.map(c => c.getAttribute('data-testid'))).toEqual([
      'contested-card-ec2',
      'contested-card-ec3',
      'contested-card-ec1',
    ])
  })

  it('calls onResolveContested with the right args, bound to the right edge', () => {
    const onResolve = vi.fn()
    render(
      <ContestedEdgeSection
        edges={[makeContested('ec', 'f1', 'f2')]}
        nodes={nodes}
        onResolveContested={onResolve}
      />,
    )
    fireEvent.click(screen.getByTestId('contested-dismiss-ec'))
    expect(onResolve).toHaveBeenCalledWith('ec', 'dismissed')
  })
})

// ── New, because the MOVE is what put these at risk ──────────────────────────

describe('⭐ ContestedEdgeSection — the properties the rehome itself endangered', () => {
  it('renders NOTHING when there is nothing pending', () => {
    const { container } = render(
      <ContestedEdgeSection
        edges={[makePlain('en', 'f1', 'f2')]}
        nodes={nodes}
        onResolveContested={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('contested-edge-section')).not.toBeInTheDocument()
    expect(container.textContent).toBe('')
  })

  it('⭐ renders NOTHING when no handler is supplied — never dead buttons', () => {
    // Four resolve controls that silently discard a user's judgement would be
    // worse than no section. "No handler" must propagate as "no section".
    render(<ContestedEdgeSection edges={[makeContested('ec', 'f1', 'f2')]} nodes={nodes} />)
    expect(screen.queryByTestId('contested-edge-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contested-dismiss-ec')).not.toBeInTheDocument()
  })

  it('⭐ PROVIDES the detail-toggle context itself — it no longer inherits one', () => {
    // The section used to sit inside `ModelTabHeader`'s provider. Outside it,
    // every card would silently fall back to the context default (false) and the
    // expert detail region would vanish with no test noticing. Asserted as a
    // PAIR so the difference is provably this prop's doing.
    const edges = [makeContested('ec', 'f1', 'f2')]

    const { unmount } = render(
      <ContestedEdgeSection
        edges={edges}
        nodes={nodes}
        onResolveContested={vi.fn()}
        showDetail={false}
      />,
    )
    expect(screen.queryByTestId('contested-detail-ec')).not.toBeInTheDocument()
    unmount()

    render(
      <ContestedEdgeSection
        edges={edges}
        nodes={nodes}
        onResolveContested={vi.fn()}
        showDetail
      />,
    )
    expect(screen.getByTestId('contested-detail-ec')).toBeInTheDocument()
  })

  it('⭐ keeps ALL TEN of the card’s controls reachable through the new host', () => {
    // The rehome's whole obligation: not one affordance lost. Bound by TESTID,
    // so a control that survived under a different identity does not count.
    //
    // ⚠ `showDetail` is REQUIRED here, and finding that out is itself evidence
    // for the test above: the two node-reference buttons live inside the card's
    // detail region (`ContestedEdgeCard.tsx:511`), so under the context default
    // they are absent. A rehome that had dropped the provider would have lost
    // these two controls with nothing to say so.
    render(
      <ContestedEdgeSection
        edges={[makeContested('ec', 'f1', 'f2')]}
        nodes={nodes}
        onResolveContested={vi.fn()}
        showDetail
      />,
    )

    // 1-4: the always-visible resolve actions.
    for (const id of [
      'contested-accept-pass1-ec',
      'contested-accept-pass2-ec',
      'contested-enter-own-ec',
      'contested-dismiss-ec',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }

    // 5-6: the canvas cross-references, behind the detail gate.
    expect(screen.getByTestId('contested-node-ref-source-ec')).toBeInTheDocument()
    expect(screen.getByTestId('contested-node-ref-target-ec')).toBeInTheDocument()

    // 7-9: the three band quick-sets, in the card's DEFAULT state.
    //
    // ⚠ MUTUALLY EXCLUSIVE WITH THE CUSTOM PANEL — `ContestedEdgeCard.tsx:418`
    // gates the pills on `!showCustomInput`. The first cut of this test opened
    // the custom panel and then looked for the pills, and failed; the card is
    // right and the test was wrong. Recording it because "assert all N controls
    // in one render" is a natural way to write this and it is not available here.
    for (const band of ['weak', 'moderate', 'strong']) {
      expect(screen.getByTestId(`contested-quickset-${band}-ec`)).toBeInTheDocument()
    }

    // 10: the custom-value confirm, which replaces the pills when opened.
    fireEvent.click(screen.getByTestId('contested-enter-own-ec'))
    expect(screen.getByTestId('contested-custom-confirm-ec')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-quickset-weak-ec')).not.toBeInTheDocument()
  })
})
