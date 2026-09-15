/**
 * ⭐⭐ A LEADER SENTENCE MINTED FROM A LOCAL THRESHOLD, ONE `<DecisionSummary />`
 * AWAY FROM BEING LIVE — AND NOTHING WOULD HAVE MADE A NOISE.
 *
 * ── THE MINT ───────────────────────────────────────────────────────────────
 * `adapters/plot/v2/responseMapper.ts`, in `buildRecommendationBlock`:
 *
 *     if (winProb !== undefined && winProb > 0.6) {
 *       summary = `"${bestOption.option_label}" shows the strongest expected outcome`
 *     }
 *
 * Three faults in one sentence, and each is a standing estate ruling:
 *
 *   1 · IT NAMES A LEADING OPTION FROM A LOCAL CONSTANT. No reference to
 *       `leaderDesignationPermitted`, to `verdict.hasLeadingOption`, or to any
 *       producer permission — the entitlement seam #709/#737 exist to protect,
 *       decided here by the number `0.6`.
 *   2 · THE OBJECT CARRIES `source: 'engine'`, so a sentence the UI wrote is
 *       stamped as the producer's. That is the `compare-tab/Hero` defect
 *       (a hero asserting a cause it had never measured) with a provenance
 *       field attached.
 *   3 · THE RANKING BEHIND IT SORTS `win_probability ?? probability_of_goal`.
 *       Those are different KINDS: comparative shares partition the simulated
 *       runs and sum to 1, goal probabilities are independent per option and
 *       sum to nothing. An option ranked on its share against one ranked on its
 *       goal probability is not a ranking. "expected outcome" names a third
 *       quantity again, which is neither.
 *
 * Its `else` arm is its own claim: `'Options are closely matched'` fires
 * whenever the leader is at or below 0.6 — false when the leader holds 0.55 and
 * the rest hold 0.05 each.
 *
 * ── WHY IT IS NOT A DEFECT TODAY, DERIVED WITH CONTROLS ────────────────────
 * The sentence is carried FOUR live hops and stops at the fifth:
 *
 *     buildRecommendationBlock
 *       -> synthesizeCeeReviewFromV2        live
 *       -> hydrateAnalysis.ts:148           live — restore-from-Supabase
 *       -> store.ceeReviewV1                live, sanitised
 *       -> ceeDataAdapter getRationale      summary -> headline
 *       -> DecisionSummary renders headline
 *       -> <DecisionSummary                 ZERO mount sites
 *
 * ⛔ THIS FILE IS THAT LAST LINE, TURNED INTO A RED. The scan below is the
 * standing one, not a note in a commit message: mount the component and the
 * suite fails, naming the entitlement question that must be answered first.
 *
 * ⚠ AND IT PINS ITS OWN PRECONDITION (trap 13b). If the mint is ever removed,
 * this guard is protecting nothing and would pass forever while describing a
 * state that no longer exists. So the mint's presence is ASSERTED. If that
 * assertion fails, the correct action is to DELETE THIS FILE, and the failure
 * message says so.
 *
 * ⚠ AND EVERY ABSENCE HERE CARRIES A POSITIVE CONTROL (trap 13). A scanner
 * that reads no files, or a regex that matches nothing anywhere, agrees with
 * every absence assertion ever written. The controls are four components known
 * to be mounted and the tree's own `lazy(` sites — a real count each, not a
 * `not.toMatch` against a name nobody wrote.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const SRC = resolve(__dirname, '../../..')

/** Every source file, tests excluded — they mount things on purpose. */
const sourceFiles = (): string[] => {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        walk(p)
        continue
      }
      if (!/\.tsx?$/.test(entry) || /\.spec\.tsx?$/.test(entry)) continue
      if (p.includes(`${SRC}/test/`)) continue
      out.push(p)
    }
  }
  walk(SRC)
  return out
}

const FILES = sourceFiles()
const CORPUS = FILES.map((f) => readFileSync(f, 'utf8')).join('\n')

/** How many files mount `<Name`. */
const mountSites = (name: string): number =>
  FILES.filter((f) => new RegExp(`<${name}\\b`).test(readFileSync(f, 'utf8'))).length

