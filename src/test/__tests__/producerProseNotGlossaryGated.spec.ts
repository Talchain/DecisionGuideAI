/**
 * ⭐ PRODUCER PROSE AND USER DATA ARE NOT UI-AUTHORED COPY — a structural guard.
 *
 * `glossaryCheck` exists to stop OLUMI authoring jargon or a leader claim in copy
 * IT WROTE. Its own header: "we never rewrite user data, only the generated copy
 * that names it." `analysis-hero/__tests__/copyHygiene.spec.tsx` says it outright:
 * "Producer-supplied strings ... are deliberately NOT scanned — they are rendered
 * as data, never authored here."
 *
 * I applied it to producer prose anyway, TWICE IN ONE FILE. On the defaulted
 * assumptions it withheld TEN of thirteen realistic business factor labels —
 * Budget Variance, Win Rate, Price Elasticity, Blocked Pipeline Value, Government
 * Intervention Risk and more — with no trace in the DOM and no withheld-count
 * anywhere. The user lost the honesty disclosure BECAUSE they had named a factor
 * normally, and the loss was invisible to them and to us. #846 removed it; the
 * robustness caveat carried the identical gate and was corrected after.
 *
 * Both times the failure was SILENT. That is the property that makes this worth a
 * structural guard rather than a comment: a withheld row emits nothing, logs
 * nothing, and reads exactly like a run that had nothing to say.
 *
 * SO THIS ASSERTS THE ABSENCE STRUCTURALLY, at the import, where it cannot be
 * argued about per-call-site. Fail-closed STRUCTURAL checks — raw identifier,
 * length, blank/NUL, a required provenance token — are untouched and remain the
 * right kind of guard for this data.
 *
 * WHAT THIS CANNOT SEE: a copy of the predicate written inline rather than
 * imported. The import is the realistic vector, not a hand-rolled re-implementation.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Modules that render PRODUCER-authored or USER-authored strings verbatim. */
const PRODUCER_PROSE_MODULES = [
  'src/components/results/decision-brief/decisionBriefViewModel.ts',
  'src/components/results/decision-brief/DecisionBriefSection.tsx',
]

const GLOSSARY_SYMBOLS = [
  'containsBannedTerm',
  'findBannedTerm',
  'safeInterpolatedLabel',
  'glossaryCheck',
]

function tracked(): Set<string> {
  return new Set(
    execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter(Boolean),
  )
}

describe('producer prose is not gated by the UI copy glossary', () => {
  const files = tracked()

  it('the modules under guard still exist (positive control)', () => {
    // If a rename silently emptied this list, every assertion below would pass
    // while guarding nothing.
    expect(PRODUCER_PROSE_MODULES.length).toBeGreaterThan(1)
    for (const m of PRODUCER_PROSE_MODULES) {
      expect(files.has(m), `${m} is guarded but no longer tracked — update this list`).toBe(true)
    }
  })

  it('the detector can see the symbols it looks for (positive control)', () => {
    // Proves the probe is capable of a hit: glossaryCheck IS imported by its
    // legitimate consumers, which are UI-authored copy surfaces.
    const legitimate = [...files].filter(f =>
      f.startsWith('src/components/results/') &&
      !PRODUCER_PROSE_MODULES.includes(f) &&
      GLOSSARY_SYMBOLS.some(sym => readFileSync(f, 'utf8').includes(sym)),
    )
    expect(
      legitimate.length,
      'no file imports the glossary at all — the detector cannot distinguish absence from blindness',
    ).toBeGreaterThan(0)
  })

  it.each(PRODUCER_PROSE_MODULES)('%s does not import the copy glossary', (module) => {
    const source = readFileSync(module, 'utf8')
    const imports = source
      .split('\n')
      .filter(line => /^\s*import\b/.test(line) || /from '.*glossaryCheck'/.test(line))
      .join('\n')
    for (const symbol of GLOSSARY_SYMBOLS) {
      expect(
        imports.includes(symbol),
        `${module} imports ${symbol}. The copy glossary gates UI-AUTHORED language; `
          + 'this module renders producer or user text verbatim. Withholding a row for an '
          + 'ordinary business word is a silent loss of an honest disclosure — it cost ten '
          + 'of thirteen labels once already. Use structural guards instead.',
      ).toBe(false)
    }
  })
})
