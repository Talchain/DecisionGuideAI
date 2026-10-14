/**
 * Data layer Phase 1 · PR2a — readers OUTSIDE canvas/inspector move onto the ONE edge provenance classifier.
 *
 * PARITY CORPUS: for every served-shape relationship × every combination of the provenance facts, the old reader
 * predicate and the new one agree, EXCEPT the explicitly declared changes below. Any other difference fails.
 *   unsized gate (results unsized list, UnsizedLinkActions click refusal, chat Strengthen row):
 *     old `isStrengthPlaceholder(d)` → new `isUnsizedRelationship(d)`.
 *     DECLARED: a relationship that holds by definition, is an example figure, or is exact is no longer offered for sizing.
 *   Model-tab "unconfirmed estimate" attention:
 *     old !definitional ∧ !accepted ∧ !stated ∧ !example ∧ ai_inferred → new kind === 'olumi_estimate' ∧ ai_inferred.
 *     DECLARED: a placeholder (nobody estimated it), the user's own natural figure, an exact relationship and a
 *     template/example strength (DL call a: an example figure) are no longer "Olumi's estimate, not yet confirmed".
 * Canvas and inspector are untouched (Paul's freeze); their readers are PR2b.
 */
import { describe, expect, it } from 'vitest'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeSignedStrengthDisplay } from '../edgeValueProvenance'
import { EDGE_PROVENANCE, edgeProvenance, isUnsizedRelationship } from '../edgeProvenance'
import { isStrengthPlaceholder } from '../strengthPlaceholder'
import { isStrengthDefinitional } from '../strengthDefinitional'
import { isStrengthAccepted } from '../strengthAccepted'
import { isStrengthStated } from '../strengthStated'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { edgeValueSource } from '../edgeValueProvenance'
import { linkSizingStateOf } from '../../compare-tab/CompareSizingChecklist'
const edgeValueSourceWeight = (d: Record<string, unknown>) => edgeValueSource(d, 'weight')

type Data = Record<string, unknown>
type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const mapped = (from: string, to: string): Data => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Data
}
const DEFINITIONAL = (): Data => mapDraftEdgeToCanvas({
  from: 'n1', to: 'n2', strength: { mean: 1, std: 0.001 }, exists_probability: 1, effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', definitional: true,
    natural_effect: { amount: 1, amount_unit: 'units', per_source_change: 1, per_source_change_unit: 'units', strength_mean: 1, strength_mean_frame: 'edge_strength' } },
}, 0).data as Data
const BASES: Record<string, () => Data> = {
  placeholder: () => mapped('pro_plan_price', 'mrr'),
  estimate: () => mapped('pro_plan_price', 'monthly_new_pro_subscribers'),
  definitional: DEFINITIONAL,
}
const signed = (d: Data) => { const s = resolveEdgeSignedStrengthDisplay(d); return s.show ? s.value : 0 }

function* corpus(): Generator<[string, Data]> {
  for (const [name, make] of Object.entries(BASES)) {
    for (const ws of ['cee', 'user', 'template'] as const)
      for (const stated of [false, true]) for (const accepted of [false, true])
        for (const example of [false, true]) for (const natural of ['keep', 'none', 'user-entered', 'user-brief'] as const)
          for (const exact of [false, true]) {
            const base = make(); const v = signed(base)
            const d: Data = { ...base, weightSource: ws, provenanceDisplay: 'ai_inferred' }
            if (natural === 'none') d.naturalEffect = undefined
            if (natural === 'user-entered' || natural === 'user-brief') d.naturalEffect = { amount: 2, unit: 'u', perSourceChange: 1, sourceUnit: 'u', strengthMean: v, author: 'user', userOrigin: natural === 'user-brief' ? 'brief' : 'entered' }
            if (stated) d.strengthStated = Math.abs(v)
            if (accepted) d.strengthAccepted = Math.abs(v)
            if (example) d.strengthExampleFigure = v
            if (exact) d.strengthIdentityExact = 'goal'
            yield [`${name}/ws=${ws}/stated=${stated}/acc=${accepted}/ex=${example}/nat=${natural}/exact=${exact}`, d]
          }
  }
}
const CASES = [...corpus()]

