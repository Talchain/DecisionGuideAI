/**
 * ⭐ C6-2 — the `BRIEF_READ` stage frame (AIQ ruling #70 5858767026; X5 first-brief latency).
 *
 * CEE copies the user's own GOAL and OPTIONS out of a first brief (each an exact substring of it) and streams them a
 * few seconds into the ~60 s wait. The UI must know the frame BEFORE CEE emits it: `readStageFrames` treats an unknown
 * stage as a malformed frame, abandons the stream and re-sends the turn buffered.
 *
 * The spans below are what gpt-4.1 copied from Paul's brief C in the measurement (#70 5858747922, c62-spans-r1.jsonl).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseStageFrame, streamStageFrames } from '../streamedDraftFrames'
import { consumeStreamedDraftTurn, briefReadingOf } from '../consumeStreamedDraftTurn'
import { useDraftStore } from '../../canvas/stores/draftStore'

const sse = (frame: unknown) => `event: stage\ndata: ${JSON.stringify(frame)}\n\n`
function streamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const GOAL = 'reach £100k MRR within 6 months'
const OPTIONS = [
  'develop new features and increase our Pro plan price from £49 to £59 per month in the next release',
  'invest in additional advertising',
]
const DRAFTING = { stage: 'DRAFTING', seq: 0, status: 'in_progress' }
const BRIEF_READ = { stage: 'BRIEF_READ', seq: 1, status: 'in_progress', goal: GOAL, options: OPTIONS, elapsed_ms: 2400 }
const GRAPH = { nodes: [{ id: 'goal_mrr', kind: 'goal', label: 'MRR' }], edges: [] }
const GRAPH_READY = { stage: 'GRAPH_READY', seq: 2, status: 'in_progress', graph: GRAPH, schema_version: 'v3', elapsed_ms: 41000 }
const COMPLETE = { stage: 'COMPLETE', seq: 3, status: 'complete', status_code: 200, payload: { assistant_text: 'ok', draft_graph: GRAPH } }

const run = (frames: unknown[], handlers: Partial<Parameters<typeof consumeStreamedDraftTurn>[1]> = {}) =>
  consumeStreamedDraftTurn(streamStageFrames(streamingResponse([frames.map(sse).join('')])), {
    onGraphReady: () => {},
    ...handlers,
  })

describe('C6-2 BRIEF_READ on the wire', () => {
  it('RED: a stream carrying BRIEF_READ still reaches COMPLETE, and the reading is handed over once, verbatim', async () => {
    const onBriefRead = vi.fn()
    const out = await run([DRAFTING, BRIEF_READ, GRAPH_READY, COMPLETE], { onBriefRead })
    expect(out.kind, 'an unknown stage would abandon the stream and re-send the turn').toBe('complete')
    expect(onBriefRead).toHaveBeenCalledTimes(1)
    expect(onBriefRead).toHaveBeenCalledWith({ goal: GOAL, options: OPTIONS })
  })

  it('parseStageFrame keeps the goal (a string, or null when the brief states none) and the options', () => {
    expect(parseStageFrame(JSON.stringify(BRIEF_READ))).toMatchObject({ stage: 'BRIEF_READ', goal: GOAL, options: OPTIONS })
    expect(parseStageFrame(JSON.stringify({ ...BRIEF_READ, goal: null }))?.goal).toBeNull()
    expect(parseStageFrame(JSON.stringify({ ...BRIEF_READ, goal: 7 }))?.goal, 'a non-string goal is not carried').toBeUndefined()
  })

  it('strings only: a non-string or blank option is dropped, never coerced; nothing usable means no reading', () => {
    expect(briefReadingOf({ goal: null, options: ['invest in additional advertising', 3, '  ', null] })).toEqual({
      goal: null,
      options: ['invest in additional advertising'],
    })
    expect(briefReadingOf({ goal: '   ', options: [] })).toBeNull()
    expect(briefReadingOf({})).toBeNull()
  })

  it('the model supersedes the reading: a BRIEF_READ after GRAPH_READY is never handed over', async () => {
    const onBriefRead = vi.fn()
    const late = { ...BRIEF_READ, seq: 3 }
    const out = await run([DRAFTING, { ...GRAPH_READY, seq: 2 }, late, { ...COMPLETE, seq: 4 }], { onBriefRead })
    expect(out.kind).toBe('complete')
    expect(onBriefRead).not.toHaveBeenCalled()
  })

  it('a throwing handler never costs the turn', async () => {
    const out = await run([DRAFTING, BRIEF_READ, GRAPH_READY, COMPLETE], {
      onBriefRead: () => {
        throw new Error('display failed')
      },
    })
    expect(out.kind).toBe('complete')
  })
})

describe("draftStore: the reading lives only inside its own turn's drafting phase", () => {
  const READING = { goal: GOAL, options: OPTIONS }
  beforeEach(() => useDraftStore.getState().resetDraft())

  it('the owning turn records it while drafting; another turn cannot', () => {
    useDraftStore.getState().setDraftStreamPhase('drafting', 't1', 'scn-1')
    useDraftStore.getState().markDraftStreamBriefRead('t-other', READING)
    expect(useDraftStore.getState().draftStreamBriefReading).toBeNull()
    useDraftStore.getState().markDraftStreamBriefRead('t1', READING)
    expect(useDraftStore.getState().draftStreamBriefReading).toEqual(READING)
  })

  it('every phase change clears it: the model arriving (settling), the turn ending (idle), a new turn (drafting)', () => {
    for (const next of ['settling', 'idle', 'drafting'] as const) {
      useDraftStore.getState().setDraftStreamPhase('drafting', 't1', 'scn-1')
      useDraftStore.getState().markDraftStreamBriefRead('t1', READING)
      useDraftStore.getState().setDraftStreamPhase(next, next === 'idle' ? null : 't1', next === 'idle' ? null : 'scn-1')
      expect(useDraftStore.getState().draftStreamBriefReading, next).toBeNull()
    }
  })

  it('not recorded once the owning turn has left drafting', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', 'scn-1')
    useDraftStore.getState().markDraftStreamBriefRead('t1', READING)
    expect(useDraftStore.getState().draftStreamBriefReading).toBeNull()
  })
})
