/**
 * THE RELOAD'S EQUALITY PROOF PAIRS EACH LINK WITH ITS OWN (DET-HARM D225/D227; SPEC C13).
 *
 * The proof that the canvas equals the read (it licenses the acknowledgement and the boot run-currency restore)
 * indexed the read's links by pair, first wins, and counted distinct pairs. Once the reload draws both links of the
 * qualitative journey's `ads_before_fix → marketing_disruption` pair, that said `fwd:edge_count canvas=17 read=16`
 * (served J3 read, 29 Oct). It now pairs links by the SAME one-to-one mapping both merges use
 * (`matchEdgesOneToOne`: exact id on the same pair, then pair order) and counts the read's links.
 *
 * ⚠ ISOLATED FROM A SEPARATE MISMATCH, NOT FIXED HERE. The served read sizes no link and states no direction on nine
 * (`mp:decision → delay_update` first), and the proof fails on those on its own: the canvas projects the mapper's
 * defaults, `effect_direction: "positive"` (applyDraftResult.ts:113, projected at buildRegistrationGraph.ts:266) and
 * `strength.mean` ±0.5, and the read carries neither. The first row pins that the served read now gets PAST the count
 * and the pair to that clause. The isolated rows give every link the direction and size the canvas projects, and the
 * two parallel links opposite directions, so a pair-indexed proof would compare one with its sibling and fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
import { logger } from '../../../lib/logger'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import SERVED from '../../utils/__tests__/fixtures/served-qualitative-parallel-links.a3c24d98.read.json'

type ReadEdge = { id: string; from: string; to: string; effect_direction?: string; strength?: { mean: number } }
type Body = Omit<typeof SERVED, '_source'>
const FIRST = 'ads_before_fix__marketing_disruption'
const SECOND = 'ads_before_fix__marketing_disruption__2'

const servedBody = (): Body => structuredClone(Object.fromEntries(Object.entries(SERVED).filter(([k]) => k !== '_source'))) as Body
/** The served read with the separate default mismatch taken out, and the parallel pair pointing opposite ways. */
function isolatedBody(): Body {
  const body = servedBody()
  for (const e of body.graph.edges as ReadEdge[]) {
    if (e.id === SECOND) e.effect_direction = 'negative'
    else if (e.effect_direction === undefined) e.effect_direction = 'positive'
    // The canvas's default size, signed: what it projects for a link the read sizes in words only.
    e.strength = { mean: e.effect_direction === 'negative' ? -0.5 : 0.5 }
  }
  return body
}

let warn: { mock: { calls: unknown[][] } }
/** The proof's first failing clause on the latest reload (`unproven`), or null when the canvas is proven equal. */
function lastUnproven(): string | null | undefined {
  const calls = warn.mock.calls.filter((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined')
  return (calls.at(-1)?.[1] as { unproven?: string | null } | undefined)?.unproven
}
async function reload(body: Body): Promise<string> {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => structuredClone(body) } as unknown as Response))
  return hydrateCanvasFromServer(SERVED.scenario_id)
}
const acknowledged = () => {
  const st = useCanvasStore.getState()
  return isGraphServerAcknowledged(SERVED.scenario_id, st.nodes as never, st.edges as never)
}
const setEdgeData = (id: string, patch: Record<string, unknown>) =>
  useCanvasStore.setState({
    edges: useCanvasStore.getState().edges.map((e) => (e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e)),
  } as never)

beforeEach(() => {
  useCanvasStore.getState().reset()
  __resetPendingFactorEditsForTest()
  // A new browser context: an empty canvas bound to the scenario, nothing between the user and CEE.
  useCanvasStore.setState({
    currentScenarioId: SERVED.scenario_id,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    history: { past: [], future: [] },
  } as never)
  warn = vi.spyOn(logger, 'warn')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('after the J3 cold reload, the proof pairs each of the two parallel links with its own', () => {
  it('the served read gets past the edge count and the parallel pair, to the separate default-direction clause', async () => {
    expect(await reload(servedBody())).toBe('merged')
    expect(useCanvasStore.getState().edges).toHaveLength(17)
    const unproven = lastUnproven()
    expect(unproven).not.toMatch(/edge_count/)
    expect(unproven).not.toMatch(/ads_before_fix/)
    expect(unproven).toBe('fwd:edge:mp:decision\u0000delay_update:effect_direction:read_lacks canvas="positive"')
  })

  it('isolated from that clause: both parallel links prove equal, each to its own, and the canvas is acknowledged', async () => {
    expect(await reload(isolatedBody())).toBe('merged')
    expect(useCanvasStore.getState().edges.filter((e) => e.source === 'ads_before_fix' && e.target === 'marketing_disruption').map((e) => e.id))
      .toEqual([FIRST, SECOND])
    expect(lastUnproven()).toBeNull()
    expect(acknowledged()).toBe(true)
  })

  it('contrast: a genuinely missing link still fails the count', async () => {
    await reload(isolatedBody())
    useCanvasStore.setState({ edges: useCanvasStore.getState().edges.filter((e) => e.id !== SECOND) } as never)
    expect(await reload(isolatedBody())).toBe('unchanged')
    expect(lastUnproven()).toBe('fwd:edge_count canvas=16 read=17')
  })

  it('contrast: a changed effect_direction on a single link still fails', async () => {
    await reload(isolatedBody())
    setEdgeData('repair_time__sync_readiness', { direction: 'positive' })
    expect(await reload(isolatedBody())).toBe('unchanged')
    expect(lastUnproven()).toBe('fwd:edge:repair_time\u0000sync_readiness:effect_direction:differs canvas="positive" read="negative"')
  })

  it('contrast: the parallel links swapped on the canvas fail, because each is compared with its own and never its sibling', async () => {
    await reload(isolatedBody())
    setEdgeData(FIRST, { direction: 'negative' })
    setEdgeData(SECOND, { direction: 'positive' })
    expect(await reload(isolatedBody())).toBe('unchanged')
    expect(lastUnproven()).toBe('fwd:edge:ads_before_fix\u0000marketing_disruption:effect_direction:differs canvas="negative" read="positive"')
  })
})
