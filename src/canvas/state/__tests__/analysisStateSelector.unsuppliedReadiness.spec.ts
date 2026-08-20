/**
 * THE UNSUPPLIED-READINESS SENTINEL — a producer value the consumer must NOT
 * read as a verdict.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE REGRESSION THIS CLOSES (found by adversarial review of CEE #1004)
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE #1004 emits `analysis_state` on ALL 22 turn exits. Twelve of those exits
 * supply no readiness payload — including `clarify_v2`, THE MAINLINE
 * CONVERSATIONAL TURN — and on those `composeAnalysisStateV1` sets
 * `readiness.status = READINESS_STATUS_UNSUPPLIED = 'unknown'`.
 *
 * CEE's own docstring for that constant says, in terms:
 *     "It is NOT a synonym for `blocked`, and a consumer must not treat it as
 *      one."
 * This selector was treating it as one. Because the wire branch OVERRODE the
 * retained `ceeAnalysisReady` slice, and `deriveAnalysisDisplayState` returns
 * `not_ready` / "Set up your model" / **cta: null** for anything that is not
 * exactly `'ready'`, a user with a fully-drafted, CEE-ready model who asked one
 * clarifying question was told their model was not set up AND LOST THE RUN CTA.
 *
 * ⭐⭐ THE SHAPE, NOT THE INSTANCE. #1004's own review round 2 found this exact
 * shape one field up — a per-turn composed value silently DEGRADING a retained
 * known-good verdict — and fixed it for `run_state` by threading
 * `exitFreshness`. Nobody looked at `readiness`, one line down, which has the
 * IDENTICAL shape. Fixing one instance of a shape is not fixing the shape.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE, AND ITS LIMIT
 * ═══════════════════════════════════════════════════════════════════════════
 * The sentinel means "no readiness verdict was supplied ON THIS TURN" — an
 * ABSENCE, not a negative. An absence must fall back to the last known verdict;
 * it must never override one. Every other producer status is a real verdict and
 * still WINS over the legacy slice — pinned below by an opposite-direction twin,
 * so this fallback cannot quietly widen into "the wire never wins" (trap 22b).
 */
import { describe, expect, it } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

import { composeAnalysisState, type ComposeAnalysisStateInput } from '../analysisStateSelector'
import { ANALYSIS_READY_STATUS_UNSUPPLIED } from '../../../adapters/cee/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SRC, blankComments } from '../../utils/__tests__/helpers/derivedCallSites'

/**
 * PRE-ANALYSIS, the state the regression destroys: a drafted model CEE has
 * declared ready, no report on screen yet, no run fact, no freshness verdict.
 */
const PRE_ANALYSIS_LEGACY_READY: ComposeAnalysisStateInput = {
  analysisState: null,
  freshness: null,
  dirty: false,
  source: null,
  resultsStatus: 'idle',
  importHold: false,
  hasReport: false,
  ceeAnalysisReadyStatus: 'ready',
  aiPanelV2On: true,
}

const ALL_UNUSABLE = {
  usable_for_prose: false,
  usable_for_chips: false,
  usable_for_followup: false,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
  leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
  robustness: {},
} as const

/**
 * Build a wire verdict and PROVE it is one CEE may legally ship. The parse is
 * the positive control: a fixture the contract would reject proves nothing
 * about a payload a user can receive (trap 13).
 */
function wire(
  run_state: AnalysisStateV1['run_state'],
  readinessStatus: string,
  overrides: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
  const built = {
    run_state,
    readiness: { status: readinessStatus, blockers: [] },
    ...ALL_UNUSABLE,
    ...overrides,
  }
  const parsed = AnalysisStateV1Schema.safeParse(built)
  if (!parsed.success) {
    throw new Error(`fixture is not contract-valid: ${JSON.stringify(parsed.error.issues)}`)
  }
  return built as AnalysisStateV1
}

