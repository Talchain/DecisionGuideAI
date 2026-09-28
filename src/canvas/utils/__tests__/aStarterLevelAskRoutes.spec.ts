/**
 * The pricing starter's FIRST screen, served 28 Sep 2026 on UI `79f5c52c` (fixture = the real
 * `/bff/cee/graph-readiness` body, trace removed): no turn has run, so there is no turn verdict,
 * and the gate composed ONE sentence from the side-car — "What is X today…? … What is Y today…?"
 * with no route. The side-car's `readiness_issues[]` carry each factor's id, so each owed repair
 * is now its own row that routes to its factor (`readinessAuthoredRefusalItems`, the existing
 * scope rule). Same authority, same refusal; only the explanation routes.
 */
import { describe, expect, it } from 'vitest'

import { canRunAnalysis } from '../canRunAnalysis'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import SERVED from './fixtures/served-starter-level-ask.graph-readiness.79f5c52c.json'

const gate = (readinessStale = false) =>
  canRunAnalysis({
    graphHealth: null,
    readiness: SERVED as unknown as GraphReadiness,
    hasBlockers: false,
    nodeCount: 13,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    optionsNeedingValues: [],
    readinessStale,
  })

describe('a starter with no turn yet: each owed level routes to its factor', () => {
  it('⭐ refused, one row per owed issue, each scoped to the producer’s factor id', () => {
    const r = gate()
    expect(r.allowed).toBe(false)
    const owed = SERVED.readiness_issues.filter((i: { obligation?: string }) => i.obligation !== 'offered')
    const rows = r.blockedListing?.sentences ?? []
    expect(rows.map((s) => s.scope?.id)).toEqual(owed.map((i: { factor_id: string }) => i.factor_id))
    expect(rows[0].text).toMatch(/^What is "Competitive Pressure for Usage Pricing" today/)
  })

  it('CONTROL: a stale verdict keeps the composed sentence and routes nothing (unchanged)', () => {
    const r = gate(true)
    expect(r.allowed).toBe(false)
    expect((r.blockedListing?.sentences ?? []).every((s) => s.scope === undefined)).toBe(true)
  })
})
