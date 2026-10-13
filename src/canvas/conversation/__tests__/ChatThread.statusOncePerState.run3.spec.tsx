/**
 * ⭐ Run-3 judge U2 (live/runs/2026-10-12T153555Z; UI a9a5c26f, CEE 3fdf0f38), DL ruling (b): CEE prefixes the same status
 * headline and bullets to every reply in one model state, and the thread drew them on every reply ("Not shown: some
 * relationships aren't sized yet" / "Olumi's estimates: 11, see Check estimates." on hiring steps 3, 3 and 7). They are
 * drawn ONCE per state; a reply in a NEW state always shows them again.
 *
 * The fixture is the three served replies (hiring turns 03, 04 and 07, answer shape and state only): 03 and 04 share
 * one state (graph 115f6121…, run 15:37:51Z); 07 is a new one (graph 9673b6fc…, run 15:40:48Z) with the same status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import served from './fixtures/run3-hiring-status-turns.json'
import { answerStateKeyOf } from '../answerShape'
import { clearAllTranscripts } from '../utils/transcriptStore'

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector({ nodes: [], edges: [] }),
    { getState: () => ({ nodes: [], edges: [] }), setState: vi.fn(), subscribe: vi.fn() },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => any) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  clearAllTranscripts()
})

type Turn = (typeof served.turns)[number]
const [T03, T04, T07] = served.turns as Turn[]
const STATUS = T03._answer_shape.headline
const ESTIMATES = T03._answer_shape.bullets[0]


describe('U2: CEE\'s repeated status is drawn once per model state', () => {
  it('CONTROL: 03 and 04 share one state, 07 is a new one, and all three open with the same status', () => {
    expect(answerStateKeyOf(T03)).toBe(answerStateKeyOf(T04))
    expect(answerStateKeyOf(T07)).not.toBe(answerStateKeyOf(T03))
    expect([T03, T04, T07].map(t => t._answer_shape.headline)).toEqual([STATUS, STATUS, STATUS])
    expect([T03, T04, T07].map(t => t._answer_shape.bullets[0])).toEqual([ESTIMATES, ESTIMATES, ESTIMATES])
  })

  it('a new run on the same graph is a new state (hiring turns 06 → 07 kept graph 9673b6fc…), and no graph hash is no state', () => {
    const at = (graph_hash: string | undefined, computed_at?: string) => ({ graph_hash, analysis_state: computed_at ? { run_state: { computed_at } } : null })
    expect(answerStateKeyOf(at('9673b6fc2adfbee3', '2026-10-12T15:37:51.321Z'))).not.toBe(answerStateKeyOf(at('9673b6fc2adfbee3', '2026-10-12T15:40:48.373Z')))
    expect(answerStateKeyOf(at('9673b6fc2adfbee3'))).toBe('9673b6fc2adfbee3|no-run')
    expect(answerStateKeyOf(at(undefined, '2026-10-12T15:40:48.373Z'))).toBeNull()
  })

})
