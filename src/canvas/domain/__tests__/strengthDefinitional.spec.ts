/**
 * MG 0ebb952a (1 Oct 2026) — A LINK THAT HOLDS BY DEFINITION IS NOBODY'S ESTIMATE.
 *
 * CEE writes the parts of a total (#2445) and a risk's exposure to the goal
 * (#2386) as links that hold by arithmetic, with `provenance.definitional: true`
 * beside `magnitude: 'olumi_estimate'`. The UI never read `definitional`, so
 * every link surface called them "Olumi's estimate" and the Model tab offered to
 * adopt them. This file pins the ONE reader at every ingestion hop, the ONE
 * predicate, a save/reload, and the pure readers (D1 D2 D4 D5 D6 D9 of
 * `cond1-readers.md`). The rendered readers have their own specs:
 * `EdgePanel.strengthDefinitional.spec.tsx` (D3/D4),
 * `StyledEdge.strengthDefinitional.spec.tsx` (D6/D8),
 * `EdgePills.strengthDefinitional.spec.tsx` (D7).
 *
 * CORPUS — not hand-invented: `provenance` is VERBATIM the stored edge the real
 * CEE constructor (`buildModelFromBrief`, CEE #2445 head e997aa49) registered in
 * the MG probe `cond1-probe.out`, variant A ("Sprint capacity on AI reporting" →
 * "Total sprint capacity allocated"). The envelope keys (`strength`,
 * `exists_probability: 1`, `effect_direction: 'positive'`) are the ones #2445's
 * rewrite returns (`admit-model.ts:4509`); `provenance_display: 'ai_inferred'` is
 * CEE's display for `cee_hypothesis`.
 *
 * Every assertion has its CONTROL on the same wire: the identical edge without
 * `definitional` (an ordinary Olumi estimate — must still say so), and the same
 * edge as the user's own (`user_specified` — unchanged).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { overlayEdge } from '../../utils/mergeAppliedGraph'
import { saveState, loadState } from '../../persist'
import {
  BY_DEFINITION,
  isStrengthDefinitional,
  readWireStrengthIsDefinitional,
  strengthDefinitionalPatch,
} from '../strengthDefinitional'
import { EdgeDataSchema } from '../edges'
import { toModelRows, type ModelProjectionInput } from '../../model-tab-v2/adapters'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'
import { buildExamineLinkView } from '../../ui/inspector-v2/examine/examineLinkView'
import { linkStrengthSourceWords } from '../../components/hoverCard/LinkHoverCard'
import { selectAssumedStrengthToResolve } from '../../../components/results/strengthElicitation/selectAssumedStrengthToResolve'

type WireEdge = Record<string, unknown> & { from: string; to: string }

const PART = 'sprint_capacity_on_ai_reporting'
const TOTAL = 'total_sprint_capacity_allocated'
const NATURAL = {
  amount: 1,
  amount_unit: '% of upcoming sprint capacity',
  per_source_change: 1,
  per_source_change_unit: '% of upcoming sprint capacity',
  strength_mean: 1,
  strength_mean_frame: 'edge_strength',
}
/** The #2445 part → total link, provenance verbatim from the CEE probe (see header). */
const DEFINITIONAL: WireEdge = {
  from: PART,
  to: TOTAL,
  strength: { mean: 1, std: 0.001 },
  exists_probability: 1,
  effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL, definitional: true },
}
/** CONTROL: the same link as an ordinary Olumi estimate — no `definitional`. */
const ESTIMATE: WireEdge = {
  ...DEFINITIONAL,
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL },
}
/** CONTROL: the same link as the user's own. */
const USER_STATED: WireEdge = {
  ...DEFINITIONAL,
  provenance_display: 'user_set',
  provenance: { source: 'user_specified', magnitude: 'user_stated', natural_effect: NATURAL },
}

const ingest = (e: WireEdge, i = 0) => mapDraftEdgeToCanvas({ ...e }, i).data as Record<string, unknown>

// ── Hop 2 needs the store; driven through the public entry point, as
//    `strengthPlaceholder.spec.ts` does. ─────────────────────────────────────
let storeNodes: any[] = []
let storeEdges: any[] = []
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))
vi.mock('../../store/scenarios', () => ({ saveAutosave: vi.fn() }))
const { applyAutoApplyPatch } = await import('../../conversation/utils/applyPatch')

