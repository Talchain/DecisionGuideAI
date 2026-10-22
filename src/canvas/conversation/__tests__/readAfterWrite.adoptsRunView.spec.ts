/**
 * The core turn carries no canonical view, so the option cards' served chance cells stayed empty until a reload (served
 * 22 Oct, CEE 4a4c338c: blank cards live, "about 40% chance … in this model" on every card after a reload). The read that
 * confirms THIS Run carries CEE's view: it is adopted for the scenario, as hydration does. Nothing else adopts here.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { checkReadAfterWrite } from '../readAfterWrite'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { leaderTestView } from '../../runView/__tests__/helpers/leaderTestView'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { runViewOf } from '../../runView/runView'
// Served bytes (fixture header): the pressed Run's turn and the read-after-write read that delivered it.
import servedWire from './fixtures/core-run-read-after-write-served.json'

const SAVED = 'c57ba8f34f877fa3bcce4de5c6f40c527f8578e821e04b0b9f4237baf2184d9f'
const RUN = 'c253bb65588667a6213a562667f5ae728532b1a966adfa298cbf222d4673bb63'
const served = leaderTestView({ run_id: RUN }, 'withheld', null)
const read = (view: unknown) => ({ status: 'graph', graph: {}, graphHash: '48e2a1babc59ccfd', contentHash: SAVED, canonicalAnalysisView: view }) as never
const deps = (...answers: unknown[]) => { let i = 0; return { read: (async () => answers[i++]) as never, wait: async () => {} } }

describe('read-after-write adopts the confirmed Run\'s canonical view', () => {
  beforeEach(() => useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }))

  it('⭐ the saved model and THIS Run, current → CEE\'s view is held for the scenario (the cards read it now)', async () => {
    expect(await checkReadAfterWrite('scn', { scenarioRevision: SAVED, runId: RUN }, {}, deps(read(served)))).toBe('confirmed')
    const held = useCanonicalAnalysisViewStore.getState()
    expect([held.scenarioId, held.view?.run?.run_id]).toEqual(['scn', RUN])
  })

  it('CONTRAST: a turn with no Run, or a read that does not deliver this Run, adopts nothing', async () => {
    await checkReadAfterWrite('scn', { scenarioRevision: SAVED, runId: null }, {}, deps(read(served)))
    const other = leaderTestView({ run_id: 'b'.repeat(64) }, 'withheld', null)
    await checkReadAfterWrite('scn', { scenarioRevision: SAVED, runId: RUN }, {}, deps(read(other), read(other)))
    expect(useCanonicalAnalysisViewStore.getState().view).toBeNull()
  })
})


describe('served: the live Run card binds to the adopted view', () => {
  beforeEach(() => useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }))

  it('⭐ the core Run\'s report reads each option\'s served cell once the confirming read is adopted; before it, none', async () => {
    const turn = servedWire.turn as Record<string, any>
    // As applyV5State builds the live report from the core turn's block (no run id on it; CEE's computed_at beside it).
    const report = mapV5AnalysisToReport({ type: 'analysis_result', ...turn.analysis_result } as never, { computedAt: turn.analysis_state.run_state.computed_at })
    const before = runViewOf(report, useCanonicalAnalysisViewStore.getState().view)
    expect(before.servedCellOf('loyalty_card')).toBeNull()

    const read = { status: 'graph', graph: {}, graphHash: turn.analysis_result.computed_against_hash, contentHash: servedWire.read.content_hash,
      canonicalAnalysisView: servedWire.read.canonical_analysis_view } as never
    expect(await checkReadAfterWrite('scn', { scenarioRevision: turn.model.scenario_revision, runId: turn.run.run_id }, {}, deps(read))).toBe('confirmed')
    const after = runViewOf(report, useCanonicalAnalysisViewStore.getState().view)
    const cell = after.servedCellOf('loyalty_card')
    expect(cell?.kind).toBe('figure')
    expect((cell as { face?: string }).face).toMatch(/^‘Start a loyalty card’: about 39% chance of /)
  })
})
