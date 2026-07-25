/**
 * No-EVPI-display contract — a DERIVED, fail-loud guard.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY DERIVED RATHER THAN A CHECKLIST
 * ─────────────────────────────────────────────────────────────────────────────
 * The dominant defect in this estate is the HAND-MAINTAINED MIRROR: a list a
 * human must remember to sync with reality, whose drift always reads as green.
 * The original brief for this removal named THREE display sites. Reading every
 * hit of `evpiPp|evpi_percentage_points` across `src/` found EIGHT, including a
 * status-bar chip that SUMMED three refuted numbers into one headline figure
 * and a compare-tab line that repeated the removed sentence verbatim. An
 * EARLIER DRAFT OF THIS VERY GUARD then found a NINTH — the Strengthen panel's
 * "Knowing this better could shift the result by about {N} percentage points",
 * which carries the same figure under the alias `evpiPercentagePoints` and
 * which a grep for `evpiPp` misses. A checklist would have shipped 3 of 9 and
 * read as done.
 *
 * So this guard derives its file set from the filesystem on every run. A new
 * component that renders an EVPI figure fails this test the day it lands, with
 * no list to update.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS FORBIDDEN
 * ─────────────────────────────────────────────────────────────────────────────
 * Any DISPLAY module that mentions an EVPI-derived identifier at all. The
 * number is refuted (PLoT publishes 12.3pp for a factor ISL measures at 0.0pp
 * in the same payload), and the ordering it induces is inverted against our own
 * compute layer, so it must not select, order, or label anything a user sees.
 *
 * NON-DISPLAY modules are exempt BY DERIVED CATEGORY, not by filename:
 *   · `src/lib/scientificValidation/**` — the validator whose JOB is to check
 *     EVPI values. Removing its EVPI references would delete the honesty
 *     machinery, not the defect.
 *   · `src/components/debug/**`, `src/lib/debugRedaction*` — the debug bundle
 *     and its redaction manifest; developer-facing, never product copy.
 *   · `src/adapters/`, `src/v5/`, `src/lib/mappers/` — transport. These carry
 *     the producer's field across a boundary and are already
 *     absence-preserving (they OMIT rather than default). Deleting the field
 *     in transport would break the debug bundle and the validator above.
 *   · any `__tests__` directory — including this file's own fixtures.
 *
 * CLAIM TYPE: static source analysis over tracked files. It proves no display
 * module REFERENCES the quantity. It is not a rendering claim — the render
 * assertions live in `evpiSurfacesRemoved.honesty.spec.tsx` (results) and
 * `evpiSurfacesRemoved.canvas.honesty.spec.tsx` (canvas).
 */

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

/**
 * Identifiers that denote THE REFUTED QUANTITY specifically —
 * `factor_sensitivity[].evpi_percentage_points` / `evidence_gaps[].evpi_percentage_points`
 * and its UI aliases.
 *
 * Deliberately NOT a bare `/evpi/i`. A separate, unrelated `voi.evpi` field
 * exists on `src/canvas/adapters/islRobustnessAdapter.ts` (currency- or
 * fraction-scaled, rendered by `ResultsPanel/ValueOfInformationList.tsx` and
 * `RecommendationCard/RobustnessBlock.tsx`). That is a different quantity from a
 * different producer path and is NOT what this change removed — sweeping it in
 * would make this guard a blunt instrument that the next lane disables. It is
 * recorded as a separate follow-up, not silently widened into here.
 */
const EVPI_IDENTIFIER =
  /\b(evpi_percentage_points|evpiPp|evpiPercentagePoints|evpiMap|topEvpiFactor|topEvpiFactorId|topEvpiValue)\b/

/**
 * `evpi_method` / `evpiMethod` are deliberately NOT in the list above.
 *
 * That field is the producer's own word for HOW it computed the figure
 * ("heuristic"), surfaced by the How-computed modal as a methodology
 * disclosure. It is a label about a method, not a claim about what resolving a
 * factor is worth, and it is the kind of self-incriminating disclosure this
 * repo wants MORE of. It is recorded as a follow-up (the row now describes a
 * number the product no longer shows), not swept in here.
 */

