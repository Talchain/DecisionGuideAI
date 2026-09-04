/**
 * ⭐ READ-ONLY MUST STILL BE READABLE.
 *
 * ⚠ THE DEFECT THIS PINS. `[data-authority="disabled"] :disabled` carried
 * `opacity: 0.55`. The fieldset uses `display: contents`, so that rule lands on
 * DESCENDANTS — and every inspector panel renders the node's description in a
 * `<textarea>` inside it (`FactorControllablePanel.tsx:404`,
 * `OptionPanel.tsx:288`, `GoalPanel.tsx:344`). It therefore faded **the model's
 * own content**, measured at 10.5:1 → 3.0:1, below WCAG 2.2 AA 1.4.3's 4.5:1.
 *
 * ⭐ WHY THE GUARD BANS THE PROPERTY RATHER THAN CHECKING A RATIO. `opacity`
 * composites the whole subtree and a child cannot exceed its parent's value, so
 * "faded field, full-strength value" is not expressible. Any `opacity < 1` on
 * this selector necessarily fades the value. Banning the channel is therefore
 * an EXACT statement of the requirement, where a threshold on a computed ratio
 * would be a proxy that drifts with the theme — and jsdom cannot compute the
 * ratio anyway (trap: a test that cannot fail).
 *
 * The `::placeholder` fade is explicitly ALLOWED and asserted to survive: a
 * placeholder is an invitation, not content, and is the one part that should
 * read as withdrawn.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CSS = resolve(process.cwd(), 'src/index.css')
const SELECTOR = '[data-authority="disabled"] :disabled'

/** The declaration block for a selector, or null. */
function blockFor(css: string, selector: string): string | null {
  const i = css.indexOf(selector + ' {')
  if (i === -1) return null
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  return close === -1 ? null : css.slice(open + 1, close)
}

describe('inspector read-only fields', () => {
  it('never fades the value — no opacity on the text-bearing element', () => {
    expect(existsSync(CSS), `guard pointed at nothing: ${CSS}`).toBe(true)
    const css = readFileSync(CSS, 'utf8')
    // CONTRAST CONTROL: prove the file and the parser see something first, or
    // an "absent" result would mean nothing.
    expect(css.length, 'index.css read as empty').toBeGreaterThan(1000)
    const block = blockFor(css, SELECTOR)
    expect(block, `selector not found — has it been renamed? ${SELECTOR}`).not.toBeNull()

    // Strip comments: the rationale above deliberately CONTAINS the word
    // `opacity`, and a guard that matched its own explanation would be the
    // hand-maintained mirror this repo keeps paying for.
    const declarations = block!.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations, 'the ban must not be satisfied by comment-stripping alone').toMatch(/cursor\s*:/)
    expect(declarations).not.toMatch(/(^|[\s;])opacity\s*:/)
  })

  it('keeps the placeholder fade — an invitation SHOULD read as withdrawn', () => {
    const css = readFileSync(CSS, 'utf8')
    const ph = blockFor(css, `${SELECTOR}::placeholder`)
    expect(ph, 'the placeholder rule was removed with the value fade').not.toBeNull()
    expect(ph!.replace(/\/\*[\s\S]*?\*\//g, '')).toMatch(/opacity\s*:/)
  })

  it('still signals inertness on channels that carry no information', () => {
    const d = blockFor(readFileSync(CSS, 'utf8'), SELECTOR)!.replace(/\/\*[\s\S]*?\*\//g, '')
    // Without this, "delete the opacity line" would pass test 1 while leaving
    // the field indistinguishable from an editable one — the defect #1055 exists
    // to fix, reopened by its own remedy.
    expect(d).toMatch(/cursor\s*:\s*not-allowed/)
    expect(d, 'no visual inertness signal left at all').toMatch(/border-color\s*:|background-color\s*:/)
  })
})
