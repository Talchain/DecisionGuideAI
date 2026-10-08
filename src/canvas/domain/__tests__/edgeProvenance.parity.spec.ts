/**
 * Data layer Phase 1 — ONE edge provenance classifier (DATA-LAYER-CENSUS defect 3; design ced112bd, DL-approved).
 *
 * For every kind, the canvas source icon, the inspector chip and the Model-tab mark all come from `edgeProvenance`
 * and agree with its table. Before: an Olumi estimate was "ai" on the icon, "olumi" on the chip and UNMARKED in the
 * Model tab (raw `weightSource: 'cee'`); a template strength "From brief" on the icon and "example" on the chip; a stated
 * figure "brief" on the icon and "user" on the chip. Edge data comes from served wire shapes through the real mapper
 * (mrr-17d1cd3a: Pro plan price → MRR is a 0.5 placeholder; Pro plan price → new subscribers is Olumi's −0.4 estimate;
 * MG 0ebb952a's definitional part → total). Bound by edge id.
 */
import { describe, expect, it } from 'vitest'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeSignedStrengthDisplay } from '../edgeValueProvenance'
import { EDGE_PROVENANCE, edgeProvenance, type EdgeProvenanceKind } from '../edgeProvenance'
import { edgeStrengthSourceMark } from '../edgeStrengthSourceIcon'
import { classifyValueProvenance } from '../valueProvenance'
import { buildEdgeInspectorSentence } from '../../ui/inspector-v2/edgeInspectorSentence'
import { toModelRows } from '../../model-tab-v2/adapters'

type Data = Record<string, unknown>
type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const dataFor = (from: string, to: string): Data => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  expect(i, `${from} → ${to} is in the fixture`).toBeGreaterThanOrEqual(0)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Data
}
const PLACEHOLDER = () => dataFor('pro_plan_price', 'mrr')
const ESTIMATE = () => dataFor('pro_plan_price', 'monthly_new_pro_subscribers')
const W = (d: Data) => { const s = resolveEdgeSignedStrengthDisplay(d); if (!s.show) throw new Error('needs a strength'); return Math.abs(s.value) }
const DEFINITIONAL = (): Data => mapDraftEdgeToCanvas({
  from: 'n1', to: 'n2', strength: { mean: 1, std: 0.001 }, exists_probability: 1, effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', definitional: true,
    natural_effect: { amount: 1, amount_unit: 'units', per_source_change: 1, per_source_change_unit: 'units', strength_mean: 1, strength_mean_frame: 'edge_strength' } },
}, 0).data as Data

/** One served-shape edge per kind. */
const CASES: ReadonlyArray<[EdgeProvenanceKind, () => Data]> = [
  ['olumi_estimate', ESTIMATE],
  ['user', () => ({ ...ESTIMATE(), weightSource: 'user' })],
  ['brief', () => { const d = ESTIMATE(); return { ...d, strengthStated: W(d) } }],
  ['accepted', () => { const d = ESTIMATE(); return { ...d, strengthAccepted: W(d) } }],
  ['placeholder', PLACEHOLDER],
  ['definitional', DEFINITIONAL],
  ['example', () => ({ ...ESTIMATE(), weightSource: 'template' })],
  ['exact', () => ({ ...PLACEHOLDER(), strengthIdentityExact: 'mrr' })],
]