function viaPatch(e: WireEdge) {
  storeNodes = [
    { id: e.from, type: 'factor', position: { x: 0, y: 0 }, data: { label: e.from } },
    { id: e.to, type: 'factor', position: { x: 0, y: 0 }, data: { label: e.to } },
  ]
  storeEdges = []
  applyAutoApplyPatch({
    block_type: 'graph_patch',
    auto_apply: true,
    operations: [{ op: 'add_edge', target_id: 'e1', data: { ...e } }],
  } as any)
  expect(storeEdges).toHaveLength(1)
  return storeEdges[0]
}

beforeEach(() => {
  storeNodes = []
  storeEdges = []
})

describe('the ONE wire reader', () => {
  it('reads provenance.definitional === true, and nothing else', () => {
    expect(readWireStrengthIsDefinitional(DEFINITIONAL)).toBe(true)
    expect(readWireStrengthIsDefinitional(ESTIMATE)).toBe(false)
    expect(readWireStrengthIsDefinitional(USER_STATED)).toBe(false)
    expect(readWireStrengthIsDefinitional({ from: 'a', to: 'b' })).toBe(false)
    // A truthy non-`true` is not the producer's word.
    expect(readWireStrengthIsDefinitional({ ...DEFINITIONAL, provenance: { definitional: 'true' } })).toBe(false)
  })

  it('a label on a strength the wire did not supply stores nothing', () => {
    expect(strengthDefinitionalPatch(DEFINITIONAL, false)).toEqual({})
    expect(strengthDefinitionalPatch(DEFINITIONAL, true)).toEqual({ strengthDefinitional: true })
    expect(strengthDefinitionalPatch(ESTIMATE, true)).toEqual({})
  })
})

describe('hops 1, 2 and 3 carry the SAME key', () => {
  it('hop 1 (full draft) and hop 2 (patch receipt) store strengthDefinitional: true, and agree on the whole bag', () => {
    const drafted = ingest(DEFINITIONAL)
    const patched = viaPatch(DEFINITIONAL).data as Record<string, unknown>
    expect(drafted.strengthDefinitional).toBe(true)
    expect(patched.strengthDefinitional).toBe(true)
    expect(isStrengthDefinitional(drafted)).toBe(true)
    expect(isStrengthDefinitional(patched)).toBe(true)
    const keys = new Set([...Object.keys(drafted), ...Object.keys(patched)])
    const differing = [...keys].filter((k) => JSON.stringify(drafted[k]) !== JSON.stringify(patched[k]))
    expect(differing).toEqual([])
  })

  it('CONTROL: an ordinary olumi_estimate and a user_stated edge carry no key at either hop', () => {
    for (const e of [ESTIMATE, USER_STATED]) {
      expect('strengthDefinitional' in ingest(e)).toBe(false)
      expect('strengthDefinitional' in viaPatch(e).data).toBe(false)
    }
  })

  it('hop 3 (DraftChat) calls the same reader and keeps the key out of the wire remainder (source pin)', () => {
    // As in `strengthPlaceholder.spec.ts`: DraftChat's mapper is inline in the
    // component, so this is a SOURCE PIN of the two lines, not a behaviour witness.
    const src = readFileSync(path.resolve(__dirname, '../../components/DraftChat.tsx'), 'utf8')
    expect(src).toMatch(/\.\.\.strengthDefinitionalPatch\(e as Record<string, unknown>, weightSource !== 'default'\)/)
    // Inside the same destructure, before the remainder is taken (the placeholder
    // pin owns the line directly above `...edgeRest`).
    expect(src).toMatch(/strengthDefinitional: _strengthDefinitional,[^}]*?\.\.\.edgeRest/)
  })
})

describe('the predicate', () => {
  it('a strength a person set is theirs — the flag cannot relabel it', () => {
    expect(isStrengthDefinitional({ ...ingest(DEFINITIONAL), weightSource: 'user' })).toBe(false)
  })

  it('CONTROL: the untouched definitional edge is one; the estimate and the user edge are not', () => {
    expect(isStrengthDefinitional(ingest(DEFINITIONAL))).toBe(true)
    expect(isStrengthDefinitional(ingest(ESTIMATE))).toBe(false)
    expect(isStrengthDefinitional(ingest(USER_STATED))).toBe(false)
  })
})

