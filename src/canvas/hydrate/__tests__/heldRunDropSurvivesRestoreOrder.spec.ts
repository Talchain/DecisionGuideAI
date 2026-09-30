/**
 * ⛔ R3 5904756210 (oob S2 on `5f8ee46d`): when the boot read lands BEFORE the autosave restore, the drop found nothing
 * held and the restore then put Run 1 back under "Cannot confirm". The read's answer is now recorded per scenario and
 * the restore (`ReactFlowGraph` init) consults it. Fixtures are R3's and the DL's served reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { readSaysHeldRunNotCurrent, __resetHeldRunDroppedByReadForTests } from '../heldRunDroppedByRead'
import STALE from './fixtures/served-6b2b94dd-stale.read.json'
import CURRENT from './fixtures/served-520aab46-cold.read.json'

function serve(read: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(read), { status: 200 })))
}
beforeEach(() => {
  __resetHeldRunDroppedByReadForTests()
  clearImportRegistrationMarkers()
  useCanvasStore.getState().reset()
})
afterEach(() => { vi.unstubAllGlobals(); clearImportRegistrationMarkers() })

describe('the read’s "not current" outlives the order of boot and autosave restore', () => {
  it('RED: a stale read into an EMPTY store (restore not yet run) still records that the held Run is not current', async () => {
    const sid = STALE.scenario_id
    useCanvasStore.setState({ currentScenarioId: sid, serverGraphIdentity: null, lastAuthoritativeGraph: null } as never)
    serve(STALE)
    await hydrateCanvasFromServer(sid)
    expect(useCanvasStore.getState().results?.report ?? null).toBeNull() // nothing was held to drop
    expect(readSaysHeldRunNotCurrent(sid)).toBe(true) // …so the later autosave restore must not bring Run 1 back
    expect(readSaysHeldRunNotCurrent('some-other-scenario')).toBe(false)
  })

  it('CONTROL: a read that vouches for its Run records nothing — the restore proceeds', async () => {
    const sid = CURRENT.scenario_id
    useCanvasStore.setState({ currentScenarioId: sid, serverGraphIdentity: null, lastAuthoritativeGraph: null } as never)
    serve(CURRENT)
    await hydrateCanvasFromServer(sid)
    expect(readSaysHeldRunNotCurrent(sid)).toBe(false)
  })
})
