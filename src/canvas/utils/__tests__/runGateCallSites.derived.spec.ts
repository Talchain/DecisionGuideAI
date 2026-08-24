/**
 * DERIVED guard: every run-gate call site feeds the streamed-draft honesty rung
 * (ROADMAP 2.122).
 *
 * ── WHY THIS EXISTS, AND WHY IT IS SHAPED THIS WAY ───────────────────────
 * The mutation battery for this lane produced a survivor: removing
 * `draftStreamPhase` from `OutputsDock`'s `canRunAnalysis(...)` call stayed
 * GREEN. Nothing tested the wiring line — the gate's own logic is well covered
 * (`canRunAnalysis.draftStreamPhase.spec.ts`, exhaustive over the phase union),
 * but a gate nobody feeds is a gate that never fires. That is the
 * guarantee-theatre shape: correct machinery, never executed.
 *
 * Two ways to close it were considered and rejected:
 *
 *   - **make the param REQUIRED.** A compile error is the loudest alarm there
 *     is, but `canRunAnalysis` has 52 test call sites and forcing all of them to
 *     name a phase would be pure noise around a two-caller change.
 *   - **mount the components.** `OutputsDock` is ~2,500 lines with a large
 *     dependency graph; a render test would cover ONE surface and would have to
 *     be duplicated for the next one.
 *
 * This guard instead DERIVES the call-site manifest from the source at test
 * time. It therefore covers a THIRD run surface added tomorrow, which neither
 * alternative does, and it cannot go stale the way a hand-listed set of files
 * would (trap 12): the file list is a grep result, not a literal.
 *
 * Its honest limit, stated: this is a STRUCTURAL check on source text. It proves
 * the argument is passed, not that the value passed is the live store value. The
 * end-to-end behaviour is pinned separately by `streamedDraftTurn.spec.ts`,
 * which drives the real store through a real streamed turn.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  SRC,
  blankComments,
  runGateCallSites,
} from './helpers/derivedCallSites'

/**
 * ⚠ THE SCANNER LIVES IN ONE PLACE NOW (`helpers/derivedCallSites.ts`).
 * This spec previously defined its own copy, verbatim-duplicated into
 * `blockedReasonStaleWiring.derived.spec.ts`. Both copies shared one defect —
 * they matched the gate's name inside COMMENTS — so a prose reference in
 * `SuggestedChips.tsx` was counted as a third call site and four tests failed
 * against a file that never calls the gate. Fixing it in one copy would have
 * left the other wrong. The helper is the canonical owner; this file consumes
 * it and defines no scanner.
 */
const CALL_SITES = runGateCallSites()

