/**
 * Frame-contract parser + stream reader for the staged V5 turn (ROADMAP 2.122).
 *
 * The contract under test is CEE PR #751's, banked in
 * `PHASE0-EVIDENCE-2026-07-28/m1l2-draft-consumer.md` §"Frame contract" and
 * live-measured in `cee2-live-latency.md`. Every fixture here is shaped from
 * that live wire capture, not invented:
 *
 *   event: stage
 *   data: {"stage":"DRAFTING","seq":0,"status":"in_progress"}
 *
 * plus `: heartbeat` comment lines every 10 s (13 bytes, measured drift < 3 ms
 * per beat over a minute) which carry no frame but DO prove liveness.
 */
import { describe, it, expect, vi } from 'vitest'

import {
  parseStageFrame,
  streamStageFrames,
  StreamAbandonedError,
  STREAM_SILENCE_TIMEOUT_MS,
  SERVER_HEARTBEAT_INTERVAL_MS,
} from '../streamedDraftFrames'

// ---------------------------------------------------------------------------
// Wire fixtures — shaped from the 29 Jul live capture (cee2-live-latency.md)
// ---------------------------------------------------------------------------

const DRAFTING = { stage: 'DRAFTING', seq: 0, status: 'in_progress' }
const GRAPH_READY = {
  stage: 'GRAPH_READY',
  seq: 2,
  status: 'in_progress',
  schema_version: 'v3',
  elapsed_ms: 35_834,
  graph: {
    nodes: [
      { id: 'goal_1', kind: 'goal', label: 'Choose a billing system' },
      { id: 'opt_build', kind: 'option', label: 'Build in-house' },
    ],
    edges: [{ from: 'opt_build', to: 'goal_1' }],
  },
}
const COACHING_READY = {
  stage: 'COACHING_READY',
  seq: 3,
  status: 'in_progress',
  coaching_status: 'partial',
}
const COMPLETE = {
  stage: 'COMPLETE',
  seq: 4,
  status: 'complete',
  status_code: 200,
  payload: { response_version: 2, assistant_text: 'ok' },
}

function sseEvent(frame: unknown): string {
  return `event: stage\ndata: ${JSON.stringify(frame)}\n\n`
}

/** A `Response` whose body streams the supplied chunks in order. */
function streamingResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init,
  })
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const v of it) out.push(v)
  return out
}

describe('parseStageFrame — the frame contract, defensively', () => {
  it('parses every one of the five stage classes off the wire shape', () => {
    for (const frame of [DRAFTING, GRAPH_READY, COACHING_READY, COMPLETE]) {
      const parsed = parseStageFrame(JSON.stringify(frame))
      expect(parsed).not.toBeNull()
      expect(parsed!.stage).toBe(frame.stage)
      expect(parsed!.seq).toBe(frame.seq)
      expect(parsed!.status).toBe(frame.status)
    }
  })

  it('carries the GRAPH_READY graph through verbatim', () => {
    const parsed = parseStageFrame(JSON.stringify(GRAPH_READY))
    expect(parsed!.graph?.nodes).toHaveLength(2)
    expect(parsed!.graph?.edges).toHaveLength(1)
    expect(parsed!.schema_version).toBe('v3')
  })

  it('returns null — never throws, never guesses — on malformed data', () => {
    expect(parseStageFrame('not json at all')).toBeNull()
    expect(parseStageFrame('')).toBeNull()
    expect(parseStageFrame('[]')).toBeNull()
    expect(parseStageFrame('null')).toBeNull()
  })

  it('rejects a frame missing any contract field rather than defaulting it', () => {
    expect(parseStageFrame(JSON.stringify({ seq: 0, status: 'in_progress' }))).toBeNull()
    expect(parseStageFrame(JSON.stringify({ stage: 'DRAFTING', status: 'in_progress' }))).toBeNull()
    expect(parseStageFrame(JSON.stringify({ stage: 'DRAFTING', seq: 0 }))).toBeNull()
  })

  it('rejects an unknown stage name — a new server stage must not be silently swallowed', () => {
    expect(
      parseStageFrame(JSON.stringify({ stage: 'ENRICHING', seq: 1, status: 'in_progress' })),
    ).toBeNull()
  })

  it('rejects a non-integer or negative seq (monotonicity is only checkable on integers)', () => {
    expect(parseStageFrame(JSON.stringify({ stage: 'DRAFTING', seq: 1.5, status: 'in_progress' }))).toBeNull()
    expect(parseStageFrame(JSON.stringify({ stage: 'DRAFTING', seq: -1, status: 'in_progress' }))).toBeNull()
  })
})

