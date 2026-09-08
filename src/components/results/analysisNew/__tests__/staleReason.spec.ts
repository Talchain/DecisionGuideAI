/**
 * The mapping the Reasoning tab's first line depends on.
 *
 * ⚠ WRITTEN BECAUSE ITS FIRST VERSION WAS INLINE IN THE DOCK AND A MUTANT
 * SURVIVED: replacing the whole expression with the constant `'changed'` left
 * every suite GREEN. An untested replacement for an untested collapse is the
 * same defect wearing a new name.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { staleReasonFromFreshness, staleReasonFromTrustSemantic } from '../staleReason'
// Bound by IDENTITY to the producer's own exported constants, never to the
// string literals they happen to hold: a reason code renamed at the source must
// move these cases with it rather than leave them silently pointing at a value
// nothing writes any more.
import {
  classifyFreshnessForDisplay,
  deriveAnalysisFreshnessUpdate,
  RUN_COMPLETED_WITHOUT_VERDICT,
  VERDICT_ABSENT_FROM_PAYLOAD,
  type AnalysisFreshnessState,
} from '../../../../canvas/store/analysisFreshness'
import { ORPHANED_RESULT } from '../../../../canvas/state/analysisStateSelector'

describe('staleReasonFromFreshness', () => {
  it("licenses the stronger claim ONLY on the producer's own 'stale'", () => {
    expect(staleReasonFromFreshness('stale')).toBe('changed')
  })

  /**
   * ⚠ THE DIRECTION THAT WAS BROKEN. 'unknown' means CEE could not determine
   * freshness — an absence of evidence, never evidence of a change.
   */
  it("never claims a change from 'unknown'", () => {
    expect(staleReasonFromFreshness('unknown')).toBe('unconfirmed')
  })

  it('fails closed on every other value, including ones this build does not know', () => {
    for (const v of ['fresh', 'none', '', 'STALE', 'changed', null, undefined]) {
      expect(staleReasonFromFreshness(v)).toBe('unconfirmed')
    }
  })
})

/**
 * ⭐⭐ THE LIVE FUNCTION, WHICH HAD NO COVERAGE AT ALL.
 *
 * ⚠ A REVIEWER RAN THE SAME MUTATION AGAINST BOTH AND GOT OPPOSITE ANSWERS:
 *
 *   mutate `staleReasonFromTrustSemantic` → 'changed'   788/788 GREEN
 *   mutate `staleReasonFromFreshness`     → 'changed'   REDs 2 by name
 *
 * Same file, same mutation, same 61-file / 788-test net. **All of the coverage
 * sat on the function nothing calls.** `OutputsDock.tsx` (the `analysisStaleReason` binding) uses
 * `staleReasonFromTrustSemantic`; `staleReasonFromFreshness` has no production
 * caller on this path, and it is the one every existing case exercised.
 *
 * ⚠⚠ AND THIS SPEC'S OWN HEADER ALREADY RECORDS THIS MUTANT SURVIVING ONCE
 * BEFORE — which is why the file exists. It was written to stop exactly this
 * and then pinned the wrong function.
 */
