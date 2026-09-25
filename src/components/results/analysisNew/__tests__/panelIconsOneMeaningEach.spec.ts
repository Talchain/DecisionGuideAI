/**
 * ⭐⭐ ONE ICON, ONE MEANING — across the right-hand panel (Model + Reasoning).
 *
 * Paul, 23 Sep 2026, and the rulings the lane lead took on his instruction:
 *
 *   R1 `HelpCircle` = an UNRESOLVED question (a status): "Estimate not yet
 *      confirmed" and "Not assessed". Nothing else.
 *   R2 `Pencil` = the EDIT act only. The "User edited" status is `UserCheck`.
 *   R3 `Sparkles` = content Olumi ORIGINATED (a status: AI estimate, option
 *      origin). Every hand-to-Olumi ACT is `MessageCircle`.
 *   R4 confirm ACT = `Check`; confirmed STATUS = `CheckCircle`.
 *
 * The icon audit that grounds this found each of `HelpCircle`, `Pencil` and
 * `Sparkles` carrying two or three meanings on the same screens, and NO register
 * of meaning-to-icon that spanned both tabs, so nothing could catch a fourth.
 *
 * ─── HOW MEANING IS READ, AND WHERE IT HAD TO BE A SOURCE SCAN ──────────────
 * 1. STATUS meanings come from the two EXPORTED registers the rows render from —
 *    `VALUE_PROVENANCE_ICON` (who authored a value) and `ATTENTION_MARK` (what a
 *    row still needs). Read by value, via lucide's own `displayName`, so no
 *    source text is trusted for them.
 * 2. ACTION glyphs are whatever a panel file hands the shared icon button as
 *    `icon={X}`. Those are JSX props, not exported data, so they are read by a
 *    SOURCE SCAN of comment-stripped code.
 * 3. The three contested glyphs are then pinned by a LEDGER: every panel file
 *    that references them, how many times, and what each reference means. The
 *    component files (`DisclosureRow`, `WhatWeChecked`, `ValueProvenanceKey`,
 *    `PrimaryIntervention`, `ModelRowView`, …) do not export their glyph
 *    choices, so this is a source scan by necessity, and it is named as one.
 *    A new reference anywhere in the panel REDs until someone writes down which
 *    of the one meanings it carries.
 *
 * ⚠ SCOPE, NAMED: `src/canvas/model-tab-v2/**` and
 * `src/components/results/analysisNew/**` (non-test, non-prototype `.ts/.tsx`),
 * plus `src/canvas/domain/valueProvenanceIcon.ts`. The Model card
 * (`components/model-tab/ModelHealthSection.tsx`) already drew the act as
 * `MessageCircle` and is outside this sweep.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { LucideIcon } from 'lucide-react'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { VALUE_PROVENANCE_ICON } from '../../../../canvas/domain/valueProvenanceIcon'
import { ATTENTION_MARK } from '../../../../canvas/model-tab-v2/rowPresentation'

const SRC = path.resolve(__dirname, '../../../..')
const SCOPE_DIRS = ['canvas/model-tab-v2', 'components/results/analysisNew']
const SCOPE_FILES = ['canvas/domain/valueProvenanceIcon.ts']
const SKIP_DIRS = new Set(['__tests__', '__fixtures__', '__mocks__', 'prototype'])

function scopeSources(): { name: string; code: string }[] {
  const out: { name: string; code: string }[] = []
  const add = (full: string) =>
    out.push({ name: path.relative(SRC, full), code: stripComments(fs.readFileSync(full, 'utf8'), full) })
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(full)
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.(spec|test)\./.test(entry)) add(full)
    }
  }
  for (const d of SCOPE_DIRS) walk(path.join(SRC, d))
  for (const f of SCOPE_FILES) add(path.join(SRC, f))
  return out
}

const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g

/** References to `glyph` in code, with the lucide import line itself removed. */
function referenceCount(code: string, glyph: string): number {
  const body = code.replace(LUCIDE_IMPORT, '')
  return (body.match(new RegExp(`\\b${glyph}\\b`, 'g')) ?? []).length
}

/** The glyphs whose meaning this file rules on. */
const GUARDED = new Set(['HelpCircle', 'Pencil', 'Sparkles', 'MessageCircle', 'Check', 'CheckCircle', 'UserCheck'])