describe('analysisStateSelector — the unsupplied-readiness sentinel', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. THE REGRESSION. Both run-state kinds a clarify turn can carry.
  // ───────────────────────────────────────────────────────────────────────────

  it('never_run + unsupplied readiness KEEPS the legacy ready verdict and the Run CTA', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      analysisState: wire({ kind: 'never_run' }, ANALYSIS_READY_STATUS_UNSUPPLIED),
    })
    expect(out.displayState.state).toBe('ready_to_analyse')
    expect(out.displayState.cta).toEqual({ kind: 'primary', label: 'Run analysis' })
  })

  it('unknown_degraded + unsupplied readiness KEEPS the legacy ready verdict and the Run CTA', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      analysisState: wire(
        { kind: 'unknown_degraded', cause: 'no_graph_this_turn' },
        ANALYSIS_READY_STATUS_UNSUPPLIED,
      ),
    })
    expect(out.displayState.state).toBe('ready_to_analyse')
    expect(out.displayState.cta).toEqual({ kind: 'primary', label: 'Run analysis' })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ⭐ OPPOSITE-DIRECTION TWINS — the wire still WINS whenever it states a
  //    real verdict. Without these, "fall back on the sentinel" could widen
  //    into "never trust the wire" and the suite would applaud.
  // ───────────────────────────────────────────────────────────────────────────

  it('a REAL producer readiness status still OVERRIDES a contradicting legacy ready', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      analysisState: wire({ kind: 'never_run' }, 'needs_encoding'),
    })
    expect(out.displayState.state).toBe('not_ready')
    expect(out.displayState.cta).toBeNull()
  })

  it('a blocked run_state still forces blocked, sentinel or not', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      // CC-A (`blocked` ⇒ `blocked_unusable`) is enforced by the 0.48.0 parser,
      // so the honest blocked fixture must carry it. The `safeParse` control
      // caught the first draft of this case, which is what it is there for.
      analysisState: wire(
        { kind: 'blocked', reason_code: 'x', blockers: [] },
        ANALYSIS_READY_STATUS_UNSUPPLIED,
        { blocked_unusable: true },
      ),
    })
    expect(out.displayState.state).not.toBe('ready_to_analyse')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. THE FALLBACK FABRICATES NOTHING. When the legacy slice is ALSO
  //    unsupplied there is no verdict anywhere, and the honest answer stays
  //    not-ready — an absence must not become a positive claim.
  // ───────────────────────────────────────────────────────────────────────────

  it('does NOT invent readiness when the legacy slice is unsupplied too', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      ceeAnalysisReadyStatus: ANALYSIS_READY_STATUS_UNSUPPLIED,
      analysisState: wire({ kind: 'never_run' }, ANALYSIS_READY_STATUS_UNSUPPLIED),
    })
    expect(out.displayState.state).toBe('not_ready')
    expect(out.displayState.cta).toBeNull()
  })

  it('does NOT invent readiness when the legacy slice is absent entirely', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      ceeAnalysisReadyStatus: undefined,
      analysisState: wire({ kind: 'never_run' }, ANALYSIS_READY_STATUS_UNSUPPLIED),
    })
    expect(out.displayState.state).toBe('not_ready')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. POST-ANALYSIS is untouched — the review measured no regression there and
  //    this pins it, so the fallback cannot start rewriting completed runs.
  // ───────────────────────────────────────────────────────────────────────────

  it('post-analysis complete_current + sentinel still reads as a completed run', () => {
    const out = composeAnalysisState({
      ...PRE_ANALYSIS_LEGACY_READY,
      resultsStatus: 'complete',
      hasReport: true,
      source: 'cee_v5_run_analysis',
      analysisState: wire(
        { kind: 'complete_current', computed_at: '2026-08-18T09:00:00.000Z' },
        ANALYSIS_READY_STATUS_UNSUPPLIED,
      ),
    })
    expect(out.displayState.state).not.toBe('not_ready')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. THE SENTINEL IS NOW A PRODUCER VALUE. CEE's `READINESS_STATUS_UNSUPPLIED`
  //    and the UI's `ANALYSIS_READY_STATUS_UNSUPPLIED` must remain the SAME
  //    string, or this fallback silently stops firing while every test that
  //    hardcodes the literal keeps passing (trap 12).
  // ───────────────────────────────────────────────────────────────────────────

  it('the UI sentinel constant is still the exact string CEE emits', () => {
    expect(ANALYSIS_READY_STATUS_UNSUPPLIED).toBe('unknown')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CONVERGENCE GUARD — one declaration of the sentinel IN THIS MODULE
// ═════════════════════════════════════════════════════════════════════════════
/**
 * `analysisStateSelector.ts` used to declare its OWN `= 'unknown'` sentinel
 * beside a docstring claiming it was therefore "named ONCE, at the single seam
 * that reads it". The claim was false when written: this repo's cee-adapter
 * already exported `ANALYSIS_READY_STATUS_UNSUPPLIED` and already had a
 * consumer. Two names for one string, under a comment arguing there was one.
 *
 * ⚠ WHAT THIS GUARD DOES *NOT* CLAIM, stated so it never has to be weakened:
 * it does NOT assert repo-wide uniqueness. A third declaration of the same
 * string lives at `lib/coherence/crossSurfaceCoherence.ts` (exported, read by
 * the coherence gate) and is deliberately out of scope here. A guard that
 * asserted something false about the estate would be relaxed the first time it
 * fired honestly, and a relaxed alarm teaches people to stop looking. So the
 * scope is exactly one named module, and the name is in the assertion.
 *
 * ⚠ IT MUST BE ABLE TO FAIL, AND THE COMMENT-BLANKING IS WHY IT CAN. The real
 * module QUOTES CEE's declaration inside a `//` comment as producer evidence.
 * Over raw text this guard would red against correct code, and the obvious
 * "fix" would be to loosen the pattern until it matched nothing — a guard
 * agreeing with itself. It therefore scans comment-blanked source (reusing the
 * canonical scanner, not a second copy of one), and carries the discriminating
 * pair below: a fixture with a REAL declaration must be SEEN, a fixture with
 * only a COMMENTED one must be IGNORED. Neither alone shows anything.
 */
describe('convergence — the unsupplied sentinel is declared once, at the boundary', () => {
  /** Any `const|let|var <name> = 'unknown'` binding, however named. */
  const SENTINEL_DECL = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=\n]*)?=\s*(['"])unknown\1/g

  const declarationsIn = (text: string): string[] =>
    (blankComments(text).match(SENTINEL_DECL) ?? []).map((m) => m.trim())

  const MODULE_PATH = join(SRC, 'canvas', 'state', 'analysisStateSelector.ts')
  const moduleSource = readFileSync(MODULE_PATH, 'utf8')

  it('CONTROL: the module under test was actually read (non-empty, and is the right file)', () => {
    expect(moduleSource.length).toBeGreaterThan(1000)
    expect(moduleSource).toContain('export function selectAnalysisReadinessAuthority')
  })

  it('POSITIVE CONTROL: the detector SEES a real local declaration', () => {
    const fixture = "const READINESS_STATUS_UNSUPPLIED = 'unknown'\nexport function f() { return 1 }"
    expect(declarationsIn(fixture)).toHaveLength(1)
  })

  it('POSITIVE CONTROL: it sees one under any other name, so a rename cannot evade it', () => {
    const fixture = 'let somethingElse: string = "unknown"'
    expect(declarationsIn(fixture)).toHaveLength(1)
  })

  it('BLINDNESS CONTROL: a declaration QUOTED IN A COMMENT is not counted', () => {
    const fixture = "//     export const READINESS_STATUS_UNSUPPLIED = 'unknown'\nexport function f() { return 1 }"
    expect(declarationsIn(fixture)).toHaveLength(0)
  })

  it('analysisStateSelector.ts declares no sentinel of its own', () => {
    expect(declarationsIn(moduleSource)).toEqual([])
  })

  it('it consumes the canonical owner from the cee adapter instead', () => {
    expect(blankComments(moduleSource)).toContain(
      "import { ANALYSIS_READY_STATUS_UNSUPPLIED } from '../../adapters/cee/types'",
    )
  })

  it('and the canonical owner is the string the comparison actually needs', () => {
    expect(blankComments(moduleSource)).toContain(
      'analysisState.readiness.status === ANALYSIS_READY_STATUS_UNSUPPLIED',
    )
  })
})
