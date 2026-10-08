/**
 * GOAL-REACH guided path, DGAI reader (P02; contract LOCKED with CHAT-STABLE 8 Oct 05:0xZ):
 * `guided_sizing { v:1, total, graph_hash, run_key, links:[{id?,from,to,from_label,to_label,order,press:{id,parameters}}],
 * remaining?, progress_line? }` at the turn root (or DGAI's additive sidecar). DGAI renders only what CEE sends: the
 * presses are CEE's, the order is CEE's, and a list whose graph_hash is not the current model's is never shown.
 */
import { describe, it, expect } from 'vitest'
import { readGuidedSizing, guidedSizingForModel } from '../readGuidedSizing'
import { ADDITIVE_EXTENSIONS_KEY } from '../responseParser'

const LINK = (order: number, from: string, to: string) => ({
  id: `e_${from}_${to}`, from, to, from_label: from.toUpperCase(), to_label: to.toUpperCase(), order,
  press: { id: `agent-propose-link-effect:${from}>${to}`, parameters: { from, to } },
})
const GUIDED = {
  v: 1, total: 3, graph_hash: 'abc123', run_key: 'run_1',
  links: [LINK(2, 'price', 'subscribers'), LINK(1, 'starter', 'mrr'), LINK(3, 'churn', 'mrr')],
  remaining: 3, progress_line: '3 more to go; with 1 left, Olumi can show a range.',
}

describe('P02 guided_sizing reader', () => {
  it('reads the root key, ordered by CEE’s `order`, presses carried verbatim', () => {
    const r = readGuidedSizing({ guided_sizing: GUIDED })
    expect(r?.links.map((l) => l.order)).toEqual([1, 2, 3])
    expect(r?.links[0].press).toEqual({ id: 'agent-propose-link-effect:starter>mrr', parameters: { from: 'starter', to: 'mrr' } })
    expect(r?.progressLine).toBe(GUIDED.progress_line)
  })

  it('reads the additive sidecar the same way (DGAI keeps unknown root keys there)', () => {
    expect(readGuidedSizing({ [ADDITIVE_EXTENSIONS_KEY]: { guided_sizing: GUIDED } })?.total).toBe(3)
  })

  it('CONTROL: absent → null (no guided path)', () => {
    expect(readGuidedSizing({})).toBeNull()
  })

  it('fails closed on a malformed list: a link with no press, a non-v1 shape, or duplicate orders → null', () => {
    expect(readGuidedSizing({ guided_sizing: { ...GUIDED, links: [{ ...LINK(1, 'a', 'b'), press: undefined }] } })).toBeNull()
    expect(readGuidedSizing({ guided_sizing: { ...GUIDED, v: 2 } })).toBeNull()
    expect(readGuidedSizing({ guided_sizing: { ...GUIDED, links: [LINK(1, 'a', 'b'), LINK(1, 'c', 'd')] } })).toBeNull()
  })

  it('a list for another model revision is never shown (stale graph_hash) — the current one is', () => {
    const r = readGuidedSizing({ guided_sizing: GUIDED })!
    expect(guidedSizingForModel(r, 'abc123')).toBe(r)
    expect(guidedSizingForModel(r, 'zzz999')).toBeNull()
    expect(guidedSizingForModel(r, null)).toBeNull()
  })
})
