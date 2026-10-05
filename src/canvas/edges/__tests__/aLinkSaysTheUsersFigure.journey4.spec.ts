/**
 * BEAT 1 — A LINK SAYS THE USER'S OWN FIGURE AS THEIRS (Canvas lane, 4 Oct 2026; DL 0df0e1 brief items 3 and 4).
 *
 * Journey 4 (served CEE 24e9b102 / UI 4b7a82ad) stored four of the brief's sizes on links with
 * `provenance.magnitude: 'user_stated'` and `source: 'brief_extraction'` — 2 customers per 1%, −£300 per lost
 * customer, 150 starter subscribers, £49 per subscriber — and the canvas told the user every one was "Olumi's
 * estimate": the hover card and the link inspector read the β's stamp (`weightSource`), which never looks at
 * `magnitude`. The size itself was said only in the Model tab.
 *
 * CORPUS: the SERVED graph, verbatim (`fixtures/journey4ServedGraph.d4e6a8ba.json`, wire capture 09), through the
 * real ingestion mapper (`mapDraftEdgeToCanvas`). Nothing here is hand-written except the two mutants, which are
 * derived from served edges. Every assertion binds a link by its END IDS, never by a label or a value.
 *
 * The fifth sized link (£1,200 per 1%) is stored `olumi_estimate` by CEE's writer — Model Construction's defect, not
 * this lane's — so the canvas truthfully says "Olumi's estimate" of it until that writer is fixed.
 */
import { describe, it, expect } from 'vitest'
import served from './fixtures/journey4ServedGraph.d4e6a8ba.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { edgeSizePhrase } from '../edgeSizePhrase'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'
import { linkStrengthSourceWords } from '../../components/hoverCard/LinkHoverCard'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (served as { graph: { edges: WireEdge[] } }).graph.edges

function wireEdge(from: string, to: string): WireEdge {
  const found = WIRE.filter((e) => e.from === from && e.to === to)
  expect(found, `${from} → ${to} in the served graph`).toHaveLength(1)
  return found[0]
}
function sizeOf(wire: WireEdge) {
  return edgeSizePhrase(mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>)
}

const USERS_FOUR: ReadonlyArray<{ from: string; to: string; figure: RegExp }> = [
  { from: 'existing_price_change_from_today', to: 'existing_customers_lost_from_price_rise', figure: /^Increase of about 2 customers per 1 ?%/ },
  { from: 'existing_customers_lost_from_price_rise', to: 'monthly_recurring_revenue', figure: /^Decrease of about £300 \/ month per 1 customer/ },
  { from: 'starter_tier_availability', to: 'starter_subscribers', figure: /^Increase of about 150 subscribers/ },
  { from: 'starter_subscribers', to: 'monthly_recurring_revenue', figure: /^Increase of about £49 \/ month per 1 subscriber/ },
]
const OLUMIS = { from: 'existing_price_change_from_today', to: 'monthly_recurring_revenue' }

