/**
 * Source hygiene guard — scans the module's production source (tests and
 * fixtures excluded) for the failure modes the brief bans outright:
 *
 *   - unsafe HTML (dangerouslySetInnerHTML / innerHTML);
 *   - any network path (fetch/axios/XHR/EventSource/WebSocket) — the hero is
 *     a read-only layer over props, it must never introduce a second fetch;
 *   - UI-created banding thresholds (a `>= 0.x ?` style ternary — the
 *     prototype's band()/trustWord() shape);
 *   - reads of the trust/stability fields the hero must not consume
 *     (`robustnessLevel`, `robustnessLabel`, `recommendationStability` — no
 *     producer display-safe label exists for these, so any read is a
 *     fabrication path. ⚠ `robustnessVerdict` is deliberately NOT in that list
 *     since ROADMAP 2.1227: it IS the producer's display-safe field and reading
 *     it is the sanctioned path — see the block comment below);
 *   - imports from the focus-now module (its inertness guard forbids
 *     external importers — patterns were copied, not imported).
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const MODULE_DIR = resolve(process.cwd(), 'src', 'components', 'results', 'analysis-hero')

function productionSources(dir: string, acc: { file: string; content: string }[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === '__fixtures__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      productionSources(full, acc)
    } else if (/\.(ts|tsx)$/.test(name)) {
      // stripComments blanks comments but KEEPS strings/templates as code, so a
      // design-note comment that mentions `fetch(`/`robustnessVerdict`/a
      // threshold no longer false-reds (the #386/#403 footgun) while a real
      // bracket-key read (`data['robustnessVerdict']`) or a live
      // `coaching-panel/focus-now` import string is still caught. blankNonCode
      // would blank those strings and weaken detection, so it is the wrong tool
      // (reclassified from the #403 manifest's "blankNonCode class").
      acc.push({ file: name, content: stripComments(readFileSync(full, 'utf8'), name) })
    }
  }
  return acc
}

const sources = productionSources(MODULE_DIR)

describe('Analysis hero source hygiene', () => {
  it('scans a non-empty production source set (guard is alive)', () => {
    // Names a file at BOTH depths on purpose. Every other `it` in this file
    // asserts an ABSENCE over `sources`, so all of them go vacuous if the scan
    // shrinks — and until 2.1228 the subdirectory half of that scan was held
    // alive only incidentally, by the trust/stability pin happening to contain
    // two `actOnIt/` entries. Emptying that pin retired the only control on the
    // recursion: deleting the `isDirectory()` walk left this whole spec GREEN
    // (measured), silently un-covering `actOnIt/` — the directory holding the
    // module 2.1228 changed. Assert the depth explicitly instead.
    expect(sources.map((s) => s.file)).toEqual(
      expect.arrayContaining(['buildHeroModel.ts', 'rankActOnItRows.ts']),
    )
  })

  it.each([
    ['unsafe HTML', /dangerouslySetInnerHTML|\binnerHTML\b/],
    ['network access', /\bfetch\s*\(|\baxios\b|XMLHttpRequest|EventSource|WebSocket/],
    // Catches `0.5`, no-leading-zero `.5`, and scientific `1e-1` literals.
    ['UI banding threshold ternary', /[><]=?\s*(?:0?\.\d+|\d+(?:\.\d+)?e-\d+)\s*\?/i],
    ['focus-now imports', /coaching-panel\/focus-now/],
  ])('contains no %s', (_label, re) => {
    for (const { file, content } of sources) {
      expect(re.test(content), `${file} must not match ${re}`).toBe(false)
    }
  })

  /**
   * ── TRUST/STABILITY READS: AN EXACTLY-PINNED KNOWN-GAP SET ─────────────────
   *
   * This ban used to be a flat "no file may match". The cockpit consolidation
   * moved `rowRanking.ts` into this tree as `actOnIt/rankActOnItRows.ts`, and
   * it reads two of the four banned symbols — so the flat assertion went red.
   *
   * It is pinned rather than narrowed, and the distinction matters. Narrowing
   * the regex, excluding `actOnIt/`, or moving the file would all CARVE OUT
   * the discrepancy: the guard would go green while losing the power to see
   * the very thing it exists to catch. A pin keeps every symbol in scope and
   * records the gap honestly — the suite is green for the RIGHT reason.
   *
   * THE PIN IS BIDIRECTIONAL, and that is the point:
   *   · a NEW violation (set GROWS)   -> RED. The ban still bites everywhere.
   *   · a FIXED violation (set SHRINKS) -> RED. You cannot quietly resolve one
   *     and leave the pin overstating the debt; shrinking it is a deliberate,
   *     reviewable edit.
   *
   * ⚠ DO NOT "FIX" A RED HERE BY EDITING THIS SET TO MATCH REALITY. If the set
   * grew, you introduced a fabrication path. Only shrink it alongside the
   * change that genuinely removes a read.
   *
   * ⭐ THE SET IS NOW EMPTY, AND THE BAN IS FLAT AGAIN. The two entries were
   * NOT the same kind of debt — the guard's blanket rationale ("no producer
   * display-safe label exists") was stale for one and exactly right for the
   * other. Both are now resolved, in opposite ways, and the difference is the
   * whole lesson of this block:
   *
   *   · `recommendationStability` — ✅ ROADMAP 2.1228. The ban was CORRECT and
   *     the CODE was wrong, so the READ was deleted. `isReadyToBrief` no longer
   *     consults it: the `>= 0.85` cliff was UI-INVENTED, and the producer
   *     deliberately WITHHOLDS the field it gated on (PLoT
   *     `src/routes/v2/run.ts:3266-3277` — it is the leader's `win_probability`
   *     relabelled, so emitting it under a stability name was "a fabricated
   *     second statistic"). The predicate relies solely on the producer's
   *     display-safe verdict now. See
   *     `../actOnIt/__tests__/rankActOnItRows.spec.ts` §6/§7 for the
   *     bidirectional divergence pin bounding that behavioural change.
   *
   *   · `robustnessVerdict` — ✅ ROADMAP 2.1227. The CODE was correct and the
   *     BAN was wrong, so the SYMBOL LEFT THE REGEX. A display-safe label does
   *     exist: `types.ts` documents this field as sourced ONLY from PLoT's
   *     `robustness.display_verdict`, fail-closed normalised in
   *     `useResultsSectionData.ts:1974-1986` (only the four producer enum
   *     tokens populate it; absent field or unrecognised token → undefined →
   *     the honest "Robustness unknown" state). Reading it IS the sanctioned
   *     path — it is what `types.ts` instructs surfaces to use for the binary
   *     glyph — so banning it and then pinning the violation was recording a
   *     debt that did not exist.
   *
   * ⚠ NOTE WHICH SYMBOL DID *NOT* LEAVE. `robustnessLevel` is still banned and
   * that is deliberate: `types.ts` says it is PLoT-level structured data that
   * "must NOT drive the binary Robust/Sensitive glyph", and it carries a
   * UI-SEM-005 stability fallback. The two are differently-named twins and only
   * one is display-safe — unbanning the wrong one would have been this estate's
   * chronic defect. So the ban keeps its three genuinely-unlicensed symbols and
   * an EMPTY known-gap set, which is the healthy end state the flat ban had
   * before the cockpit consolidation.
   *
   * THE PIN STILL BITES IN BOTH DIRECTIONS FROM EMPTY: a new banned read makes
   * the found set GROW (RED), and padding this list with an entry nothing
   * matches makes it OVERSTATE (RED). Both are proved by mutants.
   */
  const TRUST_STABILITY_RE =
    /robustnessLevel|robustnessLabel|recommendationStability/g

  const KNOWN_TRUST_STABILITY_READS: readonly string[] = []

  it('trust/stability field reads match the pinned known-gap set EXACTLY', () => {
    const found = new Set<string>()
    for (const { file, content } of sources) {
      for (const m of content.matchAll(TRUST_STABILITY_RE)) {
        found.add(`${file}::${m[0]}`)
      }
    }
    expect(
      [...found].sort(),
      'trust/stability reads drifted from the pinned set — see the block comment above: ' +
        'a GROWN set means a new fabrication path, a SHRUNK set means a fix landed ' +
        'without updating the pin. Do not edit the pin to match reality.',
    ).toEqual([...KNOWN_TRUST_STABILITY_READS].sort())
  })

  /**
   * ROADMAP 2.1227 — THE UN-BAN IS ITSELF PINNED, IN BOTH DIRECTIONS.
   *
   * `robustnessVerdict` left the regex deliberately (it is the producer's
   * display-safe field and reading it is sanctioned). Without this test, the
   * un-ban is invisible: someone re-adding the symbol would make the pin RED
   * with a message telling them a fabrication path had appeared, and the
   * tempting "fix" would be to re-pin the sanctioned read as a debt again.
   *
   * The second assertion is the load-bearing half — it stops the un-ban being
   * over-applied to the NON-display-safe twin.
   */
  it('the display-safe verdict is unbanned; its non-display-safe twin is NOT', () => {
    // Both assertions rebuild the pattern from `.source`: `TRUST_STABILITY_RE`
    // carries the `g` flag, and `.test()` on a global regex advances `lastIndex`,
    // so calling it twice on the shared instance would make the second result
    // depend on the first. A stateful instrument is not an instrument.
    const banned = () => new RegExp(TRUST_STABILITY_RE.source)
    expect(banned().test('data.robustnessVerdict')).toBe(false)
    expect(banned().test('data.robustnessLevel')).toBe(true)
  })

  it('positive controls: each pattern fires on the code it bans', () => {
    const banding = /[><]=?\s*(?:0?\.\d+|\d+(?:\.\d+)?e-\d+)\s*\?/i
    expect(/dangerouslySetInnerHTML|\binnerHTML\b/.test('el.innerHTML = x')).toBe(true)
    expect(/\bfetch\s*\(/.test('await fetch(url)')).toBe(true)
    expect(banding.test("conf >= 0.65 ? 'Firm' : 'Fragile'")).toBe(true)
    expect(banding.test("p > .5 ? 'likely' : 'unlikely'")).toBe(true)
    expect(banding.test("score >= 1e-1 ? 'a' : 'b'")).toBe(true)
    // Re-pointed by ROADMAP 2.1227 from `robustnessVerdict` (deliberately
    // unbanned) to `robustnessLevel` — its NON-display-safe twin, which is
    // still banned. A positive control aimed at a symbol the regex no longer
    // contains would assert nothing.
    expect(/robustnessLevel/.test('data.robustnessLevel')).toBe(true)
    // Assembled from parts rather than written as one source-text literal:
    // the sibling guard (focus-now module's own inertness spec) regex-scans
    // raw file text repo-wide for an import-shaped string ending in the
    // focus-now path, and this positive-control fixture (a string, never a
    // real import) was tripping it as a false-positive offender (ROADMAP
    // 1.26 chronic-CI-red triage). Same assembled runtime value, same
    // assertion; the source bytes just no longer spell out that shape.
    const focusNowSpecifier = ['@/canvas/components/coaching-panel', 'focus-now'].join('/')
    expect(/coaching-panel\/focus-now/.test(`import x from '${focusNowSpecifier}'`)).toBe(true)
  })

  it('comment-strip both directions: comment mentions vanish, code (incl. bracket-key) still trips', () => {
    const fetchRe = /\bfetch\s*\(|\baxios\b|XMLHttpRequest|EventSource|WebSocket/
    const verdictRe = /robustnessLevel|robustnessLabel|recommendationStability/
    // Comment-borne mentions are blanked → not scanned (the #386/#403 footgun):
    expect(fetchRe.test(stripComments('// must never introduce a second fetch(', 'x.ts'))).toBe(false)
    expect(verdictRe.test(stripComments('/* must not read robustnessLevel */', 'x.ts'))).toBe(false)
    // Real code still trips, INCLUDING a bracket-string read (why we keep
    // strings — blankNonCode would have blanked this and missed it):
    expect(fetchRe.test(stripComments('const r = await fetch(url)', 'x.ts'))).toBe(true)
    expect(verdictRe.test(stripComments("const v = data['robustnessLevel']", 'x.ts'))).toBe(true)
    // A live focus-now import string is kept and caught. Assemble the
    // specifier (do NOT spell out an import-shaped focus-now literal in source)
    // — the sibling focus-now inertness guard regex-scans this file; same
    // .join technique as the positive control above.
    const fnSpecifier = ['./coaching-panel', 'focus-now'].join('/')
    expect(
      /coaching-panel\/focus-now/.test(stripComments(`import x from '${fnSpecifier}'`, 'x.ts')),
    ).toBe(true)
  })
})
