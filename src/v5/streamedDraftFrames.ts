/**
 * streamedDraftFrames — the wire half of the staged V5 turn consumer
 * (ROADMAP 2.122 / 1.204 M1, POC-DONE step 1).
 *
 * Reads `POST <turn endpoint>/stream` as `text/event-stream` and yields typed
 * stage frames. Nothing here touches the canvas or the store; the two-phase
 * apply lives in `consumeStreamedDraftTurn` and its caller.
 *
 * ── THE CONTRACT (CEE PR #751, live-measured 29 Jul) ──────────────────────
 * Five classes, `event: stage`, JSON `data` with `stage`, `seq` (monotonic
 * from 0) and `status`:
 *
 *   | stage           | seq | status      | payload                              |
 *   |-----------------|-----|-------------|--------------------------------------|
 *   | DRAFTING        |  0  | in_progress | —                                    |
 *   | PROGRESS        |  1  | in_progress | labels[], phase, elapsed_ms          |
 *   | GRAPH_READY     |  2  | in_progress | graph{nodes,edges}, schema_version   |
 *   | COACHING_READY  |  3  | in_progress | coaching_status                      |
 *   | COMPLETE        |  4  | complete    | status_code, payload = buffered body |
 *
 * Live timings on deployed staging (`PHASE0-EVIDENCE-2026-07-28/
 * cee2-live-latency.md`, 3 runs, median): DRAFTING **271 ms**, GRAPH_READY
 * **35.8 s** (spread 33.7–39.9 s), COACHING_READY 59.2 s, COMPLETE 60.9 s.
 * `: heartbeat` comment lines arrive every 10 s with < 3 ms drift per beat.
 *
 * ── PROGRESS IS NOT OBSERVABLE, AND THAT IS RECORDED HERE DELIBERATELY ────
 * Zero PROGRESS frames were seen in any of the three live runs: the route
 * emits the class, nothing feeds it (it needs the Anthropic streaming
 * adapter — #745's inherited LOW, restated as #751's rowed item 5). The type
 * below models it because the wire may carry it tomorrow, but **no product
 * behaviour may depend on it** — which is exactly why the elapsed-time
 * narration table in `DraftLoadingAnimation` still has to exist.
 *
 * ── WHAT IS DELIBERATELY *NOT* IMPLEMENTED ───────────────────────────────
 * #745's consumer rules include "discard the GRAPH_READY graph if COMPLETE
 * carries `salvaged_from_truncation: true`". #751 then established at the
 * bytes that **the streamed frames never carry that field** — its transport
 * header states a client branching on it "would be writing dead code", and it
 * is a rowed gap on the server side. So the discard rule here fires on
 * `status_code >= 400` ONLY. Implementing the salvage rung would be a branch
 * that cannot execute, wearing the costume of a safety guarantee — the
 * guarantee-theatre defect class this programme exists to hunt. When CEE
 * lifts the field onto the frame, add the rung *and its test* together.
 */
import { parseSSELines } from '../lib/sse/parseSSELines'

/** The five stage classes the route emits. Order is the wire's `seq` order. */
export const STAGE_NAMES = [
  'DRAFTING',
  'PROGRESS',
  'GRAPH_READY',
  'COACHING_READY',
  'COMPLETE',
] as const

export type StageName = (typeof STAGE_NAMES)[number]

const STAGE_NAME_SET: ReadonlySet<string> = new Set(STAGE_NAMES)

/** The graph shape a GRAPH_READY frame carries (`schema_version: 'v3'` live). */
export interface StageGraph {
  nodes?: unknown[]
  edges?: unknown[]
}

