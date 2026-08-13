/**
 * BYTE-STABILITY of the autosave dirty signature for React-Flow-shaped graphs.
 *
 * WHY THIS FILE EXISTS. `computeGraphHash` is the autosave's DIRTY GATE: its
 * output is compared against `lastSavedHashRef` to decide whether to write. So a
 * change to the projection is never "just a refactor" — if the signature of an
 * unchanged graph moves, every previously-clean scenario reads dirty; if two
 * different graphs start colliding, a real edit reads clean and STOPS SAVING.
 * The second failure mode is silent and loses user work.
 *
 * The P0 fix of 2026-08-13 had to teach this projector a second graph shape
 * (CEE/GraphV3), which is exactly the kind of change that can shift the
 * signature for the shape that already worked. It was verified by DIFFERENTIAL
 * at the time: the corpus below was hashed in a pristine worktree at
 * `978d073c` and in the fixed tree, and the two outputs were byte-identical
 * across all 16 entries — with a positive control proving the harness could see
 * a deliberate one-character signature change.
 *
 * A differential needs two trees, which CI does not have. This file pins the
 * SAME evidence as a golden corpus: the expected strings below are the MEASURED
 * pristine output, not values written by hand. Any future change that moves the
 * signature for a React-Flow-shaped graph turns this RED and names the entry.
 *
 * ⚠ If you are here because this went red: that is the guard working. Do not
 * update the expectations to match new output unless you can say why every
 * affected scenario reading dirty (or clean) is acceptable.
 *
 * The corpus deliberately includes the awkward canvas-shaped cases — a missing
 * `data.label`, a missing `type`, a TOP-LEVEL `label` alongside `position`, an
 * empty `data`, a `{0,0}` position, and single-element malformed graphs that did
 * not throw before because a 1-element `.sort()` never invokes its comparator.
 * Those are precisely where a careless `??` limb shifts the projection.
 */

import { describe, it, expect } from 'vitest'
import { computeGraphHash } from '../useAutosave'

function rf(id: string, extra: Record<string, unknown> = {}) {
  return { id, type: 'factor', position: { x: 10, y: 20 }, data: { kind: 'factor', label: 'L' + id }, ...extra }
}
function rfEdge(id: string, s: string, t: string, extra: Record<string, unknown> = {}) {
  return { id, source: s, target: t, type: 'styled', data: { weight: 1, confidence: 0.5 }, ...extra }
}

