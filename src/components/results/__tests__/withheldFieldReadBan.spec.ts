/**
 * WITHHELD-FIELD READ BAN — the WIDE scan (ROADMAP 2.1273).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS BANNED, AND WHY IT IS A FABRICATION AND NOT MERELY AN ABSENCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PLoT DELIBERATELY WITHHOLDS `robustness.recommendation_stability`
 * (`src/routes/v2/run.ts` at PLoT `8bf54150`). ISL derives it as
 * `option_wins[winner] / n_samples` — the leader's `win_probability`
 * RELABELLED, carrying (in the producer's own words) "zero independent
 * information". The UI was printing it as "N% stability", i.e. "a fabricated
 * second statistic": the same quantity shown twice, once honestly as "came out
 * ahead in N% of simulated scenarios" and once under a name that implies an
 * independent robustness measurement. `ranking_stability` was never emitted at
 * all.
 *
 * So this is NOT the ordinary "the producer sent nothing, render an absence"
 * case. On a FRESH run the field is undefined and every surface takes its
 * absence path (wire-witnessed 2026-08-17 — see the PR body). The live hazard
 * is a HYDRATED payload written BEFORE the withdrawal: `scenarios.analysis`
 * JSONB (→ `hooks/hydrateAnalysis.ts` → `adapters/plot/v2/responseMapper.ts`,
 * which passes the field through verbatim) and `v5_handler_facts` rows
 * (→ `canvas/stores/persistedRunSnapshotFactory.ts`). Both hydration paths are
 * SIGNED-IN ONLY (guest persistence is gated off in `hooks/useScenario.ts`;
 * `v5_handler_facts` RLS is `auth.uid() = user_id` and guest rows carry a NULL
 * user_id) — which bounds the severity but does not remove it, because a
 * legacy value flowing in renders a number nothing in the system can vouch for.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AT ALL — THE GUARD THAT COULD NOT SEE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `analysis-hero/__tests__/hygiene.spec.ts` already bans `recommendationStability`
 * — but it scans `MODULE_DIR` only (`src/components/results/analysis-hero/`).
 * Every surface that actually rendered the percentage lived OUTSIDE that
 * directory, so the ban was live, correct, and structurally incapable of
 * seeing any of them. A manual sweep found five reads the guard could not.
 *
 * ⚠ BOUNDARY, STATED DELIBERATELY (file ownership, ROADMAP 2.1228 lane):
 * that sibling guard is NOT edited or duplicated by this file. It owns
 * `src/components/results/analysis-hero/**` and its own four-symbol trust
 * regex; this file EXCLUDES `analysis-hero/` from its walk for exactly that
 * reason, and scans the two trees the sibling cannot reach:
 * `src/components/results/` (minus `analysis-hero/`) and `src/canvas/`.
 * If the two ever need to merge, that is a deliberate consolidation, not a
 * side effect of either lane.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PIN IS AN EXACTLY-PINNED KNOWN-GAP SET, AND IT IS BIDIRECTIONAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A flat "no file may match" is not available here: the field is legitimately
 * TRAVERSED by the adapter/mapper/type layer (a wire field the UI must keep
 * TOLERATING on hydration is not the same claim as a wire field the UI may
 * RENDER), and several categorical-label consumers are rowed separately. So the
 * ban keeps every symbol in scope and records the remaining debt honestly:
 *
 *   · a NEW read (set GROWS)     -> RED. A new fabrication path appeared.
 *   · a FIXED read (set SHRINKS) -> RED. You cannot quietly resolve one and
 *     leave the pin overstating the debt; shrinking it is a deliberate,
 *     reviewable edit that lands WITH the change that removed the read.
 *
 * ⚠ DO NOT "FIX" A RED HERE BY EDITING THE PIN TO MATCH REALITY. If the set
 * grew, you introduced a read of a withheld field — fix the read.
 *
 * ⚠ AND THE DEFECT THIS FILE IS WRITTEN TO AVOID (CLAUDE.md trap 13b, "a guard
 * agreeing with itself"): `KNOWN_WITHHELD_FIELD_READS` below is a HAND-WRITTEN
 * LITERAL, transcribed from a scan output and compared against a FRESH
 * derivation. It is deliberately NOT computed by filtering the derived set, nor
 * derived from the same walk it is checked against — a pin built from the scan
 * it validates can only ever agree with itself, and would pass while the whole
 * scanner was blind.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE REMAINING ENTRIES ARE — THEY ARE NOT ALL THE SAME KIND OF DEBT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  (a) TOLERATION, not rendering — legitimate and expected to stay. The
 *      adapter/mapper/type/store layer must keep PARSING a field that legacy
 *      persisted payloads contain, or hydration of an old run breaks outright.
 *      `adapters/`, `stores/`, `types.ts`, `store.ts`, `analysisEnrichmentShape`,
 *      `assembleAnalysisInputsSummary`, `persistedRunSnapshotFactory`.
 *
 *  (b) A CATEGORICAL LABEL derived from the withheld number — rowed separately,
 *      NOT fixed in this train, and deliberately left visible here so the debt
 *      is countable: `useResultsSectionData.ts` derives `robustnessLevel` from
 *      it via `lib/stability.ts`, and that level then drives hero/badge/node
 *      copy across `ResultsBody`, `OptionCards`,
 *      `TriageActionCardsBody`, `certaintyCopy`, `winnerChipCopy`,
 *      `getStabilityDisplayLabel`, `GoalNode`, `DecisionNode`,
 *      `useNodeDisplayMetadata`, and the compare-tab's `stabilityLabel` chain.
 *      Removing that derivation is a far wider blast radius than this row and
 *      is exactly the scope boundary CLAUDE.md's scope-expansion rule names.
 *
 *  (c) THE PERCENTAGE RENDERS — this row's actual target. There are NONE left
 *      in the pin, and that is the load-bearing claim of this file. The
 *      `CLEARED_SURFACES` test states it INDEPENDENTLY of the pin (each cleared
 *      file named one by one, required to hold zero reads), so a mistaken pin
 *      edit cannot reopen a fabrication path silently.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ SCOPE OF THIS GUARD, STATED PRECISELY (CLAUDE.md trap 20)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is a SOURCE-TEXT scan over `.ts`/`.tsx` production files in two named
 * trees, with comments stripped. It is NOT a claim that no surface anywhere in
 * the UI renders the withheld field:
 *   · it does not scan `src/` outside those two roots;
 *   · it excludes `analysis-hero/` by ownership (that subtree has its own guard);
 *   · it cannot see a read that reaches the value through a renamed local, a
 *     spread, or an index signature — the DOM-level proof for the six cleared
 *     surfaces is `canvas/components/model-tab/__tests__/withheldStabilitySurfaces.honesty.spec.tsx`
 *     and `canvas/components/__tests__/LensInfoPanel.spec.tsx`, which inject a
 *     legacy value and assert no percentage renders.
 * A source scan and a render-level pin are complementary; neither substitutes
 * for the other.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const REPO_ROOT = resolve(process.cwd())

/**
 * The two trees the `analysis-hero/` guard cannot reach. Both are scanned;
 * `analysis-hero/` itself is excluded below (see the boundary note above).
 */
