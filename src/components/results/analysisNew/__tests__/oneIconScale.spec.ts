/**
 * ONE ICON SCALE — three steps, keyed to depth.
 *
 * ## The measurement
 *
 * Across `analysisNew`: **four square icon sizes** — `w-3` ×22, `w-3.5` ×9,
 * `w-4` ×8, `w-6` ×1 — with no rule, and **four files using more than one
 * internally**.
 *
 * ⛔ THE TELL IS NOT THE COUNT, IT IS WHICH ICON. `ChevronDown`/`ChevronRight` —
 * one disclosure chevron, doing one job — rendered at **three of the four
 * sizes**. That is not "different icons need different weights"; it is the same
 * icon sized against whatever happened to be nearest on screen.
 *
 * ## Why a scale and not one size
 *
 * ⭐ DEPTH IS A REAL AXIS. A section's own icon should not weigh the same as an
 * icon inside a sentence three levels into that section — the hierarchy the
 * panel draws with headings and zones should be drawn by its icons too. So the
 * scale encodes WHERE an icon sits and a caller picks by position, not by size.
 *
 * ⚠ THE SIZES WERE MOSTLY RIGHT ALREADY. 41 sites moved and almost none changed
 * appearance: this names what was being chosen ad hoc so the next icon inherits
 * a decision. That is exactly how four sizes accumulated — each was reasonable
 * beside its neighbour.
 *
 * ⛔ `w-6` IS NOT ON THE SCALE. `SectionShell`'s 24px circle is a CONTAINER that
 * holds an icon, not an icon. Sizing it from here would make a badge and a glyph
 * the same kind of thing, and is asserted as an exception below rather than
 * quietly tolerated.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { ICON_SCALE, icon } from '../panelSurfaces'
import { GLYPH_PX, glyphAlign, glyphNudgePx } from '../panelGlyphAlign'

const PANEL_DIR = path.resolve(__dirname, '..')
/** A square size written by hand inside a className — what the scale replaces. */
const BARE_SQUARE = /className="[^"]*\bw-(\d+(?:\.\d+)?)\s+h-\1\b[^"]*"/g
/** The one legitimate off-scale size, and what it is. */
const CONTAINER_EXCEPTION = 'w-6 h-6'

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

function panelSources(): { name: string; code: string }[] {
  const out: { name: string; code: string }[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '__tests__' || entry === 'prototype') continue
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (/\.tsx$/.test(full) && !/\.(spec|test)\./.test(full))
        out.push({ name: path.relative(PANEL_DIR, full), code: stripComments(fs.readFileSync(full, 'utf8')) })
    }
  }
  walk(PANEL_DIR)
  return out
}

describe('the icon scale', () => {
  it('has exactly three steps, and they are distinct', () => {
    const values = Object.values(ICON_SCALE)
    expect(values).toHaveLength(3)
    expect(new Set(values).size, 'two steps with one value is not a scale').toBe(3)
    expect(icon('section')).toBe(ICON_SCALE.section)
  })

  it('⛔ no file writes a square icon size by hand', () => {
    const sources = panelSources()
    expect(sources.length, 'PRECONDITION: the sweep found no panel sources').toBeGreaterThan(20)

    const offenders = sources.flatMap((f) =>
      (f.code.match(BARE_SQUARE) ?? [])
        .filter((c) => !c.includes(CONTAINER_EXCEPTION))
        .map((c) => `${f.name}: ${c.slice(0, 70)}`),
    )

    expect(
      offenders,
      'use `icon(\'section\'|\'row\'|\'inline\')`. Four sizes accumulated because each ' +
        'was reasonable beside its neighbour; the scale is what makes the choice inherited.',
    ).toEqual([])
  })

  /**
   * ⭐ THE ARM THAT PROVES THE SWEEP CAN SEE. Without it a regex matching nothing
   * would satisfy the case above by examining an empty set.
   */
  it('PRECONDITION: the detector recognises a bare size when it sees one', () => {
    const fake = 'className="shrink-0 w-5 h-5 text-info"'
    expect(new RegExp(BARE_SQUARE.source).test(fake), 'the detector is blind').toBe(true)
    expect(
      new RegExp(BARE_SQUARE.source).test('className={`shrink-0 ${icon(\'row\')} text-info`}'),
      'and must not flag a call site that uses the scale',
    ).toBe(false)
  })

  /**
   * ⚠ THE EXCEPTION IS A MIRROR, so it gets a mirror's check: if the container
   * it names disappears, the exemption is stale and silently widens the rule.
   */
  it('⛔ the container exception still corresponds to something real', () => {
    const uses = panelSources().filter((f) => f.code.includes(CONTAINER_EXCEPTION))
    expect(
      uses.map((f) => f.name),
      'if nothing uses w-6 any more, drop the exception rather than leaving it open',
    ).not.toEqual([])
  })
})

