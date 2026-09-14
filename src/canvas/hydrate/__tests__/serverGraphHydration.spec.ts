/**
 * hydrateCanvasFromServer — RED-first spec (ROADMAP 2.312 piece 3).
 *
 * The boot orchestration: read the server's graph for the scenario in hand and
 * merge its VALUES onto the local canvas, keeping the local LAYOUT. Every
 * non-200 answer leaves the canvas exactly as it was — a refusal is never a
 * deletion and a blip is never an empty canvas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyV5State } from '../../../v5/applyV5State'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const OTHER_SCENARIO_ID = '99999999-8888-4777-8666-555555555555'
const CEE_TOKEN = 'a'.repeat(63) + '7'
const CEE_TOKEN_2 = 'b'.repeat(63) + '4'

const A_POS = { x: 10, y: 20 }
const B_POS = { x: 300, y: 400 }

function envelope(value = CEE_TOKEN, projection = 'identity.v1') {
  return {
    kind: 'graph_identity_hash',
    value,
    algorithm: 'sha256',
    projection_version: projection,
    graph_schema_version: 'graph_v3',
    normaliser_version: '1',
  }
}

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: {
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
      ],
      edges: [],
    },
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-1',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function seedCanvas(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { ...A_POS },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { ...B_POS },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

function nodeById(id: string): any {
  return useCanvasStore.getState().nodes.find((n: any) => n.id === id)
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hydrateCanvasFromServer — boot WITH a server graph', () => {
  it('hydrates the server’s values and keeps the LOCAL positions', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)
    expect(outcome).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('goal-1').data.value).toBe(9)
    expect(nodeById('factor-1').position).toEqual(A_POS)
    expect(nodeById('goal-1').position).toEqual(B_POS)
  })

  it('stores CEE’s identity token VERBATIM, envelope fields intact', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v1',
    })
  })

  it('MUTANT GUARD — the stored token is CEE’s, never locally recomputed', async () => {
    // The fixture token is a fixed 64-hex string with no relationship to the
    // graph bytes. Any local re-derivation (a hash of the graph, a digest of
    // the JSON, a checksum) produces a different value and fails here.
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().serverGraphIdentity?.value).toBe(CEE_TOKEN)
  })
})

describe('hydrateCanvasFromServer — CEE-to-CEE token comparison only', () => {
  it('skips the merge when CEE returns the SAME token at the SAME projection', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')

    // Local edit after the first hydrate; a second identical read must not
    // silently roll it back — the token says the server has not moved.
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n: any) =>
          n.id === 'factor-1' ? { ...n, data: { ...n.data, value: 777 } } : n,
        ) as never,
    })

    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
    expect(nodeById('factor-1').data.value).toBe(777)
  })

  it('re-merges when CEE issues a DIFFERENT token', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)

    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          graph_identity_hash: envelope(CEE_TOKEN_2),
          graph: {
            nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 42 }],
            edges: [],
          },
        }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(42)
  })

  it('NEVER compares across projection_version — a version change always re-merges', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)

    // Same token VALUE, different projection. The values are not comparable
    // across projections, so equality here must not be trusted.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          graph_identity_hash: envelope(CEE_TOKEN, 'identity.v2'),
          graph: {
            nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 42 }],
            edges: [],
          },
        }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(nodeById('factor-1').data.value).toBe(42)
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual({
      value: CEE_TOKEN,
      projectionVersion: 'identity.v2',
    })
  })

  it('a null token never suppresses a merge', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ graph_identity_hash: null })),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })
})

describe('hydrateCanvasFromServer — refusals never touch the canvas', () => {
  it('404 leaves the canvas EXACTLY as it was — never a deletion', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'NOT_FOUND' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'notReadable',
    )
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
    expect(nodeById('factor-1').data.value).toBe(100)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
  })

  it('200 + graph_present:false leaves the canvas untouched (honest absence)', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: null, graph_present: false, graph_identity_hash: null }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('absent')
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a persistent 503 RETRIES and then leaves the canvas untouched', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(503, { error: 'INTERNAL' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'unavailable',
    )
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a 503 that clears on retry DOES hydrate', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(503, { error: 'INTERNAL' }))
      .mockResolvedValueOnce(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'merged',
    )
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('factor-1').position).toEqual(A_POS)
  })

  it('401 leaves the canvas untouched', async () => {
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'UNAUTHENTICATED' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })).toBe(
      'refused',
    )
    expect(useCanvasStore.getState().nodes).toBe(before)
  })
})

describe('hydrateCanvasFromServer — guards', () => {
  it('makes NO request without a scenario id', async () => {
    expect(await hydrateCanvasFromServer(null)).toBe('skipped')
    expect(await hydrateCanvasFromServer('')).toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('makes NO request for a non-UUID scenario id', async () => {
    expect(await hydrateCanvasFromServer('draft-local-1')).toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('REFUSES a graph whose scenario moved under the in-flight read', async () => {
    // The request is slower than a route change, so an answer can arrive for a
    // scenario the user has already left. Applying it would graft decision A's
    // graph onto decision B's canvas.
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockImplementation(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO_ID } as never)
      return jsonResponse(200, okBody())
    })
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('skipped')
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })
})

describe('hydrateCanvasFromServer — the late-answer deadline (A3)', () => {
  it('gives up on a hung read rather than rolling the canvas back later', async () => {
    // A cold-start answer arriving tens of seconds after boot describes a graph
    // the user has since edited on screen; applying it then is a silent
    // rollback, and the autosave would persist it moments later.
    const before = useCanvasStore.getState().nodes
    fetchSpy.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )
    const outcome = await hydrateCanvasFromServer(SCENARIO_ID, {
      timeoutMs: 5,
      retryDelayMs: 0,
    })
    expect(outcome).toBe('unusable')
    expect(useCanvasStore.getState().nodes).toBe(before)
  })
})

/**
 * ⭐⭐⭐ THE WRITE PRECONDITION A RESTORED SESSION NEEDS BEFORE ITS FIRST EDIT.
 *
 * A manual edit is a compare-and-set: the server refuses unless
 * `computeAnalysisAffectingGraphHash(persistedGraph)` equals the base the client
 * sent. That base reached the client ONLY through a turn response, and a reload
 * runs no turn — so a restored session held none and every FIRST edit was
 * refused. Witnessed natively on 2026-09-09: the editor opened, Cancel correctly
 * sent nothing, and Save honestly sent nothing either.
 *
 * ⚠ WHAT THESE PIN IS THE FENCE, NOT JUST THE HAPPY PATH. A base installed by a
 * read that was refused, aborted, superseded or about another scenario would be
 * a client asserting a precondition for a graph it is not showing — worse than
 * having none, because the server would then accept a write against bytes the
 * user never saw.
 */