const SCAN_ROOTS = [
  resolve(REPO_ROOT, 'src', 'components', 'results'),
  resolve(REPO_ROOT, 'src', 'canvas'),
] as const

const EXCLUDED_DIRS = new Set(['__tests__', '__fixtures__', '__mocks__'])

interface ScannedFile {
  /** Repo-relative, POSIX-separated. NOT the basename — the wide scan spans
   *  two trees and basenames collide (`types.ts` exists in both). */
  rel: string
  content: string
}

function productionSources(dir: string, acc: ScannedFile[] = []): ScannedFile[] {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      productionSources(full, acc)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    // Storybook files ship no product surface.
    if (/\.stories\.(ts|tsx)$/.test(name)) continue
    const rel = relative(REPO_ROOT, full).split(sep).join('/')
    // ── the ownership boundary (ROADMAP 2.1228 lane owns this subtree) ──
    if (rel.includes('/analysis-hero/')) continue
    acc.push({ rel, content: stripComments(readFileSync(full, 'utf8'), name) })
  }
  return acc
}

const sources = SCAN_ROOTS.flatMap((root) => productionSources(root))

/**
 * Both wire spellings and both camelCase VM twins. The camelCase forms are in
 * scope deliberately: the fabrication reached the screen through the VM field,
 * not through the wire key, so a regex that banned only `recommendation_stability`
 * would have missed every render this row removed.
 */
