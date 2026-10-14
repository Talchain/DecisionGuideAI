/**
 * ⭐ A FRESH BROWSER'S COLD OPEN OF A CURRENT RUN KEEPS IT CURRENT — the Driver badges survive (P0 5909616965,
 * AIQ rows 5909634999). Measured on served UI `e4d0bee7`, MRR `3b6369b0` (complete_current, 4 driver rows): a fresh
 * browser showed NO "Driver 1 of 1 ranked"; a same-browser reload showed it.
 *
 * Cause: the boot's currency leg PROVES the Run current and writes `fresh`; the read's report is then written through
 * the shared read applier, whose run-completion transition (`noteRunCompletedWithoutVerdict`) demoted it to
 * `unknown · run_completed_without_verdict` — so `useRunCurrency()` stopped saying current and every run cue hid. On a
 * reload the report is already held, the applier dedupes, and `fresh` stood. The currency leg is this read's ONE
 * verdict writer (the applier already gets a no-op `setAnalysisStateV1`); the freshness transition is the same write.
 *
 * Corpus: the served read, captured byte-for-byte (`fixtures/served-3b6369b0-mrr-current.read.json`, 30 Sep 10:5xZ).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useFactorRunCues } from '../../nodes/shared/useFactorRunCues'
import { selectIdentityExactLinks, useIdentityEvaluatedStore } from '../../domain/identityExactLinks'

const READ = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/served-3b6369b0-mrr-current.read.json'), 'utf8'))
const SCN = READ.scenario_id as string

// ONE cold open per file, as a fresh browser does exactly once: a second boot in the same module would meet the first
// boot's verdict as an echo (the reducer's guard), which no real fresh browser ever does.
let outcome: string
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => READ, headers: new Map() })))
  useCanvasStore.setState({ currentScenarioId: SCN, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null, lastServerGraphHash: null,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, results: { status: 'idle', progress: 0, report: null } } as never)
  outcome = await hydrateCanvasFromServer(SCN, { retryDelayMs: 0 })
})
afterAll(() => { vi.unstubAllGlobals() })

function cues(factorId: string) {
  const { result } = renderHook(() => useFactorRunCues(factorId, useNodeDisplayMetadata(factorId, 'factor' as never)))
  return result.current
}

describe('a fresh browser cold-opens a current Run', () => {
  it('PRECONDITION: the served read is a current Run carrying driver rows, and the boot restores it', async () => {
    expect(READ.analysis_state.run_state.kind).toBe('complete_current')
    expect(READ.analysis_result.enrichment.factor_sensitivity.length).toBeGreaterThan(0)
    expect(outcome).toBe('merged')
    expect(useCanvasStore.getState().results.report).not.toBeNull()
  })

  it('RED: the proven-current Run stays current (fresh), so the top factor shows "Driver 1 of 1"', async () => {
    expect((useCanvasStore.getState() as { analysisFreshness: { freshness: string } | null }).analysisFreshness?.freshness).toBe('fresh')
    const c = cues('paying_subscribers')
    expect(c.runCurrency).toBe('current')
    expect(c.driverLine?.rank).toBeTruthy()
  })

  it('CONTROL: an unranked factor gets no driver line (the cue binds to THIS factor\'s rank)', async () => {
    expect(cues('monthly_new_subscribers').driverLine).toBeNull()
  })
})

// IDENTITY-EXACT (#2686 rebuild), on the real path: the served read carries `analysis_identity_evaluated_node_ids:
// ["mrr"]` and MRR = Pro plan monthly price × Paying subscribers. After the cold open, exactly the two operand links
// into MRR read exact; every other link on the board is untouched (contrast).
describe('a fresh browser cold-opens a Run that evaluated an identity', () => {
  it('the operand links into the evaluated MRR identity read exact, and no other link does', () => {
    expect(READ.analysis_identity_evaluated_node_ids).toEqual(['mrr'])
    const s = useCanvasStore.getState()
    const exact = selectIdentityExactLinks(s, useIdentityEvaluatedStore.getState().held)
    const idOf = (source: string, target: string) => s.edges.find(e => e.source === source && e.target === target)?.id
    const words = 'Exact: ‘MRR’ = ‘Pro plan monthly price’ × ‘Paying subscribers’'
    expect(exact.get(idOf('pro_plan_monthly_price', 'mrr')!)).toBe(words)
    expect(exact.get(idOf('paying_subscribers', 'mrr')!)).toBe(words)
    expect(exact.size).toBe(2)
    expect(s.edges.length).toBeGreaterThan(2)
  })
})
