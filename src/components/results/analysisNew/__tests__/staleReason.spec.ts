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
 * sat on the function nothing calls.** `OutputsDock.tsx:1018` uses
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
      // ⚠⚠ ANCHORED, AND UNANCHORED IS HOW ATTACK D1 GOT THROUGH. The check was
      // a SUBSTRING match, so `analysisNew/staleReasonCompat.ts` satisfied it —
      // and a re-export shim there (`export { staleReasonFromFreshness as
      // staleReasonFromTrustSemantic }`) puts the aliasing one hop away, where
      // the IMMEDIATE import has no `propertyName` for clause A to read.
      // Result: pin green, typecheck green, 2,057 tests green, and the dock
      // returning `unconfirmed` for every member of the domain — Attack A's
      // outcome verbatim. The mechanism was isolated with a contrast control:
      // the same shim at `analysisNew/compat/reader.ts` REDs, differing only
      // in path.
      //
      // ⚠ WHAT ANCHORING DOES NOT DO: it kills the shim-PATH family, not
      // re-exports in general. A shim at the exact path would still pass, and
      // only a behavioural test closes that. Stated, not implied.
      if (
        ts.isImportDeclaration(n) &&
        /analysisNew\/staleReason['"]$/.test(n.moduleSpecifier.getText(sf).trim())
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
