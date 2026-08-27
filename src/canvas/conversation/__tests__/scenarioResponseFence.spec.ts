/**
 * scenarioResponseFence — behaviour-identity, PROVED BY EXECUTION.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS DEFENDING
 * ═══════════════════════════════════════════════════════════════════════════
 * Five guard sites in `useConversation` were five separately-written copies of
 * ONE comparison. Collapsing them into one named predicate is a change to
 * safety-critical code however careful it looks: four of those sites can drop a
 * complete, server-committed model, and one of them (`inline_draft_apply`) is
 * the last rung at which a model can still reach the user.
 *
 * So the equivalence is not asserted in a comment and not argued from reading.
 * It is measured here, row by row, against a LITERAL TRANSCRIPTION of the
 * expression that used to sit at every call site — the same discipline
 * `reconcileTerminalPreview` was held to when it was extracted from the same
 * function for the same reason.
 *
 * ⚠ THE PREDICATE IS NOT A RELAXATION. Every row below that the old expression
 * refused, this one refuses. The only rows that move, move towards REFUSING.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE DIVERGING ROW, AND WHY IT IS PINNED RATHER THAN ARGUED
 * ═══════════════════════════════════════════════════════════════════════════
 * `null === null` is TRUE, so the old expression treated "the canvas claims no
 * decision, and neither did the dispatch" as a MATCH and let the write through.
 * This predicate refuses it. That is the fail-closed direction — writing a model
 * into a canvas that is not claiming any decision is exactly the bridging the
 * fence exists to prevent — but it IS a behaviour change and it is named as one.
 *
 * ⭐ AN EQUIVALENT MUTANT MUST BE DEMONSTRATED, NEVER ASSERTED — this estate has
 * been bitten in BOTH directions by that rule. The reachability half of the
 * argument is therefore NOT made here in prose; it is demonstrated by execution
 * in `scenarioResponseFence.dispatchIdIsMinted.spec.tsx`, which drives a real
 * turn from a null scenario and shows the lazy mint guarantees a UUID before
 * the dispatch id is captured — so `scenarioIdAtDispatch` is never null at any
 * of the five sites, and the diverging row cannot be reached from them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  responseBelongsToDispatchingScenario,
  recordScenarioFenceDiscard,
} from '../scenarioResponseFence'
import { blankComments } from '../../utils/__tests__/helpers/derivedCallSites'
import { logger } from '../../../lib/logger'

type Id = string | null | undefined

/**
 * A LITERAL TRANSCRIPTION of what stood at all five call sites. Sites 1, 2 and 5
 * wrote it negated (`!==`); sites 3 and 4 wrote it positive (`===`). Both are
 * this one comparison, so this is the thing the new predicate must reproduce.
 */
function ORIGINAL(live: Id, dispatch: Id): boolean {
  return live === dispatch
}

/**
 * The full input alphabet. `''` is included deliberately: it is the value a
 * "clear the id" bug would most plausibly produce, and it is NOT null, so it
 * exercises the equality arm rather than the null arm.
 */
const ALPHABET: Id[] = [null, undefined, '', 'A', 'B']

function label(v: Id): string {
  return v === null ? 'null' : v === undefined ? 'undefined' : `'${v}'`
}

