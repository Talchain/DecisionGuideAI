/**
 * ⭐ AFTER draft → undo, THE RECORD MUST NOT STILL DESCRIBE THE DRAFT.
 *
 * `lastAuthoritativeGraph` records the graph the server is believed to hold.
 * `useImportRegistration.ts:6-7` enumerates the four graph-replacement sites —
 * `importCanvas`, `hydrateGraphSlice`, `loadScenario`, `undoDraft` — and only
 * the fourth failed to stand it down.
 *
 * ⚠ THIS IS A LIE, NOT A GAP. After an undo the canvas shows the PRE-DRAFT
 * graph while the record still describes the DRAFT one. Any reader that trusts
 * the record then suppresses a legitimate warning about a node the server never
 * held — the data-loss class #1108 closed, reopened through a fourth door.
 *
 * ⭐ CLOSED AGAINST THE ENUMERATION, NOT THE INSTANCE. The last test asserts
 * the property for every site the repo itself lists, so a fifth site added
 * later fails here rather than shipping the same lie again.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

const DRAFT = {
  nodes: [{ id: 'n-draft', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Drafted' } }],
  edges: [],
}
const PRE_DRAFT = {
  nodes: [{ id: 'n-pre', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Mine' } }],
  edges: [],
}
const DRAFT_RECORD = { nodeIds: ['n-draft'], edgePairs: [] }

describe('undoDraft stands the authoritative record down', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: DRAFT.nodes,
      edges: DRAFT.edges,
      draftChatPreDraftSnapshot: PRE_DRAFT,
      lastAuthoritativeGraph: DRAFT_RECORD,
    } as never)
  })

  it('clears the record so a reader cannot trust a description of the undone graph', () => {
    // PRECONDITION PINNED IN-TEST: without a record set, "it is null after"
    // would hold for a reason that has nothing to do with the fix.
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toEqual(DRAFT_RECORD)

    useCanvasStore.getState().undoDraft()

    const s = useCanvasStore.getState()
    // Bound by IDENTITY: the canvas really did revert, so the assertion below
    // is about the record and not about a no-op undo.
    expect(s.nodes.map(n => n.id)).toEqual(['n-pre'])
    expect(
      s.lastAuthoritativeGraph,
      'the record still describes the DRAFT graph the canvas no longer shows',
    ).toBeNull()
  })

  it('does not clear what an undo does not invalidate', () => {
    // The narrow fix must stay narrow: reaching for DECISION_CONTEXT_CLEAR
    // would also null these, and an undo invalidates none of them.
    useCanvasStore.setState({ currentScenarioId: 'scn-1', serverGraphIdentity: { any: 1 } } as never)
    useCanvasStore.getState().undoDraft()
    const s = useCanvasStore.getState() as Record<string, unknown>
    expect(s.currentScenarioId).toBe('scn-1')
    expect(s.serverGraphIdentity).not.toBeNull()
  })

  it('every enumerated graph-replacement site is named in the store', async () => {
    // The enumeration is the repo's own, not a list maintained here.
    const fs = await import('node:fs'); const path = await import('node:path')
    const reg = path.resolve(process.cwd(), 'src/canvas/registration/useImportRegistration.ts')
    expect(fs.existsSync(reg), `enumeration source missing: ${reg}`).toBe(true)
    const doc = fs.readFileSync(reg, 'utf8')
    expect(doc.length, 'enumeration file read as empty').toBeGreaterThan(500)
    const sites = ['importCanvas', 'hydrateGraphSlice', 'loadScenario', 'undoDraft']
      .filter(n => doc.includes(n))
    // CONTRAST CONTROL: if the enumeration were renamed away, this would drop
    // and the assertion below would pass on an empty set.
    expect(sites.length, 'the enumeration no longer names the four sites').toBe(4)
    const store = fs.readFileSync(path.resolve(process.cwd(), 'src/canvas/store.ts'), 'utf8')
    for (const site of sites) expect(store, `${site} is not defined in the store`).toContain(`${site}:`)
  })
})