const WITHHELD_FIELD_RE =
  /recommendation_stability|ranking_stability|recommendationStability|rankingStability/g

/**
 * HAND-WRITTEN. Transcribed from the scan output, not computed from it. See the
 * block comment: a pin derived from the walk it validates agrees with itself.
 *
 * Grouped by DEBT CLASS, because they are not the same kind of entry and a flat
 * list invites the next lane to "clean up" a legitimate one.
 */
/**
 * ── (a) TOLERATION / PARSE LAYER — legitimate, expected to stay ──────────
 * These must keep ACCEPTING a field that legacy persisted payloads contain.
 * Deleting them does not remove a fabrication; it breaks hydration of an old
 * run. `types.ts` entries are type declarations, not reads.
 *
 * ⚠ THE MEMBERSHIP TEST FOR THIS CLASS, stated so the next entry lands in the
 * right one: a file belongs here only if it PARSES OR CARRIES the value and
 * derives NO verdict from it. A file that turns the withheld number into a
 * word, a band, a percentage or a gate is class (b) below — however plumbing-
 * like its path looks.
 */
const TOLERATION_READS: readonly string[] = [
  'src/canvas/store.ts::rankingStability',
  'src/canvas/store.ts::ranking_stability',
  'src/canvas/store.ts::recommendation_stability',
  'src/canvas/compare-tab/types.ts::recommendationStability',
  'src/components/results/types.ts::rankingStability',
  'src/components/results/types.ts::ranking_stability',
  'src/components/results/types.ts::recommendationStability',
  'src/components/results/types.ts::recommendation_stability',
  // Presence detection only — asks "did the producer send robustness at all",
  // never renders the number.
  'src/components/results/useResultCompleteness.ts::recommendation_stability',
  // Re-emits the field into an inputs-summary payload (its own header documents
  // the absence case). Carries the value onward; renders nothing.
  'src/canvas/analysis/assembleAnalysisInputsSummary.ts::ranking_stability',
  'src/canvas/analysis/assembleAnalysisInputsSummary.ts::recommendation_stability',
]

