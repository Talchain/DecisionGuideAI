/**
 * ⛔ DL #75 5904550441 (signed-in `520aab46`, UI `6dcb3b10` · CEE `622c8a0`): a signed-in cold open showed "Run a first
 * pass" / "No analysis results yet" over a CURRENT saved Run. The Run was saved at 02:25Z; CEE #2337 (05:00Z) then put
 * `proposed_by: 'olumi'` on `raise_to_54` in the graph read. The boot merge counted acquiring that provenance as a
 * model edit, so the Run read as edited since the read. Reproduced identically on the pre-#2329 base `13d877aa`.
 * Fixture: the DL's served cold read (`signedin-w3/w-622c8a0/cold-read.json`), not authored here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import READ from './fixtures/served-520aab46-cold.read.json'
import { NODE_ACQUIRED_METADATA_KEYS } from '../../utils/mergeServerGraph'
import { STALE_NODE_FIELDS } from '../../domain/analyticalNodeFields'

const SID = READ.scenario_id

beforeEach(() => {
  clearImportRegistrationMarkers()
  useCanvasStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: SID, serverGraphIdentity: null, lastAuthoritativeGraph: null } as never)
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(READ), { status: 200 })))
})
afterEach(() => { vi.unstubAllGlobals(); clearImportRegistrationMarkers() })

/** Boot once (the Run adopted), then make the canvas the OLDER snapshot and boot again, as a signed-in open does. */
async function bootOverOlderSnapshot(edit: (data: Record<string, unknown>, id: string) => Record<string, unknown>): Promise<void> {
  expect(await hydrateCanvasFromServer(SID)).toBe('merged')
  expect(useCanvasStore.getState().results?.report).toBeTruthy() // positive control: the Run is shown
  const st = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: st.nodes.map((n) => ({ ...n, data: edit({ ...(n.data as Record<string, unknown>) }, n.id) })),
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
  } as never)
  await hydrateCanvasFromServer(SID)
}

describe('an older snapshot that lacks producer provenance the read now carries', () => {
  it('RED: acquiring `proposed_by` (+ `threshold_source`, `goal_threshold_cap_provenance`) is not an edit — the saved Run stays shown', async () => {
    await bootOverOlderSnapshot((d) => { for (const k of NODE_ACQUIRED_METADATA_KEYS) delete d[k]; return d })
    const s = useCanvasStore.getState()
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(s.graphEditedSinceLastRun).toBe(false)
    expect(s.results?.report).toBeTruthy()
    expect(s.hasCompletedFirstRun).toBe(true)
  })

  it('BOUNDARY (AIQ 5904679135): no masked key is in the analysis-affecting (stale) set the server hash reads', () => {
    for (const k of NODE_ACQUIRED_METADATA_KEYS) expect(STALE_NODE_FIELDS).not.toContain(k)
    expect(STALE_NODE_FIELDS).toContain('interventions') // contrast: the set is read, not empty
  })

  it('CONTROL: a real value difference (an option intervention) is still an edit', async () => {
    await bootOverOlderSnapshot((d, id) => {
      if (id !== 'raise_to_59') return d
      const iv = d.interventions as Record<string, unknown>
      const k = Object.keys(iv)[0]
      const v = iv[k] as Record<string, unknown> | number
      return { ...d, interventions: { ...iv, [k]: typeof v === 'number' ? v + 1 : { ...v, value: Number((v as { value?: number }).value ?? 0) + 1 } } }
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})