/**
 * `import { Pencil as EditMark } from 'lucide-react'` would hide a GUARDED glyph
 * from the ledger. Aliases of other glyphs (`CircleDashed as NoValueMark` in
 * `ModelStrip`) are not this file's business and are not flagged.
 */
function aliasedImports(code: string): string[] {
  const out: string[] = []
  for (const m of code.matchAll(LUCIDE_IMPORT)) {
    for (const part of m[1].split(',')) {
      const alias = part.trim().match(/^(\w+)\s+as\s+(\w+)$/)
      if (alias && GUARDED.has(alias[1])) out.push(`${alias[1]} as ${alias[2]}`)
    }
  }
  return out
}

/**
 * The glyphs a file hands the shared icon button — each one an ACTION.
 *
 * ⚠ `<IconBtn … />` ONLY. Section shells take an `icon` prop too
 * (`AnalysisNewSection`, `SectionShell`) and those are section headings, not
 * acts — the first cut of this scan read every `icon={X}` and flagged the
 * uncertainty section's heading glyph as an act. Every `IconBtn` call site in
 * scope is self-closing, so the element runs to the next `/>`.
 */
function actionGlyphs(code: string): string[] {
  const out: string[] = []
  for (const m of code.matchAll(/<IconBtn\b/g)) {
    const end = code.indexOf('/>', m.index)
    const element = code.slice(m.index, end === -1 ? undefined : end)
    const glyph = element.match(/\bicon=\{(\w+)\}/)
    if (glyph) out.push(glyph[1])
  }
  return out
}

const nameOf = (icon: LucideIcon) => (icon as unknown as { displayName: string }).displayName

/**
 * The ledger. File → reference count → the ONE meaning those references carry.
 * The meaning column is documentation for the next reader; the counts are what
 * the test enforces.
 */
const LEDGER: Record<'HelpCircle' | 'Pencil' | 'Sparkles', Record<string, { n: number; meaning: string }>> = {
  HelpCircle: {
    'canvas/model-tab-v2/rowPresentation.ts': { n: 1, meaning: 'status: Estimate not yet confirmed' },
    'components/results/analysisNew/sections/WhatWeChecked.tsx': { n: 1, meaning: 'status: not assessed' },
    'components/results/analysisNew/DisclosureRow.tsx': { n: 1, meaning: 'status: Not assessed (row marker)' },
  },
  Pencil: {
    'canvas/model-tab-v2/ModelRowView.tsx': { n: 1, meaning: 'act: Rename' },
    'components/results/analysisNew/DisclosureRow.tsx': { n: 1, meaning: 'act: Review or change' },
    'components/results/analysisNew/FactorValueControl.tsx': { n: 1, meaning: 'act: edit this value' },
    'components/results/analysisNew/sections/ModelStrip.tsx': { n: 1, meaning: 'act: edit this value' },
  },
  Sparkles: {
    'canvas/domain/valueProvenanceIcon.ts': { n: 1, meaning: 'status: AI estimate' },
    'components/results/analysisNew/sections/OptionsComparison.tsx': { n: 2, meaning: 'status: option Olumi proposed (mark + legend)' },
  },
}

function measured(glyph: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of scopeSources()) {
    const n = referenceCount(f.code, glyph)
    if (n > 0) out[f.name] = n
  }
  return out
}

describe('the sweep sees the panel it claims to cover', () => {
  it('PRECONDITION: both tabs are walked, at a plausible magnitude', () => {
    const names = scopeSources().map((f) => f.name)
    expect(names.filter((n) => n.startsWith('canvas/model-tab-v2/')).length).toBeGreaterThan(15)
    expect(names.filter((n) => n.startsWith('components/results/analysisNew/')).length).toBeGreaterThan(40)
    expect(names).toContain('canvas/domain/valueProvenanceIcon.ts')
  })

  it('POSITIVE CONTROL: a same-family glyph known to be present IS counted', () => {
    // `Crosshair` is "Show on canvas" on every Reasoning row.
    expect(measured('Crosshair')['components/results/analysisNew/DisclosureRow.tsx']).toBe(1)
  })

  it('POSITIVE CONTROL: the counter ignores the import line and comments, and sees a use', () => {
    const code = stripComments(
      "import { Pencil } from 'lucide-react'\n// Pencil in prose\nconst a = <Pencil />\n",
      'x.tsx',
    )
    expect(referenceCount(code, 'Pencil')).toBe(1)
  })

  it('no panel file hides a guarded glyph behind an import alias', () => {
    // POSITIVE CONTROL: the detector sees a guarded alias, and ignores an unguarded one.
    expect(aliasedImports("import { Pencil as EditMark, CircleDashed as X } from 'lucide-react'")).toEqual([
      'Pencil as EditMark',
    ])
    const aliased = scopeSources().flatMap((f) => aliasedImports(f.code).map((a) => `${f.name}: ${a}`))
    expect(aliased).toEqual([])
  })
})

