/**
 * `canvasBeforeOwnAppliedWrite` — G₀ for an applied receipt, pure.
 *
 * The integration cases live in `registration/__tests__/oneWriterRegistration.spec.tsx`
 * §9 and `edgeStrengthOneWriter.spec.tsx` (real dispatcher, real registration
 * hook). This pins what they cannot reach cheaply: that ONLY this turn's write
 * is undone, byte-for-byte (a goal rename's `provenance`, present or absent),
 * and that every unproven or no-longer-shown write answers null — the
 * fail-closed half of the rule.
 */
import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { canvasBeforeOwnAppliedWrite, receiptProvesOwnEdgeEdit, type CanvasGraph } from '../ownOptimisticWrite'
import type { StructuralDeleteIntent } from '../../mutations/structuralDelete'
import type { StructuralRenameIntent } from '../../mutations/structuralRename'
import type { StructuralAddIntent } from '../../mutations/structuralAdd'

const node = (id: string, data: Record<string, unknown>): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data }) as unknown as Node
const edge = (id: string, source: string, target: string, data: Record<string, unknown>): Edge =>
  ({ id, source, target, data }) as unknown as Edge

const A = node('fac_a', { label: 'A', kind: 'factor' })
const B = node('fac_b', { label: 'B', kind: 'factor' })
const GONE = node('fac_gone', { label: 'Gone', kind: 'factor' })
const AB = edge('e_ab', 'fac_a', 'fac_b', { weight: 0.6, direction: 'negative' })
const GA = edge('e_ga', 'fac_gone', 'fac_a', { weight: 0.3, direction: 'positive' })

const committed = (nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>> = []) => ({
  draft_graph: { nodes, edges },
})

describe('structural_delete', () => {
  const intent = {
    id: 'sd-1',
    removedNodeIds: ['fac_gone'],
    removedEdges: [],
    baseGraphHash: 'aag_x',
    claimedNodeIds: ['fac_gone'],
    claimedEdgeIds: ['e_ga'],
    restore: { nodes: [GONE], edges: [GA] },
  } as unknown as StructuralDeleteIntent
  const afterDelete: CanvasGraph = { nodes: [A, B], edges: [AB] }
  const proven = committed([{ id: 'fac_a', label: 'A' }, { id: 'fac_b', label: 'B' }])

  it('proven and still shown: G₀ is the canvas with exactly the removed elements back', () => {
    const g0 = canvasBeforeOwnAppliedWrite('structural_delete', { structuralDelete: intent }, proven, afterDelete)
    expect(g0?.nodes.map((n) => n.id).sort()).toEqual(['fac_a', 'fac_b', 'fac_gone'])
    expect(g0?.edges.map((e) => e.id).sort()).toEqual(['e_ab', 'e_ga'])
    // Verbatim — the objects the gesture took, not reconstructions.
    expect(g0?.nodes.find((n) => n.id === 'fac_gone')).toBe(GONE)
    expect(g0?.edges.find((e) => e.id === 'e_ga')).toBe(GA)
  })

  it('refuted (the committed graph still holds the node) or unproven (no committed graph): null', () => {
    const refuted = committed([{ id: 'fac_a' }, { id: 'fac_b' }, { id: 'fac_gone' }])
    expect(canvasBeforeOwnAppliedWrite('structural_delete', { structuralDelete: intent }, refuted, afterDelete)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('structural_delete', { structuralDelete: intent }, { assistant_text: 'x' }, afterDelete)).toBeNull()
  })

  it('the canvas no longer shows the whole removal (an element is back): null', () => {
    expect(
      canvasBeforeOwnAppliedWrite('structural_delete', { structuralDelete: intent }, proven, { nodes: [A, B, GONE], edges: [AB] }),
    ).toBeNull()
    expect(
      canvasBeforeOwnAppliedWrite('structural_delete', { structuralDelete: intent }, proven, { nodes: [A, B], edges: [AB, GA] }),
    ).toBeNull()
  })

  it('another event type never undoes a delete intent it did not send', () => {
    expect(canvasBeforeOwnAppliedWrite('structural_rename', { structuralDelete: intent }, proven, afterDelete)).toBeNull()
  })
})