describe('staleReasonFromTrustSemantic — the one the dock actually calls', () => {
  it("'changed' is the only input that licenses the CHANGED sentence", () => {
    expect(staleReasonFromTrustSemantic('changed')).toBe('changed')
  })

  /**
   * ⚠ THE CASE THAT KILLS THE MUTANT. A version returning 'changed'
   * unconditionally passes the arm above and fails here — which is the
   * difference between covering a function and pinning it.
   */
  it.each(['unknown', 'stale', 'fresh', '', null, undefined])(
    'refuses to claim a CHANGE it cannot see: %s → unconfirmed',
    (v) => {
      expect(staleReasonFromTrustSemantic(v as never)).toBe('unconfirmed')
    },
  )

  /**
   * ⚠⚠ THE WIRING — AND THE TEXT VERSION OF THIS WAS DEFEATED THREE WAYS.
   *
   * It read `OutputsDock.tsx` as a STRING: `toContain('staleReasonFromTrustSemantic(')`
   * plus `includes('staleReasonFromFreshness(') === false`. A reviewer landed
   * all three of these past it, every one green, one of them fully shippable:
   *
   *   A  import { staleReasonFromFreshness as staleReasonFromTrustSemantic }
   *      ← the alias leaves `staleReasonFromTrustSemantic(` at the call site,
   *        and the import has a SPACE after the name rather than `(`, so BOTH
   *        halves of the string check read clean. Identical signatures, so it
   *        TYPECHECKS. ⚠ And the trust-semantic domain is
   *        `changed`/`current`/`cannot_confirm` — never `'stale'` — so aliased,
   *        the dock returns `'unconfirmed'` UNCONDITIONALLY and the panel can
   *        never say the model changed again. The original defect, reborn,
   *        with 238 files / 2,700 tests green under it.
   *   B  comment the call out and hardcode `'unconfirmed'`
   *   C  shadow it with a local function carrying the old `=== 'stale'` logic
   *
   * So this reads the SYNTAX rather than the characters, and each clause kills
   * a named attack:
   *
   *   · the import's ORIGINAL export name, not the local alias   → kills A
   *   · the identifier is actually CALLED, not merely imported   → kills B
   *   · nothing local declares that name                         → kills C
   *
   * ⚠ WHAT IT STILL IS NOT: a behavioural test. It proves the dock is wired to
   * the right function, not that the rendered panel says the right thing. The
   * behavioural version needs the dock rendered with `useAnalysisTrust` mocked
   * — ~10 `vi.mock` calls, per the existing dock specs — and that is the
   * stronger artefact. Stated as a known gap rather than left implied.
   */
  /**
   * Does this import specifier resolve to THE reader module — the one this
   * suite tests — rather than to something merely spelled like it?
   *
   * Both operands are normalised through `path.resolve`, so `./x/../y`,
   * `../../components/results/analysisNew/staleReason` and a shim at
   * `components/compat/analysisNew/staleReason` are compared as the filesystem
   * sees them and not as text. The extension is stripped because a TS
   * specifier omits it.
   */
  const READER_MODULE = path.resolve(__dirname, '../staleReason')

  function resolvesToTheReaderModule(specifierText: string, importingFile: string): boolean {
    const spec = specifierText.replace(/^['"]|['"]$/g, '')
    // Only relative specifiers can name a file in this repo; a bare package
    // specifier is somebody else's module by definition.
    if (!spec.startsWith('.')) return false
    const resolved = path.resolve(path.dirname(importingFile), spec).replace(/\.tsx?$/, '')
    return resolved === READER_MODULE
  }

  it('the dock is wired to the TRUST reader — by syntax, not by string match', () => {
    const file = path.resolve(__dirname, '../../../../canvas/components/OutputsDock.tsx')
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const NAME = 'staleReasonFromTrustSemantic'

    let importedOriginal: string | null = null
    let localAlias: string | null = null
    let called = false
    let shadowed = false

    const walk = (n: ts.Node): void => {
      // ⚠⚠⚠ THIS RESOLVES THE SPECIFIER TO AN ABSOLUTE PATH. IT USED TO MATCH A
      // STRING, AND THE STRING LOST FIVE ROUNDS RUNNING.
      //
      //   D1  substring match      → a shim at `analysisNew/staleReasonCompat.ts`
      //   D2  two-segment anchor   → a shim at `components/compat/analysisNew/staleReason.ts`
      //
      // Both re-export `staleReasonFromFreshness as staleReasonFromTrustSemantic`,
      // so the aliasing sits one hop away where the IMMEDIATE import has no
      // `propertyName` for clause A to read. D2 measured: this pin 11/11,
      // typecheck PASSED, ESLint 0 errors, 1522/1522 across every
      // `OutputsDock`-referencing spec — and the dock returning `unconfirmed`
      // for all four members of the producer's domain.
      //
      // ⚠ THE COUNT IS THE FINDING, NOT THE DEFEAT. Every fix narrowed the
      // string; every defeat moved sideways within it. Five rounds is past the
      // point where "one more rule" is engineering rather than sunk cost
      // (CLAUDE.md trap 22f). So this is a CHANGE OF KIND: resolve the module
      // specifier against the importing file and compare absolute paths. A path
      // that resolves elsewhere cannot be spelled to look like this one, which
      // is what ends the series rather than extending it.
      if (
        ts.isImportDeclaration(n) &&
        resolvesToTheReaderModule(n.moduleSpecifier.getText(sf).trim(), file)
      ) {
        const named = n.importClause?.namedBindings
        if (named && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            // `propertyName` is the ORIGINAL export; `name` is the local alias.
            const original = (el.propertyName ?? el.name).getText(sf)
            if (el.name.getText(sf) === NAME) {
              importedOriginal = original
              localAlias = el.name.getText(sf)
            }
          }
        }
      }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === NAME) called = true
      if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && n.name.getText(sf) === NAME) {
        shadowed = true
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)

    // PRECONDITION: the import must exist at all, or every clause below is
    // vacuously satisfied by a file that imports nothing.
    expect(localAlias, 'the dock does not import the reader at all').toBe(NAME)

    expect(
      importedOriginal,
      'ATTACK A: the dock imports a DIFFERENT export under this name. Aliased ' +
        'to the freshness reader it returns `unconfirmed` unconditionally, ' +
        'because the trust domain never contains `stale` — so the panel can ' +
        'never say the model changed.',
    ).toBe(NAME)

    expect(called, 'ATTACK B: imported but never called — the derivation does not run').toBe(true)
    expect(shadowed, 'ATTACK C: a local declaration shadows the import').toBe(false)
  })
})