export interface StageFrame {
  stage: StageName
  /**
   * Monotonic from 0 — but NOT contiguous. See the header's note on PROGRESS:
   * `seq 1` is never emitted on the live wire, so the normal sequence is
   * 0, 2, 3, 4 and a strict "+1" check would reject every healthy stream.
   */
  seq: number
  status: 'in_progress' | 'complete'
  /** GRAPH_READY only. */
  graph?: StageGraph
  schema_version?: string
  elapsed_ms?: number
  /** PROGRESS only — modelled, never observed on the wire. See the header. */
  labels?: unknown[]
  phase?: string
  /** COACHING_READY only. Enum, not prose. */
  coaching_status?: string
  /** COMPLETE only. `payload` is the buffered turn body VERBATIM. */
  status_code?: number
  payload?: unknown
}

/**
 * Every way the stream can end without a usable COMPLETE frame. Each maps to
 * the same product behaviour (transparent fallback to the buffered turn) but
 * they are distinguished because the diagnostics and the tests need them apart.
 */
export type StreamAbandonReason =
  | 'http_error'
  | 'no_body'
  | 'transport'
  | 'silence'
  | 'malformed_frame'
  | 'seq_not_monotonic'
  | 'no_terminal_frame'
  | 'aborted'

export class StreamAbandonedError extends Error {
  readonly name = 'StreamAbandonedError'
  constructor(
    readonly reason: StreamAbandonReason,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

/**
 * The server's heartbeat cadence, from CEE `config/timeouts.ts`
 * (`SSE_HEARTBEAT_INTERVAL_MS`) and confirmed on the wire at
 * 10.219/20.218/30.218/40.219/50.222/60.222 s.
 */
export const SERVER_HEARTBEAT_INTERVAL_MS = 10_000

/**
 * How long the client tolerates total dead air — no frame, no heartbeat, no
 * byte — before abandoning the stream.
 *
 * DERIVED from the server cadence rather than typed as a second magic number:
 * three consecutive missed beats. Deliberately NOT an elapsed-time deadline
 * on the turn: the cold-start GRAPH_READY spread reached 39.9 s and a p99 turn
 * has no upper bound the client can know, so any wall-clock cut-off would kill
 * healthy slow draws. The outer 130 s `EXTENDED_TIMEOUT_MS` (which exists to
 * outlive CEE's own 125 s proxy budget) remains the only elapsed-time guard.
 */
export const STREAM_SILENCE_TIMEOUT_MS = SERVER_HEARTBEAT_INTERVAL_MS * 3

/**
 * Decode one SSE `data:` payload into a validated frame.
 *
 * Returns `null` — never throws, never fills in a default — for anything that
 * is not a complete, well-formed frame. A frame with a guessed `seq` would
 * defeat the monotonicity check, and a frame with a guessed `stage` would let a
 * new server stage be silently swallowed.
 */
export function parseStageFrame(raw: string): StageFrame | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null
  const obj = decoded as Record<string, unknown>

  const stage = obj.stage
  if (typeof stage !== 'string' || !STAGE_NAME_SET.has(stage)) return null

  const seq = obj.seq
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null

  const status = obj.status
  if (status !== 'in_progress' && status !== 'complete') return null

  const frame: StageFrame = { stage: stage as StageName, seq, status }

  const graph = obj.graph
  if (typeof graph === 'object' && graph !== null && !Array.isArray(graph)) {
    frame.graph = graph as StageGraph
  }
  if (typeof obj.schema_version === 'string') frame.schema_version = obj.schema_version
  if (typeof obj.elapsed_ms === 'number') frame.elapsed_ms = obj.elapsed_ms
  if (Array.isArray(obj.labels)) frame.labels = obj.labels
  if (typeof obj.phase === 'string') frame.phase = obj.phase
  if (typeof obj.coaching_status === 'string') frame.coaching_status = obj.coaching_status
  if (typeof obj.status_code === 'number') frame.status_code = obj.status_code
  if ('payload' in obj) frame.payload = obj.payload

  return frame
}

/**
 * Read an already-opened SSE `Response` and yield stage frames as they arrive.
 *
 * Yields on arrival, one frame at a time — a caller that renders inside the
 * loop renders at the frame's wire timestamp. That is the whole point of the
 * lane, so this function must never buffer to completion.
 */
export async function* streamStageFrames(
  res: Response,
  opts: { silenceTimeoutMs?: number } = {},
): AsyncGenerator<StageFrame> {
  if (!res.ok) {
    throw new StreamAbandonedError(
      'http_error',
      `streamed turn returned HTTP ${res.status}`,
      res.status,
    )
  }
  if (!res.body) {
    throw new StreamAbandonedError('no_body', 'streamed turn response carried no body')
  }

  const silenceMs = opts.silenceTimeoutMs ?? STREAM_SILENCE_TIMEOUT_MS
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let lastSeq = -1
  let sawTerminal = false
  let silenceTimer: ReturnType<typeof setTimeout> | undefined

  /** Rejects when the socket has been silent for the budget. */
  const armSilence = () =>
    new Promise<never>((_resolve, reject) => {
      silenceTimer = setTimeout(
        () =>
          reject(
            new StreamAbandonedError(
              'silence',
              `no bytes for ${silenceMs}ms (server heartbeats every ${SERVER_HEARTBEAT_INTERVAL_MS}ms)`,
            ),
          ),
        silenceMs,
      )
    })

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      const silence = armSilence()
      try {
        chunk = await Promise.race([reader.read(), silence])
      } catch (e) {
        if (e instanceof StreamAbandonedError) throw e
        const err = e as Error
        if (err?.name === 'AbortError') {
          throw new StreamAbandonedError('aborted', 'streamed turn aborted')
        }
        throw new StreamAbandonedError('transport', `stream read failed: ${err?.message ?? 'unknown'}`)
      } finally {
        clearTimeout(silenceTimer)
        // Keep the losing rejection from surfacing as an unhandled rejection
        // once the read has won the race.
        void silence.catch(() => {})
      }

      const done = chunk.done
      if (chunk.value) buffer += decoder.decode(chunk.value, { stream: !done })

      // Split on the LAST newline so a frame cut mid-JSON across TCP segments
      // (measured: GRAPH_READY arrived as eight sub-frame segments) stays in
      // the buffer until it is whole.
      const cut = buffer.lastIndexOf('\n')
      const ready = done ? buffer : cut >= 0 ? buffer.slice(0, cut + 1) : ''
      if (!done && cut >= 0) buffer = buffer.slice(cut + 1)
      else if (done) buffer = ''

      if (ready.length > 0) {
        const { events } = parseSSELines(ready.split('\n'), done)
        for (const ev of events) {
          const frame = parseStageFrame(ev.data)
          if (!frame) {
            throw new StreamAbandonedError(
              'malformed_frame',
              `undecodable stage frame (event: ${ev.eventType || '<none>'})`,
            )
          }
          // MONOTONICITY, not contiguity — and the distinction is measured, not
          // stylistic. #745's consumer rules say "`seq` monotonic ⇒ a dropped
          // frame is detectable", and an earlier version of this comment
          // repeated that as if this check detected GAPS. It does not, and it
          // must not: PROGRESS (`seq 1`) is never emitted on the live wire
          // (zero observed across three runs), so 0 -> 2 is the ORDINARY
          // sequence and a contiguity check would reject every healthy stream.
          // What a repeated or backwards `seq` does prove is a duplicated or
          // re-ordered frame, which is a real transport fault.
          if (frame.seq <= lastSeq) {
            throw new StreamAbandonedError(
              'seq_not_monotonic',
              `seq went backwards or repeated: ${lastSeq} -> ${frame.seq}`,
            )
          }
          lastSeq = frame.seq
          if (frame.status === 'complete') sawTerminal = true
          yield frame
          if (sawTerminal) return
        }
      }

      if (done) break
    }

    if (!sawTerminal) {
      throw new StreamAbandonedError(
        'no_terminal_frame',
        `stream closed after seq ${lastSeq} without a terminal frame`,
      )
    }
  } finally {
    clearTimeout(silenceTimer)
    try {
      await reader.cancel()
    } catch {
      // Cancelling an already-errored or already-closed reader is not a failure.
    }
  }
}
