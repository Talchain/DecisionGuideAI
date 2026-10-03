/**
 * ⭐ ONE MONEY-FIGURE RULE — the lock on the root (DL #72 5870353946, ROOT: Product Experience).
 *
 * THE DEFECT. Served f0c8814f: one price edit (49 → 58.8, `unit: "GBP/month"`) read "£58.8 / month" on
 * the factor card, "£58.80 / month" on the Reasoning tab and "49 GBP/month" on the Olumi-tab receipt.
 * Four formatters, each with its own glyph map and its own digits, so every new surface added a fifth.
 *
 * THE RULE. Money is put on screen by `moneyFigureParts` / `formatMoneyFigure` in `src/utils/unitClassifier.ts`
 * (the receipt, the threshold sites and the factor card call it). This guard fails when a source file OUTSIDE
 * that home composes a currency glyph itself: a template that writes `£${…}` / `$${…}` / `€${…}`, a glyph
 * concatenated with `+`, a private `GBP: '£'` map, or a direct `ISO_CURRENCY_GLYPHS[…]` read.
 *
 * LEGACY is the set that composed money itself when the rule landed. It is EXACT and BIDIRECTIONAL: a new
 * file fails, and a legacy file that stops composing money fails too, until it is struck off the list — so
 * the list can only shrink, and never outlives the drift it records.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '../..')
const SRC = join(ROOT, 'src')
const HOME = 'src/utils/unitClassifier.ts'

/** Composed money itself on 28 Sep 2026, when the rule landed. Strike a file off when it calls the rule. */
const LEGACY = new Set([
  'src/canvas/components/ComparisonCanvasLayout.tsx',
  'src/canvas/components/InterventionDisplay.tsx',
  'src/canvas/domain/goalOwnTargetRow.ts',
  'src/canvas/utils/confidenceRangeLabels.ts',
  'src/canvas/utils/goalConstraintText.ts',
  'src/components/results/utils/formatGoalTarget.ts',
  'src/lib/currency.ts',
  'src/lib/export.ts',
])

const COMPOSES_MONEY: ReadonlyArray<[string, RegExp]> = [
  ['a template writing £${…} or €${…}', /`[^`\n]*[£€]\$\{/],
  ['a template writing $${…}', /`[^`\n]*\$\$\{/],
  ['a glyph concatenated with +', /['"][£$€]['"]\s*\+/],
  ['a private GBP → £ map', /\bGBP\s*:\s*['"]£['"]/],
  ['a direct ISO_CURRENCY_GLYPHS[…] read', /ISO_CURRENCY_GLYPHS\[/],
]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === '__fixtures__' || name === 'node_modules') continue
      sourceFiles(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test|stories)\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(p)
    }
  }
  return out
}

function composers(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf-8')
    const why = COMPOSES_MONEY.filter(([, re]) => re.test(text)).map(([name]) => name)
    if (why.length > 0) found.set(relative(ROOT, file), why)
  }
  return found
}

describe('one money-figure rule', () => {
  const found = composers()

  it('POSITIVE CONTROL: the probe sees the rule\'s own home and the legacy sites', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(1000)
    expect(found.has(HOME)).toBe(true)
    expect(found.size).toBeGreaterThanOrEqual(LEGACY.size)
  })

  it('⭐ no file outside the rule\'s home and the legacy list composes a currency glyph', () => {
    const offenders = [...found.entries()]
      .filter(([file]) => file !== HOME && !LEGACY.has(file))
      .map(([file, why]) => `${file}: ${why.join('; ')} — call formatMoneyFigure / moneyFigureParts (src/utils/unitClassifier.ts)`)
    expect(offenders).toEqual([])
  })

  it('the legacy list only shrinks: a file that no longer composes money is struck off', () => {
    const stale = [...LEGACY].filter((file) => !found.has(file))
    expect(stale, 'remove these from LEGACY: they now go through the rule').toEqual([])
  })

  it('the receipt, the threshold sites and the factor card are NOT on the legacy list', () => {
    for (const file of [
      'src/v5/blocks/v5GraphPatchDescription.ts',
      'src/components/results/analysisNew/thresholdFigure.ts',
      'src/utils/formatFactorDisplayValue.ts',
    ]) {
      expect(LEGACY.has(file)).toBe(false)
      expect(found.has(file), `${file} composes money outside the rule`).toBe(false)
    }
  })
})