describe('it survives a save and a reload', () => {
  it('local save → load keeps the key, and the loaded edge still holds by definition', () => {
    const edge = { ...mapDraftEdgeToCanvas({ ...DEFINITIONAL }, 6), type: 'styled' }
    expect(saveState({ nodes: [], edges: [edge] as any })).toBe(true)
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    const back = loaded!.edges.find((e) => e.id === edge.id)!
    expect((back.data as Record<string, unknown>).strengthDefinitional).toBe(true)
    expect(isStrengthDefinitional(back.data as Record<string, unknown>)).toBe(true)
  })

  it('the edge-data schema declares the key', () => {
    expect(EdgeDataSchema.parse(ingest(DEFINITIONAL)).strengthDefinitional).toBe(true)
  })

  it('a server readback of the same edge keeps it; one that no longer labels it removes it', () => {
    const canvas = mapDraftEdgeToCanvas({ ...DEFINITIONAL }, 6)
    const same = overlayEdge(canvas, { ...DEFINITIONAL }, { acquireServerStrengthOnNoop: true })
    expect(same.data.strengthDefinitional).toBe(true)
    const after = overlayEdge(canvas, { ...ESTIMATE }, { acquireServerStrengthOnNoop: true })
    expect('strengthDefinitional' in after.data).toBe(false)
  })

  it('a readback onto a canvas saved BEFORE the key existed acquires it', () => {
    const older = mapDraftEdgeToCanvas({ ...DEFINITIONAL }, 6)
    delete (older.data as Record<string, unknown>).strengthDefinitional
    const after = overlayEdge(older, { ...DEFINITIONAL }, { acquireServerStrengthOnNoop: true })
    expect(after.data.strengthDefinitional).toBe(true)
  })
})

// ── The readers. Each: definitional → no estimate words, no offer; the same
//    wire as an Olumi estimate → still "Olumi's estimate" (CONTROL); the user's
//    own → unchanged. ────────────────────────────────────────────────────────

