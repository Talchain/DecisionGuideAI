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
 *     (the robustness trio and recommendationStability — no producer
 *     display-safe label exists, so any read would be a fabrication path);
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
    expect(sources.map((s) => s.file)).toContain('buildHeroModel.ts')
  })

  it.each([
    ['unsafe HTML', /dangerouslySetInnerHTML|\binnerHTML\b/],
    ['network access', /\bfetch\s*\(|\baxios\b|XMLHttpRequest|EventSource|WebSocket/],
    // Catches `0.5`, no-leading-zero `.5`, and scientific `1e-1` literals.
    ['UI banding threshold ternary', /[><]=?\s*(?:0?\.\d+|\d+(?:\.\d+)?e-\d+)\s*\?/i],
    [
      'trust/stability field reads',
      /robustnessLevel|robustnessLabel|robustnessVerdict|recommendationStability/,
    ],
    ['focus-now imports', /coaching-panel\/focus-now/],
  ])('contains no %s', (_label, re) => {
    for (const { file, content } of sources) {
      expect(re.test(content), `${file} must not match ${re}`).toBe(false)
    }
  })

  it('positive controls: each pattern fires on the code it bans', () => {
    const banding = /[><]=?\s*(?:0?\.\d+|\d+(?:\.\d+)?e-\d+)\s*\?/i
    expect(/dangerouslySetInnerHTML|\binnerHTML\b/.test('el.innerHTML = x')).toBe(true)
    expect(/\bfetch\s*\(/.test('await fetch(url)')).toBe(true)
    expect(banding.test("conf >= 0.65 ? 'Firm' : 'Fragile'")).toBe(true)
    expect(banding.test("p > .5 ? 'likely' : 'unlikely'")).toBe(true)
    expect(banding.test("score >= 1e-1 ? 'a' : 'b'")).toBe(true)
    expect(/robustnessVerdict/.test('data.robustnessVerdict')).toBe(true)
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
    const verdictRe = /robustnessLevel|robustnessLabel|robustnessVerdict|recommendationStability/
    // Comment-borne mentions are blanked → not scanned (the #386/#403 footgun):
    expect(fetchRe.test(stripComments('// must never introduce a second fetch(', 'x.ts'))).toBe(false)
    expect(verdictRe.test(stripComments('/* must not read robustnessVerdict */', 'x.ts'))).toBe(false)
    // Real code still trips, INCLUDING a bracket-string read (why we keep
    // strings — blankNonCode would have blanked this and missed it):
    expect(fetchRe.test(stripComments('const r = await fetch(url)', 'x.ts'))).toBe(true)
    expect(verdictRe.test(stripComments("const v = data['robustnessVerdict']", 'x.ts'))).toBe(true)
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