/**
 * ⭐⭐⭐ THE ENUMERATION THE READER'S DOC COMMENT STATES, MADE EXECUTABLE.
 *
 * ⚠ WHY THIS BLOCK EXISTS, AND IT IS A COUNT, NOT A STYLE PREFERENCE.
 * `staleReason.ts` used to SUMMARISE `classifyFreshnessForDisplay` in one line,
 * and shipped TWO summaries that were both false in OPPOSITE directions:
 *
 *   round 1  an UNQUALIFIED rule                     — too wide
 *   round 2  "a retained `'unknown'` dirtied locally yields `'cannot_confirm'`
 *            instead"                                — false on limb 2b below
 *
 * Round 2 was written IN REVIEW to fix round 1, and the same sentence was
 * duplicated into `OutputsDock.tsx`, so one wrong claim shipped in two files
 * with nothing keeping them in step. Two reversals on one predicate is the
 * point at which another summary is sunk cost rather than engineering
 * (CLAUDE.md trap 22f), so the comment now ENUMERATES the branches and this
 * block asserts them.
 *
 * ⚠⚠ WHAT THIS CAN AND CANNOT DO — STATED, NOT IMPLIED. A comment cannot go
 * red. Nothing here can stop a third wrong SENTENCE being typed. What it does
 * stop is the sentence being made true by "fixing" the code to match it, and it
 * gives the next author an EXECUTED table to check a sentence against instead
 * of the previous author's prose. That is the whole claim.
 *
 * ⚠ THE DOMAIN THESE ROWS COME FROM. Derived by executing
 * `classifyFreshnessForDisplay` over 4 freshness values × 6 reason codes ×
 * 3 at-run/current hash pairs × dirty × importHold, plus the null state — 292
 * rows, of which 70 return `'changed'` — at `06979dad`. The rows below are the
 * boundary of that set, not a sample of it.
 */
