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
 * ⛔ `w-6` IS NOT ON THE SCALE. `SectionShell`'s 24px slot (untinted since the
 * V2 no-tints rule — it was a filled circle) is a CONTAINER that
 * holds an icon, not an icon. Sizing it from here would make a badge and a glyph
 * the same kind of thing, and is asserted as an exception below rather than
 * quietly tolerated.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { ICON_SCALE, icon } from '../panelSurfaces'

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
 * ⭐ THE MODEL TAB IS THE OTHER HALF OF THE SAME PANEL, AND IT WAS UNGUARDED.
 *
 * The icon audit (23 Sep 2026) found the scale enforced in `analysisNew/` only;
 * the Model tab hand-wrote `w-3.5 h-3.5` at four sites — the same value, with
 * nothing to stop a fifth size appearing. The one-icon-one-meaning pass touches
 * those files, so the guard now reads them too, through the SAME detector.
 *
 * ⚠ SCOPE, NAMED: `src/canvas/model-tab-v2/**` (non-test `.tsx`). The Model
 * card (`components/model-tab/`) is not swept here.
 */
const MODEL_TAB_DIR = path.resolve(__dirname, '../../../../canvas/model-tab-v2')

function modelTabSources(): { name: string; code: string }[] {
  const out: { name: string; code: string }[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '__tests__') continue
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (/\.tsx$/.test(full) && !/\.(spec|test)\./.test(full))
        out.push({ name: path.relative(MODEL_TAB_DIR, full), code: stripComments(fs.readFileSync(full, 'utf8')) })
    }
  }
  walk(MODEL_TAB_DIR)
  return out
}

describe('the icon scale — the Model tab too', () => {
  it('⛔ no Model-tab file writes a square icon size by hand', () => {
    const sources = modelTabSources()
    // ⚠ The directory holds 9 `.tsx` files at 2177f45c (its logic is `.ts`), so
    // the magnitude floor is 8 and the files this pass touches are named.
    expect(sources.length, 'PRECONDITION: the sweep found too few Model-tab sources').toBeGreaterThanOrEqual(8)
    for (const required of [
      'ModelRowView.tsx',
      'ModelOutline.tsx',
      'ModelGroupActions.tsx',
      'ValueProvenanceMark.tsx',
      'ValueProvenanceKey.tsx',
    ]) {
      expect(sources.map((f) => f.name), `PRECONDITION: ${required} is in the sweep`).toContain(required)
    }

    const offenders = sources.flatMap((f) =>
      (f.code.match(BARE_SQUARE) ?? []).map((c) => `model-tab-v2/${f.name}: ${c.slice(0, 70)}`),
    )
    expect(offenders, "use `icon('row')` from `analysisNew/panelSurfaces`").toEqual([])
  })
})