const DERIVED_LABEL_READS: readonly string[] = [
  // ── (b) CATEGORICAL LABELS DERIVED FROM THE WITHHELD NUMBER ─────────────
  // ROWED SEPARATELY, deliberately NOT fixed in this train, and left visible
  // here so the debt is countable rather than forgotten.
  //
  // These do not print the percentage — they band it into a WORD ('Robust',
  // 'Stable ranking', 'stable') or use it as a gate. That is a smaller claim
  // than "N% stability" but it is still a claim sourced from a quantity the
  // producer withheld, and two of them are worse than a mislabel:
  //   · `useNodeDisplayMetadata.ts` substitutes stability for an unavailable
  //     GOAL PROBABILITY — a different quantity entirely;
  // The second such case, `ConfidenceSection.tsx` — which read
  // `(rankingStability ?? 1) >= …`, defaulting a WITHHELD field to fully-stable,
  // a fail-OPEN default — is GONE: the component was deleted on 18 Aug 2026 as
  // provably dead (zero importers outside the test tree). That debt is
  // discharged by removal, not by toleration; `ResultsFooter.tsx` left the list
  // the same way. `useNodeDisplayMetadata.ts` is recorded for follow-up.
  //
  // The root of this class is `useResultsSectionData.ts`, which derives
  // `robustnessLevel` via `lib/stability.ts`; every entry below it consumes
  // that level or the raw number. Unpicking it reaches hero copy, option cards,
  // node badges and the footer at once — a far wider blast radius than this row,
  // and exactly the boundary CLAUDE.md's scope-expansion rule tells a lane to
  // stop at and re-brief.
  'src/components/results/useResultsSectionData.ts::rankingStability',
  'src/components/results/useResultsSectionData.ts::ranking_stability',
  'src/components/results/useResultsSectionData.ts::recommendationStability',
  'src/components/results/useResultsSectionData.ts::recommendation_stability',
  'src/components/results/buildResultsVM.ts::recommendationStability',
  'src/components/results/OptionCards.tsx::recommendationStability',
  'src/components/results/ResultsBody.tsx::recommendationStability',
  'src/components/results/TriageActionCardsBody.tsx::recommendationStability',
  'src/components/results/utils/certaintyCopy.ts::recommendationStability',
  'src/components/results/utils/getStabilityDisplayLabel.ts::recommendationStability',
  'src/components/results/utils/winnerChipCopy.ts::recommendationStability',
  'src/canvas/adapters/modelCardAdapter.ts::ranking_stability',
  'src/canvas/adapters/modelCardAdapter.ts::recommendation_stability',
  'src/canvas/hooks/useNodeDisplayMetadata.ts::recommendationStability',
  'src/canvas/hooks/useNodeDisplayMetadata.ts::recommendation_stability',
  'src/canvas/nodes/DecisionNode.tsx::recommendation_stability',
  'src/canvas/nodes/GoalNode.tsx::recommendationStability',
  'src/canvas/nodes/GoalNode.tsx::recommendation_stability',
  // ⚠ MOVED HERE FROM CLASS (a) — it was filed as toleration and it is not.
  // `analysisSnapshotFactory.ts` reads the withheld number, calls
  // `deriveStabilityLabel(stability)` on it, and PERSISTS the resulting word
  // onto `AnalysisSnapshot.stabilityLabel` — which `compare-tab/Hero.tsx`
  // renders ("Confidence improving · Model {label}"), `HealthIndicators.tsx`
  // renders as a from/to pair, and `deriveTransitions.ts` reads to decide
  // `robustnessChanged`. Class (a)'s own description — "carries the value
  // onward; renders nothing", "legitimate, expected to stay" — is false of it
  // on both counts, and the mislabel told the next lane there was nothing here
  // to fix. This is (b) at its sharpest: the derived verdict is written to a
  // persistence surface, so it OUTLIVES the run that produced it.
  'src/canvas/stores/analysisSnapshotFactory.ts::recommendationStability',
  'src/canvas/stores/analysisSnapshotFactory.ts::recommendation_stability',
]

/**
 * The pin the equality assertion checks, assembled from the two debt classes.
 *
 * ⚠ IT IS ASSEMBLED, NOT FLAT, AND THAT IS THE POINT. The classes used to be
 * two COMMENT HEADINGS inside one array — so an entry's debt class was a
 * decoration the suite could not see, and one landed in the wrong class and
 * stayed there through review. A comment that records a judgement nothing
 * enforces is the hand-maintained mirror (trap 12); making the classes real
 * arrays means a new entry must be PLACED in one, and `classifies every read`
 * below makes a misplacement a RED rather than a reading error.
 */
const KNOWN_WITHHELD_FIELD_READS: readonly string[] = [
  ...TOLERATION_READS,
  ...DERIVED_LABEL_READS,
]

/**
 * THE SURFACES THIS ROW CLEARED — asserted to hold ZERO reads, INDEPENDENTLY
 * of the pin above.
 *
 * ⚠ WHY THIS EXISTS AS A SEPARATE LIST. The pin is a single equality against a
 * 33-entry array; a careless edit to it (adding an entry to make a red go away
 * — precisely what its own comment forbids) could re-admit a percentage render
 * without any other test noticing. These files are therefore named ONE BY ONE
 * and required to be clean, so the row's actual acceptance condition has its own
 * assertion that no pin edit can satisfy.
 */
