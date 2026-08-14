/**
 * SELECTION-AWARE ANSWERING, hop 4b — THE WIRE-TO-CANVAS CHAIN.
 *
 * The capability this file defends, end to end and in one sentence:
 *
 *   > A user selects a node, asks a question, and the element the answer was
 *   > grounded on is MARKED on the canvas — so they do not have to hunt for
 *   > the node the answer names.
 *
 * ⭐ WHY THIS SPEC STARTS AT RAW WIRE BYTES AND FINISHES AT REAL STORE STATE.
 * Every hop in this chain has an independently defensible unit — the reader,
 * the store action, the notice. All three can be fully green while the
 * capability is DARK, because the one thing none of them can prove is that
 * anybody CALLS them. That is this estate's chronic failure #1 (a defended
 * pure function with a dark call site), so this spec deliberately owns no
 * mocks on the path under test: it feeds a real HTTP body to the real
 * `parseV5Response`, hands the result to the real `applyV5State` shaped
 * EXACTLY as the production call site shapes it (`useConversation.ts:4736` —
 * `{ ...useCanvasStore.getState(), currentResultsHash }`), and then reads the
 * REAL canvas store.
 *
 * The F6 wiring mutant is therefore: delete
 * `store.setGroundedFocus?.(readGroundedSelection(response))` from
 * `applyV5State.ts` and every "marks" test here must RED.
 *
 * ⚠ WHAT THIS SPEC MAY AND MAY NOT CLAIM (trap 3). jsdom cannot prove
 * visibility. Everything here is a claim about STORE STATE — `highlightedNodes`
 * is the set `BaseNode.tsx:77` reads and `:249` renders as
 * `ring-4 ring-info/60 ai-highlight-pulse`. That the ring is VISIBLE is a
 * browser claim and is made separately, in a real browser, never here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  pulseAppliedTargets,
  PULSE_COALESCE_MS,
  PULSE_DURATION_MS,
} from '../../canvas/utils/appliedEditPulse'
import { parseV5Response } from '../responseParser'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { readGroundedSelection } from '../groundedSelection'
import { useCanvasStore } from '../../canvas/store'

/** The declared, schema-valid part of a turn. Identical in every case below,
 *  so the ONLY variable across the discriminating pairs is the sidecar. */
const declaredTurn = {
  response_version: 2,
  assistant_text: 'That option carries its own 3% risk of the launch slipping.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
} as const

function wireBody(groundedSelection?: unknown): Record<string, unknown> {
  return {
    ...declaredTurn,
    ...(groundedSelection === undefined ? {} : { _grounded_selection: groundedSelection }),
  }
}

/** Parse a raw wire body the way the app does — through the real parser, so
 *  the `__additive__` demotion under test is the production one and not a
 *  hand-built object that merely resembles it. */
