/**
 * PLAIN-LANGUAGE STATISTICAL NOTATION — bound to the ONE gate.
 *
 * A UX gate on the frozen deployed build (UI `2b6ec553`), fresh guest, expert mode OFF, read `(normalised)`,
 * `Prior` and `Δ` off the Model surface, outside the expert gate. Two guards remain:
 *   · the persisted expert flag reaches `DetailToggleContext`, the gate `ModelHealthSection`, the v2 Model tab and
 *     `ScienceQuantity` read (section 6);
 *   · a derived scan bans the tokens across `model-tab/` (section 7).
 *
 * ⚠ NARROWED 26 Oct 2026 (U2). The wording table (`statisticalNotation.ts`) and `ContestedEdgeCard`, the last render
 * site, went with the legacy results code, and their paired expert-OFF/ON cases with them: their SUBJECTS are gone.
 * The scan no longer exempts an owner file, so the tokens may appear in no `model-tab/` source.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── 6. THE MOUNT PATH — bind to the gate that actually ships ────────────────

describe('the gate these sections read is the one the deployed flag feeds', () => {
  // ⚠ NARROWED 2026-09-11. This block also rendered `ModelTabHeader` with a
  // context `Probe` to prove it forwarded `showDetail` verbatim. `ModelTabHeader`
  // was deleted with the v1 Model stack, and `ModelTabBody` now provides
  // `DetailToggleContext` itself. The remaining case is the one that still
  // guards a live path: the binding from the persisted flag to that provider.
  it('ModelTabBody binds that prop to expertMode — fails loud if the flag path moves', () => {
    // The estate has twice shipped a feature dark because tests targeted a
    // component the deployed posture does not render. This asserts the LINK
    // between the persisted `olumi.expertMode` state and the context above it,
    // so moving the flag REDs here instead of silently un-gating the copy.
    const here = dirname(fileURLToPath(import.meta.url))
    const body = readFileSync(join(here, '..', '..', 'ModelTabBody.tsx'), 'utf8')

    // ⚠ PATTERN UPDATED 2026-09-11, and the SHAPE of the binding changed, not the
    // fact of it. It used to match the JSX attribute `showDetail={expertMode ??
    // false}` that `ModelTabBody` passed to `ModelTabHeader`, which was the
    // provider. `ModelTabHeader` was deleted with the v1 Model stack and
    // `ModelTabBody` now supplies `DetailToggleContext` directly, so the same
    // link is expressed as the provider's value.
    expect(
      body,
      '\nThe persisted expert flag no longer reaches DetailToggleContext.\n' +
        'Moving that link silently un-gates the technical notation this file bans.\n',
    ).toMatch(/<DetailToggleContext\.Provider\s+value=\{\{\s*showDetail:\s*expertMode\s*\?\?\s*false\s*\}\}/)

    // Precondition, in-test: the file really was read. A path slip would make the
    // regex above fail for the wrong reason, or an empty read pass a negation.
    expect(body.length, 'ModelTabBody.tsx read as empty — this assertion is void').toBeGreaterThan(1000)
  })
})

// ── 7. DERIVED GUARD — no ungated technical notation left in model-tab ──────

describe('no ungated technical notation in model-tab, derived', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const DIR = join(here, '..')

  function sourceFiles(): string[] {
    return readdirSync(DIR, { withFileTypes: true })
      .filter(e => e.isFile() && /\.tsx?$/.test(e.name))
      .map(e => join(DIR, e.name))
  }

  /** Strip block/line comments so this file's own prose cannot trip the scan. */
  function codeOnly(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }

  it('POSITIVE CONTROL: the scan detects the tokens it bans', () => {
    const sample = 'const a = "(normalised)"\nconst b = <span>Δ {x}</span>\n'
    expect(codeOnly(sample)).toMatch(/\(normalised\)/)
    expect(codeOnly(sample)).toMatch(/Δ/)
  })

  it('CONTRAST CONTROL: it does not fire on the plain forms', () => {
    const honest = 'const a = " on a 0 to 1 scale"\nconst b = "a gap of 0.25"\n'
    expect(codeOnly(honest)).not.toMatch(/\(normalised\)/)
    expect(codeOnly(honest)).not.toMatch(/Δ/)
  })

  it('the corpus is non-empty and contains the components under test, BY NAME', () => {
    // An empty or mis-filtered directory would make the absence below vacuous.
    const names = sourceFiles().map(f => basename(f))
    expect(names.length).toBeGreaterThan(5)
    // ⚠ NAMES UPDATED 26 Oct 2026 (U2). `ContestedEdgeCard.tsx` and the wording table `statisticalNotation.ts` went
    // with the legacy results code; the surviving anchor is a real reader of the expert gate.
    expect(names).toContain('ModelHealthSection.tsx')
  })

  it('`(normalised)` and `Δ` appear in NO model-tab source', () => {
    const offenders = sourceFiles()
      .filter(f => /\(normalised\)|Δ/.test(codeOnly(readFileSync(f, 'utf8'))))
      .map(f => basename(f))
    expect(offenders).toEqual([])
  })
})
