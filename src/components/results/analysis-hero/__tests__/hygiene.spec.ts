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

const MODULE_DIR = resolve(process.cwd(), 'src', 'components', 'results', 'analysis-hero')

function productionSources(dir: string, acc: { file: string; content: string }[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === '__fixtures__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      productionSources(full, acc)
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push({ file: name, content: readFileSync(full, 'utf8') })
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
    ['UI banding threshold ternary', /[><]=?\s*0\.\d+\s*\?/],
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
    expect(/dangerouslySetInnerHTML|\binnerHTML\b/.test('el.innerHTML = x')).toBe(true)
    expect(/\bfetch\s*\(/.test('await fetch(url)')).toBe(true)
    expect(/[><]=?\s*0\.\d+\s*\?/.test("conf >= 0.65 ? 'Firm' : 'Fragile'")).toBe(true)
    expect(/robustnessVerdict/.test('data.robustnessVerdict')).toBe(true)
    expect(/coaching-panel\/focus-now/.test("import x from '@/canvas/components/coaching-panel/focus-now'")).toBe(true)
  })
})