const CLEARED_SURFACES: readonly string[] = [
  'src/canvas/components/model-tab/StatusBar.tsx',
  'src/canvas/components/model-tab/ModelHealthSection.tsx',
  'src/canvas/components/ModelTabBody.tsx',
  'src/canvas/compare-tab/TrajectorySection.tsx',
  'src/canvas/components/OutputsDock.tsx',
  'src/canvas/components/utils/postAnalysisFooter.ts',
  'src/canvas/components/LensInfoPanel.tsx',
]

/** Deleted outright — dead code, zero importers, absent from the deployed bundle. */
const DELETED_SURFACES: readonly string[] = [
  'src/components/results/TrustOneLiner.tsx',
]

function deriveFoundReads(): string[] {
  const found = new Set<string>()
  for (const { rel, content } of sources) {
    for (const m of content.matchAll(WITHHELD_FIELD_RE)) {
      found.add(`${rel}::${m[0]}`)
    }
  }
  return [...found].sort()
}

describe('withheld-field read ban (wide scan: results/ + canvas/)', () => {
  it('scans a non-empty production source set spanning BOTH roots (guard is alive)', () => {
    expect(sources.length).toBeGreaterThan(100)
    const rels = sources.map((s) => s.rel)
    // Identity-bound anchors, one per root — a walk that silently stopped
    // after the first root would otherwise still look healthy.
    expect(rels).toContain('src/components/results/useResultsSectionData.ts')
    expect(rels).toContain('src/canvas/components/model-tab/StatusBar.tsx')
  })

  it('excludes the analysis-hero subtree owned by the sibling guard', () => {
    expect(sources.filter((s) => s.rel.includes('/analysis-hero/'))).toEqual([])
  })

  it('withheld-field reads match the pinned known-gap set EXACTLY', () => {
    expect(
      deriveFoundReads(),
      'withheld-field reads drifted from the pinned set — see the block comment: ' +
        'a GROWN set means a new read of a field PLoT withholds, a SHRUNK set means ' +
        'a fix landed without updating the pin. Do not edit the pin to match reality.',
    ).toEqual([...KNOWN_WITHHELD_FIELD_READS].sort())
  })

  it('classifies every read into exactly one debt class, and DERIVES-A-VERDICT is class (b)', () => {
    // The two classes carry OPPOSITE instructions to the next lane — (a) says
    // "legitimate, expected to stay", (b) says "rowed debt, still a claim
    // sourced from a withheld quantity". Putting a read in the wrong one does
    // not change a number anywhere; it tells the next reader not to fix
    // something that needs fixing. So the classification gets its own pin.

    // Disjoint and total: every pinned read is in exactly one class.
    const overlap = TOLERATION_READS.filter((r) => DERIVED_LABEL_READS.includes(r))
    expect(overlap, 'a read may not be in both debt classes').toEqual([])
    expect(KNOWN_WITHHELD_FIELD_READS.length).toBe(
      TOLERATION_READS.length + DERIVED_LABEL_READS.length,
    )

    // IDENTITY-BOUND, per file, not a count — a count would be satisfied by any
    // other entry moving in the opposite direction (trap 19).
    //
    // `analysisSnapshotFactory.ts` is class (b), NOT toleration. It does not
    // merely carry the value: it calls `deriveStabilityLabel(stability)` and
    // PERSISTS the resulting word onto `AnalysisSnapshot.stabilityLabel`, which
    // `compare-tab/Hero.tsx` renders as "Model {label}", `HealthIndicators.tsx`
    // renders as a from/to pair, and `deriveTransitions.ts` reads to decide
    // `robustnessChanged`. A derived VERDICT that outlives the run that produced
    // it is the strongest form of this debt, not an example of the benign kind.
    for (const spelling of ['recommendationStability', 'recommendation_stability']) {
      const entry = `src/canvas/stores/analysisSnapshotFactory.ts::${spelling}`
      expect(KNOWN_WITHHELD_FIELD_READS, `${entry} must still be pinned`).toContain(entry)
      expect(
        DERIVED_LABEL_READS,
        `${entry} derives a categorical label (deriveStabilityLabel) and persists it — class (b)`,
      ).toContain(entry)
      expect(
        TOLERATION_READS,
        `${entry} must NOT be filed as toleration: "legitimate, expected to stay" is false of a persisted derived verdict`,
      ).not.toContain(entry)
    }

    // CONTRAST CONTROL, so the two assertions above are discriminating rather
    // than a pair that would hold for every entry: a genuine toleration read
    // must sit in (a) and NOT in (b). `types.ts` is a type declaration — it
    // derives nothing and renders nothing.
    const pureType = 'src/components/results/types.ts::recommendation_stability'
    expect(TOLERATION_READS).toContain(pureType)
    expect(DERIVED_LABEL_READS).not.toContain(pureType)
  })

  it('the surfaces this row cleared hold ZERO withheld-field reads (independent of the pin)', () => {
    for (const rel of CLEARED_SURFACES) {
      const file = sources.find((s) => s.rel === rel)
      // Identity anchor: a renamed/moved file must fail LOUD here rather than
      // silently satisfying a zero-hit assertion by not being scanned.
      expect(file, `${rel} must exist and be in the scanned set`).toBeDefined()
      const hits = [...file!.content.matchAll(WITHHELD_FIELD_RE)].map((m) => m[0])
      expect(
        hits,
        `${rel} rendered a withheld-field claim before ROADMAP 2.1273 and must ` +
          'read the field ZERO times. A hit here means a fabrication path was ' +
          'reinstated — see the reinstatement trigger in that file.',
      ).toEqual([])
    }
  })

  it('the deleted dead surfaces are still absent from the tree', () => {
    const rels = new Set(sources.map((s) => s.rel))
    for (const rel of DELETED_SURFACES) {
      expect(rels.has(rel), `${rel} was deleted as dead code and must not return`).toBe(false)
    }
    // CONTRAST CONTROL: the same membership probe returns TRUE for a file that
    // does exist, so a `false` above is a real absence and not a broken check
    // (e.g. a walk that silently produced no `rel` values at all).
    expect(rels.has('src/components/results/useResultsSectionData.ts')).toBe(true)
  })

  it('positive control: the scanner detects a real read, in a file that has one', () => {
    const anchor = sources.find(
      (s) => s.rel === 'src/components/results/useResultsSectionData.ts',
    )
    expect(anchor, 'anchor file must be in the scanned set').toBeDefined()
    const hits = [...anchor!.content.matchAll(WITHHELD_FIELD_RE)].map((m) => m[0])
    // A count, not a boolean: a probe that can see SOMETHING is not a probe
    // that can see everything (CLAUDE.md trap 13e).
    expect(hits.length).toBeGreaterThanOrEqual(2)
    expect(new Set(hits).has('recommendation_stability')).toBe(true)
  })

  it('positive control: the regex fires on each banned spelling', () => {
    for (const s of [
      'const x = r.recommendation_stability',
      'const y = r.ranking_stability',
      'const z = vm.recommendationStability',
      'const w = vm.rankingStability',
    ]) {
      expect(new RegExp(WITHHELD_FIELD_RE.source).test(s), s).toBe(true)
    }
  })

  it('comment-strip both directions: comment mentions vanish, code (incl. bracket-key) still trips', () => {
    const re = () => new RegExp(WITHHELD_FIELD_RE.source)
    expect(re().test(stripComments('// never read recommendation_stability', 'x.ts'))).toBe(false)
    expect(re().test(stripComments('/* recommendationStability is banned */', 'x.ts'))).toBe(false)
    expect(re().test(stripComments('const v = r.recommendation_stability', 'x.ts'))).toBe(true)
    // Bracket-string reads survive stripping (strings are kept as code) — the
    // obvious way to smuggle a banned read past a dotted-access regex.
    expect(re().test(stripComments("const v = r['recommendationStability']", 'x.ts'))).toBe(true)
  })
})
