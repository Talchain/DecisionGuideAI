/**
 * NodeStructuralMarker — pins for the CLIENT-DERIVED half of the node coaching
 * slot: a structural finding placed on the node its prescribed action names.
 *
 * ⚠ EVERY PLACEMENT ASSERTION BINDS BY ID (CLAUDE.md trap 19). "A marker
 * rendered" is not the claim; "a marker rendered on THIS node and on no other
 * node of the same graph" is. A test that only proved something rendered would
 * pass on a component that marked every node, which marks nothing — so each
 * positive pin is paired with its discriminating twin on a sibling node of the
 * SAME fixture, where every other input is held identical.
 *
 * ⚠ IDENTITY BINDING PRESUPPOSES IDENTITY IS UNIQUE. `createNodeId` returns
 * `String(nextNodeId)` starting at `1`, so a fixture seeded by raw `setState`
 * carrying a node with `id: '1'` can collide with a created node and make every
 * `find`/`includes` answer about whichever copy came first, silently.
 * `expectUniqueIds` is therefore a NAMED PRECONDITION, asserted on every fixture
 * before its marker is read, and proven capable of failing before it is trusted
 * (trap 13: an instrument that cannot fail is not evidence).
 *
 * ⛔ jsdom CANNOT PROVE VISIBILITY. Nothing here claims the glyph is visible,
 * unclipped, correctly stacked, or clear of the five existing corner members.
 * These pins are about presence, count, identity, provenance and accessible
 * name only. The visual claim needs a real browser and is NOT made.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { NodeStructuralMarker } from '../NodeStructuralMarker'
import { NodeCoachingMarker } from '../NodeCoachingMarker'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { STRUCTURAL_MARKER_COPY } from '../../../components/pre-analysis-v3/constants'

function node(id: string, kind: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } } as Node
}

function edge(id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge {
  return { id, source, target, data } as Edge
}

/** A producer-stated negative edge — `directionSource` is what makes it readable. */
function negativeEdge(id: string, source: string, target: string): Edge {
  return edge(id, source, target, { direction: 'negative', directionSource: 'cee' })
}

/**
 * The named precondition. Asserted as a SET COMPARISON rather than a length
 * check on a deduped copy, so a failure names the duplicate id instead of a bare
 * number mismatch.
 */
function expectUniqueIds(nodes: ReadonlyArray<Node>): void {
  const ids = nodes.map(n => n.id)
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)
  expect(duplicated).toEqual([])
  expect(new Set(ids).size).toBe(nodes.length)
}

function seed(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): void {
  expectUniqueIds(nodes)
  useCanvasStore.setState({ nodes: [...nodes], edges: [...edges] } as never, false)
}

/** `no_downside` on its RISK-NODE limb: r1 is modelled and no option reaches it. */
function strandedRisk(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('r1', 'risk'),
    ],
    edges: [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')],
  }
}

/** `shared_mechanism`: both options act directly on x1 and only on x1. */
function sharedMechanism(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('x1', 'outcome'),
      node('r1', 'risk'),
    ],
    edges: [edge('e1', 'o1', 'x1'), edge('e2', 'o2', 'x1'), edge('e3', 'x1', 'r1')],
  }
}

/** Every precondition holds and no check fires. */
function healthy(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { category: 'external' }),
      node('r1', 'risk'),
    ],
    edges: [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2'), edge('e3', 'f1', 'r1')],
  }
}

/** `no_external_factor` — the genuinely global finding. */
function noExternalFactor(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { category: 'observable' }),
      node('r1', 'risk'),
    ],
    edges: [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2'), edge('e3', 'f1', 'r1')],
  }
}

/** `no_downside` on its NEGATIVE-EDGE limb: no risk node exists at all. */
function negativeEdgeOnly(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('x1', 'outcome'),
      node('x2', 'outcome'),
    ],
    edges: [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      negativeEdge('e3', 'x1', 'x2'),
    ],
  }
}

/**
 * A producer item, typed rather than cast, so a change to `GuidanceItem`'s
 * required fields is a type error here instead of a cast quietly absorbing it.
 * `source: 'structural'` is a real member of `GuidanceSource` — the same value
 * `NodeCoachingMarker.spec.tsx` uses.
 */
function producerItemNaming(nodeId: string): GuidanceItem[] {
  return [
    {
      item_id: 'g1',
      category: 'should_fix',
      source: 'structural',
      title: 'Anchoring on the current figure',
      priority: 50,
      primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
      target_object: { type: 'node', id: nodeId },
    },
  ]
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  useCanvasStore.setState({ nodes: [], edges: [] } as never, false)
})

