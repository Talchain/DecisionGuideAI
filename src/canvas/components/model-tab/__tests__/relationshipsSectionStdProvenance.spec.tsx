/**
 * ROADMAP 2.296 C4 — the unsourced `strengthStd` default may not display as a
 * measured uncertainty.
 *
 * THE DEFECT: `RelationshipsSection` read the raw field
 * (`data?.strengthStd ?? data?.strength_std`) and rendered it on three
 * surfaces — the collapsed-card inline `σ0.15`, the expanded-card `±0.15`,
 * and the full-detail "Std" row `0.150`. `USER_EDGE_DEFAULTS.strengthStd =
 * 0.15` fabricates that number on every user-drawn edge, and the provenance
 * registry (`edgeValueProvenance.ts`) names `strengthStd` as exactly the gap
 * this mechanism exists to close: a default must never display as set.
 *
 * THE FIX: every Std display surface in this file resolves through
 * `resolveEdgeValueDisplay(data, 'strengthStd')`, which cannot hand back a
 * number without a source. Consequence, stated openly: the legacy raw
 * `strength_std` read-leg is removed. The registry deliberately declares NO
 * back-compat fallback for std (its own comment: inventing one would launder
 * the default) — so a raw producer `strength_std` that arrives without a
 * stamp renders nothing until its ingestion site stamps it, exactly like an
 * unstamped weight.
 *
 * σ/±-rendering surfaces in the touched file, complete manifest at this tip
 * (rg -an "strengthStd|strength_std" on RelationshipsSection.tsx):
 *   · :183 the source read (fixed here)
 *   · :306-308 inline σ chip           (gated by these tests)
 *   · :387-389 ± beside semantic label (gated by these tests)
 *   · :441,453-457 full-detail Std row (gated by these tests)
 * Deliberately NOT in scope, named: ContestedEdgeCard renders
 * `validation.pass1.strength_std` — a producer-signed validator value that
 * exists only when CEE sent it, not the edge-data default.
 *
 * CLAIM TYPE: jsdom text presence/absence only (trap 3).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelationshipsSection } from '../RelationshipsSection'
import { DetailToggleContext } from '../DetailToggleContext'
import type { Edge, Node } from '@xyflow/react'
import { edgeValueSourcePatch } from '../../../domain/edgeValueProvenance'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const { mockStoreState } = vi.hoisted(() => {
  return {
    mockStoreState: {
      updateEdge: vi.fn(),
      setHighlightedEdges: vi.fn(),
      setHighlightedNodes: vi.fn(),
      highlightedEdges: new Set<string>(),
      edges: [] as unknown[],
    },
  }
})

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

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

const nodes = [makeNode('f1', 'Factor A'), makeNode('f2', 'Factor B')]

/**
 * The fallthrough shape a user-drawn edge actually carries: strength and
 * belief characterised (stamped), `strengthStd: 0.15` present but UNSTAMPED —
 * the `USER_EDGE_DEFAULTS` constant, which nobody measured.
 */
function defaultStdEdge(id: string): Edge {
  return {
    id,
    source: 'f1',
    target: 'f2',
    data: {
      weight: 0.5,
      direction: 'positive',
      beliefExists: 0.7,
      strengthStd: 0.15,
      provenance: 'assumption',
      ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user', direction: 'user' }),
    },
  }
}

/** An edge whose std was actually SET — the stamp is what makes it real. */
function stampedStdEdge(id: string): Edge {
  return {
    id,
    source: 'f1',
    target: 'f2',
    data: {
      weight: 0.5,
      direction: 'positive',
      beliefExists: 0.7,
      strengthStd: 0.32,
      provenance: 'assumption',
      ...edgeValueSourcePatch({
        weight: 'user',
        beliefExists: 'user',
        direction: 'user',
        strengthStd: 'user',
      }),
    },
  }
}

/** Legacy raw wire spelling only — no `strengthStd`, no stamp. */
function legacyRawStdEdge(id: string): Edge {
  return {
    id,
    source: 'f1',
    target: 'f2',
    data: {
      weight: 0.5,
      direction: 'positive',
      beliefExists: 0.7,
      strength_std: 0.27,
      provenance: 'assumption',
      ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user', direction: 'user' }),
    },
  }
}

function renderWithDetail(edges: Edge[], showDetail = true) {
  return render(
    <DetailToggleContext.Provider value={{ showDetail }}>
      <RelationshipsSection edges={edges} nodes={nodes} isExpanded />
    </DetailToggleContext.Provider>,
  )
}

describe('RelationshipsSection — σ/±/Std display is provenance-gated (2.296 C4)', () => {
  it('RED-first: the UNSTAMPED default renders NO inline σ chip (collapsed card, full detail on)', () => {
    renderWithDetail([defaultStdEdge('e-def')])
    // Anti-vacuity: the card itself renders, with its characterised strength.
    expect(screen.getByTestId('edge-card-e-def')).toBeInTheDocument()
    expect(screen.queryByTestId('edge-e-def-inline-std')).toBeNull()
  })

  it('RED-first: the UNSTAMPED default renders no ± figure on the expanded card', () => {
    const { container } = renderWithDetail([defaultStdEdge('e-def')])
    fireEvent.click(screen.getByTestId('edge-card-e-def'))
    expect(container.textContent).not.toContain('±0.15')
  })

  it('RED-first: the UNSTAMPED default renders no full-detail Std value', () => {
    const { container } = renderWithDetail([defaultStdEdge('e-def')])
    fireEvent.click(screen.getByTestId('edge-card-e-def'))
    expect(container.textContent).not.toContain('0.150')
  })

  it('POSITIVE CONTROL: a stamped std renders on all three surfaces (trap 13)', () => {
    const { container } = renderWithDetail([stampedStdEdge('e-set')])
    // Collapsed inline σ chip.
    expect(screen.getByTestId('edge-e-set-inline-std')).toHaveTextContent('σ0.32')
    // Expanded card: ± beside the semantic label, and the detail Std row.
    fireEvent.click(screen.getByTestId('edge-card-e-set'))
    expect(container.textContent).toContain('±0.32')
    expect(container.textContent).toContain('0.320')
  })

  it('the legacy raw `strength_std` spelling no longer displays unstamped (disclosed behaviour change)', () => {
    // The registry has NO back-compat fallback for std, by design. An
    // unstamped raw `strength_std` therefore renders nothing — if a producer
    // path needs it shown, the fix is a stamp at its ingestion site, never a
    // display-side fallback that would also launder the 0.15 default.
    const { container } = renderWithDetail([legacyRawStdEdge('e-raw')])
    expect(screen.getByTestId('edge-card-e-raw')).toBeInTheDocument()
    expect(screen.queryByTestId('edge-e-raw-inline-std')).toBeNull()
    fireEvent.click(screen.getByTestId('edge-card-e-raw'))
    expect(container.textContent).not.toContain('0.27')
  })
})