async function parseWire(body: Record<string, unknown>) {
  const result = await parseV5Response(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  if (result.kind !== 'response') {
    throw new Error(`expected a parsed response, got kind=${result.kind}`)
  }
  return result.response
}

/** The production call-site shape, reproduced rather than approximated
 *  (`useConversation.ts:4736`). Spreading the live store is what carries
 *  `setGroundedFocus` through — a hand-listed store double would pass this
 *  spec while the real call site silently dropped the action. */
function productionShapedStore(): V5ApplicatorStore {
  const snapshot = useCanvasStore.getState()
  return {
    ...snapshot,
    currentResultsHash: snapshot.results?.hash ?? null,
  } as unknown as V5ApplicatorStore
}

async function applyWire(
  body: Record<string, unknown>,
  options?: Parameters<typeof applyV5State>[2],
): Promise<void> {
  const response = await parseWire(body)
  applyV5State(response, productionShapedStore(), options)
}

/**
 * The marks the canvas renders for a grounded answer, read from the slice that
 * OWNS them.
 *
 * ⚠ THIS READS `groundedFocus.nodeIds`, NOT `highlightedNodes`, AND THE
 * DIFFERENCE IS THE POINT. An earlier revision wrote the marks into
 * `highlightedNodes`; an adversarial review refuted that at the bytes —
 * eleven other writers share that channel, and `appliedEditPulse` both
 * replaces it and then EMPTIES it at `PULSE_DURATION_MS`. `BaseNode` reads
 * both sets and applies the same treatment, so the pixels are unchanged; the
 * state is now the grounding's own.
 */
const marks = (): string[] => [...useCanvasStore.getState().groundedFocus.nodeIds].sort()

/** The SHARED channel, which this slice must never write. */
const sharedHighlights = (): string[] => [...useCanvasStore.getState().highlightedNodes].sort()

beforeEach(() => {
  useCanvasStore.setState({
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    groundedFocus: { nodeIds: new Set<string>(), unresolved: null },
  })
})

describe('hop 4b — the answer’s element is marked on the canvas', () => {
  it('marks the node the answer was grounded on, bound by id', async () => {
    await applyWire(
      wireBody({ element_ids: ['node-engineer-salary'], unresolved: 'none' }),
    )

    // Bound by IDENTITY, not by a predicate another node could satisfy
    // (trap 19): the exact id, and nothing else marked.
    expect(marks()).toEqual(['node-engineer-salary'])
    expect(useCanvasStore.getState().groundedFocus.unresolved).toBe('none')
  })

  it('marks a DIFFERENT node when the answer is grounded on a different one', async () => {
    // The discriminating half of the pair. Test 1 alone cannot distinguish
    // "marks the grounded element" from "marks whatever id it is handed" —
    // only an asserted INEQUALITY across two otherwise-identical turns can.
    await applyWire(wireBody({ element_ids: ['node-engineer-salary'], unresolved: 'none' }))
    const first = marks()

    await applyWire(wireBody({ element_ids: ['node-market-timing'], unresolved: 'none' }))
    const second = marks()

    expect(first).toEqual(['node-engineer-salary'])
    expect(second).toEqual(['node-market-timing'])
    expect(second).not.toEqual(first)
  })

  it('marks every grounded element when the answer is grounded on several', async () => {
    await applyWire(
      wireBody({ element_ids: ['node-a', 'node-b', 'node-c'], unresolved: 'none' }),
    )
    expect(marks()).toEqual(['node-a', 'node-b', 'node-c'])
  })
})

describe('hop 4b — the ungrounded negative control', () => {
  it('marks NOTHING on a turn that carried no selection', async () => {
    // The generic-answer control: the identical question with nothing
    // selected. CEE omits the sidecar entirely, so this body is byte-identical
    // to every pre-hop-4b turn.
    await applyWire(wireBody())

    expect(marks()).toEqual([])
    expect(useCanvasStore.getState().groundedFocus.unresolved).toBeNull()
  })

  it('CLEARS the previous answer’s marks when the next turn is ungrounded', async () => {
    // Stale attention — the canvas still pointing at what an OLD answer was
    // about while the user reads a new one — is worse than no attention.
    await applyWire(wireBody({ element_ids: ['node-engineer-salary'], unresolved: 'none' }))
    expect(marks()).toEqual(['node-engineer-salary'])

    await applyWire(wireBody())

    expect(marks()).toEqual([])
    expect(useCanvasStore.getState().groundedFocus.unresolved).toBeNull()
  })

  it('does not resurrect a superseded turn’s grounding over a newer turn', async () => {
    // The grounded-focus read sits AFTER `applyV5State`'s stale-turn guard.
    // Pinned here rather than assumed, because moving the call one block
    // earlier would silently reverse it.
    await applyWire(wireBody({ element_ids: ['node-stale'], unresolved: 'none' }), {
      turnClientId: 'turn-1',
      currentClientTurnId: 'turn-2',
    })

    expect(marks()).toEqual([])
  })
})

describe('hop 4b — the grounding owns its own state and clobbers nobody', () => {
  // ⭐ THE CASES A REVIEW HAD TO FIND, because the suite as first written was
  // structurally blind to them: every test reset `highlightedNodes` to empty
  // and none exercised a patch-bearing turn, so a wholesale replace and an
  // ownership-respecting write were indistinguishable to it. A corpus that
  // never populates the shared channel cannot observe the shared channel being
  // trampled.

  it('leaves another writer’s marks alone on a GROUNDED turn', async () => {
    // e.g. a coaching highlight, a compare-tab transition, a panel hover sync.
    useCanvasStore.getState().setHighlightedNodes(['node-someone-elses'])

    await applyWire(wireBody({ element_ids: ['node-grounded'], unresolved: 'none' }))

    expect(marks()).toEqual(['node-grounded'])
    expect(sharedHighlights()).toEqual(['node-someone-elses'])
  })

  it('leaves another writer’s marks alone on an UNGROUNDED turn', async () => {
    // The clear must clear ITS OWN slice and nothing else. The earlier
    // revision guarded on whether this slice was non-empty, which is a
    // different question from whether it still owns what is on screen.
    await applyWire(wireBody({ element_ids: ['node-grounded'], unresolved: 'none' }))
    useCanvasStore.getState().setHighlightedNodes(['node-someone-elses'])

    await applyWire(wireBody())

    expect(marks()).toEqual([])
    expect(sharedHighlights()).toEqual(['node-someone-elses'])
  })

  it('survives an applied-edit pulse on the SAME turn, including its 2s clear', async () => {
    // THE FLAGSHIP JOURNEY: "change THIS one" — a turn that both applies a
    // patch and carries a selection. `appliedEditPulse.flush` replaces
    // `highlightedNodes` ~100ms later and EMPTIES it at PULSE_DURATION_MS.
    // While the marks lived in that channel the capability did not survive
    // its own headline use case, and no test could see it.
    vi.useFakeTimers()
    try {
      await applyWire(wireBody({ element_ids: ['node-grounded'], unresolved: 'none' }))
      pulseAppliedTargets({ nodeIds: ['node-just-edited'], edgeIds: [] })

      vi.advanceTimersByTime(PULSE_COALESCE_MS + 10)
      expect(marks()).toEqual(['node-grounded'])

      vi.advanceTimersByTime(PULSE_DURATION_MS + 10)
      // The pulse has cleared its own channel; the grounding is still marked.
      expect(sharedHighlights()).toEqual([])
      expect(marks()).toEqual(['node-grounded'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('survives a CROSS-TURN pulse — edit, then ask a grounded question 1s later', async () => {
    // ⭐ THE TIMELINE THAT NEEDS NO COINCIDENCE AT ALL, and therefore the one
    // that settles reachability. Nothing here requires CEE to emit a grounding
    // on a patch-bearing turn (a producer-side question this lane has NOT
    // settled — trap 16-inverse). Turn N applies a patch; turn N+1 is an
    // ordinary grounded question inside the pulse's 2s window; the pulse's
    // clear then fires under it.
    vi.useFakeTimers()
    try {
      pulseAppliedTargets({ nodeIds: ['node-just-edited'], edgeIds: [] })
      vi.advanceTimersByTime(PULSE_COALESCE_MS + 10)

      // 1s later, well inside the pulse window, the user asks about a selection.
      vi.advanceTimersByTime(1000)
      await applyWire(wireBody({ element_ids: ['node-grounded'], unresolved: 'none' }))
      expect(marks()).toEqual(['node-grounded'])

      // The earlier turn's clear fires. It must not touch this turn's grounding.
      vi.advanceTimersByTime(PULSE_DURATION_MS)
      expect(sharedHighlights()).toEqual([])
      expect(marks()).toEqual(['node-grounded'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('survives an EDGE-ONLY patch, which clears the shared node set outright', async () => {
    // `flush()` calls `setHighlightedNodes(nodeIds)` UNCONDITIONALLY, so a
    // patch touching only edges passes an empty node list and actively empties
    // the shared channel — no timer needed, and no node ever pulsed.
    vi.useFakeTimers()
    try {
      await applyWire(wireBody({ element_ids: ['node-grounded'], unresolved: 'none' }))
      pulseAppliedTargets({ nodeIds: [], edgeIds: ['edge-1'] })

      vi.advanceTimersByTime(PULSE_COALESCE_MS + 10)
      expect(sharedHighlights()).toEqual([])
      expect(marks()).toEqual(['node-grounded'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('hop 4b — the canvas never claims a path it does not have', () => {
  it('writes no highlighted EDGES for a grounding', async () => {
    // #694's neighbourhood-focus honesty precedent, transposed. FocusModeChip
    // renders "Showing paths from X to goal" on `highlightedEdges.size > 0`
    // alone — so a grounding, which involves no path, must leave that set
    // empty or the chip states something untrue. Guarded as an ADDITIVE
    // mutant: add an `highlightedEdges` write to `setGroundedFocus` and this
    // test must RED.
    await applyWire(
      wireBody({ element_ids: ['node-a', 'node-b'], unresolved: 'none' }),
    )

    expect(marks()).toEqual(['node-a', 'node-b'])
    expect([...useCanvasStore.getState().highlightedEdges]).toEqual([])
  })

  it('does not move the user’s own selection', async () => {
    // The AI's attention and the user's pointer are different facts and are
    // allowed to diverge. The AI may never move the pointer.
    useCanvasStore.setState({
      selection: {
        nodeIds: new Set(['node-the-user-picked']),
        edgeIds: new Set<string>(),
        anchorPosition: null,
      },
    })

    await applyWire(wireBody({ element_ids: ['node-the-ai-used'], unresolved: 'none' }))

    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['node-the-user-picked'])
    expect(marks()).toEqual(['node-the-ai-used'])
  })
})

describe('hop 4b — `not_in_model` and `could_not_check` stay apart on the wire', () => {
  it('carries `could_not_check` through to the store as itself', async () => {
    await applyWire(wireBody({ element_ids: [], unresolved: 'could_not_check' }))

    expect(useCanvasStore.getState().groundedFocus.unresolved).toBe('could_not_check')
    expect(marks()).toEqual([])
  })

  it('carries `not_in_model` through to the store as itself, on an identical payload', async () => {
    await applyWire(wireBody({ element_ids: [], unresolved: 'not_in_model' }))

    expect(useCanvasStore.getState().groundedFocus.unresolved).toBe('not_in_model')
    expect(marks()).toEqual([])
  })

  it('the two states are DISTINGUISHABLE in the store, not merely both empty', async () => {
    // The pair, asserted as a pair. Both mark nothing — so if the store
    // collapsed them, every individual assertion above would still pass and
    // the UI would have no way left to tell the user which one happened.
    await applyWire(wireBody({ element_ids: [], unresolved: 'could_not_check' }))
    const a = useCanvasStore.getState().groundedFocus.unresolved

    await applyWire(wireBody({ element_ids: [], unresolved: 'not_in_model' }))
    const b = useCanvasStore.getState().groundedFocus.unresolved

    expect(a).not.toBe(b)
  })
})

describe('hop 4b — the reader is the boundary, and it fails closed', () => {
  // The sidecar bypasses the strict schema by construction, so nothing
  // upstream validates it. Each of these must yield NO marks — never a
  // partial or coerced highlight, which on screen is indistinguishable from
  // a complete one.
  const malformed: ReadonlyArray<readonly [string, unknown]> = [
    ['an unrecognised `unresolved` value', { element_ids: ['node-a'], unresolved: 'maybe' }],
    ['a missing `unresolved`', { element_ids: ['node-a'] }],
    ['`element_ids` that is not an array', { element_ids: 'node-a', unresolved: 'none' }],
    ['a non-string id', { element_ids: ['node-a', 7], unresolved: 'none' }],
    ['an empty-string id', { element_ids: [''], unresolved: 'none' }],
    ['a non-object sidecar', 'node-a'],
  ]

  it.each(malformed)('marks nothing given %s', async (_label, payload) => {
    await applyWire(wireBody(payload))
    expect(marks()).toEqual([])
    expect(useCanvasStore.getState().groundedFocus.unresolved).toBeNull()
  })

  it('rejects a partially-malformed id list WHOLE, rather than marking the good ids', async () => {
    await applyWire(wireBody({ element_ids: ['node-good', 42], unresolved: 'none' }))
    expect(marks()).toEqual([])
  })

  it('POSITIVE CONTROL: the same probe DOES read a well-formed sidecar', async () => {
    // Without this, every assertion above could be passing because the reader
    // is blind rather than because it is strict (trap 13).
    const response = await parseWire(
      wireBody({ element_ids: ['node-a'], unresolved: 'none' }),
    )
    expect(readGroundedSelection(response)).toEqual({
      nodeIds: ['node-a'],
      unresolved: 'none',
    })
  })
})