describe('classifyFreshnessForDisplay — the branches the reader documents', () => {
  /**
   * The two states that decide limb 2b differ in ONE field. Built from a shared
   * base and asserted here, so the RED/GREEN split below is provably the
   * predicate discriminating on `freshnessReason` and not two fixtures that
   * happen to differ somewhere else (CLAUDE.md trap 13b: a discriminator must
   * pin its own precondition in-test).
   */
  const DIRTIED_UNKNOWN = { freshness: 'unknown' } as const satisfies AnalysisFreshnessState

  const SILENT_PAYLOAD_DEGRADED: AnalysisFreshnessState = {
    ...DIRTIED_UNKNOWN,
    freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD,
  }
  const CEE_STATED_UNKNOWN: AnalysisFreshnessState = {
    ...DIRTIED_UNKNOWN,
    freshnessReason: 'engine_could_not_determine',
  }

  it('PRECONDITION: the two unknown states differ ONLY in freshnessReason', () => {
    expect(SILENT_PAYLOAD_DEGRADED.freshness).toBe(CEE_STATED_UNKNOWN.freshness)
    expect(Object.keys(SILENT_PAYLOAD_DEGRADED).sort()).toEqual(
      Object.keys(CEE_STATED_UNKNOWN).sort(),
    )
    expect(SILENT_PAYLOAD_DEGRADED.freshnessReason).not.toBe(CEE_STATED_UNKNOWN.freshnessReason)
  })

  describe("limb 1 — a STATED 'stale' outranks our own uncertainty", () => {
    it("returns 'changed', with or without a local edit", () => {
      expect(classifyFreshnessForDisplay({ freshness: 'stale' }, false, false)).toBe('changed')
      expect(classifyFreshnessForDisplay({ freshness: 'stale' }, true, false)).toBe('changed')
    })

    it("survives an import hold — the hold gates the INFERRED 'changed' only", () => {
      expect(classifyFreshnessForDisplay({ freshness: 'stale' }, false, true)).toBe('changed')
    })

    /**
     * `isSelfContradictoryStale`: identical non-empty at-run/current hashes
     * disprove the change the verdict claims, so it displays as 'unknown' and
     * never reaches limb 1.
     */
    it("does NOT fire for a self-contradictory 'stale' whose own hashes match", () => {
      expect(
        classifyFreshnessForDisplay(
          { freshness: 'stale', graphHashAtRun: 'h1', currentGraphHash: 'h1' },
          false,
          false,
        ),
      ).toBe('cannot_confirm')
    })
  })

  describe("limb 2a — a retained 'fresh' verdict dirtied by a local edit", () => {
    it("returns 'changed'", () => {
      expect(classifyFreshnessForDisplay({ freshness: 'fresh' }, true, false)).toBe('changed')
    })

    it("is 'current' undirtied, and 'cannot_confirm' under an import hold", () => {
      expect(classifyFreshnessForDisplay({ freshness: 'fresh' }, false, false)).toBe('current')
      expect(classifyFreshnessForDisplay({ freshness: 'fresh' }, true, true)).toBe('cannot_confirm')
    })
  })

  /**
   * ⭐⭐⭐ LIMB 2b — THE CASE THE ROUND-2 SENTENCE DENIED.
   *
   * A retained `'unknown'` DIRTIED LOCALLY returns `'changed'`, not
   * `'cannot_confirm'`, whenever that `'unknown'` is the UI's own degradation
   * of a payload that carried no `freshness` field.
   */
  describe('limb 2b — a payload that said NOTHING about freshness, then a local edit', () => {
    it("returns 'changed' — and the panel therefore says the model CHANGED", () => {
      const semantic = classifyFreshnessForDisplay(SILENT_PAYLOAD_DEGRADED, true, false)
      expect(semantic).toBe('changed')
      // The sentence this module actually chooses. Asserting the semantic alone
      // would leave the reader free to map it to the wrong copy.
      expect(staleReasonFromTrustSemantic(semantic)).toBe('changed')
    })

    /**
     * ⚠ REACHABILITY, EXECUTED RATHER THAN ASSERTED. The state above is not a
     * shape this spec invented: it is what the slice's own pure reducer writes
     * for a `graph_patch: applied` reply — readiness only, a newer
     * `computed_at`, total silence on freshness.
     *
     * Payload shape verbatim from the staging capture
     * `turn-responses-run2.json[2]`; the canonical copy of this fixture, with
     * the full defect account, is
     * `canvas/store/__tests__/freshnessOnAppliedEdit.spec.ts`, which pins the
     * same state to `'changed'` through the store. This one exists so the
     * READER's doc comment cannot claim the opposite without a red here.
     */
    it('is the state the reducer WRITES on an applied graph_patch, not one this spec invented', () => {
      const afterRun: AnalysisFreshnessState = {
        freshness: 'fresh',
        freshnessReason: 'graph_hash_match',
        graphHashAtRun: 'c2aeb044a4bd8d6d',
        currentGraphHash: 'c2aeb044a4bd8d6d',
        computedAt: '2026-07-29T02:10:31.421Z',
      }
      const next = deriveAnalysisFreshnessUpdate(afterRun, {
        options: [],
        goal_node_id: 'goal_billing',
        status: 'ready',
        computed_at: '2026-07-29T02:11:09.522Z',
      })

      expect(next).not.toBe(afterRun)
      expect(next?.freshness).toBe('unknown')
      expect(next?.freshnessReason).toBe(VERDICT_ABSENT_FROM_PAYLOAD)
      // The overlay is deliberately NOT cleared for such a payload (silence is
      // not a re-verification), so `dirty` is still true here in the product.
      expect(classifyFreshnessForDisplay(next, true, false)).toBe('changed')
    })
  })

  /**
   * ⚠ THE DISCRIMINATION. Without these, a predicate widened to fire on ANY
   * dirtied 'unknown' passes every assertion above — the exact over-claim the
   * round-1 sentence described and the whole reason `VERDICT_ABSENT_FROM_PAYLOAD`
   * exists as a distinct marker.
   */
  describe('everything else stays cannot-confirm — the limb 2b boundary', () => {
    it("a CEE-STATED 'unknown' does not become 'changed' just because the user edited", () => {
      expect(classifyFreshnessForDisplay(CEE_STATED_UNKNOWN, true, false)).toBe('cannot_confirm')
      expect(classifyFreshnessForDisplay({ freshness: 'unknown' }, true, false)).toBe(
        'cannot_confirm',
      )
    })

    it('the orphan synthesis and the run-completion write are never dressed up as "you edited"', () => {
      expect(
        classifyFreshnessForDisplay(
          { freshness: 'unknown', freshnessReason: ORPHANED_RESULT },
          true,
          false,
        ),
      ).toBe('cannot_confirm')
      expect(
        classifyFreshnessForDisplay(
          { freshness: 'unknown', freshnessReason: RUN_COMPLETED_WITHOUT_VERDICT },
          true,
          false,
        ),
      ).toBe('cannot_confirm')
    })

    it('silence WITHOUT a local edit claims nothing — the overlay is what licenses limb 2b', () => {
      expect(classifyFreshnessForDisplay(SILENT_PAYLOAD_DEGRADED, false, false)).toBe(
        'cannot_confirm',
      )
    })

    it('an import hold suppresses limb 2b — the inferred change is unsafe there', () => {
      expect(classifyFreshnessForDisplay(SILENT_PAYLOAD_DEGRADED, true, true)).toBe(
        'cannot_confirm',
      )
    })

    it("no verdict, and a 'none' verdict, are 'none' — never a claim in either direction", () => {
      expect(classifyFreshnessForDisplay(null, true, false)).toBe('none')
      expect(classifyFreshnessForDisplay({ freshness: 'none' }, true, false)).toBe('none')
    })
  })

  /**
   * The panel-copy consequence of the boundary above, asserted through the
   * reader this module owns rather than left as an inference from the semantic.
   */
  it('the two unknown states produce DIFFERENT panel sentences', () => {
    expect(
      staleReasonFromTrustSemantic(classifyFreshnessForDisplay(SILENT_PAYLOAD_DEGRADED, true, false)),
    ).toBe('changed')
    expect(
      staleReasonFromTrustSemantic(classifyFreshnessForDisplay(CEE_STATED_UNKNOWN, true, false)),
    ).toBe('unconfirmed')
  })
})