/**
 * Blank out every comment before scanning, so that explaining WHY a number was
 * removed — right next to where it used to live — does not itself trip the
 * guard. Handles line comments, block comments and JSX comment expressions,
 * including multi-line ones. Line numbering is preserved so hits stay locatable.
 *
 * It does NOT track string or template literals. A string containing the
 * characters that open a comment would confuse it — the failure mode is a
 * false NEGATIVE confined to that one file, never a false green across the
 * repo, and the positive control below proves the stripper still lets real
 * code through.
 */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let mode: 'code' | 'line' | 'block' = 'code'
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') { mode = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { mode = 'block'; out += '  '; i += 2; continue }
      out += c; i++; continue
    }
    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; out += c } else out += ' '
      i++; continue
    }
    if (c === '*' && n === '/') { mode = 'code'; out += '  '; i += 2; continue }
    out += c === '\n' ? c : ' '
    i++
  }
  return out
}

/**
 * An OPTIONAL PROPERTY DECLARATION whose right-hand side is a type expression
 * cannot render anything — it only records what the producer may put on the
 * wire. Deleting those would leave the UI's wire types lying about what PLoT
 * actually sends, which is its own dishonesty. Reads and writes of the field
 * are still caught, because they carry a value, a dot, or a trailing comma.
 */
const TYPE_MEMBER_DECLARATION = /^\s*(readonly\s+)?[A-Za-z_$][\w$]*\?:\s*[A-Za-z_$][\w$<>[\]| ]*$/

/** Directories whose EVPI references are legitimately non-display. */
const NON_DISPLAY_PREFIXES = [
  'src/lib/scientificValidation/',
  'src/components/debug/',
  'src/adapters/',
  'src/v5/',
  'src/lib/mappers/',
]

const NON_DISPLAY_FILES = ['src/lib/debugRedactionManifest.ts', 'src/lib/v5EmbeddedEvidence.ts']

function isExempt(rel: string): boolean {
  if (rel.includes('__tests__/') || rel.includes('/tests/')) return true
  if (NON_DISPLAY_FILES.includes(rel)) return true
  return NON_DISPLAY_PREFIXES.some(p => rel.startsWith(p))
}

/** Derived from git, not from a list anyone maintains. */
function trackedDisplaySources(): string[] {
  const out = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return out.split('\n').filter(Boolean).filter(f => !isExempt(f))
}

function offendingLines(rel: string): string[] {
  const src = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
  return src
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !TYPE_MEMBER_DECLARATION.test(line) && EVPI_IDENTIFIER.test(line))
    .map(({ line, n }) => `${rel}:${n}  ${line.trim()}`)
}

