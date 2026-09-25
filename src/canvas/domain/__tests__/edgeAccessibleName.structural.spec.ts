/**
 * A14 — a structural link (decision→option organisational wiring, or the
 * canonical structural strength signature) is not a causal claim. It used to
 * be named "Very strong boost. Double-click to set its strength" on the
 * assistive channel — a strength word and a gesture for a link that carries
 * neither. It must instead get its structural tooltip as its name, with no
 * strength word, badge or gesture, using the ONE shared `isStructuralEdge`
 * predicate rather than a second vocabulary for the same fact.
 */
import { describe, it, expect } from 'vitest'
import {
  withEdgeAccessibleNames,
  STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION,
  type NameableEdge,
} from '../edgeAccessibleName'

const labels = new Map<string, string>([
  ['d1', 'Enter the EU market'],
  ['o1', 'Direct sales'],
  ['f1', 'Marketing budget'],
  ['f2', 'Customer acquisition cost'],
])

const nodeKindById = new Map<string, string>([
  ['d1', 'decision'],
  ['o1', 'option'],
  ['f1', 'factor'],
  ['f2', 'factor'],
])
const getNodeKind = (id: string) => nodeKindById.get(id)

describe('a structural link is named for what it structurally is', () => {
  it('a decision→option link gets the structural description, no strength word', () => {
    const edges: NameableEdge[] = [
      // A strong-looking causal payload — the exact shape that used to read
      // "Very strong boost" once `describeEdgeForSpeech` ran it through
      // `getEdgeLabel` regardless of what the edge actually was.
      { id: 'e-1', source: 'd1', target: 'o1', data: { weight: 0.95, direction: 'positive', weightSource: 'user' } },
    ]
    const [named] = withEdgeAccessibleNames(edges, labels, 'human', getNodeKind)
    expect(named.ariaLabel).toBe(
      `Connection from ${labels.get('d1')} to ${labels.get('o1')}. ${STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION}`,
    )
    expect(named.ariaLabel).not.toMatch(/boost|strong|weak|%/i)
  })

  it('carries no gesture clause — there is no strength to set', () => {
    const edges: NameableEdge[] = [
      { id: 'e-1', source: 'd1', target: 'o1', data: {} },
    ]
    const [named] = withEdgeAccessibleNames(edges, labels, 'human', getNodeKind)
    expect(named.ariaLabel).not.toMatch(/double-click|set its strength/i)
  })

  it('the canonical structural strength signature is structural even off decision→option', () => {
    const edges: NameableEdge[] = [
      {
        id: 'e-1',
        source: 'f1',
        target: 'f2',
        data: { weight: 1.0, strengthStd: 0.01, beliefExists: 1.0 },
      },
    ]
    const [named] = withEdgeAccessibleNames(edges, labels, 'human', getNodeKind)
    expect(named.ariaLabel).toContain(STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION)
  })

  it('CONTRAST — an ordinary causal link between the same two node kinds keeps its stated strength', () => {
    const edges: NameableEdge[] = [
      { id: 'e-1', source: 'f1', target: 'f2', data: { weight: 0.6, direction: 'positive', weightSource: 'user' } },
    ]
    const [named] = withEdgeAccessibleNames(edges, labels, 'human', getNodeKind)
    expect(named.ariaLabel).not.toContain(STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION)
  })

  it('CONTRAST — omitting the node-kind resolver falls back to the prior, kind-blind behaviour', () => {
    // No 4th argument — existing callers that have not been updated to pass a
    // node-kind resolver must not change behaviour by omission.
    const edges: NameableEdge[] = [
      { id: 'e-1', source: 'd1', target: 'o1', data: { weight: 0.5, direction: 'positive', weightSource: 'user' } },
    ]
    const [named] = withEdgeAccessibleNames(edges, labels, 'human')
    expect(named.ariaLabel).not.toContain(STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION)
  })
})