const CORPUS: Record<string, { nodes: any[]; edges: any[] }> = {
  empty: { nodes: [], edges: [] },
  singleNode: { nodes: [rf('n1')], edges: [] },
  simple: { nodes: [rf('n1'), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2')] },
  threeNodes: { nodes: [rf('n1'), rf('n2'), rf('n3')], edges: [rfEdge('e1', 'n1', 'n2'), rfEdge('e2', 'n2', 'n3')] },
  unsortedIds: { nodes: [rf('n3'), rf('n1'), rf('n2')], edges: [rfEdge('e2', 'n2', 'n3'), rfEdge('e1', 'n1', 'n2')] },
  noDataLabel: { nodes: [rf('n1', { data: { kind: 'factor' } }), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2')] },
  emptyData: { nodes: [rf('n1', { data: {} }), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2')] },
  noType: { nodes: [rf('n1', { type: undefined }), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2')] },
  topLevelLabelWithPosition: {
    nodes: [rf('n1', { label: 'TOP', data: { kind: 'factor' } }), rf('n2')],
    edges: [rfEdge('e1', 'n1', 'n2')],
  },
  topLevelKindWithPosition: {
    nodes: [rf('n1', { kind: 'goal', type: undefined, data: {} }), rf('n2')],
    edges: [rfEdge('e1', 'n1', 'n2')],
  },
  zeroPosition: { nodes: [rf('n1', { position: { x: 0, y: 0 } }), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2')] },
  edgeNoData: { nodes: [rf('n1'), rf('n2')], edges: [rfEdge('e1', 'n1', 'n2', { data: undefined })] },
  edgeExtraFields: {
    nodes: [rf('n1'), rf('n2')],
    edges: [rfEdge('e1', 'n1', 'n2', { data: { weight: 2, confidence: 0.9, direction: 'negative', validation: { x: 1 } } })],
  },
  richData: {
    nodes: [
      rf('n1', { data: { kind: 'factor', label: 'A', description: 'd', category: 'c', state_space: [0, 1] } }),
      rf('n2', { data: { kind: 'goal', label: 'B', success_threshold: 80, threshold_source: 'user' } }),
    ],
    edges: [rfEdge('e1', 'n1', 'n2')],
  },
  singleNodeNoId: { nodes: [{ type: 'factor', position: { x: 1, y: 2 }, data: {} }], edges: [] },
  singleEdgeNoEndpoints: { nodes: [rf('n1')], edges: [{ id: 'e1', data: {} }] },
}

/** MEASURED at pristine `978d073c`. Generated, not hand-written. */
const GOLDEN: Record<string, string> = {
  "empty": "{\"edges\":[],\"nodes\":[]}",
  "singleNode": "{\"edges\":[],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20}]}",
  "simple": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "threeNodes": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5},{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n2\",\"to\":\"n3\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln3\"},\"id\":\"n3\",\"kind\":\"factor\",\"label\":\"Ln3\",\"x\":10,\"y\":20}]}",
  "unsortedIds": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5},{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n2\",\"to\":\"n3\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln3\"},\"id\":\"n3\",\"kind\":\"factor\",\"label\":\"Ln3\",\"x\":10,\"y\":20}]}",
  "noDataLabel": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "emptyData": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "noType": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "topLevelLabelWithPosition": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "topLevelKindWithPosition": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{},\"id\":\"n1\",\"kind\":null,\"label\":\"\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "zeroPosition": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":0,\"y\":0},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "edgeNoData": "{\"edges\":[{\"data\":{},\"from\":\"n1\",\"to\":\"n2\",\"weight\":\"\"}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "edgeExtraFields": "{\"edges\":[{\"data\":{\"confidence\":0.9,\"direction\":\"negative\",\"validation\":{\"x\":1},\"weight\":2},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.9}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"factor\",\"label\":\"Ln2\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"Ln2\",\"x\":10,\"y\":20}]}",
  "richData": "{\"edges\":[{\"data\":{\"confidence\":0.5,\"weight\":1},\"from\":\"n1\",\"to\":\"n2\",\"weight\":0.5}],\"nodes\":[{\"data\":{\"category\":\"c\",\"description\":\"d\",\"kind\":\"factor\",\"label\":\"A\",\"state_space\":[0,1]},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"A\",\"x\":10,\"y\":20},{\"data\":{\"kind\":\"goal\",\"label\":\"B\",\"success_threshold\":80,\"threshold_source\":\"user\"},\"id\":\"n2\",\"kind\":\"factor\",\"label\":\"B\",\"x\":10,\"y\":20}]}",
  "singleNodeNoId": "{\"edges\":[],\"nodes\":[{\"data\":{},\"id\":null,\"kind\":\"factor\",\"label\":\"\",\"x\":1,\"y\":2}]}",
  "singleEdgeNoEndpoints": "{\"edges\":[{\"data\":{},\"from\":null,\"to\":null,\"weight\":\"\"}],\"nodes\":[{\"data\":{\"kind\":\"factor\",\"label\":\"Ln1\"},\"id\":\"n1\",\"kind\":\"factor\",\"label\":\"Ln1\",\"x\":10,\"y\":20}]}",}

describe('computeGraphHash — React-Flow signature is byte-stable vs pristine 978d073c', () => {
  it('covers every corpus entry (the golden map cannot silently shrink)', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(Object.keys(CORPUS).sort())
    expect(Object.keys(CORPUS)).toHaveLength(16)
  })

  for (const name of Object.keys(CORPUS)) {
    it(`${name} — signature unchanged`, () => {
      const g = CORPUS[name]
      expect(computeGraphHash(g.nodes, g.edges)).toBe(GOLDEN[name])
    })
  }
})
