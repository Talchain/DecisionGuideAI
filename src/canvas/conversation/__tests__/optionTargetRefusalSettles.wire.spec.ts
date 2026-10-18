/**
 * A request CEE DECLINED WITHOUT WRITING must settle as a refusal, not as an
 * unknown — proven through the REAL wire chain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — served UI `a4434670`, 24 Sep 2026, CDP starter
 * ─────────────────────────────────────────────────────────────────────────────
 * Two option-target edits came back **422 `INGRESS_CONTRACT_VIOLATION`,
 * `details.reason: 'system_event_refused_no_write'`, `retryable: false`**. The
 * producer's own line for that reason is a no-write guarantee (CEE
 * `3f412be11ae68c06ad4955a56f0cf4e9821e5946`: `route-v2.ts:3516-3530` emits it
 * only for `commitSkippedReason === 'refused_no_write'`, defined at
 * `system-events/dispatch.ts:97` as *"a gate declined and NOTHING was
 * written"*). The UI read only `details.conflict_category`, found none, and
 * settled the send as `unverified` — so even a surface that listened could
 * only say "could not confirm" about a refusal the server had stated.
 *
 * WHAT IS REAL HERE: `useConversation` → `callV5Turn` → `parseV5Response` →
 * `routeV5Response` → the V5 typed-error branch that builds
 * `SystemEventSendError` → `settleSystemEventSend`. Only global `fetch` is
 * stubbed, answering with the envelope CEE's own builder produces
 * (`buildCommitFailureBoundaryError`, `route-v2.ts:2310` at the served SHA —
 * the witness's body plus the `request_id`, `details.retryable` and
 * `details.stage` that builder always writes).
 *
 * CONTRASTS, in the same file: the retryable 500 a writer that could NOT
 * confirm its commit returns (`system_event_commit_failed`) must stay
 * `unverified`; a stale-base 409 must stay a `conflict` refusal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ConversationProvider } from '../ConversationContext'
import { OptionNode } from '../../nodes/OptionNode'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import { REVISION_CONFLICT_NOTICE } from '../../../v5/failureTypeRetryability'
import conflictCapture from './fixtures/option-edit-conflict-2b073341.json'
import { scenarioGraphUrl } from '../../../adapters/cee/scenarioGraph'
import { useConversation, SystemEventSendError } from '../useConversation'
import {
  settleSystemEventSend,
  type SystemEventSendSettlement,
  type SystemEventSendSettlementDetail,
} from '../settleSystemEventSend'
import { useCanvasStore } from '../../store'
import { noteCanvasLocalCommit, useAnalyseAfterCommittedChange } from '../../analysis/useAnalyseAfterCommittedChange'
import type { CanonicalRunOptions, CanonicalRunOutcome } from '../../analysis/canonicalRunRegistry'
import { modelVersionsUrl } from '../../../adapters/cee/modelVersions'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { useUndoJournalStore } from '../../undo/captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL } from '../../undo/undoJournal'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import lostReply from './fixtures/option-edit-lost-reply-8e9132fc.json'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
/** A guest unless a row signs in. */
const session = vi.hoisted(() => ({ identity: { userId: null as string | null, accessToken: null as string | null } }))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => session.identity.userId,
  getSessionIdentity: async () => session.identity,
}))
vi.mock('../../analysis/useAnalyseAfterCommittedChange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../analysis/useAnalyseAfterCommittedChange')>()
  return { ...actual, noteCanvasLocalCommit: vi.fn(actual.noteCanvasLocalCommit) }
})
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

vi.mock('@xyflow/react', async original => ({
  ...await original<typeof import('@xyflow/react')>(), Handle: () => null,
}))

/** G2 2b073341 row 7b: use the real option card, authority, dispatcher, parser,
 * settlement, recovery reader and store. Only the HTTP/session seams are fake. */
