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
function actionColourSites(src: string, file: string): Site[] {
  const code = stripComments(src, file)
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
    const span = openingTagSpan(code, lt + 1 + tag.length)
    if (span === null) {
      // A tag that never closes is a hard error, never a silent skip.
      throw new Error(`${file}: unterminated opening tag <${tag}> at offset ${lt}`)
    }
    const attrs = code.slice(lt + 1 + tag.length, span.end)
    const selfInteractive = isInteractive(tag, attrs)

    const withoutRings = attrs.replace(RING_ONLY, '')
    if (withoutRings.includes(ACTION_COLOUR)) {
      sites.push({
        file,
        line: code.slice(0, lt).split('\n').length,
        tag,
        licensed: selfInteractive || stack.some(Boolean),
      })
    }

    if (!span.selfClosing) stack.push(selfInteractive)
    i = span.end + 1
  }
  return sites
}

describe('the action colour means pressable, and nothing else', () => {
  const files = jsxSourceFilesIn(PANEL_DIR)
  const sites = files.flatMap((f) =>
    actionColourSites(fs.readFileSync(f, 'utf8'), path.relative(PANEL_DIR, f)),
  )

  /**
   * ⚠ PRECONDITION, PINNED IN-TEST. Every assertion below is an ABSENCE claim,
   * and an absence claim from a blind instrument is vacuous. A scanner that
   * silently stopped matching — a regex change, a Prettier reflow, a renamed
   * token — would report zero offences and pass, exactly as a healthy panel
   * does. These two assertions make blindness RED instead of green: the walk
   * must reach real files, and it must still find the LICENSED uses that the
   * panel certainly contains.
   */
  it('the scan can see the panel at all (contrast control)', () => {
    expect(files.length).toBeGreaterThan(10)
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
