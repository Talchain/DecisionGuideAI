import { describe, expect, it } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { jsxSourceFilesIn, openingTagSpan } from '../../../../../tests/helpers/jsxTextEntryScan'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

/**
 * ⭐⭐ ONE COLOUR, ONE QUESTION: `text-info` MEANS "YOU CAN PRESS THIS".
 *
 * The approved design states the rule as `shape = what it is · colour = how
 * it's doing · icon = what you can do`. The panel had drifted off it in the
 * quietest possible way — not by inventing colours, but by spending the ACTION
 * colour on things that are not actions:
 *
 *   - a `<span>` grounding chip and a `<button>` method chip, both
 *     `rounded-full bg-info/10 px-2 py-0.5 text-info` at `panelMeta`, sitting
 *     side by side. At REST they were pixel-identical; the only difference was
 *     `hover:bg-info/20`, which does not exist on touch and is invisible until
 *     the reader has already guessed;
 *   - the same collision inside `ModelStrip`'s detail chip row, where one
 *     static label shared a `flex-wrap` row with four pressable pills;
 *   - a lead-in LABEL inside a paragraph rendered `text-info`, four lines above
 *     a button that genuinely was pressable.
 *
 * ⚠ WHY A GUARD AND NOT A PASS. Every one of those was correct-looking in
 * isolation and only wrong NEXT TO ITS NEIGHBOUR, so it survives file-by-file
 * review indefinitely — the reviewer never has both elements on screen at once.
 * That is precisely the defect class a derived scan sees and a human does not.
 *
 * ⚠ WHAT THIS DELIBERATELY PERMITS: the action colour INSIDE an action. The
 * primary-intervention card in `AtAGlance` is itself a `<button>`, and its
 * `Sparkles` icon and method chip are info-coloured children of it. Nothing
 * there misleads — every pixel in that card is pressable — so the rule is
 * about ANCESTRY, not about the element alone. A guard without the ancestor
 * stack would have demanded that card be de-coloured, which is the wrong fix.
 */

const PANEL_DIR = path.resolve(__dirname, '..')
const ACTION_COLOUR = 'text-info'

/**
 * `focus-visible:ring-info` is the focus RING, not the action colour, and it
 * legitimately appears on things that are already interactive. Matching it
 * would make the guard fire on its own permitted cases.
 */
const RING_ONLY = /(?:focus-visible:|focus:|hover:|group-\w+:)?ring-info/g

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea'])

/**
 * ⚠⚠ THE SCAN COPY. Blank the CONTENTS of quoted strings, preserving both the
 * quotes and the byte offsets, so the structural walk cannot mistake prose for
 * markup while `className` values are still read from the ORIGINAL source at
 * the same positions.
 *
 * A reviewer defeated the first version of this guard with one line:
 *
 *     const S = "see <button> for details"
 *
 * `<button` inside a string literal pushed `true` onto the ancestor stack and
 * nothing ever popped it, so every later element in the file was treated as
 * licensed and an unlicensed plant went GREEN.
 */
function blankStringContents(code: string): string {
  const out = code.split('')
  let i = 0
  while (i < out.length) {
    const c = out[i]
    if (c === "'" || c === '"') {
      const quote = c
      i += 1
      while (i < out.length && out[i] !== quote) {
        if (out[i] === '\\') { out[i] = ' '; i += 1; if (i < out.length) out[i] = ' ' }
        else if (out[i] !== '\n') out[i] = ' '
        i += 1
      }
    }
    i += 1
  }
  return out.join('')
}

