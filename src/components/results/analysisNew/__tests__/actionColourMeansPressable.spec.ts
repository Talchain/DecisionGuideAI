import { describe, expect, it } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import ts from 'typescript'
import { jsxSourceFilesIn } from '../../../../../tests/helpers/jsxTextEntryScan'

/**
 * ⭐⭐ ONE COLOUR, ONE QUESTION: `text-info` MEANS "YOU CAN PRESS THIS".
 *
 * The approved design states it as `shape = what it is · colour = how it's
 * doing · icon = what you can do`. The panel had drifted off it in the
 * quietest way — not by inventing colours, but by spending the ACTION colour
 * on things that are not actions: a pressable method chip and a static
 * grounding chip rendered identically at rest, separated only by a `hover:`
 * that does not exist on touch.
 *
 * ⚠ WHAT THIS DELIBERATELY PERMITS: the action colour INSIDE an action. The
 * primary-intervention card in `AtAGlance` IS a `<button>`, and its icon and
 * chip are info-coloured children of it. Nothing there misleads, so the rule
 * is about ANCESTRY, not about the element alone.
 *
 * ⭐⭐⭐ THIS USES THE TYPESCRIPT PARSER, AND THAT IS THE WHOLE POINT.
 *
 * Three hand-rolled versions of this scan were defeated in one night, each by
 * a different delimiter:
 *
 *   1. a pseudo-tag in a DOUBLE-QUOTED string   → blanked strings
 *   2. TypeScript GENERICS (`useState<string | null>`) leaking stack frames,
 *      and `<` in COMPARISONS (`Array<{`, `a <= b`)  → required a close tag
 *   3. a pseudo-tag in a TEMPLATE literal        → handled backticks
 *   4. ⚠ ORDINARY ENGLISH APOSTROPHES — "Here's what we found" … "We don't
 *      have enough runs yet" — read as a string literal spanning the JSX
 *      between them, erasing a planted violation. 8/8 GREEN, plant invisible,
 *      AND THE STACK STILL BALANCED, so the residual-depth control read clean.
 *
 * Four rounds on one tokeniser is this estate's own signal that the approach
 * is wrong, not that the next patch is missing. **The repo already depends on
 * a parser that knows JSX text from string literals.** So this asks
 * TypeScript, and every one of those four classes stops being expressible: no
 * delimiters, no stack to leak, and ancestry comes from the tree rather than
 * from a counter that can drift.
 */

const PANEL_DIR = path.resolve(__dirname, '..')
const ACTION_COLOUR = 'text-info'

/**
 * `focus-visible:ring-info` is the focus RING, not the action colour, and it
 * legitimately appears on things that are already interactive.
 */
const RING_ONLY = /(?:focus-visible:|focus:|hover:|group-\w+:)?ring-info/g

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea'])

interface Site {
  readonly file: string
  readonly line: number
  readonly tag: string
  readonly licensed: boolean
}

function isInteractive(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): boolean {
  const tag = el.tagName.getText(sf)
  if (INTERACTIVE_TAGS.has(tag.toLowerCase())) return true
  for (const p of el.attributes.properties) {
    if (!ts.isJsxAttribute(p)) continue
    const name = p.name.getText(sf)
    if (name === 'onClick') return true
    if (name === 'role') {
      const v = p.initializer?.getText(sf) ?? ''
      if (/button|link|menuitem|tab|option|switch/.test(v)) return true
    }
  }
  return false
}

function classNameText(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): string {
  for (const p of el.attributes.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText(sf) === 'className') {
      return p.initializer?.getText(sf) ?? ''
    }
  }
  return ''
}

/** Every JSX element in the file, with whether an ACTION encloses it. */
function actionColourSites(src: string, file: string): { sites: Site[]; elements: number } {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const sites: Site[] = []
  let elements = 0

  const record = (
    el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    ancestorIsAction: boolean,
  ): void => {
    elements += 1
    const cls = classNameText(el, sf).replace(RING_ONLY, '')
    if (!cls.includes(ACTION_COLOUR)) return
    sites.push({
      file,
      line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
      tag: el.tagName.getText(sf),
      licensed: isInteractive(el, sf) || ancestorIsAction,
    })
  }

  const visit = (node: ts.Node, ancestorIsAction: boolean): void => {
    if (ts.isJsxElement(node)) {
      const open = node.openingElement
      record(open, ancestorIsAction)
      // ⚠ ANCESTRY FROM THE TREE, not from a stack. A stack has to be pushed
      // and popped in step with the source, which is exactly what generics,
      // comparisons and pseudo-tags broke. Here it is just recursion.
      const within = ancestorIsAction || isInteractive(open, sf)
      node.children.forEach((c) => visit(c, within))
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      record(node, ancestorIsAction)
      return
    }
    ts.forEachChild(node, (c) => visit(c, ancestorIsAction))
  }

  visit(sf, false)
  return { sites, elements }
}

describe('the action colour means pressable, and nothing else', () => {
  const files = jsxSourceFilesIn(PANEL_DIR)
  const scans = files.map((f) => ({
    file: path.relative(PANEL_DIR, f),
    ...actionColourSites(fs.readFileSync(f, 'utf8'), f),
  }))
  const sites = scans.flatMap((s) => s.sites)

  /**
   * ⚠ PRECONDITION. Every assertion below is an ABSENCE claim, and an absence
   * claim from a blind instrument is vacuous.
   *
   * ⚠⚠ AND THE ONE THIS REPLACES WAS DEFEATED TWICE. `licensed > 5` was
   * INVERTED — over-licensing pushes it UP, the same direction as the defect.
   * Its replacement, a stack-balance check, read CLEAN while an apostrophe
   * erased a planted violation, because the phantom string was balanced.
   *
   * A parser cannot half-work: if it fails, the element count collapses. So
   * the control is the count of JSX elements actually parsed, which no
   * mis-tokenisation can inflate.
   */
  it('the parser actually read the panel (contrast control)', () => {
    expect(files.length).toBeGreaterThan(10)
    expect(scans.reduce((n, s) => n + s.elements, 0)).toBeGreaterThan(200)
    expect(sites.filter((s) => s.licensed).length).toBeGreaterThan(5)
  })

  it('no element wears the action colour unless an action licenses it', () => {
    const unlicensed = sites.filter((s) => !s.licensed)
    expect(
      unlicensed.map((s) => `${s.file}:${s.line} <${s.tag}>`),
      'A non-interactive element is wearing `text-info`. At rest it is ' +
        'indistinguishable from the pressable controls beside it, and hover ' +
        'does not exist on touch. Give it the pill SHAPE if it needs one, but ' +
        'a neutral colour — or, if it genuinely is a control, make it one.',
    ).toEqual([])
  })
})
