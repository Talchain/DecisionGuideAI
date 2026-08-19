/**
 * ROADMAP 2.1288 fast-follow — CALL-SITE pin for `sendChip`'s typed wire intent.
 *
 * #791 made typed coaching intents actually leave the UI. Its own spec
 * (`V5CoachingActionChip.spec.tsx`) pins the PRODUCER end — a rendered click
 * calls `_sendChip` with `intent: 'add_option'` in its meta — and
 * `intentGate.spec.ts` pins the GATE end. Between them sit the two hops the PR
 * ADDED, and at this head `wire_intent` had ZERO test references anywhere
 * (contrast controls in the same sweep: `action_type` 62 files, `chipMeta` 10 —
 * real absence, not instrument blindness).
 *
 * MEASURED BEFORE THIS SUITE EXISTED — deleting the hop
 *   `...(chip.wire_intent ? { intent: chip.wire_intent } : {}),`
 * in `sendChip` leaves the whole neighbourhood GREEN: 8 spec
 * files, 250 passed / 22 skipped, counts byte-identical to pristine, INCLUDING
 * `V5CoachingActionChip.spec.tsx` itself — because that spec mocks `_sendChip`
 * and never exercises the real `ConversationPanel`/`useConversation` path. With
 * the hop gone the widening card's `add_option` still reaches the store and
 * still becomes `wire_intent`, then dies at that line; the turn ships without
 * `chip.intent`, CEE's add-option rail never fires, and the defect #791 was
 * written to close is fully restored under a green suite.
 *
 * That is the defect class named in the PR's own spec header — "a field that
 * exists and is never populated is indistinguishable, from the type's point of
 * view, from one that works" — occurring one layer BELOW where the author
 * pinned it.
 *
 * This suite renders the REAL `useConversation` hook and drives the REAL
 * `sendChip` → `dispatchAction` → `buildChipMeta` → `buildV5Payload` chain,
 * mocking only the network runner (`callV5Turn`) and the auth/scenario bridges.
 * Nothing between the chip and the wire is stubbed, so the observation point is
 * the payload actually handed to the transport.
 *
 * BINDING BY IDENTITY (trap 19): every assertion binds via the chip's own `id`,
 * asserted on the payload. "Some chip carried add_option" is a value predicate
 * another object could satisfy; "the chip whose id is `chip-widen-1` carried
 * add_option" is not.
 *
 * A DISCRIMINATING SET, not one case repeated:
 *   1. `add_option`      → `chip.intent === 'add_option'`
 *   2. `challenge_frame` → `chip.intent === 'challenge_frame'`
 *      A hop hardcoded to 'add_option' passes (1) and FAILS (2); a hop that
 *      forwards nothing fails both. Neither case alone proves forwarding.
 *   3. no `wire_intent`  → NO `intent` KEY on the wire (absent, not `undefined`)
 *      The gate is fail-closed by design, and the chip's UI STYLING
 *      `intent: 'primary'` must never leak into the typed wire field it shares
 *      a name with (CLAUDE.md trap 21 — two concepts under one name, which is
 *      exactly why `wire_intent` carries a separate name at all).
 *
 * ⚠ THE HOP IS NAMED BY ITS CODE, NEVER BY A LINE NUMBER. It sat at
 * `useConversation.ts:6565` when this suite was written and at :6600 one
 * rebase later — #810's durable-deletion receipt and #804's model-building
 * notices landed above it and moved it 35 lines without touching it. A line
 * number in a test name is a hand-maintained mirror (CLAUDE.md trap 12): it
 * drifts silently and reads as green the whole time. Locate the hop with
 *   rg -n 'chip\.wire_intent \? \{ intent: chip\.wire_intent \}'
 *
 * MUTATION MAP — each applied to COMMITTED state in a throwaway worktree
 * outside the repo root, applied-check scoped to `src/` reading exactly 1
 * (control 0), restored from a pristine ARCHIVE between runs, leading and
 * trailing controls GREEN. Every mutant bites a DIFFERENT subset, which is what
 * makes this a discriminating kit rather than four tests agreeing with each
 * other:
 *
 *   M1  delete the hop entirely
 *         → 1 RED ('expected undefined to be add_option')
 *           2 RED ('expected undefined to be challenge_frame'), 3 green
 *   M2  hardcode `{ intent: 'add_option' }`
 *         → 1 GREEN, 2 RED ('expected add_option to be challenge_frame'), 3 green
 *         This pair (M1/M2) is the binding proof: case 1 alone is satisfied by a
 *         constant, so it proves sensitivity to SOMETHING, not to the chip's own
 *         intent. Only case 2 failing while case 1 passes proves the value is
 *         forwarded rather than fabricated.
 *   M3  forward the STYLING `chip.intent` instead of `chip.wire_intent`
 *         → 1 RED, 2 RED, 3 green — green because the send gate WITHHOLDS
 *           'primary' (not in CEE_ACCEPTED_INTENTS), so the leak is stopped one
 *           layer down. Recorded rather than smoothed over: case 3's `not.toBe
 *           ('primary')` limb is enforced by the GATE, not by this hop.
 *   M4  fabricate a default: `intent: chip.wire_intent ?? 'add_option'`
 *         → 1 green, 2 green, 3 RED ('expected true to be false')
 *         This is what proves case 3 is not vacuous — it is the only mutant the
 *         absence assertion catches, and without it case 3 would be a guard no
 *         measurement had ever shown discriminating.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'
import { CEE_ACCEPTED_INTENTS } from '../../../v5/buildPayload'
import type { ActionChip } from '../types'

// ---------------------------------------------------------------------------
// Mocks — the network runner and the auth/scenario bridges ONLY.
// `sendChip`, `dispatchAction`, `buildChipMeta`, `buildV5Payload` and the send
// gate are all REAL: mocking any of them would rebuild the very vacuity this
// suite exists to close.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

const mockCallV5Turn = vi.fn()
// `importOriginal`-spread rather than a hand-listed mock (CLAUDE.md trap 12):
// a bare factory REPLACES the module, so every export added since — `__internals`
// among them — silently vanishes and the caller fails at runtime instead of here.
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
  }
})

// The streamed turn sibling is stubbed UNREACHABLE, deliberately and explicitly
// — the same construction `useConversation.hook.spec.ts` uses for its payload
// pins. It is not an artificial state: it is exactly a deployment where the
// streamed route is absent or refusing, and the buffered fallback it triggers is
// the chain under test here. Making the refusal explicit matters — left implicit,
// the fallback happened only because an incomplete mock threw, which is an
// accident that could silently stop happening.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => flags.isV5CanonicalAnalysisEnabled(),
  }
})

const mockGetUserId = vi.fn<[], Promise<string | null>>()
vi.mock('../../../lib/supabase', () => ({
  getUserId: (...args: unknown[]) => mockGetUserId(...(args as [])),
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: null,
  }),
}))

const mockLoadScenario = vi.fn<[string], Promise<unknown>>()
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...(args as [string])),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeV5SuccessResult = (text = 'OK') => ({
  kind: 'response' as const,
  response: {
    response_version: 2,
    assistant_text: text,
    blocks: [] as unknown[],
    suggested_actions: [] as unknown[],
    insights: [] as unknown[],
    stage_indicator: 'frame',
  },
})

/** The widening card's chip, as `ActionChip` — the shape #791 made travel. */
function makeChip(overrides: Partial<ActionChip> & Pick<ActionChip, 'id'>): ActionChip {
  return {
    label: 'Add an option',
    // The UI STYLING variant. Deliberately set on every fixture: if the hop
    // ever forwards THIS field instead of `wire_intent`, case 3 goes RED.
    intent: 'primary',
    message: 'Add a fourth option: partner with a regional distributor.',
    ...overrides,
  }
}