describe('responseBelongsToDispatchingScenario — equivalence to the five originals', () => {
  /**
   * ⭐ THE EQUIVALENCE PROOF. Every cell of the input space, compared against
   * the transcription. The divergence set is COLLECTED, not assumed — so a
   * predicate that quietly diverged on a third row would fail here, and so
   * would one that stopped diverging on the two named rows (which would mean
   * the null handling had been dropped).
   */
  it('agrees with the original on EVERY row except the two named ones', () => {
    const divergences: string[] = []
    for (const live of ALPHABET) {
      for (const dispatch of ALPHABET) {
        const now = responseBelongsToDispatchingScenario(live, dispatch)
        const before = ORIGINAL(live, dispatch)
        if (now !== before) divergences.push(`${label(live)} vs ${label(dispatch)}`)
      }
    }

    // Pinned EXACTLY — not `toContain`, not a length check. A new divergence
    // reds this, and so does a vanished one.
    expect(divergences).toEqual(['null vs null', 'undefined vs undefined'])
  })

  /** The rows that moved, moved towards REFUSING. Never the other way. */
  it('every diverging row moves towards refusing, never towards allowing', () => {
    for (const v of [null, undefined] as Id[]) {
      expect(ORIGINAL(v, v)).toBe(true)
      expect(responseBelongsToDispatchingScenario(v, v)).toBe(false)
    }
  })

  /**
   * The positive control for the table above. Without it, a predicate that
   * returned `false` for everything would produce a divergence list containing
   * only the matching rows — and could look plausible.
   */
  it('still ACCEPTS a genuine match — the table is not passing by refusing everything', () => {
    expect(responseBelongsToDispatchingScenario('A', 'A')).toBe(true)
    expect(responseBelongsToDispatchingScenario('', '')).toBe(true)
  })

  it('refuses every genuine mismatch, in both directions', () => {
    expect(responseBelongsToDispatchingScenario('A', 'B')).toBe(false)
    expect(responseBelongsToDispatchingScenario('B', 'A')).toBe(false)
    expect(responseBelongsToDispatchingScenario('A', null)).toBe(false)
    expect(responseBelongsToDispatchingScenario(null, 'A')).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('the five sites all go through the ONE predicate — derived, not mirrored', () => {
  const SOURCE = blankComments(
    readFileSync(join(process.cwd(), 'src/canvas/conversation/useConversation.ts'), 'utf8'),
  )

  /**
   * Derived from the source at test time rather than from a hand-listed set of
   * line numbers, for the reason `runGateCallSites.derived.spec.ts` records: a
   * literal list is a hand-maintained mirror and drifts silently. Comments are
   * blanked first, so a doc comment quoting the old expression cannot make this
   * pass or fail.
   *
   * Its honest limit, stated: this is a STRUCTURAL check on source text. It
   * proves no raw re-derivation survives and that the predicate is called five
   * times. It does NOT prove each call passes the live store value — that is
   * what the equivalence table plus the real-drive specs are for.
   */
  it('calls the predicate at exactly five sites', () => {
    const calls = SOURCE.match(/responseBelongsToDispatchingScenario\s*\(/g) ?? []
    expect(calls).toHaveLength(5)
  })

  /**
   * ⭐ THE ANTI-REGRESSION THAT MATTERS. A sixth guard written tomorrow as a raw
   * `!==` would reintroduce exactly the drift this module exists to end — five
   * copies of one rule, each free to be edited alone.
   */
  it('leaves NO raw re-derivation of the comparison anywhere in the turn path', () => {
    const raw =
      (SOURCE.match(/currentScenarioId\s*!==\s*scenarioIdAtDispatch/g) ?? []).length +
      (SOURCE.match(/currentScenarioId\s*===\s*scenarioIdAtDispatch/g) ?? []).length
    expect(raw).toBe(0)
  })

  /**
   * The positive control for the two assertions above: prove the scanner can
   * SEE this file at all. Without it, a bad path would read as "zero raw
   * comparisons" and "zero calls" — and one of those assertions would pass for
   * entirely the wrong reason (trap 13).
   */
  it('the scanner is reading the real file — positive control', () => {
    expect(SOURCE.length).toBeGreaterThan(100_000)
    expect(SOURCE).toContain('scenarioIdAtDispatch')
    expect(SOURCE).toContain('recordScenarioFenceDiscard')
  })
})

// ---------------------------------------------------------------------------

describe('the discard log is safe for production and for a public repo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * ⭐ AN ALLOWLIST, PINNED EXACTLY. The point of this record is that it ships —
   * `logger.warn` passes the production log level, unlike the `import.meta.env.DEV`
   * console.warn it replaces. Anything added to it ships too, so the key set is
   * fixed here and a new field cannot arrive without this test being changed
   * deliberately.
   *
   * Two scenario UUIDs, a site enum and a boolean. NO message content, NO user
   * text, NO brief, NO tokens, NO auth material.
   */
  it('emits exactly four fields: two ids, the site, and whether a graph was dropped', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    recordScenarioFenceDiscard({
      site: 'terminal_response',
      liveScenarioId: 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5',
      scenarioIdAtDispatch: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      carriedGraph: true,
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const [message, payload] = spy.mock.calls[0] as [string, Record<string, unknown>]

    expect(message).toBe('scenario_response_fence.discarded')
    expect(Object.keys(payload).sort()).toEqual([
      'carriedGraph',
      'liveScenarioId',
      'scenarioIdAtDispatch',
      'site',
    ])
    expect(payload.carriedGraph).toBe(true)
    expect(payload.site).toBe('terminal_response')
  })

  /** A missing id is reported as `null`, never as `undefined` or omitted. */
  it('normalises an absent id to null so the record is always readable', () => {
    const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    recordScenarioFenceDiscard({
      site: 'graph_ready_preview',
      liveScenarioId: null,
      scenarioIdAtDispatch: undefined,
      carriedGraph: false,
    })

    const [, payload] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload.liveScenarioId).toBeNull()
    expect(payload.scenarioIdAtDispatch).toBeNull()
    expect(payload.carriedGraph).toBe(false)
  })
})