describe('PR2a parity corpus', () => {
  it(`covers ${CASES.length} combinations (control: the corpus is not empty and reaches every kind)`, () => {
    expect(CASES.length).toBeGreaterThan(500)
    const kinds = new Set(CASES.map(([, d]) => edgeProvenance(d)?.kind))
    for (const k of Object.keys(EDGE_PROVENANCE)) expect(kinds.has(k as never), k).toBe(true)
  })

  it('unsized gate: old === new, except the DECLARED kinds (definitional, example, exact)', () => {
    const undeclared: string[] = []
    let declared = 0
    for (const [name, d] of CASES) {
      const before = isStrengthPlaceholder(d); const after = isUnsizedRelationship(d)
      if (before === after) continue
      const kind = edgeProvenance(d)?.kind
      if (before && !after && (kind === 'definitional' || kind === 'example' || kind === 'exact')) { declared++; continue }
      undeclared.push(`${name}: ${before} → ${after} (${kind})`)
    }
    expect(undeclared).toEqual([])
    expect(declared, 'control: the declared change is real').toBeGreaterThan(0)
  })

  it('Model-tab attention: old === new, except the DECLARED kinds (placeholder, the user\'s own natural figure)', () => {
    const undeclared: string[] = []
    let declared = 0
    for (const [name, d] of CASES) {
      const example = edgeSizePhrase(d)?.exampleFigure === true
      const before = !isStrengthDefinitional(d) && !isStrengthAccepted(d) && !isStrengthStated(d) && !example
      const after = edgeProvenance(d)?.kind === 'olumi_estimate'
      if (before === after) continue
      const kind = edgeProvenance(d)?.kind
      if (before && !after && (kind === 'placeholder' || kind === 'user' || kind === 'brief' || kind === 'exact' || kind === 'example')) { declared++; continue }
      undeclared.push(`${name}: ${before} → ${after} (${kind})`)
    }
    expect(undeclared).toEqual([])
    expect(declared).toBeGreaterThan(0)
  })
})

describe('Compare sizing checklist (linkSizingStateOf)', () => {
  it('old === new, except the DECLARED cases', () => {
    const undeclared: string[] = []
    let declared = 0
    for (const [name, d] of CASES) {
      const before = edgeValueSourceWeight(d) === 'user' || isStrengthStated(d) ? 'set' : isStrengthAccepted(d) ? 'accepted' : 'not_set'
      const after = linkSizingStateOf([{ source: 'a', target: 'b', data: d }], 'a', 'b')
      if (before === after) continue
      const kind = edgeProvenance(d)?.kind
      // DECLARED: the user's own natural figure (entered or from their brief) is theirs → 'set'; a stated key under a
      // kind that outranks it (placeholder, definition, example, exact) is not the user's size → 'not_set'/'accepted'.
      const ownNatural = after === 'set' && (kind === 'user' || kind === 'brief')
      const outranks = kind === 'placeholder' || kind === 'definitional' || kind === 'example' || kind === 'exact'
      // An acceptance key under an outranking kind: not reachable from the wire (CEE's approval of a placeholder makes it
      // `olumi_accepted`, so `strengthPlaceholderPatch` never stamps both); the classifier's order decides it.
      const outranked = (before === 'set' || before === 'accepted') && outranks
      if (ownNatural || outranked) { declared++; continue }
      undeclared.push(`${name}: ${before} → ${after} (${kind})`)
    }
    expect(undeclared).toEqual([])
    expect(declared).toBeGreaterThan(0)
  })
})

describe('the word table (INACTIVE until Paul approves; Science vocabulary)', () => {
  it('every wording says "relationship", never "link"', () => {
    for (const [k, e] of Object.entries(EDGE_PROVENANCE)) if (e.words !== null) expect(e.words, k).not.toMatch(/\blinks?\b/i)
    expect(EDGE_PROVENANCE.placeholder.words).toMatch(/\brelationship\b/)
  })
})
