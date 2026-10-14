import { describe, expect, it } from 'vitest'
import { goalChanceDriverLinks as linksWith, goalChanceDriverLinkKey, goalChanceDriverTagAria, GOAL_CHANCE_DRIVER_TAG } from '../goalChanceDriverLinks'
import { parseCanonicalAnalysisView, type CanonicalAnalysisView } from '../../runView/canonicalAnalysisView'

const STRENGTH = {
  quantity_id: 'a->b', kind: 'link_strength', from: 'a', to: 'b', side: 'low', strength: 'weaker',
  authored_by: 'olumi', user_stated_link: false,
}
const EXISTENCE = {
  quantity_id: 'a->b', kind: 'link_existence', from: 'a', to: 'b', side: 'absent',
  pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false,
}
const FACTOR = {
  quantity_id: 'a', kind: 'factor_value', factor_id: 'a', side: 'high', cut_value: 4.1,
  cut_unit: '%', pct_if_side: 40, pct_if_side_rounding: 'whole', authored_by: 'user',
}
function report(drivers: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { run_id: 'run-1', inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
    option_ids: ['o1', 'o2'], pct_by_option: { o1: 62, o2: 41 },
    target: { comparator: 'at_least', value: 120000, unit: '£' }, driver_by_option: drivers, ...extra,
  }] }
}
/**
 * #2747 r2: the tag is drawn only from the CURRENT canonical driver (`RunView.mainDriverOf`). CEE serves the same driver
 * it licensed, for each licensed (not withheld) option; `drivers` overrides what the canonical view names.
 */
function canonicalOf(r: ReturnType<typeof report>, drivers?: Record<string, unknown>): CanonicalAnalysisView | null {
  const licence = r.inference_warnings[0] as Record<string, any>
  const withheld = new Set<string>(licence.withheld_option_ids ?? [])
  const named = drivers ?? licence.driver_by_option
  return parseCanonicalAnalysisView({
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld',
    run: { run_id: r.run_id, graph_hash_at_run: null, computed_at: null },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    options: (licence.option_ids as string[]).map(option_id => ({ option_id, cell: { kind: 'none' },
      main_driver: !withheld.has(option_id) && named[option_id] ? { kind: 'available', driver: named[option_id] } : { kind: 'not_recorded' } })),
  })
}
const goalChanceDriverLinks = (r: ReturnType<typeof report> | null | undefined) =>
  linksWith(r, r === null || r === undefined ? null : canonicalOf(r))

describe('goalChanceDriverLinks — the licensed link identities', () => {
  it('includes the link_strength driver for o1 on a→b', () => {
    expect([...goalChanceDriverLinks(report({ o1: STRENGTH }))]).toEqual([[goalChanceDriverLinkKey('a', 'b'), ['o1']]])
    expect(GOAL_CHANCE_DRIVER_TAG).toBe('Chance rests most on this')
  })

  it('groups two options on the same link in optionIds order, not driver insertion order', () => {
    expect([...goalChanceDriverLinks(report({ o2: STRENGTH, o1: STRENGTH }))])
      .toEqual([[goalChanceDriverLinkKey('a', 'b'), ['o1', 'o2']]])
  })

  it('includes link_existence but omits factor_value on the same report', () => {
    expect([...goalChanceDriverLinks(report({ o1: EXISTENCE, o2: FACTOR }))])
      .toEqual([[goalChanceDriverLinkKey('a', 'b'), ['o1']]])
    expect(goalChanceDriverLinks(report({ o1: FACTOR })).size).toBe(0)
  })

  it('CONTRAST: a→b is present while the reversed b→a identity is absent', () => {
    const links = goalChanceDriverLinks(report({ o1: STRENGTH }))
    expect(links.get(goalChanceDriverLinkKey('a', 'b'))).toEqual(['o1'])
    expect(links.has(goalChanceDriverLinkKey('b', 'a'))).toBe(false)
  })

  it('returns no links for two licence records, null, or undefined', () => {
    const valid = report({ o1: STRENGTH })
    expect(goalChanceDriverLinks({ ...valid, inference_warnings: [...valid.inference_warnings, ...valid.inference_warnings] }).size).toBe(0)
    expect(goalChanceDriverLinks(null).size).toBe(0)
    expect(goalChanceDriverLinks(undefined).size).toBe(0)
  })

  it('returns the same Map instance for the same report and canonical view', () => {
    const valid = report({ o1: STRENGTH })
    const canonical = canonicalOf(valid)
    expect(linksWith(valid, canonical)).toBe(linksWith(valid, canonical))
    expect(goalChanceDriverLinks(report({ o1: STRENGTH }))).not.toBe(linksWith(valid, canonical))
  })

  it('omits absent, unknown and withheld option drivers through the licence reader', () => {
    expect([...goalChanceDriverLinks(report({ o1: STRENGTH, unknown: STRENGTH }))])
      .toEqual([[goalChanceDriverLinkKey('a', 'b'), ['o1']]])
    expect(goalChanceDriverLinks(report({ o2: STRENGTH }, { pct_by_option: { o1: 62 }, withheld_option_ids: ['o2'] })).size).toBe(0)
  })
})

describe('#2747 r2: the tag is drawn only from the gated canonical driver', () => {
  it('no canonical view: no link is tagged, though the licence names a driver', () => {
    expect(linksWith(report({ o1: STRENGTH }), null).size).toBe(0)
  })
  it('CONTRAST: the canonical view records no driver for o1: no tag; the same report with it recorded: tagged', () => {
    const r = report({ o1: STRENGTH })
    expect(linksWith(r, canonicalOf(r, {})).size).toBe(0)
    expect(linksWith(r, canonicalOf(r)).get(goalChanceDriverLinkKey('a', 'b'))).toEqual(['o1'])
  })
  it('a canonical view for another Run: no tag', () => {
    const r = report({ o1: STRENGTH })
    expect(linksWith({ ...r, run_id: 'run-2' }, canonicalOf(r)).size).toBe(0)
  })
})

describe('goalChanceDriverTagAria — exact accessible words', () => {
  it.each([
    [[], 'In this model, an option’s chance of meeting your goal rests most on this link. Open the link.'],
    [['X'], 'In this model, the chance of meeting your goal for ‘X’ rests most on this link. Open the link.'],
    [['X', 'Y'], 'In this model, the chance of meeting your goal for ‘X’ and ‘Y’ rests most on this link. Open the link.'],
    [['X', 'Y', 'Z'], 'In this model, the chance of meeting your goal for ‘X’, ‘Y’ and ‘Z’ rests most on this link. Open the link.'],
  ] as const)('%j', (labels, expected) => {
    expect(goalChanceDriverTagAria(labels)).toBe(expected)
  })
})
