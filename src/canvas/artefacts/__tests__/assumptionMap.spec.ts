/**
 * What the model rests on: every figure lands in exactly one cell, its column is its OWNER's verdict (never re-derived)
 * and its row is directed reachability to the goal. Served-shape link data (the parity spec's fixture, one per kind).
 */
import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import type { Edge, Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'
import { edgeProvenance, type EdgeProvenanceKind } from '../../domain/edgeProvenance'
import { assumptionMapOf, restsOnKey, restsOnNumbered, type AssumptionColumn } from '../assumptionMapModel'
import { showLensForAction } from '../lenses'
import { useCanvasStore } from '../../store'

type Data = Record<string, unknown>
type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const dataFor = (from: string, to: string): Data => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  assert.ok(i >= 0, `${from} → ${to} is in the fixture`)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Data
}
const PLACEHOLDER = () => dataFor('pro_plan_price', 'mrr')
const ESTIMATE = () => dataFor('pro_plan_price', 'monthly_new_pro_subscribers')
const W = (d: Data) => { const s = resolveEdgeSignedStrengthDisplay(d); if (!s.show) throw new Error('needs a strength'); return Math.abs(s.value) }

/** Each link kind and the column the map must give it (null = not on the map). */
const LINKS: ReadonlyArray<[EdgeProvenanceKind, () => Data, AssumptionColumn | null]> = [
  ['olumi_estimate', ESTIMATE, 'unchecked'],
  ['user', () => ({ ...ESTIMATE(), weightSource: 'user' }), 'yours'],
  ['brief', () => { const d = ESTIMATE(); return { ...d, strengthStated: W(d) } }, 'yours'],
  // Accepting Olumi's strength never makes it the user's: its origin stays Olumi's (PL, 18 Oct 2026).
  ['accepted', () => { const d = ESTIMATE(); return { ...d, strengthAccepted: W(d) } }, 'accepted'],
  ['placeholder', PLACEHOLDER, 'missing'],
  ['example', () => ({ ...ESTIMATE(), weightSource: 'template' }), 'unchecked'],
  ['exact', () => ({ ...PLACEHOLDER(), strengthIdentityExact: 'mrr' }), null],
]

