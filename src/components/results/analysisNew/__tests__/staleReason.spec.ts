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
