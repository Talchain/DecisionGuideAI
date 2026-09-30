/**
 * R3's candidate-2 witness R8-after FAIL (5909938415): a fresh browser cold-opens `af640d3c` — a CURRENT Run at £60
 * (the user's `raw_value: 60`) under the label "Raise Pro price to £59" — and every Analysis surface read "Raise Pro
 * price to £59 has the highest expected outcome", no "(set to £60)" (#2339). Same cause as the Driver badges
 * (`coldOpenCurrentRunKeepsItsRunCues.spec.ts`): the boot demoted the proven-current Run to `unknown`, and #2339's
 * suffix is gated on `runIsCurrent`. Corpus: the served read, captured byte-for-byte (30 Sep 11:1xZ).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'

const READ = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/served-af640d3c-r8-current.read.json'), 'utf8'))
const SCN = READ.scenario_id as string

// One cold open per file, as a fresh browser does exactly once (see the drivers spec).
let outcome: string
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => READ, headers: new Map() })))
  useCanvasStore.setState({ currentScenarioId: SCN, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null, lastServerGraphHash: null,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, results: { status: 'idle', progress: 0, report: null } } as never)
  outcome = await hydrateCanvasFromServer(SCN, { retryDelayMs: 0 })
})
afterAll(() => { vi.unstubAllGlobals() })

function labels(): Record<string, string> {
  const { result } = renderHook(() => useResultsSectionData())
  return Object.fromEntries((result.current.recommendation?.allOptions ?? []).map((o: { id: string; label: string }) => [o.id, o.label]))
}

describe('R8 on a fresh browser: the current Run at £60 names its level beside "£59"', () => {
  it('PRECONDITION: the served read is a current Run and the option sets the user\'s £60', () => {
    expect(READ.analysis_state.run_state.kind).toBe('complete_current')
    const opt = READ.graph.nodes.find((n: { id: string }) => n.id === 'raise_pro_price_to_59')
    expect(opt.interventions.pro_plan_price.raw_value).toBe(60)
    expect(outcome).toBe('merged')
  })

  it('RED: the results label reads "Raise Pro price to £59 (set to £60…)"; the unedited £54 option is unchanged', () => {
    const l = labels()
    expect(l.raise_pro_price_to_59).toMatch(/^Raise Pro price to £59 \(set to £60/)
    expect(l.raise_pro_price_to_54).toBe('Raise Pro price to £54')
  })
})