type WirePayload = {
  source?: string
  chip?: { id?: string; action_type?: string; intent?: string; parameters?: unknown }
}

/** The payload actually handed to the transport for a given chip id. */
function payloadForChipId(id: string): WirePayload {
  const matches = mockCallV5Turn.mock.calls
    .map((c) => c[0] as WirePayload)
    .filter((p) => p.chip?.id === id)
  // Pin the precondition in-test (trap 13b): exactly one turn, bound to THIS
  // chip's identity. If the chain silently stopped sending, or sent something
  // else, this fails here rather than letting a downstream assertion pass or
  // fail for the wrong reason.
  expect(matches).toHaveLength(1)
  return matches[0]
}

// ---------------------------------------------------------------------------

describe('sendChip — the typed wire intent reaches the wire', () => {
  beforeEach(() => {
    mockCallTurn.mockReset()
    mockStreamTurn.mockReset()
    mockCallV5Turn.mockReset()
    mockCallV5Turn.mockResolvedValue(makeV5SuccessResult())
    mockGetUserId.mockReset()
    mockGetUserId.mockResolvedValue(null)
    mockLoadScenario.mockReset()
    mockLoadScenario.mockResolvedValue(null)

    useResultsStore.setState({
      results: {
        status: 'idle',
        progress: 0,
        analysisSummary: undefined,
        lastSnapshotId: undefined,
      },
    } as never)

    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [],
      edges: [],
    })
  })

  it('the gate accepts both intents this suite discriminates on (precondition, not a claim about the hop)', () => {
    // Without this, cases 1 and 2 could both agree by being WITHHELD by the
    // send gate rather than by being forwarded — a guard agreeing with itself
    // (trap 13b). The gate is a hand-maintained allowlist; if it changes under
    // this suite, the discrimination dies silently unless pinned here.
    expect(CEE_ACCEPTED_INTENTS.has('add_option' as never)).toBe(true)
    expect(CEE_ACCEPTED_INTENTS.has('challenge_frame' as never)).toBe(true)
  })

  it('a chip carrying wire_intent add_option ships chip.intent add_option on that chip', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendChip(
        makeChip({ id: 'chip-widen-1', wire_intent: 'add_option' }),
      )
    })

    const payload = payloadForChipId('chip-widen-1')
    expect(payload.chip?.intent).toBe('add_option')
    // The identity the assertion is bound to, asserted explicitly.
    expect(payload.chip?.id).toBe('chip-widen-1')
    expect(payload.source).toBe('chip')
  })

  it('a chip carrying a DIFFERENT wire_intent ships THAT intent — a hardcoded add_option cannot pass', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendChip(
        makeChip({
          id: 'chip-challenge-1',
          label: 'Challenge the frame',
          message: 'Is this the right question to be asking at all?',
          wire_intent: 'challenge_frame',
        }),
      )
    })

    const payload = payloadForChipId('chip-challenge-1')
    expect(payload.chip?.intent).toBe('challenge_frame')
    expect(payload.chip?.intent).not.toBe('add_option')
    expect(payload.chip?.id).toBe('chip-challenge-1')
  })

  it('a chip with NO wire_intent ships NO intent KEY — the styling intent never leaks (fail-closed)', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      // `intent: 'primary'` is present (makeChip sets it) and is the STYLING
      // variant. It must not appear as the typed wire intent.
      await result.current.sendChip(makeChip({ id: 'chip-plain-1' }))
    })

    const payload = payloadForChipId('chip-plain-1')
    // The chip still travels — identity is not conditional on the intent.
    expect(payload.chip?.id).toBe('chip-plain-1')
    // ABSENT, not `undefined`: an explicit `intent: undefined` would serialise
    // differently and is a different claim about the wire.
    expect(payload.chip && 'intent' in payload.chip).toBe(false)
    expect(payload.chip?.intent).not.toBe('primary')
  })
})
