/**
 * gaps TYPE-3 and ACTION-3 (design-audit-20260925, both high), applied ONLY
 * to this pass's editable files: `ModelStrip.tsx`, `SuccessTargetLine.tsx`
 * (TYPE-3, the tiered-act call sites — `${typography.panelMeta} ...
 * action(...)`), and `ModelStrip.tsx`, `SuccessTargetLine.tsx`,
 * `BriefEditForm.tsx`, `ReviewItemEditor.tsx`, `FactorValueControl.tsx`,
 * `DriverInfluenceChart.tsx` (ACTION-3, editable-field borders). The
 * remaining call sites of both gaps live in files this pass may not edit
 * (`ChallengeCard.tsx`, `ReasoningSignals.tsx`, `AnalysisNewTabBody.tsx`,
 * `StrengthenTheReasoning.tsx`, `DisclosureRow.tsx`) — see the PR body's
 * handed-on table.
 *
 * Pinned by SOURCE SCAN, the same technique
 * `ribbonAndFooterShareOneAdmission.sourceScan.spec.ts` already uses in this
 * codebase: a class-presence assertion would pass on JSDOM's rendered output
 * either way, but the actual defect is TEXT in the file (`panelMeta` next to
 * an `action(...)` call, `border-panel-border` on an editable field), so the
 * spec reads the file the way a reviewer would.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SECTIONS_DIR = path.resolve(__dirname, '..', 'sections')
const ANALYSIS_NEW_DIR = path.resolve(__dirname, '..')

const read = (file: string) => readFileSync(file, 'utf8')

describe('gap TYPE-3: tiered acts in this pass\'s files are panelBody (12px), never panelMeta (11px)', () => {
  it('⭐⭐ ModelStrip.tsx: no `${typography.panelMeta} ... action(` pairing survives', () => {
    const src = read(path.join(SECTIONS_DIR, 'ModelStrip.tsx'))
    const offenders = src.match(/typography\.panelMeta\}[^`]*\$\{action\(/g) ?? []
    expect(offenders, `these act pairs are still 11px: ${JSON.stringify(offenders)}`).toEqual([])
    // Six sites were fixed (design-audit-20260925's own count for this file).
    const fixed = src.match(/typography\.panelBody\}[^`]*\$\{action\('secondary'\)\}/g) ?? []
    expect(fixed.length).toBeGreaterThanOrEqual(6)
  })

  it('⭐⭐ SuccessTargetLine.tsx: no `${typography.panelMeta} ... action(` pairing survives', () => {
    const src = read(path.join(SECTIONS_DIR, 'SuccessTargetLine.tsx'))
    const offenders = src.match(/typography\.panelMeta\}[^`]*\$\{?\s*action\(/g) ?? []
    expect(offenders, `these act pairs are still 11px: ${JSON.stringify(offenders)}`).toEqual([])
  })
})

describe('gap ACTION-3: every editable field in this pass\'s files carries border-field, never border-panel-border', () => {
  const editableFieldFiles = [
    path.join(SECTIONS_DIR, 'ModelStrip.tsx'),
    path.join(SECTIONS_DIR, 'SuccessTargetLine.tsx'),
    path.join(SECTIONS_DIR, 'BriefEditForm.tsx'),
    path.join(SECTIONS_DIR, 'ReviewItemEditor.tsx'),
    path.join(SECTIONS_DIR, 'DriverInfluenceChart.tsx'),
    path.join(ANALYSIS_NEW_DIR, 'FactorValueControl.tsx'),
  ]

  it('⭐⭐ no `rounded border border-panel-border` (the old field style) remains in these files', () => {
    for (const file of editableFieldFiles) {
      const src = read(file)
      expect(
        src,
        `${path.relative(ANALYSIS_NEW_DIR, file)} still has the 1.23:1 field border`,
      ).not.toMatch(/rounded border border-panel-border/)
    }
  })

  it('⭐⭐ `border-field` is present in every file that had an editable field', () => {
    for (const file of editableFieldFiles) {
      const src = read(file)
      expect(src, `${path.relative(ANALYSIS_NEW_DIR, file)} never gained border-field`).toMatch(
        /border-field/,
      )
    }
  })

  it('⭐ the disabled Save chip in FactorValueControl.tsx keeps its OWN pinned border-panel-border (not an editable field)', () => {
    const src = read(path.join(ANALYSIS_NEW_DIR, 'FactorValueControl.tsx'))
    expect(src).toMatch(/'border-panel-border text-text-light'/)
  })
})