describe('the instrument can see', () => {
  it('⛔ POSITIVE CONTROL — the scan read a real corpus', () => {
    // A scanner that read nothing agrees with every absence below.
    expect(FILES.length, 'the source walk collected no files').toBeGreaterThan(500)
    expect(CORPUS.length).toBeGreaterThan(1_000_000)
  })

  it('⛔ POSITIVE CONTROL — it finds mounts that are really there', () => {
    // Four components witnessed rendering on the deployed Reasoning tab. If the
    // regex shape ever stops matching a real mount, these fail before the
    // absence claim below can pass for the wrong reason.
    for (const mounted of ['OptionsComparison', 'AtAGlance', 'TrustLine', 'WhatsChanged']) {
      expect(mountSites(mounted), `${mounted} is mounted; a probe that cannot see it cannot prove an absence`)
        .toBeGreaterThan(0)
    }
  })

  it('⛔ POSITIVE CONTROL — it would find a dynamic mount', () => {
    // The absence claim covers lazy/dynamic mounting too, so the probe must be
    // shown capable of seeing one somewhere.
    expect((CORPUS.match(/\blazy\(/g) ?? []).length, 'no lazy() anywhere — the dynamic probe is blind')
      .toBeGreaterThan(0)
  })
})

describe('⭐ the mint exists — this guard has something to guard', () => {
  const mapper = (): string =>
    readFileSync(resolve(SRC, 'adapters/plot/v2/responseMapper.ts'), 'utf8')

  it('the threshold sentence is still there', () => {
    const text = mapper()
    expect(text.length, 'the mapper read empty — the assertion below would be vacuous').toBeGreaterThan(1000)
    expect(
      text,
      'THE MINT IS GONE. If it was deleted deliberately, DELETE THIS FILE TOO — a guard whose subject no longer exists passes forever while describing a state that ended.',
    ).toMatch(/winProb\s*>\s*0\.6/)
    expect(text).toMatch(/shows the strongest expected outcome/)
  })
})

describe('⛔ and it must stay unreachable until the entitlement question is answered', () => {
  it('nothing mounts DecisionSummary', () => {
    expect(
      mountSites('DecisionSummary'),
      [
        'DecisionSummary IS NOW MOUNTED — and that puts a UI-minted leader sentence in front of a user.',
        '',
        'It renders `rationale.headline`, which `ceeDataAdapter` fills from the recommendation',
        "block's `summary`, which `responseMapper.ts` writes as",
        '  `"<option>" shows the strongest expected outcome`  whenever a local constant 0.6 is cleared,',
        "on an object stamped `source: 'engine'`.",
        '',
        'Before mounting this, the sentence must either be removed or gated on the producer\'s own',
        'permission (`leaderDesignationPermitted` / `verdict.hasLeadingOption`), and its ranking must',
        'stop sorting `win_probability ?? probability_of_goal` as if they were one quantity.',
      ].join('\n'),
    ).toBe(0)
  })

  it('nothing imports it as a value — a type-only import is fine and is the one that exists', () => {
    // `useOptionRanking.ts` takes `import type { RankingData }`, which is erased
    // at compile and cannot mount anything. A VALUE import is the thing that
    // would precede a mount.
    /**
     * ⚠ MATCHES THE MODULE, NOT A DIRECTORY PREFIX — AND A MUTANT IS WHY.
     *
     * This required `components/DecisionSummary` in the path. A mutant that
     * injected the most likely real import — `from './DecisionSummary'`, a
     * sibling-relative one from inside `components/` — SURVIVED, because that
     * path never contains the directory name. The guard would have been green
     * through exactly the change it exists to catch.
     *
     * ⚠ CASE IS LOAD-BEARING, and there is a same-name twin to prove it:
     * `canvas/share/decisionSummary.ts` exports `formatDecisionSummary` and is
     * genuinely imported. A case-insensitive match would red on that forever.
     */
    const valueImports = FILES.filter((f) => {
      const t = readFileSync(f, 'utf8')
      return /^(?!.*\bimport\s+type\b).*\bfrom\s+'[^']*\/DecisionSummary'/m.test(t)
    })
    expect(
      valueImports.map((f) => f.replace(`${SRC}/`, '')),
      'a value import of DecisionSummary appeared — see the mount test above for what it would put on screen',
    ).toEqual([])
  })

  it('nothing lazy-loads it', () => {
    expect(
      (CORPUS.match(/lazy\([^)]*DecisionSummary/g) ?? []).length,
      'DecisionSummary is being dynamically mounted — the static scan above cannot see that, and this can',
    ).toBe(0)
  })
})
