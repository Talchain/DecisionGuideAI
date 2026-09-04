/**
 * ⭐ A SECTION TITLE IS TYPED AS A SECTION TITLE.
 *
 * Measured on the DEPLOYED build (`b14cd478`) with a completed analysis, guest,
 * 291px dock: seven section headings on this tab, and TWO of them rendered
 * `11px/400` — `panelMeta`, the badge token — while the other five rendered
 * `14px/600` via `SectionShell`'s `panelHeader`. One of the two was SMALLER
 * than the body text beneath it.
 *
 * The token table settles it in its own words: `panelHeader` is "section
 * titles"; `panelMeta` is "badges, pills, axis labels, tertiary metadata". This
 * is #1179's defect class on the other tab — a surface reaching for the nearest
 * token rather than the right one — and nothing pinned it.
 *
 * DERIVED, NOT MIRRORED: the file list comes from a recursive walk, so a new
 * section is in scope the moment it is written. There is no list to keep in sync.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sourceFilesIn } from '../../../../../tests/helpers/jsxTextEntryScan'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const DIR = join(process.cwd(), 'src/components/results/analysisNew')
/**
 * ⚠ SECTION TITLES ONLY — h1–h3. THE SCOPE IS NARROWER THAN "every heading",
 * and the narrowing is measured rather than assumed.
 *
 * The first version of this guard matched h1–h4 and flagged
 * `DeeperAnalysis.tsx`'s `<h4>`. That one is CORRECT as it stands: it is a
 * GROUP title nested inside an expanded disclosure — indented `pl-5`, one level
 * below a section — and it pairs `panelMeta` size with `text-text-header`
 * COLOUR. Promoting it to `panelHeader` would give a child the same weight as
 * its parent section and flatten the hierarchy in the other direction.
 *
 * So: a SECTION title (h1–h3) must carry `panelHeader`. A nested GROUP title
 * (h4) may carry `panelMeta` with header colour. If a future h4 is used as a
 * section title, this guard will not see it — that is the stated limit, not an
 * oversight.
 */
const HEADING_TAG = /<h[1-3](?![A-Za-z0-9_$-])/g

/** Every heading element in this tab's source, with the class expression that styles it. */
function headings(): { file: string; snippet: string }[] {
  const out: { file: string; snippet: string }[] = []
  for (const file of sourceFilesIn(DIR)) {
    if (file.includes('__tests__')) continue
    const code = stripComments(readFileSync(file, 'utf8'), file)
    for (const m of code.matchAll(HEADING_TAG)) {
      // the opening tag only — className lives before the first `>`
      const gt = code.indexOf('>', m.index!)
      out.push({ file: file.slice(DIR.length + 1), snippet: code.slice(m.index!, gt < 0 ? m.index! + 400 : gt) })
    }
  }
  return out
}

describe('Analysis (New) — a section title is typed as a section title', () => {
  it('the h4 exception is REAL and still exempt (the scope clause is not decorative)', () => {
    // Pins the narrowing itself. If `DeeperAnalysis`'s h4 ever stops being an
    // h4 — or stops pairing panelMeta with header colour — this reds, so the
    // exception cannot quietly become a licence for section titles.
    const src = readFileSync(join(DIR, 'sections/DeeperAnalysis.tsx'), 'utf8')
    expect(/<h4 className=\{`\$\{typography\.panelMeta\} text-text-header`\}/.test(src),
      'the DeeperAnalysis h4 changed — re-derive whether the exception still holds').toBe(true)
  })

  it('the scan finds headings at all (positive control)', () => {
    // Without this, a regex or walker change empties the set and the assertion
    // below passes by measuring nothing.
    expect(headings().length, 'no headings found — the scan is blind').toBeGreaterThanOrEqual(3)
  })

  it('no heading is typed with panelMeta, the badge token', () => {
    const offenders = headings()
      .filter((h) => /typography\.panelMeta/.test(h.snippet))
      .map((h) => `${h.file}: ${h.snippet.replace(/\s+/g, ' ').slice(0, 90)}`)
    expect(
      offenders,
      `A section heading is wearing panelMeta (11px badge type). The token table reserves panelHeader for section titles.\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('the two headings this closed are on panelHeader, by identity', () => {
    const all = headings()
    const byFile = (f: string) => all.filter((h) => h.file.endsWith(f))
    // Bound by IDENTITY to the two surfaces measured on the deployed build,
    // so a future refactor that drops either one fails loudly rather than
    // silently shrinking the set this test protects.
    expect(byFile('sections/WhatWeChecked.tsx').some((h) => /typography\.panelHeader/.test(h.snippet)), 'WhatWeChecked').toBe(true)
    expect(byFile('AnalysisNewTabBody.tsx').some((h) => /typography\.panelHeader/.test(h.snippet)), 'the decision-VOI heading').toBe(true)
  })
})