describe('the served journey-4 links say whose size they carry', () => {
  it('PRECONDITION — the corpus is the served graph: 12 links, 5 sized, 4 of them the user\'s', () => {
    expect(WIRE).toHaveLength(12)
    const sized = WIRE.filter((e) => (e.provenance as { natural_effect?: unknown } | undefined)?.natural_effect !== undefined)
    expect(sized).toHaveLength(5)
    expect(sized.filter((e) => (e.provenance as { magnitude?: string }).magnitude === 'user_stated')).toHaveLength(4)
  })

  for (const link of USERS_FOUR) {
    it(`⭐ ${link.from} → ${link.to}: the user's figure, "from your brief"`, () => {
      const size = sizeOf(wireEdge(link.from, link.to))
      expect(size).not.toBeNull()
      expect(size!.size).toMatch(link.figure)
      expect(size!.whose).toBe('from your brief')
      expect(size!.sentence).toBe(`${size!.size} · from your brief`)
      expect(size!.usersFigure).toBe(true)
      expect(size!.sentence).not.toMatch(/Olumi/)
    })
  }

  it("the £1,200 link is stored as Olumi's estimate, and says so (CEE's writer owns that label)", () => {
    const size = sizeOf(wireEdge(OLUMIS.from, OLUMIS.to))
    expect(size).not.toBeNull()
    expect(size!.size).toMatch(/^Increase of about £1,200 \/ month per 1 ?%/)
    expect(size!.whose).toBe("Olumi's estimate")
    expect(size!.usersFigure).toBe(false)
  })

  it('CONTROL — the seven unsized links (option, decision and repair wiring) say no size at all', () => {
    const unsized = WIRE.filter((e) => (e.provenance as { natural_effect?: unknown } | undefined)?.natural_effect === undefined)
    expect(unsized).toHaveLength(7)
    for (const e of unsized) expect(sizeOf(e), `${e.from} → ${e.to}`).toBeNull()
  })

  it('MUTANT — the same served link with its `magnitude` stripped is nobody\'s size: nothing is said (fail closed)', () => {
    const wire = wireEdge('existing_customers_lost_from_price_rise', 'monthly_recurring_revenue')
    const { magnitude: _dropped, ...provenance } = wire.provenance as Record<string, unknown>
    expect(sizeOf({ ...wire, provenance })).toBeNull()
  })

  it('MUTANT — a user size that came from outside the brief reads "your figure", not "from your brief"', () => {
    const wire = wireEdge('starter_subscribers', 'monthly_recurring_revenue')
    const size = sizeOf({ ...wire, provenance: { ...(wire.provenance as object), source: 'user_specified' } })
    expect(size!.whose).toBe('your figure')
  })

  it('MUTANT — a moved β (the stored size no longer describes the strength) is not said: the stale guard holds', () => {
    const wire = wireEdge('starter_subscribers', 'monthly_recurring_revenue')
    const strength = wire.strength as { mean: number; std: number }
    expect(sizeOf({ ...wire, strength: { ...strength, mean: strength.mean + 0.2 } })).toBeNull()
  })
})

describe('the link inspector and the hover card say it in the same words', () => {
  const minus300 = () => sizeOf(wireEdge('existing_customers_lost_from_price_rise', 'monthly_recurring_revenue'))!

  it('⭐ inspector: "From your brief: decrease of about £300 …" — never "Olumi estimated this strength"', () => {
    const sentence = resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee', usersFigure: minus300() })
    expect(sentence).toMatch(/^From your brief: decrease of about £300 \/ month per 1 customer\. Olumi sized this link from it\./)
    expect(sentence).not.toMatch(/Olumi estimated this strength/)
  })

  it('CONTROL — inspector: with no user size, Olumi\'s own strength keeps its sentence', () => {
    expect(resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee' })).toMatch(/^Olumi estimated this strength from your description\./)
    expect(resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee', usersFigure: null })).toMatch(/^Olumi estimated this strength/)
  })

  it('CONTROL — inspector: a user size never relabels a strength the person SET, a template\'s, or a definition', () => {
    expect(resolveEdgeValuesProvenance({ strength: 'user', existence: 'cee', usersFigure: minus300() })).toMatch(/^You set this strength\./)
    expect(resolveEdgeValuesProvenance({ strength: 'template', existence: 'cee', usersFigure: minus300() })).toMatch(/^This strength came with the template/)
    expect(resolveEdgeValuesProvenance({ strength: 'cee', existence: 'cee', strengthDefinitional: true, usersFigure: minus300() }))
      .not.toMatch(/From your brief/)
  })

  it('⭐ hover: a strength sized from the user\'s figure is "from your figure", not "Olumi\'s estimate"', () => {
    expect(linkStrengthSourceWords(false, 'cee', false, true)).toBe('from your figure')
    expect(linkStrengthSourceWords(false, 'cee', false, false)).toBe('Olumi’s estimate')
  })

  it('CONTROL — hover: the user-figure words never override a confirmation, the user\'s own stamp, or a definition', () => {
    expect(linkStrengthSourceWords(true, 'cee', false, true)).toBe('Confirmed by you')
    expect(linkStrengthSourceWords(true, 'user', false, true)).toBe('Set by you')
    expect(linkStrengthSourceWords(false, 'cee', true, true)).toBe('By definition')
  })
})