describe('structural_rename', () => {
  const rename = (restore: StructuralRenameIntent['restore']) =>
    ({
      id: 'sr-1',
      nodeId: 'goal_g',
      label: 'New goal',
      expectedLabel: 'Old goal',
      baseGraphHash: 'aag_x',
      restore,
    }) as StructuralRenameIntent
  const renamedGoal = node('goal_g', { label: 'New goal', kind: 'goal', provenance: 'user_set', target: 5 })
  const canvas: CanvasGraph = { nodes: [renamedGoal, B], edges: [] }
  const proven = committed([{ id: 'goal_g', label: 'New goal' }, { id: 'fac_b', label: 'B' }])

  it('proven and still shown: the label AND the provenance it replaced come back', () => {
    const g0 = canvasBeforeOwnAppliedWrite(
      'structural_rename',
      { structuralRename: rename({ label: 'Old goal', provenance: 'from_brief', provenanceWasPresent: true }) },
      proven,
      canvas,
    )
    expect(g0?.nodes.find((n) => n.id === 'goal_g')?.data).toEqual({
      label: 'Old goal',
      kind: 'goal',
      provenance: 'from_brief',
      target: 5,
    })
    expect(g0?.nodes.find((n) => n.id === 'fac_b')).toBe(B)
  })

  it('a provenance key that was ABSENT before is removed, not written as undefined', () => {
    const g0 = canvasBeforeOwnAppliedWrite(
      'structural_rename',
      { structuralRename: rename({ label: 'Old goal', provenanceWasPresent: false }) },
      proven,
      canvas,
    )
    const data = g0?.nodes.find((n) => n.id === 'goal_g')?.data as Record<string, unknown>
    expect(data.label).toBe('Old goal')
    expect('provenance' in data).toBe(false)
  })

  it('refuted (committed at another label), unproven, or renamed again since: null', () => {
    const intent = rename({ label: 'Old goal', provenanceWasPresent: false })
    const refuted = committed([{ id: 'goal_g', label: 'Someone else' }])
    expect(canvasBeforeOwnAppliedWrite('structural_rename', { structuralRename: intent }, refuted, canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('structural_rename', { structuralRename: intent }, {}, canvas)).toBeNull()
    const renamedAgain = { nodes: [node('goal_g', { label: 'Newer', kind: 'goal' }), B], edges: [] }
    expect(canvasBeforeOwnAppliedWrite('structural_rename', { structuralRename: intent }, proven, renamedAgain)).toBeNull()
  })
})

describe('edge_strength_edit', () => {
  const before = { weight: 0.25, direction: 'positive', strengthStd: 0.12, serverStrength: { mean: 0.25 } }
  const written = edge('e-13', 'fac_a', 'out_nrr', { ...before, weight: 0.55, weightSource: 'user' })
  const canvas: CanvasGraph = { nodes: [A], edges: [written] }
  const own = { optimisticEdgeEdit: { edgeId: 'e-13', sentMagnitude: 0.55, before } }
  const proven = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: 0.55, std: 0.12 } }])

  it('proven and still shown: exactly the keys the strength write touched come back', () => {
    const g0 = canvasBeforeOwnAppliedWrite('edge_strength_edit', own, proven, canvas)
    const data = g0?.edges[0]?.data as Record<string, unknown>
    expect(data.weight).toBe(0.25)
    // Absent before → explicitly undefined, so the digest projects as before.
    expect(data.weightSource).toBeUndefined()
    expect(data.direction).toBe('positive')
    // Untouched keys are untouched.
    expect(data.strengthStd).toBe(0.12)
    expect(data.serverStrength).toEqual({ mean: 0.25 })
  })

  it('the committed graph shows another magnitude, or none: null', () => {
    const other = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: 0.25 } }])
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, other, canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, committed([{ id: 'fac_a' }], []), canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, {}, canvas)).toBeNull()
  })

  it('the canvas has moved on from the sent magnitude: null', () => {
    const movedOn = { nodes: [A], edges: [edge('e-13', 'fac_a', 'out_nrr', { ...before, weight: 0.8, weightSource: 'user' })] }
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, proven, movedOn)).toBeNull()
  })

  it('the settle question is asked of the COMMITTED graph only — a pick overwritten on screen is still proven', () => {
    const movedOn = [edge('e-13', 'fac_a', 'out_nrr', { ...before, weight: 0.25 })]
    expect(receiptProvesOwnEdgeEdit(own.optimisticEdgeEdit, proven, movedOn)).toBe(true)
    // …while the acknowledgement undo, which needs the canvas to show the write, declines.
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, proven, { nodes: [A], edges: movedOn })).toBeNull()
    // Contrast: another magnitude committed, or the link unknown to the canvas, proves nothing.
    const other = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: -0.3 } }])
    expect(receiptProvesOwnEdgeEdit(own.optimisticEdgeEdit, other, movedOn)).toBe(false)
    expect(receiptProvesOwnEdgeEdit(own.optimisticEdgeEdit, proven, [])).toBe(false)
  })

  it('no turn-carried write, or a different event type: null', () => {
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', {}, proven, canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('option_intervention_edit', own, proven, canvas)).toBeNull()
  })
})