const NODES = [
  { id: PART, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sprint capacity on AI reporting' } },
  { id: TOTAL, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total sprint capacity allocated' } },
] as unknown as Node[]

function relationshipRow(data: Record<string, unknown>) {
  const input: ModelProjectionInput = {
    nodes: NODES,
    edges: [{ id: 'e1', source: PART, target: TOTAL, data }] as never,
    goalThreshold: null,
  }
  const row = toModelRows(input).find((r) => r.kind === 'relationship')
  expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
  return row!
}

describe('D1 — the Model tab relationship sentence', () => {
  it('says "by definition", not "Olumi\'s estimate", and drops the "about" hedge', () => {
    const value = relationshipRow(ingest(DEFINITIONAL)).primaryValue
    expect(value).toBe('Increase of 1 % of upcoming sprint capacity per 1 % of upcoming sprint capacity · by definition')
    expect(value).not.toMatch(/Olumi|estimate|about/)
  })

  it("CONTROL: the same wire as an Olumi estimate still says \"about … · Olumi's estimate\"", () => {
    expect(relationshipRow(ingest(ESTIMATE)).primaryValue).toBe(
      "Increase of about 1 % of upcoming sprint capacity per 1 % of upcoming sprint capacity · Olumi's estimate",
    )
  })

  // Beat 1 (Paul, 4 Oct 2026: full provenance words on links): the user's own size now SAYS it is theirs — "your
  // figure" (stated outside the brief) — where it used to carry no words. The control's point is unchanged: no
  // "Olumi", no "by definition".
  it("CONTROL: the user's own reads as theirs (\"your figure\"), never Olumi's or a definition", () => {
    const value = relationshipRow(ingest(USER_STATED)).primaryValue
    expect(value).toBe('Increase of about 1 % of upcoming sprint capacity per 1 % of upcoming sprint capacity · your figure')
    expect(value).not.toMatch(/Olumi|definition/)
  })
})

describe('D2 — the Model tab never offers to adopt a definition', () => {
  it('no "unconfirmed-estimate" attention (the "Adopt Olumi\'s estimate" chip)', () => {
    expect(relationshipRow(ingest(DEFINITIONAL)).attention).not.toContain('unconfirmed-estimate')
  })

  it('CONTROL: the same wire as an Olumi estimate IS offered (the gate is live on this fixture)', () => {
    expect(relationshipRow(ingest(ESTIMATE)).attention).toContain('unconfirmed-estimate')
  })

  it("CONTROL: the user's own is not offered", () => {
    expect(relationshipRow(ingest(USER_STATED)).attention).not.toContain('unconfirmed-estimate')
  })
})

describe('D4 — the inspector provenance sentences', () => {
  it('say the link holds by definition, and never "Olumi estimated"', () => {
    const s = resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee', strengthDefinitional: true })
    expect(s).toContain('This link holds by definition')
    expect(s).toContain('By definition, this connection always exists.')
    expect(s).not.toMatch(/Olumi estimated/)
  })

  it('CONTROL: an Olumi estimate keeps both "Olumi estimated" sentences', () => {
    const s = resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee' })
    expect(s).toBe('Olumi estimated this strength from your description. Olumi estimated how likely this connection is to exist.')
  })

  it("CONTROL: the flag cannot relabel the user's own strength", () => {
    expect(resolveEdgeValuesProvenance({ strength: 'user', existence: 'user', strengthDefinitional: true })).toBe(
      'You set this strength. You set how likely this connection is to exist.',
    )
  })
})

describe('D5 — Examine this link', () => {
  const view = (data: Record<string, unknown>, fragile = false) =>
    buildExamineLinkView({ sourceLabel: 'Part', targetLabel: 'Total', data, structural: false, fragile })

  it('offers no examination of a definition — even when the last Run flagged it', () => {
    expect(view(ingest(DEFINITIONAL))).toBeNull()
    expect(view(ingest(DEFINITIONAL), true)).toBeNull()
  })

  it('CONTROL: the same wire as an Olumi estimate is offered on the olumi_estimate basis', () => {
    expect(view(ingest(ESTIMATE))?.basis).toBe('olumi_estimate')
  })

  it("CONTROL: the user's own, unflagged, is not challenged (unchanged)", () => {
    expect(view(ingest(USER_STATED))).toBeNull()
  })
})

describe('D6 — the link hover words', () => {
  it('a definition reads "By definition" — not "Olumi’s estimate", and not "Confirmed by you"', () => {
    expect(linkStrengthSourceWords(false, 'cee', true)).toBe(BY_DEFINITION)
    expect(linkStrengthSourceWords(true, 'cee', true)).toBe(BY_DEFINITION)
  })

  it('CONTROL: without the flag the words are unchanged', () => {
    expect(linkStrengthSourceWords(false, 'cee')).toBe('Olumi’s estimate')
    expect(linkStrengthSourceWords(true, 'user')).toBe('Set by you')
  })
})

describe('D9 — the results card never asks to resolve a definition', () => {
  const decide = (data: Record<string, unknown>) =>
    selectAssumedStrengthToResolve({
      fragileEdges: [{ from_id: PART, to_id: TOTAL, switch_probability: 0.4 }],
      edges: [{ id: 'e1', source: PART, target: TOTAL, data }],
      nodeLabels: new Map([[PART, 'Sprint capacity on AI reporting'], [TOTAL, 'Total sprint capacity allocated']]),
      reviewableEdgeIds: new Set(['e1']),
    })

  it('a fragile definitional link is not selected', () => {
    const d = decide(ingest(DEFINITIONAL))
    expect(d.selected).toBeNull()
    expect(d.assumedFragileCount).toBe(0)
  })

  it('CONTROL: the same fragile link as an Olumi estimate IS selected (the row clears the floor)', () => {
    const d = decide(ingest(ESTIMATE))
    expect(d.selected?.edgeId).toBe('e1')
    expect(d.selected?.strengthProvenance).toBe('ai_inferred')
  })

  it("CONTROL: the user's own is not selected (unchanged)", () => {
    expect(decide(ingest(USER_STATED)).selected).toBeNull()
  })
})