describe('run-gate call sites — derived manifest', () => {
  it('finds the call sites at all (trap 13: prove the matcher sees a presence)', () => {
    // If this ever drops to zero, every assertion below becomes vacuous. It is
    // the first test in the file for exactly that reason.
    expect(CALL_SITES.length).toBeGreaterThan(0)
    // And the manifest is reported by name, so a reviewer can see what was
    // actually covered rather than trusting a count.
    expect(CALL_SITES.map((c) => c.file).sort()).toEqual([
      'canvas/components/OutputsDock.tsx',
      'canvas/conversation/ConversationPanel.tsx',
    ])
  })

  it.each(CALL_SITES.map((c) => [c.file, c] as const))(
    '%s feeds the gate its draftStreamPhase',
    (_file, site) => {
      // ROADMAP 2.122: a run affordance that does not tell the gate about the
      // streamed draft's phase will hand the user a live Run button at ~36 s,
      // over values CEE is about to change and a scenario it has not committed.
      expect(site.args).toMatch(/\bdraftStreamPhase\b/)
    },
  )

  it('the matcher would CATCH a call site that omitted it (positive control)', () => {
    const withoutIt = `canRunAnalysisUtil({
      graphHealth: null,
      readiness,
      hasBlockers,
      nodeCount,
    })`
    expect(/\bdraftStreamPhase\b/.test(withoutIt)).toBe(false)
  })

  it.each(CALL_SITES.map((c) => [c.file, c] as const))(
    '%s scopes the phase to the open scenario (review F2)',
    (_file, site) => {
      // Passing the RAW store field would re-create F2: an unsettled draft on one
      // scenario blocked Run on every other, with a false reason. The phase must
      // arrive through `draftStreamPhaseFor`, which is the one place that decides
      // ownership. A structural check, like its sibling above — the behaviour is
      // pinned in `draftStreamOwnership.spec.ts` and `streamedDraftTurn.spec.ts`.
      const source = readFileSync(join(SRC, site.file), 'utf8')
      expect(source).toMatch(/draftStreamPhaseFor\s*\(/)
      // …and NOT the unscoped read that caused the finding.
      expect(source).not.toMatch(/useDraftStore\(\s*\(s\)\s*=>\s*s\.draftStreamPhase\s*\)/)
    },
  )

  it('the F2 matcher would CATCH an unscoped read (positive control)', () => {
    const unscoped = 'const draftStreamPhase = useDraftStore((s) => s.draftStreamPhase)'
    expect(/useDraftStore\(\s*\(s\)\s*=>\s*s\.draftStreamPhase\s*\)/.test(unscoped)).toBe(true)
    const scoped = 'const draftStreamPhase = useDraftStore((s) => draftStreamPhaseFor(s, sid))'
    expect(/useDraftStore\(\s*\(s\)\s*=>\s*s\.draftStreamPhase\s*\)/.test(scoped)).toBe(false)
    expect(/draftStreamPhaseFor\s*\(/.test(scoped)).toBe(true)
  })

  it('the matcher recognises the aliased import name, not just the exported one', () => {
    // Both live callers import the gate as `canRunAnalysisUtil`. A pattern that
    // only matched `canRunAnalysis(` would find nothing and the suite would be
    // decorative.
    expect(CALL_SITES.every((c) => /canRunAnalysis(?:Util)?\s*\(\s*\{/.test(c.args))).toBe(true)
    expect(CALL_SITES.some((c) => c.args.startsWith('canRunAnalysisUtil'))).toBe(true)
  })
})

describe('the 130 s timeout handler consumes the preview predicate (review F1, adjacent)', () => {
  /**
   * Structural, and for the same reason as the run-gate guard above: the timeout is
   * a 130-second wall-clock branch, which is exactly the code that ships untested.
   * The DECISION it makes is pinned exhaustively in
   * `stores/__tests__/draftStreamOwnership.spec.ts`; this asserts the branch
   * actually asks.
   *
   * Without it, the handler tells a user whose graph is visibly on the canvas
   * that the turn did not happen — and marks the delivered bubble failed —
   * directly contradicting the honest notice the abort path adds beside it.
   */
  const source = readFileSync(join(SRC, 'canvas/conversation/useConversation.ts'), 'utf8')

  it('asks streamedPreviewStandingFor before rendering the generic timeout copy', () => {
    expect(source).toMatch(/streamedPreviewStandingFor\(/)
    // The generic copy must be gated on it.
    expect(source).toMatch(/!streamedPreviewStanding/)
  })

  it('still renders a generic notice — the fix suppresses it, it does not delete it', () => {
    // Positive control: a non-streamed turn's timeout must keep saying
    // SOMETHING. A mutation that removed the notice entirely would be a
    // different defect.
    //
    // ⚠ ROADMAP 2.665 — REPOINTED, AND THE OLD FORM WAS A 12b DECAY IN WAITING.
    // This asserted the literal string "your message has not gone through",
    // i.e. it was pinned to whatever the copy happened to be that day. When
    // 2.665 removed that sentence as FALSE, the assertion did not fail: it was
    // satisfied by the replacement code's own COMMENT quoting the old wording.
    // A source-grep control that a comment can satisfy is testing nothing
    // (trap 19 — passing on the wrong object). It now binds to the copy
    // CONSTANT the handler actually renders, which no comment can impersonate,
    // and the constant's wording is pinned in deliveryUnknownHonesty.spec.tsx
    // where it can be asserted for meaning rather than for characters.
    expect(source).toMatch(/content:\s*WAIT_EXPIRY_UNKNOWN_COPY/)
    expect(source).toMatch(/from '\.\/deliveryUnknown'/)
  })
})

describe('the graph-write choke point consumes the persistence predicate (review F1)', () => {
  /**
   * ⚠ ADDED BECAUSE A MUTANT SURVIVED. Removing the `shouldPersistGraphForScenario`
   * guard from `persistGraphNow` stayed GREEN: the DECISION is pinned exhaustively
   * in `stores/__tests__/draftStreamOwnership.spec.ts`, but nothing asserted the
   * writer asks. That is the third time in this lane a correct, well-tested rule
   * turned out to have an unwired consumer — the same shape as M15/M16 in round 1.
   *
   * Structural, deliberately: driving a real Supabase write through the debounced
   * autosave in jsdom would test the harness, not the rule. The behaviour that
   * matters (which phases suppress) is pinned at the predicate.
   */
  const source = readFileSync(join(SRC, 'hooks/useScenario.ts'), 'utf8')

  it('asks shouldPersistGraphForScenario before writing scenarios.graph', () => {
    expect(source).toMatch(/shouldPersistGraphForScenario\(/)
  })

  it('asks inside persistGraphNow — the ONE write path, not some other branch', () => {
    // `persistGraphNow`'s own header declares it the single write code path shared
    // by the debounced autosave, its retry and the flush barrier. The guard has to
    // be there, or one of those three bypasses it.
    const fn = source.slice(source.indexOf('async function persistGraphNow'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(body).toMatch(/shouldPersistGraphForScenario\(/)
    // …and it must GUARD, not merely be mentioned.
    expect(body).toMatch(/if\s*\(\s*!shouldPersistGraphForScenario\(/)
  })

  it('reports whether it wrote, and the save indicator gates on that (R2-N1)', () => {
    // A suppressed no-op used to resolve indistinguishably from a real write, so
    // the caller ran setSaveStatus('saved') + a timestamp for a write that
    // deliberately did not happen. Cosmetic during the 25 s window; during a
    // terminal `unsettled` state a signed-in user sees "saved" on every edit
    // while nothing persists, then loses all of it on reload. A false indicator
    // is the honesty class this whole lane polices.
    expect(source).toMatch(/async function persistGraphNow\([^)]*\):\s*Promise<boolean>/)
    // Both status-setting call sites must gate on the returned flag.
    const gated = source.match(/const (?:wrote|retryWrote) = await/g) ?? []
    expect(gated.length).toBe(2)
    expect(source).toMatch(/mountedRef\.current && wrote/)
    expect(source).toMatch(/mountedRef\.current && retryWrote/)
    // …and no ungated "saved" write survives.
    expect(source).not.toMatch(/await p\n\s*if \(mountedRef\.current\) \{\n\s*setSaveStatus\('saved'\)/)
  })

  it('still calls the real write when permitted (positive control)', () => {
    // A mutation that suppressed every write would also satisfy the assertions
    // above; this keeps the guard from blessing a broken save path.
    const fn = source.slice(source.indexOf('async function persistGraphNow'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(body).toMatch(/saveGraphViaGatedPath\(/)
  })
})

describe('the scanner ignores comments WITHOUT going blind to code', () => {
  /**
   * These pin the fix for the defect described at the top of
   * `helpers/derivedCallSites.ts`. Each control is a DISCRIMINATING PAIR: the
   * commented form must be invisible AND the executable form must still be
   * seen, in the same fixture. A control that only proved "comments are
   * ignored" would be satisfied by a scanner that had gone blind to
   * everything, which is the failure mode that matters here — a scanner
   * finding nothing makes every derived assertion in this file vacuous.
   */
  const find = (src: string) =>
    (blankComments(src).match(/\bcanRunAnalysis(?:Util)?\s*\(\s*\{/g) ?? []).length

  it('does not see the gate named in a LINE comment, but still sees a real call beside it', () => {
    const src = [
      '// `ConversationPanel` already computes `runGateResult = canRunAnalysis({...})`',
      'const r = canRunAnalysisUtil({ readiness, draftStreamPhase })',
    ].join('\n')
    expect(find(src)).toBe(1)
    // …and it is the executable one: the comment contributes nothing.
    expect(find('// canRunAnalysis({ a })')).toBe(0)
  })

  it('does not see the gate named in a BLOCK comment or JSDoc', () => {
    expect(find('/* canRunAnalysis({ a }) */')).toBe(0)
    expect(find('/**\n * canRunAnalysisUtil({ a })\n */')).toBe(0)
    // Discrimination, same shape: real code AFTER a block comment survives.
    expect(find('/** canRunAnalysis({ a }) */\nconst r = canRunAnalysis({ b })')).toBe(1)
  })

  it('a `//` inside a STRING does not blank the rest of the line (blindness control)', () => {
    // Without string tracking this URL would blank the call that follows it,
    // silently removing a real call site from the manifest.
    const src = `const u = 'https://example.test/x'; const r = canRunAnalysis({ readiness })`
    expect(find(src)).toBe(1)
  })

  it('a regex literal containing a slash does not blank the rest of the line', () => {
    const src = `const re = /https:\\/\\//; const r = canRunAnalysis({ readiness })`
    expect(find(src)).toBe(1)
  })

  it('blanking preserves byte offsets, so argument slices stay aligned', () => {
    const src = 'const a = 1 // canRunAnalysis({ x })\nconst b = 2'
    const blanked = blankComments(src)
    expect(blanked).toHaveLength(src.length)
    expect(blanked.split('\n')).toHaveLength(src.split('\n').length)
    expect(blanked.startsWith('const a = 1 ')).toBe(true)
    expect(blanked).not.toMatch(/canRunAnalysis/)
  })

  it('CONTROL: the real manifest is non-empty, so the fix did not blind the scan', () => {
    // The scanner-level twin of the file-level assertion above. If the comment
    // fix had over-stripped, this is where it shows up as a zero rather than as
    // a quietly-passing suite.
    expect(CALL_SITES.length).toBeGreaterThan(0)
  })
})