/**
 * A DIRECTION edit rides the same carrier but keeps `|mean|` — so the magnitude
 * test is already true of the graph BEFORE the flip lands. The committed SIGN
 * is what proves it (independent review of #1950, 5820041073).
 */
describe('edge_strength_edit carrying a direction flip', () => {
  const before = { weight: 0.4, direction: 'positive', serverStrength: { mean: 0.4, effect_direction: 'positive' } }
  const flipped = edge('e-7', 'fac_a', 'out_nrr', { ...before, direction: 'negative', directionSource: 'user' })
  const canvas: CanvasGraph = { nodes: [A], edges: [flipped] }
  const own = { optimisticEdgeEdit: { edgeId: 'e-7', sentMagnitude: 0.4, before, sentDirection: 'negative' as const } }
  const landed = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: -0.4 } }])
  const unchanged = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: 0.4 } }])

  it('the committed graph still carries the OLD sign at the same magnitude: not proven', () => {
    expect(receiptProvesOwnEdgeEdit(own.optimisticEdgeEdit, unchanged, [flipped])).toBe(false)
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, unchanged, canvas)).toBeNull()
  })

  it('CONTRAST — the committed graph carries the sent sign: proven, and the undo restores the old direction', () => {
    expect(receiptProvesOwnEdgeEdit(own.optimisticEdgeEdit, landed, [flipped])).toBe(true)
    const data = canvasBeforeOwnAppliedWrite('edge_strength_edit', own, landed, canvas)?.edges[0]?.data as Record<string, unknown>
    expect(data.direction).toBe('positive')
    expect(data.directionSource).toBeUndefined()
  })

  it('a zero mean states no sign, so it proves no direction', () => {
    const zero = committed([{ id: 'fac_a' }], [{ from: 'fac_a', to: 'out_nrr', strength: { mean: 0 } }])
    const atZero = { ...own.optimisticEdgeEdit, sentMagnitude: 0 }
    expect(receiptProvesOwnEdgeEdit(atZero, zero, [flipped])).toBe(false)
  })

  it('the canvas weight differs from the sent (server) magnitude: the undo still applies, to the direction keys only', () => {
    const dragged = edge('e-7', 'fac_a', 'out_nrr', { ...before, weight: 0.6, weightSource: 'user', direction: 'negative', directionSource: 'user' })
    const data = canvasBeforeOwnAppliedWrite('edge_strength_edit', own, landed, { nodes: [A], edges: [dragged] })
      ?.edges[0]?.data as Record<string, unknown>
    expect(data.direction).toBe('positive')
    expect(data.directionSource).toBeUndefined()
    expect(data.weight).toBe(0.6)
    expect(data.weightSource).toBe('user')
  })

  it('the canvas has moved back to the old sign: the undo declines', () => {
    const movedBack = { nodes: [A], edges: [edge('e-7', 'fac_a', 'out_nrr', { ...before })] }
    expect(canvasBeforeOwnAppliedWrite('edge_strength_edit', own, landed, movedBack)).toBeNull()
  })
})

