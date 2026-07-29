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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, it, expect } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** Every `.ts`/`.tsx` file under `src/`, tests and stories excluded. */
function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      productionSources(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.(spec|test|stories)\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Find every invocation of the run gate and return its argument-object text.
 *
 * Matches the local alias too (`canRunAnalysisUtil`), because both live callers
 * import it under that name — a matcher that only knew the exported name would
 * find zero call sites and this whole spec would pass by testing nothing.
 */
function runGateCallSites(): Array<{ file: string; args: string }> {
  const found: Array<{ file: string; args: string }> = []
  const pattern = /\bcanRunAnalysis(?:Util)?\s*\(\s*\{/g
  for (const file of productionSources(SRC)) {
    const text = readFileSync(file, 'utf8')
    // The gate's own module defines and documents it; it is not a call site.
    if (file.endsWith(join('canvas', 'utils', 'canRunAnalysis.ts'))) continue
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      // Walk braces from the opening `{` to capture the whole argument object.
      let depth = 1
      let i = m.index + m[0].length
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      found.push({ file: relative(SRC, file), args: text.slice(m.index, i) })
    }
  }
  return found
}

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
   * Without it, the handler tells a user whose graph is visibly on the canvas that
   * "your message has not gone through" — and marks the delivered bubble failed —
   * directly contradicting the honest notice the abort path adds beside it.
   */
  const source = readFileSync(join(SRC, 'canvas/conversation/useConversation.ts'), 'utf8')

  it('asks streamedPreviewStandingFor before rendering the generic timeout copy', () => {
    expect(source).toMatch(/streamedPreviewStandingFor\(/)
    // The generic copy must be gated on it.
    expect(source).toMatch(/!streamedPreviewStanding/)
  })

  it('still contains the generic copy — the fix suppresses it, it does not delete it', () => {
    // Positive control: a non-streamed turn's timeout must keep saying the true
    // thing. A mutation that removed the copy entirely would be a different defect.
    expect(source).toMatch(/your message has not gone through/i)
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

  it('still calls the real write when permitted (positive control)', () => {
    // A mutation that suppressed every write would also satisfy the assertions
    // above; this keeps the guard from blessing a broken save path.
    const fn = source.slice(source.indexOf('async function persistGraphNow'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(body).toMatch(/saveGraphViaGatedPath\(/)
  })
})
