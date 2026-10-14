import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCanonicalAnalysisView } from '../canonicalAnalysisView'

// Captured CEE bodies stay byte-unchanged; new wire shapes are test-only mutations.
const served: { canonical_analysis_view: unknown } = JSON.parse(readFileSync(
  'src/canvas/runView/__tests__/fixtures/cee-1c-served-read-464abd0a.json', 'utf8'))
const bodies: Record<string, unknown> & { a_current: { staleness: Record<string, unknown> } } = JSON.parse(readFileSync(
  'src/canvas/runView/__tests__/fixtures/cee-canonical-view-bodies-283b8a98.json', 'utf8'))
const interimLimitation = 'Hash equality cannot detect brief, framing or stage changes.'
const revisionLimitation = 'No analysis hash was available; only the scenario revision was compared.'
const wire = (staleness: Record<string, unknown> = {}) => ({
  ...bodies.a_current,
  staleness: { ...bodies.a_current.staleness, ...staleness },
})

describe('canonical READ run revision wire contract', () => {
  it.each([
    ['cee-1c served READ', served.canonical_analysis_view],
    ...['a_current', 'b_stale_after_edit', 'c_refused_only', 'c2_no_run'].map(key => [key, bodies[key]]),
  ])('still parses today’s captured shape: %s', (_name, body) => {
    const view = parseCanonicalAnalysisView(body)
    expect(view).not.toBeNull()
    expect(view).toEqual(body)
    expect(view?.staleness.run_revision).toBeNull()
    expect(view?.staleness.basis).toBe('analysis_graph_hash_interim')
  })

  it('parses recorded n=7 with source recorded and interim hash basis', () => {
    const body = wire({ run_revision: 7, run_revision_source: 'recorded' })
    expect(parseCanonicalAnalysisView(body)).toEqual(body)
  })

  it('parses the revision basis with its paired limitation', () => {
    const body = wire({ run_revision: 7, run_revision_source: 'recorded',
      basis: 'recorded_run_revision', limitation: revisionLimitation })
    expect(parseCanonicalAnalysisView(body)).toEqual(body)
  })

  it.each([0, 7, Number.MAX_SAFE_INTEGER])('accepts safe non-negative revision %s without a source', run_revision => {
    const body = wire({ run_revision })
    expect(parseCanonicalAnalysisView(body)).toEqual(body)
  })

  it('accepts legacy_unknown only with a null run revision', () => {
    const body = wire({ run_revision: null, run_revision_source: 'legacy_unknown' })
    expect(parseCanonicalAnalysisView(body)).toEqual(body)
  })

  it.each([-1, 1.5, '7', Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, undefined, true])(
    'rejects malformed run revision %s', run_revision => {
      expect(parseCanonicalAnalysisView(wire({ run_revision }))).toBeNull()
    })

  it.each([
    { run_revision: null, run_revision_source: 'recorded' },
    { run_revision: 7, run_revision_source: 'legacy_unknown' },
    { run_revision: 7, run_revision_source: 'unknown' },
    { run_revision: null, run_revision_source: null },
    { run_revision: null, run_revision_source: undefined },
  ])('rejects invalid source/revision combination %j', staleness => {
    expect(parseCanonicalAnalysisView(wire(staleness))).toBeNull()
  })

  it.each([
    { basis: 'analysis_graph_hash_interim', limitation: revisionLimitation },
    { basis: 'recorded_run_revision', limitation: interimLimitation },
    { basis: 'unknown', limitation: interimLimitation },
    { basis: 'recorded_run_revision', limitation: 'unknown' },
  ])('rejects mismatched or unknown basis/limitation %j', staleness => {
    expect(parseCanonicalAnalysisView(wire(staleness))).toBeNull()
  })
})