function isInteractive(tag: string, attrs: string): boolean {
  return (
    INTERACTIVE_TAGS.has(tag.toLowerCase()) ||
    /\bonClick\s*=/.test(attrs) ||
    /\brole\s*=\s*["'{]?\s*["']?(button|link|menuitem|tab|option|switch)\b/.test(attrs)
  )
}

interface Site {
  readonly file: string
  readonly line: number
  readonly tag: string
  readonly licensed: boolean
}

/**
 * Walk a file's JSX maintaining an ancestor stack, and report every element
 * wearing the action colour together with whether an action licenses it.
 *
 * ⚠ The stack is pushed for an opening tag and popped for `</Tag>`; a
 * self-closing tag is never pushed. Fragments (`<>`/`</>`) carry no attributes
 * and no interactivity, so they are tracked purely to keep the stack balanced.
 */
function actionColourSites(src: string, file: string): { sites: Site[]; residualDepth: number } {
  const raw = stripComments(src, file)
  const code = blankStringContents(raw)
  const sites: Site[] = []
  const stack: boolean[] = []
  let i = 0
  while (i < code.length) {
    const lt = code.indexOf('<', i)
    if (lt === -1) break

    if (code[lt + 1] === '/') {
      stack.pop()
      i = code.indexOf('>', lt) + 1 || code.length
      continue
    }

    const name = /^<([A-Za-z][\w.]*)?/.exec(code.slice(lt))
    if (name === null) {
      i = lt + 1
      continue
    }
    const tag = name[1] ?? ''
    /*
     * ⚠ AN EMPTY TAG NAME IS A FRAGMENT ONLY WHEN THE VERY NEXT CHARACTER IS
     * `>`. Otherwise it is a COMPARISON — `a <= b`, `count < 3` — and the span
     * walk runs on to some unrelated `>` far below, pushing a frame that never
     * closes. That was the last residue after the generics fix: two phantom
     * `<>` frames, in `AtAGlance` and `StrengthenTheReasoning`.
     */
    if (tag === '' && code[lt + 1] !== '>') {
      i = lt + 1
      continue
    }
    const span = openingTagSpan(code, lt + 1 + tag.length)
    if (span === null) {
      // A tag that never closes is a hard error, never a silent skip.
      throw new Error(`${file}: unterminated opening tag <${tag}> at offset ${lt}`)
    }
    const attrs = raw.slice(lt + 1 + tag.length, span.end)
    const selfInteractive = isInteractive(tag, attrs)

    const withoutRings = attrs.replace(RING_ONLY, '')
    if (withoutRings.includes(ACTION_COLOUR)) {
      sites.push({
        file,
        line: raw.slice(0, lt).split('\n').length,
        tag,
        licensed: selfInteractive || stack.some(Boolean),
      })
    }

    /*
     * ⚠⚠ THE BIGGER LEAK, AND IT WAS NOT THE STRING LITERAL. Measured across
     * this directory, SEVEN of sixteen files ended with a non-empty stack —
     * and the leaked names say why: `NonNullable`, `MarkKind`, `string`,
     * `boolean`, `ReturnType`. TYPESCRIPT GENERICS. `useState<string | null>`
     * matches `<string`, walks to its `>`, and pushes a frame nothing closes.
     *
     * A real JSX element that is not self-closing HAS a closing tag. A generic
     * never does. Requiring one is a cheap, total filter for both classes.
     */
    const closes = code.indexOf(`</${tag}`, span.end) !== -1
    if (!span.selfClosing && closes) stack.push(selfInteractive)
    i = span.end + 1
  }
  return { sites, residualDepth: stack.length }
}

describe('the action colour means pressable, and nothing else', () => {
  const files = jsxSourceFilesIn(PANEL_DIR)
  const scans = files.map((f) => ({
    file: path.relative(PANEL_DIR, f),
    ...actionColourSites(fs.readFileSync(f, 'utf8'), path.relative(PANEL_DIR, f)),
  }))
  const sites = scans.flatMap((s) => s.sites)

  /**
   * ⭐⭐ THE PRECONDITION THAT ACTUALLY DETECTS THE FAILURE MODE.
   *
   * ⚠ THE ONE THIS REPLACES WAS INVERTED, AND A REVIEWER PROVED IT. It
   * asserted `licensed > 5` — but the failure mode is a leaked ancestor frame
   * that marks everything downstream as licensed, so the corruption PUSHES
   * THAT NUMBER UP. The control moved in the same direction as the defect: it
   * could never have fired. An inverted control is worse than none, because it
   * reads as diligence.
   *
   * The walk is a stack, so it has a property that cannot be faked in either
   * direction: over a well-formed file it must END EMPTY. A pseudo-tag inside
   * a string literal, or a TypeScript generic read as an element, leaves a
   * residue — and this REDs, naming the file.
   *
   * Measured before the fix: SEVEN of sixteen files left residue
   * (`ModelStrip` 14 deep, `StrengthenTheReasoning` 8), so the ancestor
   * licensing was unreliable across nearly half the directory while the guard
   * reported clean.
   */
  it('the ancestor walk balances on every file (it cannot be silently blinded)', () => {
    expect(files.length).toBeGreaterThan(10)
    const leaking = scans.filter((s) => s.residualDepth > 0).map((s) => `${s.file} (+${s.residualDepth})`)
    expect(
      leaking,
      'A non-empty stack at end of file means a frame was pushed and never ' +
        'popped — a `<tag>` inside a string, or a TypeScript generic read as ' +
        'an element. Every element after it is then treated as licensed, so ' +
        'the guard goes quietly blind.',
    ).toEqual([])
  })

  it('the scan still sees the licensed uses it is supposed to permit', () => {
    // Kept as a SEPARATE, non-inverted control: the walk reaching zero files,
    // or matching nothing, is a different failure from an unbalanced stack.
    expect(sites.filter((s) => s.licensed).length).toBeGreaterThan(5)
  })

  it('no element wears the action colour unless an action licenses it', () => {
    const unlicensed = sites.filter((s) => !s.licensed)
    expect(
      unlicensed.map((s) => `${s.file}:${s.line} <${s.tag}>`),
      'A non-interactive element is wearing `text-info`. At rest it is ' +
        'indistinguishable from the pressable controls beside it, and hover ' +
        'does not exist on touch. Give it the pill SHAPE if it needs one, but ' +
        'a neutral colour (`bg-panel-hover` / `text-text-light`) — or, if it ' +
        'genuinely is a control, make it one.',
    ).toEqual([])
  })
})