describe('option-card outcomes through the real send and canonical refresh', () => {
  const optionId = 'add_one_specialist'
  const factorId = 'number_of_additional_specialists'
  const editorId = `option-value-editor-${optionId}-${factorId}`
  let mode: 'conflict' | 'drop' | 'saved'
  let writes: number
  let posts: Array<Record<string, unknown>>
  let reads: number
  let failRead: boolean
  let serverGraph: typeof conflictCapture.before

  function LiveOption() {
    const option = useCanvasStore(state => state.nodes.find(node => node.id === optionId))!
    return createElement(OptionNode, {
      id: option.id, data: option.data, type: 'option', position: option.position,
      selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
      dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
    } as never)
  }
  function typeValue(value: string) {
    fireEvent.click(screen.getByTestId(editorId))
    const input = screen.getByTestId(`${editorId}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }
  const word = () => screen.queryByTestId(`${editorId}-settlement`)?.textContent

  beforeEach(() => {
    mode = 'conflict'; writes = 0; posts = []; reads = 0; failRead = false
    useCanvasStore.setState({ currentScenarioId: conflictCapture.before.scenario_id,
      nodes: [], edges: [], importPendingServerRegistration: false, serverGraphIdentity: null,
      analysisFreshnessDirty: false, ceeAnalysisReady: null, lastServerGraphHash: null } as never)
    expect(mergeServerGraphOnHydrate(conflictCapture.before.graph).accepted).toBe(true)
    // The captured losing tab opened on this canonical graph/hash; no optimistic write is introduced.
    useCanvasStore.setState({ lastServerGraphHash: conflictCapture.before.graph_hash })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === scenarioGraphUrl(conflictCapture.before.scenario_id)) {
        reads += 1
        if (failRead) return new Response('{}', { status: 500 })
        return new Response(JSON.stringify(serverGraph), { status: 200 })
      }
      if (init?.method === 'POST') {
        const request = JSON.parse(String(init.body)) as Record<string, unknown>
        posts.push(request)
        const event = request.event as { base_graph_hash?: unknown }
        if (event.base_graph_hash !== serverGraph.graph_hash) {
          return new Response(JSON.stringify(conflictCapture.conflict), { status: 409 })
        }
        serverGraph = conflictCapture.after
        if (mode === 'drop') { writes += 1; throw new TypeError('response dropped after server commit') }
        if (mode === 'saved') { writes += 1; return new Response(JSON.stringify(conflictCapture.applied), { status: 200 }) }
        return new Response(JSON.stringify(conflictCapture.conflict), { status: 409 })
      }
      throw new Error(`Unexpected HTTP boundary: ${String(url)}`)
    }))
  })

  function openCard() {
    // A conflict begins after the other tab's write; a successful/dropped send begins on the captured old base.
    serverGraph = mode === 'conflict' ? conflictCapture.after : conflictCapture.before
    render(createElement(ReactFlowProvider, null,
      createElement(ConversationProvider, null, createElement(LiveOption))))
    fireEvent.click(screen.getByTestId(editorId))
    expect((screen.getByTestId(`${editorId}-input`) as HTMLInputElement).value).toBe('2')
    fireEvent.keyDown(screen.getByTestId(`${editorId}-input`), { key: 'Escape' })
  }

  it('G2 409: says definitely not saved, reads the winner’s 5, and reopens on 5 without another write', async () => {
    openCard(); typeValue('4')
    await waitFor(() => expect(word()).toBe(REVISION_CONFLICT_NOTICE))
    expect(reads).toBe(1)
    expect(posts).toHaveLength(1)
    expect(posts[0].event).toEqual({ kind: 'option_intervention_edit', option_id: optionId, factor_id: factorId,
      value: 0.4, base_graph_hash: conflictCapture.before.graph_hash })
    expect(writes).toBe(0)
    expect(screen.getByTestId(editorId).textContent).toMatch(/5 specialists/)
    fireEvent.click(screen.getByTestId(editorId))
    expect((screen.getByTestId(`${editorId}-input`) as HTMLInputElement).value).toBe('5')
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(conflictCapture.after.graph_hash)
    const held = useCanvasStore.getState().nodes.find(node => node.id === optionId)!.data.interventions as Record<string, { value: number; source: string }>
    expect(held[factorId].value).toBe(0.5)
    expect(held[factorId].source).toBe('user_specified')
  })

  it('dropped response stays unknown; retry reads the already-saved value without a duplicate write', async () => {
    mode = 'drop'; openCard(); typeValue('5')
    await waitFor(() => expect(word()).toBe('Could not confirm. It may not have reached the model.'))
    expect(reads).toBe(0)
    mode = 'conflict'; typeValue('5')
    await waitFor(() => expect(word()).toBe('Saved. The model holds this value.'))
    expect(posts).toHaveLength(2)
    expect(writes).toBe(1)
    expect(reads).toBe(1)
    expect(screen.getByTestId(editorId).textContent).toMatch(/5 specialists/)
  })

  it('200 applies the server’s 5 once and shows it, with no refusal or unknown-delivery claim', async () => {
    mode = 'saved'; openCard(); typeValue('5')
    await waitFor(() => expect(screen.getByTestId(editorId).textContent).toMatch(/5 specialists/))
    expect(posts).toHaveLength(1)
    expect(writes).toBe(1)
    expect(reads).toBe(0)
    expect(word()).toBeUndefined()
  })

  it('a failed refresh never turns the confirmed 409 non-save into an unknown send', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      failRead = true
      openCard(); typeValue('4')
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(word()).toBe('Checking the saved model…')
      await act(async () => { await vi.advanceTimersByTimeAsync(30_001) })
      expect(word()).toBe('Not saved on this attempt. The latest model could not be refreshed. Reload it before editing again.')
      expect(posts).toHaveLength(1)
      expect(writes).toBe(0)
      expect(reads).toBe(1)
      expect(screen.getByTestId(editorId).textContent).toMatch(/2 specialists/)
      expect(screen.queryByText('Could not confirm. It may not have reached the model.')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * ⭐ C3: A SAVE THAT ONLY THE READ-BACK PROVES STILL STARTS ITS AUTOMATIC RUN (served capture
 * 2026-10-18T034045Z, DGAI e7eb7cd5 / CEE 8e9132fc, turns 03–04). CEE committed "Add one specialist" 1 → 2 and its 200
 * was lost ("Failed to fetch"); the re-entry got 409 `stale_base_graph_hash`; the card read the saved model and said
 * "Saved. The model holds this value." — and no Run followed, because the only note of a canvas edit's commit rode the
 * lost 200.
 *
 * ⛔ AND ONLY WHEN THAT SAVE IS THIS CARD'S (PL-C3-FOREIGN-COMMIT-0505, Codex BLOCK on #2817@bfb174db): the value never
 * says who saved it. The current version's `creation.source_turn_id` does — the served list for this scenario records
 * turn 03's own `turn_id` on version 2c9b40a1 — so the commit is noted only when it names one of this card's own lost
 * sends. Every body below is the capture's, verbatim; the fake CEE writes, refuses and records the writing turn the way
 * the served one did. The REAL `useAnalyseAfterCommittedChange` decides the Run.
 */
describe('a saved edit confirmed by read-back after a lost reply starts exactly one automatic Run (served 8e9132fc)', () => {
  type Run = (opts?: CanonicalRunOptions) => Promise<CanonicalRunOutcome>
  const sent = lostReply.turn03.request_body.event
  const editorId = `option-value-editor-${sent.option_id}-${sent.factor_id}`
  const scenarioId = lostReply.before.scenario_id
  /** The version turn 03 wrote, as the served list shows it (written by turn 75028e02). */
  const servedHead = lostReply.versionsList.versions.find(version => version.sequence === 2)!
  const tabATurn = lostReply.turn03.request_body.turn_id
  const signedIn = { userId: 'b6c10033-1330-43d7-86c8-f8b85b1702ad', accessToken: 'test-access-token' }
  let serverGraph: { readonly graph_hash: string }
  /** The turn that wrote the saved model's current version, or null before any write. */
  let writtenBy: string | null
  let conflict: unknown
  /** The network loses the reply to the next send, after CEE has handled it. */
  let loseNextReply: boolean
  let posts: Array<{ event: unknown; turn_id: string }>
  let writes: number
  let reads: number
  let versionReads: number
  let run: ReturnType<typeof vi.fn<Parameters<Run>, ReturnType<Run>>>
  /** The model the canvas held when each Run started. */
  let hashAtRun: Array<string | null>

  function LiveOption() {
    const option = useCanvasStore(state => state.nodes.find(node => node.id === sent.option_id))!
    return createElement(OptionNode, {
      id: option.id, data: option.data, type: 'option', position: option.position,
      selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
      dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
    } as never)
  }
  function AutoRun() {
    useAnalyseAfterCommittedChange({ run, idle: true, hasRunOnRecord: true })
    return null
  }
  /** The tab opens on `model`, as the capture's tab did. */
  function openOn(model: { readonly graph: unknown; readonly graph_hash: string }) {
    expect(mergeServerGraphOnHydrate(model.graph as never).accepted).toBe(true)
    useCanvasStore.setState({ lastServerGraphHash: model.graph_hash })
    render(createElement(ReactFlowProvider, null,
      createElement(ConversationProvider, null, createElement(LiveOption), createElement(AutoRun))))
  }
  function typeValue(value: string) {
    fireEvent.click(screen.getByTestId(editorId))
    const input = screen.getByTestId(`${editorId}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }
  const word = () => screen.queryByTestId(`${editorId}-settlement`)?.textContent
  /** Lets any Run the last change would start get started, so a count of 0 is not just "not yet". */
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

  /** A send whose reply the network lost: "Could not confirm", and nothing runs. */
  async function sendLost(value: string) {
    loseNextReply = true
    typeValue(value)
    await waitFor(() => expect(word()).toBe('Could not confirm. It may not have reached the model.'))
    await settle()
    expect(run).not.toHaveBeenCalled()
  }
  /** Turns 03–04: the 200 is lost after CEE saved 2; the user re-enters 2; the 409; the read finds 2 saved. */
  async function lostReplyThenReentry() {
    openOn(lostReply.before)
    await sendLost('2')
    typeValue('2')
    await waitFor(() => expect(word()).toBe('Saved. The model holds this value.'))
    await settle()
  }
  /** Tab A's turn 03 already saved 2: the canvas still opens on the model before it. */
  function afterTabASaved2() {
    serverGraph = lostReply.after; writtenBy = tabATurn
  }

  beforeEach(() => {
    session.identity = signedIn
    serverGraph = lostReply.before; writtenBy = null; conflict = lostReply.turn04.response_body; loseNextReply = false
    posts = []; writes = 0; reads = 0; versionReads = 0; hashAtRun = []
    run = vi.fn<Parameters<Run>, ReturnType<Run>>(async () => {
      hashAtRun.push(useCanvasStore.getState().lastServerGraphHash)
      return { status: 'dispatched' }
    })
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
    // A Run on record (turn 03's `analysis_ready`: computed 03:42:09, stale against the moved model).
    useCanvasStore.setState({ currentScenarioId: scenarioId,
      nodes: [], edges: [], importPendingServerRegistration: false, serverGraphIdentity: null,
      analysisFreshnessDirty: false, ceeAnalysisReady: null, lastServerGraphHash: null, hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_hash_diverged', computedAt: '2026-10-18T03:42:09.883Z' },
    } as never)
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === scenarioGraphUrl(scenarioId)) {
        reads += 1
        return new Response(JSON.stringify(serverGraph), { status: 200 })
      }
      if (String(url) === modelVersionsUrl(scenarioId)) {
        versionReads += 1
        // CEE's list, newest first: the current version records the turn that wrote it.
        const head = { ...servedHead, creation: { ...servedHead.creation, source_turn_id: writtenBy } }
        return new Response(JSON.stringify({ ...lostReply.versionsList, current_version_id: head.version_id,
          versions: [head], next_cursor: null }), { status: 200 })
      }
      if (init?.method === 'POST') {
        const request = JSON.parse(String(init.body)) as { event: { base_graph_hash?: unknown }; turn_id: string }
        posts.push(request)
        const lost = loseNextReply
        loseNextReply = false
        let reply: Response
        // CEE's compare-and-swap: a send on any base but the saved one writes nothing.
        if (request.event.base_graph_hash !== serverGraph.graph_hash) {
          reply = new Response(JSON.stringify(conflict), { status: 409 })
        } else {
          writes += 1
          serverGraph = lostReply.after
          writtenBy = request.turn_id
          reply = new Response(JSON.stringify(lostReply.turn03.response_body), { status: 200 })
        }
        if (lost) throw new TypeError('Failed to fetch')
        return reply
      }
      throw new Error(`Unexpected HTTP boundary: ${String(url)}`)
    }))
  })
  afterEach(() => { session.identity = { userId: null, accessToken: null } })

  it('⭐ ROW: lost 200 → re-entry → 409 stale base → the read holds 2, written by the lost send → exactly ONE Run, on the saved model', async () => {
    await lostReplyThenReentry()
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    await settle()

    expect(run).toHaveBeenCalledTimes(1)
    expect(hashAtRun).toEqual([lostReply.after.graph_hash])
    // Noted as the version the lost send wrote, by identity.
    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(noteCanvasLocalCommit).toHaveBeenCalledWith(servedHead.version_id)
    expect(posts.map(post => post.event)).toEqual([lostReply.turn03.request_body.event, lostReply.turn04.request_body.event])
    expect(writtenBy).toBe(posts[0].turn_id)
    expect(writes).toBe(1)
    expect(reads).toBe(1)
    expect(versionReads).toBe(1)
  })

  it('NO DOUBLE: a second read of the same saved model leaves it at one Run', async () => {
    await lostReplyThenReentry()
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))

    await act(async () => { await hydrateCanvasFromServer(scenarioId) })
    await settle()

    expect(reads).toBe(2)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(lostReply.after.graph_hash)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('⛔ FOREIGN: another tab already saved the same 2; this tab’s 409 read holds 2 over a stale analysis → NO Run and no commit noted', async () => {
    afterTabASaved2()
    openOn(lostReply.before); typeValue('2')
    await waitFor(() => expect(word()).toBe('Saved. The model holds this value.'))
    await waitFor(() => expect(versionReads).toBe(1))
    await settle()

    // The analysis on record is NOT current, so a noted commit WOULD run: the identity is what stops it.
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(false)
    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
    expect(posts.map(post => post.event)).toEqual([lostReply.turn04.request_body.event])
    expect(writes).toBe(0)
  })

  it('⛔ FOREIGN, this tab’s own reply lost too: its send was refused, the other tab’s 2 is saved → NO Run and no commit noted', async () => {
    afterTabASaved2()
    openOn(lostReply.before)
    await sendLost('2')
    typeValue('2')
    await waitFor(() => expect(word()).toBe('Saved. The model holds this value.'))
    await waitFor(() => expect(versionReads).toBe(1))
    await settle()

    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(false)
    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
    expect(writes).toBe(0)
    expect(writtenBy).toBe(tabATurn)
  })

  it('GUEST (no versions to read): the lost reply is still read back as saved, honestly, and nothing runs', async () => {
    session.identity = { userId: null, accessToken: null }
    await lostReplyThenReentry()

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
    expect(writes).toBe(1)
    expect(versionReads).toBe(0)
  })

  it('CONTRAST: the reply arrives (turn 03’s 200 with its receipt) → one Run from the receipt, and no read', async () => {
    expect(lostReply.turn03.response_body.model_version_receipt.version_id).toBe(servedHead.version_id)
    openOn(lostReply.before); typeValue('2')
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    await settle()

    expect(run).toHaveBeenCalledTimes(1)
    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(noteCanvasLocalCommit).toHaveBeenCalledWith(servedHead.version_id)
    expect(hashAtRun).toEqual([lostReply.turn03.response_body.graph_hash])
    expect(posts.map(post => post.event)).toEqual([lostReply.turn03.request_body.event])
    expect(reads).toBe(0)
    expect(versionReads).toBe(0)
    expect(word()).toBeUndefined()
  })

  it('CONTRAST: tab B (turn 06) — 409 revision_conflict, the read holds tab A’s 4, not B’s 5 → the revision notice and NO Run', async () => {
    serverGraph = lostReply.tabBRead; conflict = lostReply.turn06.response_body
    openOn(lostReply.after); typeValue('5')
    await waitFor(() => expect(word()).toBe(REVISION_CONFLICT_NOTICE))
    await settle()

    expect(posts.map(post => post.event)).toEqual([lostReply.turn06.request_body.event])
    expect(writes).toBe(0)
    expect(reads).toBe(1)
    expect(run).not.toHaveBeenCalled()
  })

  it('CONTRAST: a genuine refusal — 409 stale base, the read still holds 1 → "Not saved…" and NO Run', async () => {
    // The capture's pre-edit model, with ONLY its hash moved: another writer changed something else, not this value.
    serverGraph = { ...lostReply.before, graph_hash: 'f0f0f0f0f0f0f0f0' }
    openOn(lostReply.before); typeValue('2')
    await waitFor(() => expect(word()).toBe('Not saved. The model kept its previous value.'))
    await settle()

    expect(posts.map(post => post.event)).toEqual([lostReply.turn03.request_body.event])
    expect(writes).toBe(0)
    expect(reads).toBe(1)
    expect(run).not.toHaveBeenCalled()
  })
})