describe('⭐ the status registers carry one meaning per glyph', () => {
  const provenance = Object.entries(VALUE_PROVENANCE_ICON).map(([k, v]) => [k, nameOf(v)] as const)
  const attention = Object.entries(ATTENTION_MARK).map(([k, v]) => [k, nameOf(v)] as const)
  const kindsDrawnAs = (glyph: string, reg: readonly (readonly [string, string])[]) =>
    reg.filter(([, g]) => g === glyph).map(([k]) => k)

  it('R1: HelpCircle is only "Estimate not yet confirmed" in the row registers', () => {
    expect(kindsDrawnAs('HelpCircle', attention)).toEqual(['unconfirmed-estimate'])
    expect(kindsDrawnAs('HelpCircle', provenance)).toEqual([])
  })

  it('R2: Pencil is NEVER a status — "User edited" is the person glyph', () => {
    expect(kindsDrawnAs('Pencil', provenance)).toEqual([])
    expect(kindsDrawnAs('Pencil', attention)).toEqual([])
    expect(nameOf(VALUE_PROVENANCE_ICON.edited)).toBe('UserCheck')
    expect(VALUE_PROVENANCE_ICON.edited).toBe(VALUE_PROVENANCE_ICON.human)
  })

  it('R3: Sparkles is only the AI-estimate status', () => {
    expect(kindsDrawnAs('Sparkles', provenance)).toEqual(['ai'])
    expect(kindsDrawnAs('Sparkles', attention)).toEqual([])
  })

  it('R4: CheckCircle is the confirmed STATUS', () => {
    expect(kindsDrawnAs('CheckCircle', provenance)).toEqual(['confirmed'])
  })
})

describe('⭐ no glyph is both a status and an act', () => {
  it('nothing handed to the shared icon button is a status glyph', () => {
    const statusGlyphs = new Set([
      ...Object.values(VALUE_PROVENANCE_ICON).map(nameOf),
      ...Object.values(ATTENTION_MARK).map(nameOf),
    ])
    const acts = scopeSources().flatMap((f) => actionGlyphs(f.code).map((g) => ({ file: f.name, g })))
    // POSITIVE CONTROL: the act scan really reads the panel's icon buttons…
    expect(acts.map((a) => a.g)).toContain('Crosshair')
    // …and only them: a section heading's `icon` prop is not an act.
    expect(actionGlyphs('<SectionShell icon={TrendingUp} title="x" /><IconBtn icon={Crosshair} tooltip="y" />')).toEqual([
      'Crosshair',
    ])
    const collisions = acts.filter((a) => statusGlyphs.has(a.g)).map((a) => `${a.file}: ${a.g}`)
    expect(collisions).toEqual([])
  })

  it('R3: every hand-to-Olumi act in the panel is the speech bubble', () => {
    const m = measured('MessageCircle')
    expect(m['components/results/analysisNew/DisclosureRow.tsx']).toBe(2)
    expect(m['components/results/analysisNew/sections/PrimaryIntervention.tsx']).toBe(1)
    expect(m['canvas/model-tab-v2/ModelGroupActions.tsx']).toBe(1)
  })

  it('R4: the confirm act is the bare tick', () => {
    const acts = scopeSources()
      .filter((f) => f.name === 'canvas/model-tab-v2/ModelRowView.tsx')
      .flatMap((f) => actionGlyphs(f.code))
    expect(acts).toContain('Check')
    expect(acts).not.toContain('CheckCircle')
  })
})

describe('⭐ THE LEDGER — every reference to a contested glyph, and its one meaning', () => {
  for (const glyph of Object.keys(LEDGER) as (keyof typeof LEDGER)[]) {
    it(`${glyph}: referenced exactly where the ledger says, and nowhere else`, () => {
      const expected = Object.fromEntries(Object.entries(LEDGER[glyph]).map(([f, v]) => [f, v.n]))
      expect(measured(glyph)).toEqual(expected)
    })
  }
})