describe('streamStageFrames — reading the live wire shape', () => {
  it('yields the five frames in order from a single coalesced chunk', async () => {
    const res = streamingResponse([
      sseEvent(DRAFTING) + sseEvent(GRAPH_READY) + sseEvent(COACHING_READY) + sseEvent(COMPLETE),
    ])
    const frames = await collect(streamStageFrames(res))
    expect(frames.map((f) => f.stage)).toEqual([
      'DRAFTING',
      'GRAPH_READY',
      'COACHING_READY',
      'COMPLETE',
    ])
  })

  it('yields a frame that arrived split across TCP chunks mid-JSON', async () => {
    // The live capture forwarded the 10,471-byte GRAPH_READY frame as EIGHT
    // ~1,369-byte sub-frame segments. A reader that assumed one chunk == one
    // frame would drop it.
    const whole = sseEvent(GRAPH_READY)
    const mid = Math.floor(whole.length / 2)
    const res = streamingResponse([sseEvent(DRAFTING), whole.slice(0, mid), whole.slice(mid), sseEvent(COMPLETE)])
    const frames = await collect(streamStageFrames(res))
    expect(frames.map((f) => f.stage)).toEqual(['DRAFTING', 'GRAPH_READY', 'COMPLETE'])
    expect(frames[1].graph?.nodes).toHaveLength(2)
  })

  it('treats `: heartbeat` comment lines as liveness, not as frames', async () => {
    const res = streamingResponse([
      sseEvent(DRAFTING),
      ': heartbeat\n\n',
      ': heartbeat\n\n',
      sseEvent(COMPLETE),
    ])
    const frames = await collect(streamStageFrames(res))
    expect(frames.map((f) => f.stage)).toEqual(['DRAFTING', 'COMPLETE'])
  })

  it('abandons with `malformed_frame` on undecodable frame data', async () => {
    const res = streamingResponse([sseEvent(DRAFTING), 'event: stage\ndata: {oh dear\n\n'])
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({
      name: 'StreamAbandonedError',
      reason: 'malformed_frame',
    })
  })

  it('abandons with `http_error` when the response is not a 2xx', async () => {
    const res = new Response('nope', { status: 502 })
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({
      reason: 'http_error',
      httpStatus: 502,
    })
  })

  it('abandons with `no_body` when the response carries no readable body', async () => {
    const res = { ok: true, status: 200, body: null } as unknown as Response
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({ reason: 'no_body' })
  })

  it('surfaces a mid-stream transport error as `transport`', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseEvent(DRAFTING)))
        controller.error(new Error('socket hung up'))
      },
    })
    const res = new Response(body, { status: 200 })
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({ reason: 'transport' })
  })
})

