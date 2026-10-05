/**
 * "Start fresh" must be fresh on the NEXT LOAD, not only in memory.
 *
 * THE DEFECT, and the reason it is worse than it looks. `resetCanvas` cleared
 * in-memory state and `currentScenarioId` — and left `olumi-canvas-autosave` on
 * disk. The production boot arbiter (`ReactFlowGraph`) then reads
 * `autosave && !scenario`, which is EXACTLY the state a reset produces, and
 * takes `loadSource = 'autosave'` unconditionally: no age cap, no fresh-entry
 * test. So the previous model came back on the next page load, announced by
 * "Recovered unsaved changes from your last session."
 *
 * The case that makes it a demo hazard rather than a nuisance: an operator
 * starts over between sessions, reloads, and is shown somebody else's model
 * with a toast confirming it is theirs.
 *
 * `clearTranscript`'s own docstring already read "(scenario deleted / canvas
 * reset)" and it had ZERO production call sites — the wiring was designed and
 * never done, which is precisely why nothing went red.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import * as scenarios from '../scenarios'
import { TRANSCRIPT_STORAGE_KEY, saveTranscript, __resetTranscriptTombstonesForTests } from '../../conversation/utils/transcriptStore'

const AUTOSAVE_KEY = 'olumi-canvas-autosave'

describe('resetCanvas — a fresh start is fresh on the next load', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetTranscriptTombstonesForTests()
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null, serverGraphIdentity: null, lastServerGraphHash: null })
  })

  it('clears the persisted autosave, so the boot arbiter cannot restore the previous model', () => {
    // Put the store in the state a reset is reached from: a real graph on screen.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Previous decision' } }] as never,
      edges: [],
    })
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ timestamp: Date.now(), nodes: [{ id: 'n1' }], edges: [] }))

    // Pin the precondition IN-TEST: without something to resurrect this case
    // would pass while measuring nothing (trap 13b).
    expect(localStorage.getItem(AUTOSAVE_KEY), 'precondition: an autosave must exist to be resurrected').not.toBeNull()

    useCanvasStore.getState().resetCanvas()

    expect(
      localStorage.getItem(AUTOSAVE_KEY),
      'the persisted autosave survived "start fresh" — the boot arbiter\'s `autosave && !scenario` branch will ' +
        'restore it on the next load and tell the user their last session was recovered, inside a fresh session',
    ).toBeNull()
  })

  it('clears the persisted transcript for the decision being reset', () => {
    const scenarioId = '11111111-2222-3333-4444-555555555555'
    scenarios.setCurrentScenarioId(scenarioId)
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ [scenarioId]: { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm1', role: 'user', content: 'hi' }] } }),
    )
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Previous' } }] as never,
      edges: [],
    })

    const before = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) as string)
    expect(Object.keys(before), 'precondition: a transcript must exist for this decision').toContain(scenarioId)

    useCanvasStore.getState().resetCanvas()

    const after = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')
    expect(
      Object.keys(after),
      'the previous conversation survived "start fresh" and will be restored into the new session',
    ).not.toContain(scenarioId)
  })

  it('reads the scenario id BEFORE discarding it — the transcript file is keyed by that id', () => {
    // The discriminating case for the ORDERING. `clearCurrentScenarioId()` runs
    // inside resetCanvas; a clear that happened first would leave the transcript
    // keyed under an id nothing could look up, and this test would be the only
    // thing to notice.
    const scenarioId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    scenarios.setCurrentScenarioId(scenarioId)
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({
        [scenarioId]: { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm1', role: 'user', content: 'hi' }] },
        'some-other-decision': { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm2', role: 'user', content: 'other' }] },
      }),
    )
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Previous' } }] as never,
      edges: [],
    })

    useCanvasStore.getState().resetCanvas()

    const after = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')
    expect(Object.keys(after)).not.toContain(scenarioId)
    // ...and ONLY that one. A reset must not delete another decision's history.
    expect(
      Object.keys(after),
      'resetting one decision deleted a different decision\'s conversation',
    ).toContain('some-other-decision')
  })

  /**
   * ── "Start fresh" is about the WORKING CANVAS, not about saved records ────
   *
   * `getCurrentScenarioId()` can hold a SAVED record's id (`loadScenario` writes
   * one; so does `createScenario` via `saveCurrentScenario`), and the
   * ScenarioSwitcher is mounted in both the toolbar and the top bar. Clearing
   * the transcript unconditionally meant: save a decision → "Start fresh" → the
   * graph record survives and its conversation is destroyed, so re-opening it
   * shows the model beside an empty chat.
   *
   * That is the very defect `transcriptStore`'s header was written to fix — and
   * the fix for the demo hazard re-created it. Both directions are pinned here.
   */
  it('does NOT destroy a SAVED decision\'s conversation — the record survives, so its transcript must too', () => {
    const created = scenarios.createScenario({ name: 'Saved decision', nodes: [], edges: [] })
    scenarios.setCurrentScenarioId(created.id)
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ [created.id]: { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm1', role: 'user', content: 'hi' }] } }),
    )
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Saved' } }] as never,
      edges: [],
    })

    expect(scenarios.getScenario(created.id), 'precondition: the record must exist to be protected').toBeDefined()

    useCanvasStore.getState().resetCanvas()

    expect(
      Object.keys(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')),
      '"Start fresh" destroyed a SAVED decision\'s conversation: the graph record survives, so re-opening it now ' +
        'shows the model beside an empty chat',
    ).toContain(created.id)
  })

  it('DOES discard an UNSAVED decision\'s conversation — the discriminating twin', () => {
    // Without this, a guard that simply never cleared anything would satisfy the
    // case above while re-opening the demo hazard the item exists for.
    const unsavedId = 'cccccccc-dddd-eeee-ffff-000000000000'
    scenarios.setCurrentScenarioId(unsavedId)
    expect(scenarios.getScenario(unsavedId), 'precondition: this id must NOT be a saved record').toBeUndefined()
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ [unsavedId]: { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm1', role: 'user', content: 'hi' }] } }),
    )
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Unsaved' } }] as never,
      edges: [],
    })

    useCanvasStore.getState().resetCanvas()

    expect(
      Object.keys(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')),
      'the guard is too wide: an unsaved decision\'s conversation survived "start fresh" and will be restored ' +
        'into what the next visitor enters as a fresh session',
    ).not.toContain(unsavedId)
  })

  /**
   * ── A decision saved ON THE SERVER is saved, with or without a local record ──
   *
   * F1 (5 Oct, Codex P2 on #2503): opening a decision from the server list loads it with NO local record, and
   * since #2503 `loadScenario` writes the pointer to it. "Start new" then read it as UNSAVED and deleted its
   * conversation, tombstoning the id for the rest of the page load, while its graph survives on the server.
   * Re-opening it showed the model beside an empty chat.
   *
   * The server holding a graph for the store's OWN decision is the proof it is saved: `serverGraphIdentity`
   * (written by server hydration) or `lastServerGraphHash` (written by hydration and by a successful register).
   * Both are cleared at every scenario boundary (`DECISION_CONTEXT_CLEAR`), so a value present belongs to the
   * decision on screen, and the store's id must equal the pointer's, or it is evidence about a different decision.
   */
  const SERVER_ONLY_ID = 'aaaaaaaa-1111-4222-8333-444444444444'
  const seedServerOnly = (server: { identity?: boolean; hash?: boolean }, storeId: string = SERVER_ONLY_ID) => {
    scenarios.setCurrentScenarioId(SERVER_ONLY_ID)
    expect(scenarios.getScenario(SERVER_ONLY_ID), 'precondition: NO local record (server-only decision)').toBeUndefined()
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ [SERVER_ONLY_ID]: { savedAt: Date.now(), dropped: 0, messages: [{ id: 'm1', role: 'user', content: 'hi' }] } }),
    )
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Server decision' } }] as never,
      edges: [],
      currentScenarioId: storeId,
    })
    // The store's own setters, the only write paths the production writers use.
    if (server.identity) useCanvasStore.getState().setServerGraphIdentity({ value: 'f'.repeat(64), projectionVersion: 'identity.v1' })
    if (server.hash) useCanvasStore.getState().setLastServerGraphHash('0123456789abcdef')
  }
  const transcriptIds = () => Object.keys(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}'))

  it('does NOT destroy a server-saved decision\'s conversation (hydrated identity, no local record)', () => {
    seedServerOnly({ identity: true })
    expect(useCanvasStore.getState().serverGraphIdentity, 'precondition: the server identity was recorded').not.toBeNull()

    useCanvasStore.getState().resetCanvas()

    expect(
      transcriptIds(),
      '"Start new" destroyed a SERVER-saved decision\'s conversation: its graph survives on the server, so re-opening ' +
        'it from the list shows the model beside an empty chat',
    ).toContain(SERVER_ONLY_ID)
    // …and it is not tombstoned: re-opening it in this page load can keep saving its chat.
    expect(
      saveTranscript(SERVER_ONLY_ID, [{ id: 'm2', role: 'user', content: 'again' }] as never),
      'the reset tombstoned a saved decision: its next turns would be refused for the rest of the page load',
    ).not.toBeNull()
  })

  it('does NOT destroy a server-saved decision\'s conversation (registered write base, no local record)', () => {
    seedServerOnly({ hash: true })
    expect(useCanvasStore.getState().lastServerGraphHash, 'precondition: the server write base was recorded').toBe('0123456789abcdef')

    useCanvasStore.getState().resetCanvas()

    expect(transcriptIds(), 'a registered decision\'s conversation was destroyed by "Start new"').toContain(SERVER_ONLY_ID)
  })

  it('DOES discard it when the server evidence belongs to a DIFFERENT decision than the pointer: the binding twin', () => {
    // The store holds a server graph for ANOTHER id; the pointer's decision has neither a record nor server proof.
    seedServerOnly({ identity: true, hash: true }, 'bbbbbbbb-1111-4222-8333-444444444444')

    useCanvasStore.getState().resetCanvas()

    expect(
      transcriptIds(),
      'server evidence about a different decision kept this unsaved one\'s conversation: the demo hazard reopens',
    ).not.toContain(SERVER_ONLY_ID)
  })
})
