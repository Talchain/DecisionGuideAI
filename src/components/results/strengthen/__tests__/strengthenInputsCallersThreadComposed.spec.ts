/**
 * EVERY CALLER THAT BUILDS `StrengthenInputs` MUST THREAD THE **COMPOSED**
 * LEADER ANSWER — derived from the tree, not from a list anyone maintains.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS: A COMMENT WENT FALSE AND A LEADER CLAIM STOOD BEHIND IT
 * ═══════════════════════════════════════════════════════════════════════════
 * `buildRecommendations.ts` reads `inputs.hasLeadingOption` to decide whether
 * to emit "Challenge the leader" — a chip that asks the assistant to argue
 * against "the current leading option", and a row that names the alternative
 * option by label. It DERIVES nothing: it reads whatever its caller threaded.
 *
 * That made the module's guarantee a property of its CALL SITES, and the call
 * sites diverged. `StrengthenContainer` threaded
 * `leaderDesignationPermitted(data.recommendation)` — the composed answer,
 * lattice AND separation — while `buildStrengthenInputsForAnalysisNew` threaded
 * `data.recommendation.verdict?.hasLeadingOption`, Q2 alone. They agree on
 * three of the four lattice modes and diverge on exactly one:
 *
 *     permitted_analysis_mode: 'quantified_provisional'  +  arms separated
 *
 * On that run the Analysis tab said "Leading option not assessed" and stripped
 * every option name, while Analysis (New) — on the SAME `resultsSectionData` —
 * invited the user to challenge a leader and named the alternative. #1190 fixed
 * the caller. Nothing stopped the next one.
 *
 * ⚠ AND THE COMMENTS DESCRIBING THIS WERE WRONG IN BOTH FILES. `strengthenTypes.ts`
 * documented the field as "`DecisionVerdict.hasLeadingOption` VERBATIM …
 * threaded by `StrengthenContainer` from `data.recommendation.verdict`", which
 * was false when written; `buildRecommendations.ts` then asserted the module
 * "is not on that seam" and that importing the shared export "would silently
 * change which triggers fire" — false in the other direction. A future caller
 * reads those sentences, not this history, which is why the guarantee is now
 * DERIVED. A comment is a hand-maintained mirror and this pair drifted twice
 * (CLAUDE.md trap 12).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 * It proves that every `hasLeadingOption:` assignment reaching `StrengthenInputs`
 * in `src/` is spelled as the composed read. It is a STATIC claim about call
 * sites; it says nothing about layout, the wire, or the Reasoning tab's own
 * rendering. The behavioural half — that the composed read actually suppresses
 * the leader triggers on the divergent run — is the second describe block.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { buildStrengthenInputsForAnalysisNew } from '../../analysisNew/buildStrengthenInputsForAnalysisNew'
import { MODE_WITHHELD, PERMITTED } from '../../__fixtures__/leaderClaim.fixtures'

const SRC = resolve(process.cwd(), 'src')

/** The one spelling that folds the CEE admission in. */
const COMPOSED = 'leaderDesignationPermitted('

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
  }
  return acc
}

/** Production only: a fixture may legitimately hand-set the field. */
function isProduction(file: string): boolean {
  return !/__tests__|__fixtures__|__mocks__|\.spec\.|\.test\.|[\\/]tests[\\/]/.test(file)
}

/**
 * Every `hasLeadingOption: <rhs>` assignment in a file that also imports the
 * `StrengthenInputs` type — i.e. a file constructing that object.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST, and that is load-bearing rather than tidy:
 * both files this guard exists for now DISCUSS `leaderDesignationPermitted(...)`
 * in prose. Without the strip, a file could satisfy the guard by talking about
 * the right thing while doing the wrong one — a probe that reads its own
 * documentation as evidence. The stripper is proved below, not assumed.
 */
export function findAssignments(content: string, file: string): string[] {
  const code = stripComments(content, file)
  if (!/\bStrengthenInputs\b/.test(code)) return []
  return [...code.matchAll(/hasLeadingOption:\s*([^,\n]+)/g)].map((m) => m[1].trim())
}