describe('structural_add (C32, 26 Sep): the node, and ONLY the incident links the commit also holds', () => {
  const DEC = node('dec_p', { label: 'Pricing', kind: 'decision' })
  const OPT = node('opt_new', { label: 'New option', kind: 'option' })
  const LINK = edge('e_link', 'dec_p', 'opt_new', { weight: 1, direction: 'positive' })
  const intent = { id: 'sa-1', nodeId: 'opt_new', nodeKind: 'option', label: 'New option', baseGraphHash: 'aag_0' } as unknown as StructuralAddIntent
  const canvas: CanvasGraph = { nodes: [A, B, DEC, OPT], edges: [AB, LINK] }
  const wireBase = [{ id: 'fac_a' }, { id: 'fac_b' }, { id: 'dec_p' }]

  it('the commit holds the node AND its link (CEE #1937): G₀ is the canvas without both', () => {
    const r = committed([...wireBase, { id: 'opt_new' }], [{ from: 'fac_a', to: 'fac_b' }, { from: 'dec_p', to: 'opt_new' }])
    const g0 = canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, r, canvas)
    expect(g0?.nodes.map((n) => n.id).sort()).toEqual(['dec_p', 'fac_a', 'fac_b'])
    expect(g0?.edges.map((e) => e.id)).toEqual(['e_ab'])
  })

  it('the commit holds the node AND its link: nothing is named as not-yet-committed', () => {
    const r = committed([...wireBase, { id: 'opt_new' }], [{ from: 'dec_p', to: 'opt_new' }])
    expect(canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, r, canvas)?.notYetCommittedEdgeIds).toBeUndefined()
  })

  it('FAIL CLOSED: the commit holds the node but NOT the link, so the link is NAMED (never acknowledged with it)', () => {
    const r = committed([...wireBase, { id: 'opt_new' }], [{ from: 'fac_a', to: 'fac_b' }])
    const g0 = canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, r, canvas)
    expect(g0?.nodes.map((n) => n.id)).not.toContain('opt_new')
    expect(g0?.edges.map((e) => e.id)).toEqual(['e_ab'])
    expect(g0?.notYetCommittedEdgeIds).toEqual(['e_link'])
  })

  it('the REVERSED pair is not this link: it is still named as not committed', () => {
    const r = committed([...wireBase, { id: 'opt_new' }], [{ from: 'opt_new', to: 'dec_p' }])
    expect(canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, r, canvas)?.notYetCommittedEdgeIds).toEqual(['e_link'])
  })

  it('refuted (node absent from the commit), unproven (no graph), or the node gone from the canvas: null', () => {
    expect(canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, committed(wireBase), canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, { assistant_text: 'x' }, canvas)).toBeNull()
    const gone: CanvasGraph = { nodes: [A, B, DEC], edges: [AB] }
    expect(canvasBeforeOwnAppliedWrite('structural_add', { structuralAdd: intent }, committed([...wireBase, { id: 'opt_new' }]), gone)).toBeNull()
  })
})

describe('structural_add_edge: the one drawn link, by its endpoint pair', () => {
  const BA = edge('e_ba', 'fac_b', 'fac_a', { weight: 0.5, direction: 'positive' })
  const canvas: CanvasGraph = { nodes: [A, B], edges: [AB, BA] }
  const own = { structuralAddEdge: { from: 'fac_b', to: 'fac_a' } }

  it('the commit holds the pair: G₀ is the canvas without exactly that link', () => {
    const r = committed([{ id: 'fac_a' }, { id: 'fac_b' }], [{ from: 'fac_a', to: 'fac_b' }, { from: 'fac_b', to: 'fac_a' }])
    expect(canvasBeforeOwnAppliedWrite('structural_add_edge', own, r, canvas)?.edges.map((e) => e.id)).toEqual(['e_ab'])
  })

  it('the commit lacks the pair, or carries no graph: null', () => {
    expect(canvasBeforeOwnAppliedWrite('structural_add_edge', own, committed([{ id: 'fac_a' }, { id: 'fac_b' }], [{ from: 'fac_a', to: 'fac_b' }]), canvas)).toBeNull()
    expect(canvasBeforeOwnAppliedWrite('structural_add_edge', own, { assistant_text: 'already connected' }, canvas)).toBeNull()
  })

  it('CONTROL: another kind\'s opts never undo a link', () => {
    const r = committed([{ id: 'fac_a' }, { id: 'fac_b' }], [{ from: 'fac_b', to: 'fac_a' }])
    expect(canvasBeforeOwnAppliedWrite('structural_rename', own, r, canvas)).toBeNull()
  })
})

