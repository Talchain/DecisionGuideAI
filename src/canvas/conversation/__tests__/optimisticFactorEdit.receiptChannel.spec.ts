/**
 * ⛔⛔⛔ THE CLIENT REVERTED EVERY SUCCESSFUL EDIT BECAUSE IT LISTENED ON THE
 * WRONG CHANNEL.
 *
 * `edit-graph-dispatch.ts:1628-1637` (CEE): *"Successful (non-rejected) edits
 * return []  … THE APPLIED GRAPH INSTEAD REACHES THE UI VIA THE TOP-LEVEL
 * `draft_graph` WIRE FIELD … its only inline-graph ingestion path is
 * `draft_graph`."*
 *
 * `responseAppliedFactorEdit` scanned `blocks[]` for a `graph_patch` and
 * nothing else, so a successful edit read as "not applied" and
 * `useConversation` reverted the user's own write.
 *
 * ⛔ THE DANGEROUS DIRECTION IS THE OTHER ONE, and it has its own cases below:
 * accepting a `draft_graph` too readily would KEEP a value the server REFUSED,
 * which is worse than the defect being fixed. The new path is therefore bound
 * by IDENTITY (node id) **and** by THE NUMBER SENT.
 */
import { describe, it, expect } from 'vitest'
import { responseAppliedFactorEdit } from '../optimisticFactorEdit'

const ID = 'fac_adoption_friction'
const graph = (id: string, value: number | null) => ({
  nodes: [
    { id: 'other_node', observed_state: { value: 0.11 } },
    value === null ? { id } : { id, observed_state: { value } },
  ],
})

describe('the contract’s success shape — blocks: [] plus a top-level draft_graph', () => {
  it('ACCEPTS the edit when draft_graph shows this factor holding the number we sent', () => {
    expect(responseAppliedFactorEdit({ blocks: [], draft_graph: graph(ID, 0.42) }, ID, 0.42)).toBe(true)
  })

  it('the served shape exactly: blocks present, no graph_patch in it', () => {
    const served = {
      response_version: '5', assistant_text: 'ok', blocks: [{ type: 'text' }],
      suggested_actions: [], insights: [], stage_indicator: {}, analysis_state: {},
      draft_graph: graph(ID, 0.42),
    }
    expect(responseAppliedFactorEdit(served, ID, 0.42)).toBe(true)
  })
})

describe('⛔ the dangerous direction — a graph is not a receipt', () => {
  it('REFUSES when draft_graph holds a DIFFERENT value than we sent', () => {
    expect(responseAppliedFactorEdit({ blocks: [], draft_graph: graph(ID, 0.31) }, ID, 0.42)).toBe(false)
  })

  it('REFUSES when draft_graph does not name this factor at all', () => {
    expect(responseAppliedFactorEdit({ blocks: [], draft_graph: graph('someone_else', 0.42) }, ID, 0.42)).toBe(false)
  })

  it('REFUSES when the factor carries no observed value', () => {
    expect(responseAppliedFactorEdit({ blocks: [], draft_graph: graph(ID, null) }, ID, 0.42)).toBe(false)
  })

  it('an EXPLICIT refusal outranks a draft_graph riding along in the same reply', () => {
    const reply = {
      blocks: [{ type: 'graph_patch', status: 'rejected', target_id: ID }],
      draft_graph: graph(ID, 0.42),
    }
    expect(responseAppliedFactorEdit(reply, ID, 0.42)).toBe(false)
  })

  it('is INERT without a sentValue, so no existing caller changes behaviour', () => {
    expect(responseAppliedFactorEdit({ blocks: [], draft_graph: graph(ID, 0.42) }, ID)).toBe(false)
  })
})

describe('REGRESSION GUARDS — every pre-existing graph_patch behaviour is unchanged', () => {
  it('an applied graph_patch naming this target still applies', () => {
    expect(responseAppliedFactorEdit({ blocks: [{ type: 'graph_patch', target_id: ID }] }, ID)).toBe(true)
  })

  it('an applied but unattributable patch is still assumed ours', () => {
    expect(responseAppliedFactorEdit({ blocks: [{ type: 'graph_patch' }] }, ID)).toBe(true)
  })

  it('every NOT_APPLIED status still means not applied', () => {
    for (const status of ['rejected', 'proposed', 'dismissed', 'failed', 'error', 'pending']) {
      expect(responseAppliedFactorEdit({ blocks: [{ type: 'graph_patch', status, target_id: ID }] }, ID), status).toBe(false)
    }
  })

  it('a rejection naming ANOTHER target does not block our applied patch', () => {
    const reply = { blocks: [
      { type: 'graph_patch', status: 'rejected', target_id: 'other_node' },
      { type: 'graph_patch', target_id: ID },
    ] }
    expect(responseAppliedFactorEdit(reply, ID)).toBe(true)
  })

  it('an empty targetId is still never reverted on a guess', () => {
    expect(responseAppliedFactorEdit({ blocks: [] }, '')).toBe(true)
  })

  it('a reply with no blocks and no draft_graph is still not applied', () => {
    expect(responseAppliedFactorEdit({}, ID, 0.42)).toBe(false)
  })
})