// ---------------------------------------------------------------------------
// The precondition proves it can fail before anything trusts it
// ---------------------------------------------------------------------------

describe('NodeStructuralMarker — the id-uniqueness precondition is load-bearing', () => {
  it('PRECONDITION GUARD ITSELF FAILS on a duplicated fixture id', () => {
    expect(() => expectUniqueIds([node('dup', 'option'), node('dup', 'risk')])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Placement, each positive paired with its discriminating twin
// ---------------------------------------------------------------------------

describe('NodeStructuralMarker — placement binds to the named node', () => {
  it('marks the stranded risk named by no_downside', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="r1" />)
    expect(screen.getByTestId('node-structural-marker-r1')).toBeInTheDocument()
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Same store, same finding, a sibling node. Without
   * it, a component that marked every node would satisfy the pin above — and
   * marking everything marks nothing. `o1` is chosen deliberately: it is the
   * finding's SUBJECT (an option), the object most likely to be confused with its
   * action target.
   */
  it('⛔ marks NO OTHER node of the same graph, subject included', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    for (const other of ['o1', 'o2', 'f1', 'f2']) {
      const { container } = render(<NodeStructuralMarker nodeId={other} />)
      expect(container.innerHTML, `expected no marker on ${other}`).toBe('')
    }
  })

  it('marks the shared target named by shared_mechanism', () => {
    const { nodes, edges } = sharedMechanism()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="x1" />)
    const marker = screen.getByTestId('node-structural-marker-x1')
    expect(marker).toHaveAttribute('data-structural-kind', 'shared_mechanism')
  })

  it('⛔ shared_mechanism marks neither the options that take the route nor a transitive node', () => {
    const { nodes, edges } = sharedMechanism()
    seed(nodes, edges)
    // o1/o2 are the SUBJECT; r1 is reachable but not a DIRECT target of any
    // option, and "acts directly on" is the measured claim.
    for (const other of ['o1', 'o2', 'r1']) {
      const { container } = render(<NodeStructuralMarker nodeId={other} />)
      expect(container.innerHTML, `expected no marker on ${other}`).toBe('')
    }
  })

  it('marks nothing at all on the healthy model (no finding fires)', () => {
    const { nodes, edges } = healthy()
    seed(nodes, edges)
    for (const id of nodes.map(n => n.id)) {
      const { container } = render(<NodeStructuralMarker nodeId={id} />)
      expect(container.innerHTML, `expected no marker on ${id}`).toBe('')
    }
  })
})

// ---------------------------------------------------------------------------
// The two honest empties — a finding that fires and names nothing
// ---------------------------------------------------------------------------

describe('NodeStructuralMarker — the findings that honestly name no node', () => {
  it('⛔ no_external_factor STAYS GLOBAL: the finding fires and marks nothing', () => {
    const { nodes, edges } = noExternalFactor()
    seed(nodes, edges)
    // The finding is live on this fixture; the marker is silent anyway, because
    // the prescribed edit is to ADD a node and nothing present is the thing to
    // change. Marking every controllable factor would call correctly-modelled
    // factors wrong.
    for (const id of nodes.map(n => n.id)) {
      const { container } = render(<NodeStructuralMarker nodeId={id} />)
      expect(container.innerHTML, `expected no marker on ${id}`).toBe('')
    }
  })

  it('⛔ no_downside on the NEGATIVE-EDGE limb marks nothing: the harm is an edge, and a marker sits on a node', () => {
    const { nodes, edges } = negativeEdgeOnly()
    seed(nodes, edges)
    // `hasDownsideElement` admits this branch on negative edges alone, so there
    // is no risk NODE here. Naming x1 or x2 would assert that an outcome node IS
    // the downside, which nothing in the data says.
    for (const id of nodes.map(n => n.id)) {
      const { container } = render(<NodeStructuralMarker nodeId={id} />)
      expect(container.innerHTML, `expected no marker on ${id}`).toBe('')
    }
  })
})

// ---------------------------------------------------------------------------
// Precedence: the producer outranks the local observation, per node
// ---------------------------------------------------------------------------

/*
 * ⭐ CONTRACT v3.1 #18 (DESIGN-GAP-v31, 26 Sep, WS4): the structural "branch"
 * glyph is OFF THE CARD — the coaching slot (`NodeCoachingMarker`) no longer
 * falls back to it. The detection itself is untouched (every block above still
 * renders `NodeStructuralMarker` directly, for the inspector to carry), so the
 * slot tests below pin: producer silent → the slot is EMPTY, while the same
 * node's structural finding is still detected (the contrast that proves the
 * absence is the #18 removal, not a dead fixture).
 */
describe('one voice per node: the producer outranks the structural observation', () => {
  it('v3.1 #18: while the producer is silent the slot carries NO structural glyph — the finding is still detected', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeCoachingMarker nodeId="r1" />)
    expect(screen.queryByTestId('node-structural-marker-r1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('node-coaching-marker-r1')).not.toBeInTheDocument()
    cleanup()
    render(<NodeStructuralMarker nodeId="r1" />)
    expect(screen.getByTestId('node-structural-marker-r1')).toBeInTheDocument()
  })

  it('⭐ it falls silent once the producer names THIS node, and the producer marker takes the slot', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    useGuidanceStore.getState().setGuidanceItems(producerItemNaming('r1'))
    render(<NodeCoachingMarker nodeId="r1" />)
    expect(screen.getByTestId('node-coaching-marker-r1')).toBeInTheDocument()
    expect(screen.queryByTestId('node-structural-marker-r1')).not.toBeInTheDocument()
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN FOR THE SUPPRESSION. Without it, a slot that fell
   * silent whenever the store held anything at all would pass the test above, and
   * the suppression would be bound to "a turn delivered guidance" rather than to
   * "the producer spoke about THIS card". Same shape as `oneVoicePerNode`'s own
   * contrast, which is the ruling this inherits.
   */
  it('⛔ CONTRAST: a producer item naming a DIFFERENT node puts no producer marker on THIS card — and (v3.1 #18) no structural glyph either', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    useGuidanceStore.getState().setGuidanceItems(producerItemNaming('o1'))
    render(<NodeCoachingMarker nodeId="r1" />)
    expect(screen.queryByTestId('node-coaching-marker-r1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('node-structural-marker-r1')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The honesty fence, asserted rather than trusted
// ---------------------------------------------------------------------------

describe('NodeStructuralMarker — the honesty fence', () => {
  it('⛔ writes NOTHING to the guidance store: no synthesised producer provenance', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
    render(<NodeStructuralMarker nodeId="r1" />)
    // The marker rendered, and the producer channel is still empty. A synthesised
    // `target_object` would both fabricate provenance and silence
    // `useScienceIcons.producerNamesThisNode` with a client-side computation.
    expect(screen.getByTestId('node-structural-marker-r1')).toBeInTheDocument()
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
  })

  it('names the source in the DOM and keeps its testid family distinct from the producer marker', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="r1" />)
    const marker = screen.getByTestId('node-structural-marker-r1')
    expect(marker).toHaveAttribute('data-marker-source', 'canvas-structure')
    expect(marker.getAttribute('data-testid')).not.toContain('node-coaching-marker')
  })

  it('is a non-interactive image, not a button (the panel row owns the action)', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="r1" />)
    const marker = screen.getByTestId('node-structural-marker-r1')
    expect(marker).toHaveAttribute('role', 'img')
    expect(marker.tagName).not.toBe('BUTTON')
    expect(marker.querySelector('button')).toBeNull()
  })

  it('carries an accessible name that states the observation and never attributes it to Olumi', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="r1" />)
    const marker = screen.getByTestId('node-structural-marker-r1')
    const label = marker.getAttribute('aria-label') ?? ''
    // Bound to the copy constant by identity, so the sentence cannot drift away
    // from the one the glossary sweep scans.
    expect(label).toBe(STRUCTURAL_MARKER_COPY.no_downside)
    expect(label).toMatch(/^Observed from the shape of your model/)
    expect(label).not.toMatch(/olumi/i)
    // ⭐ SUPERSEDED BY CONTRACT v3.1 (24 Sep, deltas ICON-09 / PILL-07; Paul
    // 23 Sep pt 12, "Icons need hover/focus labels"; ED 02:31Z, native title
    // is not full-text recovery). This asserted a native `title` carrying the
    // same sentence. The sentence now reaches sighted users through the shared
    // focusable Tooltip, whose content IS this accessible name, and the shared
    // Tooltip blanks any native title — so the marker is a keyboard stop and
    // carries no native-title text.
    expect(marker.getAttribute('title') ?? '').toBe('')
    expect(marker).toHaveAttribute('tabindex', '0')
  })

  it('renders exactly ONE marker on the node it names, never a stack', () => {
    const { nodes, edges } = strandedRisk()
    seed(nodes, edges)
    render(<NodeStructuralMarker nodeId="r1" />)
    expect(screen.getAllByTestId('node-structural-marker-r1')).toHaveLength(1)
  })
})
