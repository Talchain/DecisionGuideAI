/**
 * #2747 r2 (fresh check r1, BLOCKING 3): a chat card names its Run by IDENTITY. The turn that carried the analysis block
 * also carried its own canonical view; the card is stamped with that view's run id only when that Run's graph hash is the
 * card's own (`turnCanonicalRunOf`). Three Runs of one graph share the hash, so the hash alone never names the Run.
 */
import { describe, expect, it } from 'vitest'
import { mapV5Blocks } from '../mapV5Blocks'
import { turnCanonicalRunOf } from '../../applyV5State'

const BLOCK = { type: 'analysis_result', summary: 's', leading_option_id: null, enrichment: {}, computed_against_hash: 'h1' }
const view = (run: Record<string, unknown> | null) => ({ schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', run,
  staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
  leader_licence: 'withheld', options: [] })
const card = (response: Record<string, unknown>) =>
  mapV5Blocks([BLOCK] as never, [], turnCanonicalRunOf(response))[0] as { run_id?: string; computed_against_hash?: string }

describe('the analysis card is stamped with its own turn\'s canonical Run', () => {
  it('the turn\'s canonical Run has the card\'s graph hash: the card carries that run id', () => {
    expect(card({ canonical_analysis_view: view({ run_id: 'run-7', graph_hash_at_run: 'h1', computed_at: null }) }).run_id).toBe('run-7')
  })
  it('the turn\'s canonical Run is on another graph: no run id (the card is unknown, not this Run)', () => {
    expect(card({ canonical_analysis_view: view({ run_id: 'run-7', graph_hash_at_run: 'h2', computed_at: null }) }).run_id).toBeUndefined()
  })
  it('no canonical view on the turn, or one with no Run: no run id', () => {
    expect(card({}).run_id).toBeUndefined()
    expect(card({ canonical_analysis_view: view(null) }).run_id).toBeUndefined()
  })
  it('CONTROL: the graph hash itself is still carried', () => {
    expect(card({}).computed_against_hash).toBe('h1')
  })
})