/** CEE's `buildCommitFailureBoundaryError` shape, at the served SHA. */
function commitFailureEnvelope(opts: {
  error: string
  reason: string
  retryable: boolean
}): Record<string, unknown> {
  return {
    error: opts.error,
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      retryable: opts.retryable,
      reason: opts.reason,
      event_kind: 'option_intervention_edit',
      stage: 'frame',
    },
    request_id: 'req_option_target_1',
    retryable: opts.retryable,
  }
}

/** The stale-base 409 — `route-v2.ts` sends the category in `details.conflict_category`. */
const STALE_BASE_409 = {
  error: 'GRAPH_DIVERGED',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    conflict_category: 'stale_base_graph_hash',
    recovery_action: 'refresh_and_reconfirm',
    event_kind: 'option_intervention_edit',
  },
  request_id: 'req_option_target_2',
  retryable: false,
}

function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const OPTION_TARGET_EVENT = {
  type: 'option_intervention_edit' as const,
  payload: {
    option_id: 'opt_segment',
    factor_id: 'fac_gdpr',
    value: 0.7,
    base_graph_hash: '77d05bb3aaaaaaaa',
  },
}

/** Send through the REAL dispatcher and settle it through the REAL resolver. */
async function sendAndSettle(): Promise<{
  error: unknown
  settlement: SystemEventSendSettlement
  detail: SystemEventSendSettlementDetail
}> {
  const { result } = renderHook(() => useConversation())
  let error: unknown = null
  let settled: { settlement: SystemEventSendSettlement; detail: SystemEventSendSettlementDetail } | null = null
  await act(async () => {
    const send = result.current.sendSystemEvent(OPTION_TARGET_EVENT as never, { deferIfBusy: false } as never)
    await new Promise<void>((resolve) => {
      settleSystemEventSend(send, (settlement, detail) => {
        settled = { settlement, detail }
        resolve()
      })
    })
    await send.catch((e: unknown) => {
      error = e
    })
  })
  expect(settled, 'the send never settled').not.toBeNull()
  return { error, ...(settled as unknown as { settlement: SystemEventSendSettlement; detail: SystemEventSendSettlementDetail }) }
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('a declined option-target edit settles as a refusal, through the real wire chain', () => {
  it('⭐ 422 `system_event_refused_no_write` → refused / declined — RED at a4434670, which said `unverified`', async () => {
    const fetchStub = stubFetchWith(
      422,
      commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
    )

    const { error, settlement, detail } = await sendAndSettle()

    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(SystemEventSendError)
    // The producer's reason is CARRIED — the field the no-write is stated on.
    expect((error as SystemEventSendError).reason).toBe('system_event_refused_no_write')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('declined')
    expect(detail.reason).toBe('system_event_refused_no_write')
  })

  it('CONTRAST — the retryable 500 a writer returns when it could NOT confirm stays `unverified`', async () => {
    stubFetchWith(
      500,
      commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
    )

    const { settlement, detail } = await sendAndSettle()

    // Same envelope shape, opposite guarantee: a commit MAY have landed. Green
    // at a4434670 too — the new arm must not swallow this outcome.
    expect(settlement).toBe('unverified')
    expect(detail?.refusal).toBeUndefined()
  })

  it('CONTRAST — a stale-base 409 is still a refusal', async () => {
    stubFetchWith(409, STALE_BASE_409)

    const { settlement } = await sendAndSettle()

    // Green at a4434670 too: the category arm is unchanged.
    expect(settlement).toBe('refused')
  })

  it('the two refusals are named apart — a stale base is a CONFLICT, the 422 a DECLINE', async () => {
    stubFetchWith(409, STALE_BASE_409)
    const conflict = await sendAndSettle()
    expect(conflict.detail?.refusal).toBe('conflict')

    stubFetchWith(
      422,
      commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
    )
    const declined = await sendAndSettle()
    expect(declined.detail?.refusal).toBe('declined')
  })

  it('the retryable 500 carries its reason too, and it is NOT read as a no-write', async () => {
    stubFetchWith(
      500,
      commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
    )
    const { error, settlement } = await sendAndSettle()
    expect((error as SystemEventSendError).reason).toBe('system_event_commit_failed')
    expect(settlement).toBe('unverified')
  })
})

/**
 * MANUAL-EDIT-REWITNESS-0753Z N1, 24 Sep 2026 (served UI `25314672`, CEE
 * `e81aea1`): on the OpenAI lane `/agent/v1/turn` forwards a canvas edit and
 * re-sends the orchestrator's body with `_diagnostic_trace` and
 * `_provider_calls` added at the top level. The strict `BoundaryErrorSchema`
 * rejected that body, so both refusals above settled `unverified` there.
 */
const LANE_SIDECARS = {
  _diagnostic_trace: { exit_path: 'agent_lane_forwarded', forwarded_kind: 'system_event' },
  _provider_calls: [],
}

describe('N1 — the same refusals, as the OpenAI lane delivers them, still settle as refusals', () => {
  it('⭐ stale-base 409 + lane sidecars → refused / conflict, category carried — RED at 25314672 (`unverified`)', async () => {
    stubFetchWith(409, { ...STALE_BASE_409, ...LANE_SIDECARS })

    const { error, settlement, detail } = await sendAndSettle()

    expect(error).toBeInstanceOf(SystemEventSendError)
    expect((error as SystemEventSendError).conflictCategory).toBe('stale_base_graph_hash')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('conflict')
  })

  it('⭐ 422 `system_event_refused_no_write` + lane sidecars → refused / declined, reason carried — RED at 25314672', async () => {
    stubFetchWith(422, {
      ...commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
      ...LANE_SIDECARS,
      _provider_calls_truncated: true,
    })

    const { error, settlement, detail } = await sendAndSettle()

    expect((error as SystemEventSendError).reason).toBe('system_event_refused_no_write')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('declined')
  })

  it('CONTRAST — the retryable 500 + lane sidecars carries its reason and stays `unverified` (the sidecars never manufacture a no-write)', async () => {
    stubFetchWith(500, {
      ...commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
      ...LANE_SIDECARS,
    })

    const { error, settlement } = await sendAndSettle()

    // RED at 25314672 on the reason only (it was a parse_error, so nothing was
    // carried); the settlement was `unverified` then and must stay so now.
    expect((error as SystemEventSendError).reason).toBe('system_event_commit_failed')
    expect(settlement).toBe('unverified')
  })

  it('⛔ CONTRAST — an undeclared NON-underscore root key is not a sidecar: the 409 stays unparsed and `unverified`', async () => {
    stubFetchWith(409, { ...STALE_BASE_409, ...LANE_SIDECARS, recovery: { action: 'reload' } })

    const { error, settlement } = await sendAndSettle()

    expect((error as SystemEventSendError).conflictCategory).toBeUndefined()
    expect(settlement).toBe('unverified')
  })
})