describe('the silence watchdog — abort on silence, never on elapsed time', () => {
  it('derives its budget from the measured server heartbeat interval', () => {
    // The route heartbeats every SSE_HEARTBEAT_INTERVAL_MS = 10 s (CEE
    // config/timeouts.ts:977), live-observed at 10.219/20.218/30.218/40.219/
    // 50.222/60.222 s. The client budget must be a MULTIPLE of that, so it is
    // derived from it rather than typed as a second magic number (trap 12).
    expect(SERVER_HEARTBEAT_INTERVAL_MS).toBe(10_000)
    expect(STREAM_SILENCE_TIMEOUT_MS % SERVER_HEARTBEAT_INTERVAL_MS).toBe(0)
    expect(STREAM_SILENCE_TIMEOUT_MS / SERVER_HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(3)
  })

  it('abandons with `silence` when no bytes arrive for the budget', async () => {
    vi.useFakeTimers()
    try {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseEvent(DRAFTING)))
          // Never closes and never enqueues again — dead air. The generator's
          // own `finally` cancels the reader, which closes it for us.
        },
      })
      const res = new Response(body, { status: 200 })
      const frames: unknown[] = []
      const run = (async () => {
        for await (const f of streamStageFrames(res)) frames.push(f)
      })()
      const settled = run.then(
        () => ({ ok: true as const }),
        (e) => ({ ok: false as const, e }),
      )
      // Let the first frame land, then run the clock past the silence budget.
      await vi.advanceTimersByTimeAsync(1)
      await vi.advanceTimersByTimeAsync(STREAM_SILENCE_TIMEOUT_MS + 10)
      const outcome = await settled
      expect(outcome.ok).toBe(false)
      expect((outcome as { e: StreamAbandonedError }).e.reason).toBe('silence')
      expect(frames).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT abandon a long turn that keeps heartbeating past the budget', async () => {
    // A 61 s turn with 10 s beats must survive. This is the pin that stops
    // anyone "simplifying" the silence watchdog into an elapsed-time deadline —
    // the cold-start GRAPH_READY spread reached 39.9 s.
    vi.useFakeTimers()
    try {
      const encoder = new TextEncoder()
      let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controllerRef = controller
          controller.enqueue(encoder.encode(sseEvent(DRAFTING)))
        },
      })
      const res = new Response(body, { status: 200 })
      const frames: string[] = []
      const run = (async () => {
        for await (const f of streamStageFrames(res)) frames.push(f.stage)
      })()
      const settled = run.then(
        () => ({ ok: true as const }),
        (e) => ({ ok: false as const, e }),
      )
      await vi.advanceTimersByTimeAsync(1)
      // Six 10 s beats = 60 s of wall clock, twice the silence budget.
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(SERVER_HEARTBEAT_INTERVAL_MS)
        controllerRef!.enqueue(encoder.encode(': heartbeat\n\n'))
        await vi.advanceTimersByTimeAsync(1)
      }
      controllerRef!.enqueue(encoder.encode(sseEvent(COMPLETE)))
      controllerRef!.close()
      await vi.advanceTimersByTimeAsync(1)
      const outcome = await settled
      expect(outcome.ok).toBe(true)
      expect(frames).toEqual(['DRAFTING', 'COMPLETE'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('seq — MONOTONICITY, and deliberately not contiguity', () => {
  it('ACCEPTS the live sequence 0, 2, 3, 4 — PROGRESS (seq 1) never arrives', async () => {
    // The control that keeps the check from being tightened into something that
    // rejects every healthy stream. Zero PROGRESS frames were observed across
    // three live runs (cee2-live-latency.md honest note 4), so a "+1" contiguity
    // rule would abandon every real draft at the GRAPH_READY frame.
    const res = streamingResponse([
      sseEvent(DRAFTING) + sseEvent(GRAPH_READY) + sseEvent(COACHING_READY) + sseEvent(COMPLETE),
    ])
    const frames = await collect(streamStageFrames(res))
    expect(frames.map((f) => f.seq)).toEqual([0, 2, 3, 4])
  })

  it('abandons on a REPEATED seq — a duplicated frame is a transport fault', async () => {
    const res = streamingResponse([sseEvent(DRAFTING), sseEvent({ ...DRAFTING, stage: 'PROGRESS' })])
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({
      reason: 'seq_not_monotonic',
    })
  })

  it('abandons on a BACKWARDS seq — a re-ordered frame is a transport fault', async () => {
    const res = streamingResponse([
      sseEvent(GRAPH_READY),
      sseEvent(DRAFTING),
    ])
    await expect(collect(streamStageFrames(res))).rejects.toMatchObject({
      reason: 'seq_not_monotonic',
    })
  })

  it('the abandonment carries the two seq values, so the fault is diagnosable', async () => {
    const res = streamingResponse([sseEvent(GRAPH_READY), sseEvent(DRAFTING)])
    await expect(collect(streamStageFrames(res))).rejects.toThrow(/2 -> 0/)
  })
})