const iconKind = (d: Data) => edgeStrengthSourceMark(d)?.kind ?? null
const chipKind = (d: Data) => {
  const shown = resolveEdgeSignedStrengthDisplay(d)
  return buildEdgeInspectorSentence({ sourceLabel: 'A', targetLabel: 'B', data: d, strengthDisplay: shown, linkKind: 'causal' }).chip
}
const modelTabKind = (d: Data) => {
  const rows = toModelRows({
    nodes: [{ id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B' } }] as never,
    edges: [{ id: 'e-ab', source: 'a', target: 'b', data: d }] as never,
    goalThreshold: null,
  })
  const row = rows.find((r) => r.id === 'e-ab')
  expect(row, 'the relationship row for e-ab').toBeDefined()
  if (row!.provenanceKind) return row!.provenanceKind
  if (row!.provenanceAccepted) return 'accepted'
  return classifyValueProvenance(row!.provenanceSource)?.kind ?? null
}

describe('edgeProvenance — one answer per kind, on every surface', () => {
  it.each(CASES)('%s: classifier, canvas icon, inspector chip and Model-tab mark agree with the ONE table', (kind, make) => {
    const d = make()
    expect(edgeProvenance(d)?.kind).toBe(kind)
    const entry = EDGE_PROVENANCE[kind]
    expect(iconKind(d), 'canvas icon').toBe(entry.mark)
    expect(modelTabKind(d), 'Model-tab mark').toBe(entry.mark)
    if (kind !== 'definitional' && kind !== 'exact') expect(chipKind(d), 'inspector chip').toBe(entry.chip)
  })

  it('DEFECT 3 RED: Olumi\'s estimate is marked in the Model tab (was null from the raw weightSource \'cee\')', () => {
    expect(modelTabKind(ESTIMATE())).toBe('ai')
    expect(iconKind(ESTIMATE())).toBe('ai')
    expect(chipKind(ESTIMATE())).toBe('olumi')
  })
  it('DL call (a): a template strength is an example figure everywhere — no "From brief" icon', () => {
    const d = { ...ESTIMATE(), weightSource: 'template' }
    expect(iconKind(d)).toBeNull()
    expect(chipKind(d)).toBe('example')
  })
  it('DL call (b): a strength sized from the user\'s stated figure reads "From your brief" (chip brief, not "Yours")', () => {
    const d = ESTIMATE()
    expect(chipKind({ ...d, strengthStated: W(d) })).toBe('brief')
  })
})

describe('edgeProvenance — order (first match wins), each pair bound by the same edge', () => {
  it('a person\'s setting outranks a stale placeholder key', () => {
    expect(edgeProvenance({ ...PLACEHOLDER(), weightSource: 'user' })?.kind).toBe('user')
  })
  it('a person\'s setting outranks a live example figure', () => {
    // The example key counts only without a natural effect (`edgeSizePhrase`): the shipped example's figure.
    const d = { ...ESTIMATE(), naturalEffect: undefined }
    const signed = (resolveEdgeSignedStrengthDisplay(d) as { value: number }).value
    expect(edgeProvenance({ ...d, strengthExampleFigure: signed })?.kind).toBe('example')
    expect(edgeProvenance({ ...d, strengthExampleFigure: signed, weightSource: 'user' })?.kind).toBe('user')
  })
  it('a live example figure outranks "by definition"', () => {
    const d = { ...DEFINITIONAL(), naturalEffect: undefined }
    expect(edgeProvenance(d)?.kind, 'control: still definitional without the example key').toBe('definitional')
    expect(edgeProvenance({ ...d, strengthExampleFigure: W(d) })?.kind).toBe('example')
  })
  it('"by definition" outranks an identity-exact key', () => {
    expect(edgeProvenance({ ...DEFINITIONAL(), strengthIdentityExact: 'n2' })?.kind).toBe('definitional')
  })
  it('example (template) outranks a stated figure', () => {
    const d = ESTIMATE()
    expect(edgeProvenance({ ...d, weightSource: 'template', strengthStated: W(d) })?.kind).toBe('example')
  })
  it('definitional outranks Olumi\'s estimate (same wire, flag on/off)', () => {
    expect(edgeProvenance(DEFINITIONAL())?.kind).toBe('definitional')
  })
  it('exact outranks placeholder', () => {
    expect(edgeProvenance({ ...PLACEHOLDER(), strengthIdentityExact: 'mrr' })?.kind).toBe('exact')
  })
  it('placeholder outranks a stated figure', () => {
    const d = PLACEHOLDER()
    expect(edgeProvenance({ ...d, strengthStated: W(d) })?.kind).toBe('placeholder')
  })
  it('a figure the user ENTERED (natural effect, entered) outranks the stated-figure key: "Set by you"', () => {
    const d = ESTIMATE()
    const signed = (resolveEdgeSignedStrengthDisplay(d) as { value: number }).value
    const entered = { amount: 2, unit: 'customers', perSourceChange: 1, sourceUnit: 'calls', strengthMean: signed, author: 'user', userOrigin: 'entered' }
    expect(edgeProvenance({ ...d, naturalEffect: entered, strengthStated: W(d) })?.kind).toBe('user')
    expect(edgeProvenance({ ...d, naturalEffect: { ...entered, userOrigin: 'brief' }, strengthStated: W(d) })?.kind).toBe('brief')
  })
  it('a stated figure outranks an acceptance', () => {
    const d = ESTIMATE()
    expect(edgeProvenance({ ...d, strengthStated: W(d), strengthAccepted: W(d) })?.kind).toBe('brief')
  })
  it('an acceptance outranks Olumi\'s own estimate', () => {
    const d = ESTIMATE()
    expect(edgeProvenance({ ...d, strengthAccepted: W(d) })?.kind).toBe('accepted')
  })
  it('no strength set → null (readers keep their own "not set")', () => {
    expect(edgeProvenance({})).toBeNull()
    expect(edgeProvenance(undefined)).toBeNull()
  })
})