/**
 * ⭐⭐ THE OTHER HALF OF THE SAME RELATIONSHIP: WHERE THE GLYPH SITS.
 *
 * Naming the sizes and leaving the nudges hand-typed would have shipped half a
 * component. A nudge is a function of the glyph's height and the line box of
 * the text beside it — and this PR moves the first of those two. A literal
 * `mt-[1px]` cannot follow it, and nothing in this estate can see one pixel go
 * wrong.
 *
 * Measured before the change: eight sites, **four correct and four a pixel
 * out**, with the same glyph/scale pair given two different answers in two
 * different files.
 *
 * ⚠ SCOPE, STATED. This governs the ARBITRARY-BRACKET top nudge only, which is
 * now producible solely by `glyphAlign()`. It deliberately says nothing about
 * `mt-0.5` or `-mt-px`: the first is a scale step expressing rhythm, the second
 * is baseline alignment of an icon in inline flow. Three mechanisms that look
 * alike is this estate's trap 21, so they are named apart rather than merged.
 */
describe('one glyph alignment, derived from the pair it depends on', () => {
  it('⛔ no file hand-types an arbitrary top nudge — `glyphAlign()` is the only producer', () => {
    const offenders = panelSources()
      .filter((f) => f.name !== 'panelGlyphAlign.ts')
      .filter((f) => /\bmt-\[\d+px\]/.test(f.code))
      .map((f) => f.name)

    expect(
      offenders,
      'use `glyphAlign(<glyph>, <text scale>)`. A typed pixel value records a measurement ' +
        'taken once against a size and a line height that both move — and four of the eight ' +
        'this replaced were already a pixel out.',
    ).toEqual([])
  })

  it('PRECONDITION: the rule bites on a file that breaks it', () => {
    // Without this, a regex that matched nothing would satisfy the case above
    // by examining an empty set — the vacuity this estate has shipped before.
    expect(/\bmt-\[\d+px\]/.test('<Icon className="w-4 h-4 mt-[1px]" />')).toBe(true)
    expect(/\bmt-\[\d+px\]/.test("className={`${icon('row')} mt-0.5`}")).toBe(false)
  })

  it('reproduces every value a human got RIGHT — the control on the derivation', () => {
    // ⭐ If this disagreed with all eight shipped values it would be evidence
    // about the arithmetic, not about the code. It agrees on exactly the four
    // that were correct, across three glyph sizes and three text scales.
    expect(glyphNudgePx('section', 'panelHeader'), 'TrustLine:88 shipped 2px').toBe(2)
    expect(glyphNudgePx('row', 'panelBody'), 'AtAGlance:1182 shipped 3px').toBe(3)
    expect(glyphNudgePx('bullet', 'panelMeta'), 'AtAGlance:1074/1118 shipped 6px').toBe(6)
  })

  it('and corrects the four that were not', () => {
    // section/panelHeader shipped as 1px in three files; inline/panelMeta as 3px.
    expect(glyphNudgePx('section', 'panelHeader')).not.toBe(1)
    expect(glyphNudgePx('inline', 'panelMeta'), 'AtAGlance:620 shipped 3px').toBe(2)
  })

  /**
   * ⛔ THE ARM THAT STOPS THE GLYPH MAP DRIFTING FROM `ICON_SCALE`. Two maps of
   * the same three sizes is the mirror this estate keeps paying for. `bullet`
   * is deliberately absent from the tier map — no tier draws one — which is why
   * the two maps are not merged into one.
   */
  it('⛔ every icon tier has a glyph height, and the two agree on the square', () => {
    for (const depth of ['section', 'row', 'inline'] as const) {
      const step = GLYPH_PX[depth] / 4
      expect(
        ICON_SCALE[depth],
        `ICON_SCALE.${depth} and GLYPH_PX.${depth} describe the same square`,
      ).toBe(`w-${step} h-${step}`)
    }
  })

  it('never pulls a glyph UP — an overhanging glyph would only overhang further', () => {
    // `section` is 16px; `panelMeta`'s line box is 15.125px, so there is no slack.
    expect(glyphNudgePx('section', 'panelMeta')).toBe(0)
    expect(glyphAlign('section', 'panelMeta'), 'and emits no class at all').toBe('')
  })
})