/** Factor values by their stamp, and the column each must take (the stamps the card specs use). */
const FACTORS: ReadonlyArray<[string, Data, AssumptionColumn]> = [
  ['user', { observedState: { value: 0.7, source: 'user_override' } }, 'yours'],
  ['brief', { observedState: { value: 0.8, source: 'brief_extraction', extractionType: 'explicit' } }, 'yours'],
  ['olumi', { observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' } }, 'unchecked'],
  // CONTRAST: Olumi's drafted value with no marker is still Olumi's and unchecked, never assumed accepted.
  ['olumi drafted, unmarked', { observedState: { value: 0.4, source: 'cee_inference' } }, 'unchecked'],
  ['accepted', { observedState: { value: 0.5, source: 'user_assumption', reviewed_by_user: { intent: 'confirm' } } }, 'accepted'],
  // An origin nobody can attest is never shown as the user's (DL, 18 Oct 2026; BaseNode.evidenceLensSaysIt's intent).
  ['unverified', { provenance: 'unverified_brief', observedState: { value: 12, source: 'brief_extraction' } }, 'unknown'],
  ['unknown provenance', { provenance: 'something_new', observedState: { value: 3 } }, 'unknown'],
]

const node = (id: string, type: string, data: Data = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const edge = (id: string, source: string, target: string, data: Data): Edge => ({ id, source, target, data })

describe('what the model rests on', () => {
  it('every link kind takes its owner\'s column; definitional and exact links are not assumptions', () => {
    for (const [kind, data, column] of LINKS) {
      const d = data()
      assert.equal(edgeProvenance(d)?.kind, kind, `POSITIVE CONTROL: the fixture really is ${kind}`)
      const map = assumptionMapOf([node('f', 'factor'), node('g', 'goal')], [edge('e', 'f', 'g', d)], 'g')
      const link = map.items.filter((i) => i.target.kind === 'edge')
      if (column === null) assert.equal(link.length, 0, `${kind} is not on the map`)
      else assert.deepEqual(link.map((i) => [i.column, i.row]), [[column, 'on_path']], kind)
    }
  })

  it('every factor stamp takes its owner\'s column', () => {
    for (const [name, data, column] of FACTORS) {
      const map = assumptionMapOf([node('f', 'factor', data), node('g', 'goal')], [], 'g')
      assert.deepEqual(map.items.map((i) => i.column), [column], name)
    }
  })

  it('CLASS: across generated chains, each figure appears once, and is on the path exactly when it reaches the goal', () => {
    for (let n = 1; n <= 12; n += 1) for (let cut = 0; cut <= n; cut += 1) {
      // f0 → f1 → … → f(n-1) → goal, with the link out of f(cut) removed (cut = n keeps the chain whole).
      const nodes = [...Array.from({ length: n }, (_, i) => node(`f${i}`, 'factor', FACTORS[i % FACTORS.length][1])), node('g', 'goal')]
      const ids = [...nodes.slice(0, n).map((x) => x.id), 'g']
      const edges = ids.slice(0, -1).flatMap((from, i) => (i === cut ? [] : [edge(`e${i}`, from, ids[i + 1], ESTIMATE())]))
      const map = assumptionMapOf(nodes, edges, 'g')
      const keys = map.items.map((i) => `${i.target.kind}:${i.target.id}`)
      assert.equal(new Set(keys).size, keys.length, 'no figure twice')
      assert.equal(keys.length, n + edges.length, 'every factor and every causal link')
      for (const item of map.items) {
        const index = Number((item.target.kind === 'node' ? item.target.id : edges.find((e) => e.id === item.target.id)!.target).replace(/\D/g, '') || n)
        const reaches = item.target.kind === 'edge' && edges.find((e) => e.id === item.target.id)!.target === 'g' ? true : index > cut || cut === n
        assert.equal(item.row, reaches ? 'on_path' : 'off_path', `${item.target.id} with the cut at ${cut}`)
      }
    }
  })

  it('CONTRAST: a link into a dead end is not on a path, even when its own source is', () => {
    const map = assumptionMapOf(
      [node('f', 'factor', FACTORS[0][1]), node('x', 'factor', FACTORS[0][1]), node('g', 'goal')],
      [edge('fg', 'f', 'g', ESTIMATE()), edge('fx', 'f', 'x', ESTIMATE())],
      'g',
    )
    const rowOf = (id: string) => map.items.find((i) => i.target.id === id)?.row
    assert.equal(rowOf('f'), 'on_path')
    assert.equal(rowOf('fg'), 'on_path')
    assert.equal(rowOf('fx'), 'off_path')
    assert.equal(rowOf('x'), 'off_path')
  })

  it('CONTRAST: links out of an option or the question are the option\'s own changes, not on the map', () => {
    const map = assumptionMapOf(
      [node('q', 'decision'), node('o', 'option'), node('f', 'factor', FACTORS[0][1]), node('g', 'goal')],
      [edge('qo', 'q', 'o', {}), edge('of', 'o', 'f', ESTIMATE()), edge('fg', 'f', 'g', PLACEHOLDER())],
      'g',
    )
    assert.deepEqual(map.items.map((i) => i.target.id).sort(), ['f', 'fg'])
  })

  it('a cycle and a link to a missing node neither loop nor appear', () => {
    const map = assumptionMapOf(
      [node('a', 'factor', FACTORS[0][1]), node('b', 'factor', FACTORS[0][1]), node('g', 'goal')],
      [edge('ab', 'a', 'b', ESTIMATE()), edge('ba', 'b', 'a', ESTIMATE()), edge('bg', 'b', 'g', ESTIMATE()), edge('bz', 'b', 'zzz', ESTIMATE())],
      'g',
    )
    assert.deepEqual(map.items.map((i) => `${i.target.id}:${i.row}`).sort(), ['a:on_path', 'ab:on_path', 'b:on_path', 'ba:on_path', 'bg:on_path'])
  })

  it('a model with no goal says so: nothing is on a path to it', () => {
    const map = assumptionMapOf([node('a', 'factor', FACTORS[0][1]), node('b', 'factor', FACTORS[0][1])], [edge('ab', 'a', 'b', ESTIMATE())], null)
    assert.equal(map.hasGoal, false)
    assert.ok(map.items.every((i) => i.row === 'off_path'))
  })

  it('a press of an action about the model\'s figures turns on "Rests on"; any other press changes no lens', () => {
    const lens = () => useCanvasStore.getState().lens.active
    useCanvasStore.getState().setLens('full')
    showLensForAction('review')
    assert.equal(lens(), 'full')
    for (const action of ['strengthen', 'check_estimates', 'bias_anchoring']) {
      useCanvasStore.getState().setLens('full')
      showLensForAction(action)
      assert.equal(lens(), 'rests_on', action)
    }
  })
})

describe('"Rests on" numbers', () => {
  // Three factors in two rows and one link between rows, at real positions.
  const at: Record<string, { x: number; y: number }> = { a: { x: 400, y: 0 }, b: { x: 0, y: 0 }, c: { x: 200, y: 300 }, g: { x: 200, y: 600 } }
  const nodes = (dataOf: (id: string) => Data = () => ({ observedState: { value: 0.5, source: 'cee_inference' } })) =>
    ['a', 'b', 'c'].map((id) => ({ ...node(id, 'factor', dataOf(id)), position: at[id] })).concat({ ...node('g', 'goal'), position: at.g })
  const edges = [edge('e_bc', 'b', 'c', ESTIMATE())]
  const numbers = (ns: Node[]) => {
    const items = restsOnNumbered(assumptionMapOf(ns, edges, 'g').items, edges, (id) => ns.find((n) => n.id === id)?.position ?? null)
    return new Map(items.map((i) => [restsOnKey(i.target), i.n]))
  }

  it('run in reading order: top row left to right, then a link at the middle of its ends, then the next row', () => {
    assert.deepEqual([...numbers(nodes()).entries()], [['node:b', 1], ['node:a', 2], ['edge:e_bc', 3], ['node:c', 4]])
  })

  it('a figure keeps its number when its state changes, so the key and the model never renumber under the user', () => {
    const before = numbers(nodes())
    // CONTRAST: the state really changed (unchecked → yours) for one figure.
    const settled = nodes((id) => (id === 'a' ? { observedState: { value: 0.7, source: 'user_override' } } : { observedState: { value: 0.5, source: 'cee_inference' } }))
    const columnOf = (ns: Node[]) => assumptionMapOf(ns, edges, 'g').items.find((i) => i.target.id === 'a')?.column
    assert.equal(columnOf(nodes()), 'unchecked')
    assert.equal(columnOf(settled), 'yours')
    assert.deepEqual([...numbers(settled).entries()], [...before.entries()])
  })
})