describe('no EVPI figure reaches a display module', () => {
  /**
   * POSITIVE CONTROL (trap 13). An absence assertion is vacuous until the
   * detector is shown capable of seeing a presence. Both halves are proven:
   * the scanner finds files at all, and the matcher fires on every real string
   * that was removed from the product.
   */
  it('POSITIVE CONTROL: the scanner sees files and the matcher fires on the removed code', () => {
    const files = trackedDisplaySources()
    expect(files.length).toBeGreaterThan(500)
    expect(files).toContain('src/components/results/useResultsSectionData.ts')
    expect(files).toContain('src/canvas/components/model-tab/FactorsSection.tsx')

    // Verbatim lines deleted by this change. If the matcher cannot see these,
    // the suite below proves nothing.
    for (const removed of [
      '          evpiPp: typeof gap.evpi_percentage_points === \'number\' ? gap.evpi_percentage_points : undefined,',
      '          .filter(g => (g.evpiPp ?? 0) > 0)',
      '                Worth {evpiPp}pp if resolved: your knowledge of {label} would improve confidence by {evpiPp} percentage points',
      '    if (evpiMap.size > 0) {',
      '        f.evpiPercentagePoints > VOI_EVPI_FLOOR_PP,',
      '      evpiPp: f.evpi_percentage_points ?? 0,',
      '        detail: `${latest.topElasticity}% influence, resolving could improve confidence by ${latest.topEvpiValue}pp`,',
    ]) {
      expect(EVPI_IDENTIFIER.test(removed), `matcher must see: ${removed.trim()}`).toBe(true)
    }

    // stripComments must blank comments WITHOUT blanking real code — otherwise
    // the guard could pass by seeing nothing at all.
    expect(stripComments('const a = 1 // evpiPp here\nconst evpiPp = 2\n'))
      .toContain('const evpiPp = 2')
    expect(stripComments('const a = 1 // evpiPp here\n').split('\n')[0])
      .not.toContain('evpiPp')
    expect(stripComments('{/* evpiPp in JSX */}\nconst b = 3').trim()).toContain('const b = 3')
    expect(stripComments('{/* evpiPp in JSX */}\nconst b = 3')).not.toContain('evpiPp')
    // A string literal is CODE and must survive.
    expect(stripComments("const s = 'evpiPp'")).toContain('evpiPp')

    // The type-declaration carve-out must admit a declaration and REFUSE a use.
    expect(TYPE_MEMBER_DECLARATION.test('  evpi_percentage_points?: number')).toBe(true)
    expect(TYPE_MEMBER_DECLARATION.test('  evpiPp?: number | null')).toBe(true)
    expect(TYPE_MEMBER_DECLARATION.test('      evpiPp: f.evpi_percentage_points ?? 0,')).toBe(false)
    expect(TYPE_MEMBER_DECLARATION.test('          .filter(g => (g.evpiPp ?? 0) > 0)')).toBe(false)
    expect(TYPE_MEMBER_DECLARATION.test('  evpiMap: Map<string, number>')).toBe(false)

    // And it must NOT fire on innocuous neighbours, or the guard is a blunt
    // instrument that will be disabled the first time it cries wolf. The
    // `voi.evpi` entries are the SEPARATE quantity described above.
    for (const innocuous of [
      'const voi = gap.voi_score ?? 0',
      'elasticity: f.elasticity ?? 0,',
      'label: `${Math.round(recommendationStability * 100)}% stability`,',
      'const evpiDisplay = voi.evpi < 1',
      'const evpi = raw.evpi ?? raw.expected_value ?? 0',
    ]) {
      expect(EVPI_IDENTIFIER.test(innocuous), `matcher must ignore: ${innocuous}`).toBe(false)
    }
  })

  it('no display source references an EVPI-derived identifier', () => {
    const hits = trackedDisplaySources().flatMap(offendingLines)
    expect(
      hits,
      hits.length === 0
        ? ''
        : `EVPI resurfaced in ${hits.length} display line(s). The quantity is REFUTED — PLoT `
          + `publishes 12.3pp for a factor ISL measures at 0.0pp in the same payload, and the `
          + `formula multiplies BY the top-two win-probability gap, inverting decision theory. `
          + `If this is genuinely non-display, add its DIRECTORY to NON_DISPLAY_PREFIXES with a `
          + `reason — do not add a filename.\n${hits.join('\n')}`,
    ).toEqual([])
  })
})

/**
 * Second guard, deliberately independent of the first.
 *
 * The identifier scan above would MISS a re-introduction that recomputes the
 * same claim under a different variable name — exactly how the StatusBar chip
 * was written (`label: \`${'${Math.round(top3Sum)}'}pp via EVPI\``, whose only
 * EVPI identifier sat on an enclosing line). Two guards keyed on different
 * things is the point: one on the quantity, one on the sentence.
 */
const FORBIDDEN_COPY: Array<[RegExp, string]> = [
  [/would improve confidence by/i, 'the "Worth Xpp if resolved" factor chip'],
  [/resolving could improve confidence/i, 'the "Resolving could improve confidence by up to Xpp" line'],
  [/pp via EVPI/i, 'the StatusBar chip that SUMMED three refuted figures'],
  [/ranked by EVPI/i, 'the visible factor-list sort label'],
]

describe('the removed user-facing copy does not come back under another name', () => {
  it('POSITIVE CONTROL: every pattern fires on the string it was written to catch', () => {
    const originals = [
      'Worth {evpiPp}pp if resolved: your knowledge of {label} would improve confidence by {evpiPp} percentage points',
      'Resolving could improve confidence by up to {Math.round(actionItem.evpiPp)}pp',
      'label: `${Math.round(top3Sum)}pp via EVPI`,',
      "sortNote={hasRobustnessData && evpiMap.size > 0 ? 'ranked by EVPI' : undefined}",
    ]
    originals.forEach((s, i) => {
      expect(FORBIDDEN_COPY[i][0].test(s), `pattern ${i} must see: ${s}`).toBe(true)
    })
  })

  it('no display source contains any of the removed sentences', () => {
    const hits: string[] = []
    for (const rel of trackedDisplaySources()) {
      const src = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
      src.split('\n').forEach((line, i) => {
        for (const [re, what] of FORBIDDEN_COPY) {
          if (re.test(line)) hits.push(`${rel}:${i + 1}  [${what}]  ${line.trim()}`)
        }
      })
    }
    expect(hits, hits.length ? `Removed EVPI copy is back:\n${hits.join('\n')}` : '').toEqual([])
  })
})