describe('StrengthenInputs callers thread the COMPOSED leader answer', () => {
  const callers = walk(SRC)
    .filter(isProduction)
    .map((file) => ({ file, rhs: findAssignments(readFileSync(file, 'utf8'), file) }))
    .filter((c) => c.rhs.length > 0)

  it('NON-VACUITY: the sweep actually found the production call sites', () => {
    // A derived guard that finds nothing passes silently and forever. This is
    // the contrast control: the two known callers must be visible to the probe,
    // by IDENTITY, before any absence claim below means anything.
    expect(
      callers.length,
      'the sweep found no StrengthenInputs construction site — the probe is blind, not the tree clean',
    ).toBeGreaterThanOrEqual(2)
    const names = callers.map((c) => c.file.replace(SRC, 'src'))
    expect(names.some((n) => n.includes('StrengthenContainer'))).toBe(true)
    expect(names.some((n) => n.includes('buildStrengthenInputsForAnalysisNew'))).toBe(true)
  })

  it('every caller threads the composed answer, never the raw verdict', () => {
    const offenders = callers
      .flatMap((c) => c.rhs.map((rhs) => ({ file: c.file.replace(SRC, 'src'), rhs })))
      .filter((o) => !o.rhs.includes(COMPOSED))
    expect(
      offenders,
      'These call sites thread something other than leaderDesignationPermitted(...).\n'
        + 'Threading `verdict.hasLeadingOption` here re-opens "Challenge the leader" on\n'
        + 'quantified_provisional runs — the defect #1190 closed:\n'
        + offenders.map((o) => `  ${o.file}: ${o.rhs}`).join('\n'),
    ).toEqual([])
  })

  it('THE STRIPPER IS PROVED, NOT ASSUMED — a discriminating pair', () => {
    // Any check whose output licenses skipping work needs its own control.
    // Same assignment, once as code and once inside a comment: the probe must
    // see exactly one of them, or every result above is unreliable.
    const asCode = 'type X = StrengthenInputs\nconst a = { hasLeadingOption: rec.verdict?.hasLeadingOption }'
    const asComment = 'type X = StrengthenInputs\n// const a = { hasLeadingOption: rec.verdict?.hasLeadingOption }'
    expect(findAssignments(asCode, 'a.ts')).toHaveLength(1)
    expect(findAssignments(asComment, 'b.ts')).toHaveLength(0)
    // …and the gate must reject the raw-verdict spelling it just parsed,
    // otherwise the offender filter above could be vacuously empty.
    expect(findAssignments(asCode, 'a.ts')[0].includes(COMPOSED)).toBe(false)
  })
})

describe('the composed read suppresses the leader triggers on the divergent run', () => {
  const sources = (data: ReturnType<typeof PERMITTED>) => ({
    data,
    guidanceItems: [],
    biasSignals: null,
    currentStage: null,
  })

  it('PRECONDITION: the fixture really is the state the two answers disagree on', () => {
    // Pin it in-test. If MODE_WITHHELD ever stopped reproducing the divergence,
    // the arm below would pass for a reason unrelated to the property it names.
    const rec = MODE_WITHHELD().recommendation as unknown as Record<string, unknown>
    expect((rec.verdict as { hasLeadingOption?: boolean }).hasLeadingOption).toBe(true)
    expect(rec.leaderDesignationPermitted).toBe(false)
  })

  it('MODE-WITHHELD: the inputs carry FALSE, so no leader trigger can fire', () => {
    const inputs = buildStrengthenInputsForAnalysisNew(sources(MODE_WITHHELD()))
    // The whole point: Q2 alone would be `true` here and would re-open
    // "Challenge the leader". The composed read is `false`.
    expect(inputs.hasLeadingOption).toBe(false)
  })

  it('ANTI-VACUITY: a fully licensed run still carries TRUE', () => {
    // Without this twin, a caller hard-wired to `false` would pass the arm
    // above — over-suppression scoring as a fix.
    expect(buildStrengthenInputsForAnalysisNew(sources(PERMITTED())).hasLeadingOption).toBe(true)
  })
})