describe('hydrateCanvasFromServer — the server write base', () => {
  const WRITE_BASE = '9f2c1b0ae4d37c5a'
  const OTHER_BASE = '1122334455667788'

  function clearBase(): void {
    // Direct, because the setter deliberately never clears: absence→clear would
    // forget a good base on a turn that simply said nothing about the graph.
    useCanvasStore.setState({ lastServerGraphHash: null } as never)
  }

  function base(): string | null {
    return useCanvasStore.getState().lastServerGraphHash
  }

  it('⭐ a MERGED read installs the base for the graph it just applied', async () => {
    clearBase()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ graph_hash: WRITE_BASE })))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(base()).toBe(WRITE_BASE)
  })

  it('⭐ an UNCHANGED read installs it too — and that is the ordinary reload', async () => {
    // "The server has not moved" means the canvas already holds exactly the
    // graph this response describes, so its base is true of what the user is
    // looking at. Skipping here would leave the ordinary restore with no base,
    // which IS the defect.
    clearBase()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(base()).toBeNull()

    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ graph_hash: WRITE_BASE })))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
    expect(base()).toBe(WRITE_BASE)
  })

  it('⚠ a body with NO base leaves the session exactly as it was — fail closed', async () => {
    clearBase()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    // An older CEE. The edit stays refused and says so; nothing is invented.
    expect(base()).toBeNull()
  })

  it('⚠ a REFUSED merge installs nothing — the graph it describes is not on screen', async () => {
    clearBase()
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          graph_hash: WRITE_BASE,
          graph_identity_hash: envelope(CEE_TOKEN_2),
          // Zero node-id overlap with a non-empty canvas — the merge's own
          // load-bearing refusal.
          graph: { nodes: [{ id: 'other-1', kind: 'factor', label: 'Elsewhere' }], edges: [] },
        }),
      ),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    expect(base()).toBeNull()
  })

  /**
   * ⚠⚠ THIS PINS THE OPTION'S CONTRACT, NOT THE BOOT PATH — stated because an
   * earlier version of this file presented it as the superseded-read control
   * and it is not one. The spec supplies `canApply` itself; the real boot caller
   * passes only auth and an abort signal, so this schedule is one no production
   * caller produces. The control that does cover the real schedule is below.
   */
  it('honours an explicit canApply:false — the option means what it says', async () => {
    clearBase()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ graph_hash: OTHER_BASE })))
    expect(
      await hydrateCanvasFromServer(SCENARIO_ID, { canApply: () => false }),
    ).toBe('skipped')
    expect(base()).toBeNull()
  })

  /**
   * ⭐⭐⭐ THE SCHEDULE THE ABORT SIGNAL DOES NOT COVER, and the one an
   * independent review had to find because my own control could not see it.
   *
   * The boot caller passes no `canApply`, and its abort signal tracks scenario,
   * auth and unmount — NOT a same-scenario turn landing while a read is in
   * flight. So: start read A, let a GENUINE turn install hB, then deliver A. Its
   * hA must not replace hB, or the next manual edit sends a superseded
   * precondition and earns a stale refusal from the writer.
   *
   * ⚠ Silently, too: a turn does not touch `serverGraphIdentity`, so the
   * UNCHANGED branch keeps the displayed graph correct while downgrading only
   * the base. Nothing visible moves.
   *
   * The newer base is installed by the REAL applicator, wired as
   * `useConversation` wires it — not by poking the store, which would prove the
   * rule against a fixture rather than against the thing that actually competes
   * with this read.
   */
  it('⭐ a LATE read cannot replace a base a real turn installed while it was in flight', async () => {
    clearBase()

    let deliverA!: (r: Response) => void
    fetchSpy.mockReturnValue(new Promise<Response>(resolve => { deliverA = resolve }))
    const readA = hydrateCanvasFromServer(SCENARIO_ID)
    await Promise.resolve()

    // The genuine competitor: a real turn, through the real applicator.
    const snapshot = useCanvasStore.getState()
    applyV5State(
      {
        response_version: 2,
        assistant_text: 'ok',
        blocks: [],
        suggested_actions: [],
        insights: [],
        stage_indicator: 'analyse',
        graph_hash: OTHER_BASE,
      } as never,
      { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as never,
    )
    expect(base()).toBe(OTHER_BASE)

    // Now A arrives, carrying the base that was current when it was issued.
    deliverA(jsonResponse(200, okBody({ graph_hash: WRITE_BASE })))
    await readA

    // The turn is newer. A late read does not get to undo it.
    expect(base()).toBe(OTHER_BASE)
  })

  it('⭐ DISCRIMINATING TWIN: with NO turn in flight, that same late read DOES install its base', async () => {
    // Without this the rule above would pass against an adoption that never
    // fires — which is the defect this whole change exists to fix.
    clearBase()

    let deliverA!: (r: Response) => void
    fetchSpy.mockReturnValue(new Promise<Response>(resolve => { deliverA = resolve }))
    const readA = hydrateCanvasFromServer(SCENARIO_ID)
    await Promise.resolve()

    deliverA(jsonResponse(200, okBody({ graph_hash: WRITE_BASE })))
    await readA

    expect(base()).toBe(WRITE_BASE)
  })

  it('⚠ an ABSENT graph installs nothing — there is nothing to write against', async () => {
    clearBase()
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ graph: null, graph_present: false, graph_hash: WRITE_BASE })),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).not.toBe('merged')
    expect(base()).toBeNull()
  })

  it('POSITIVE CONTROL: these refusals are about their own cause', async () => {
    // Without this, every assertion above would pass against a hydration that
    // never installs a base at all — which is the state this change exists to
    // end.
    clearBase()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ graph_hash: WRITE_BASE })))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(base()).toBe(WRITE_BASE)
  })
})
