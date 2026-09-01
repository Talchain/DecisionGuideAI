/**
 * The read-only Inspector's inertness must be VISIBLE, and this is a SOURCE
 * SCAN because the thing under test is a CSS rule.
 *
 * ⚠ WHAT THIS TEST CAN AND CANNOT DO, stated rather than implied. jsdom applies
 * no stylesheet, so it can never tell you what a user SEES — a rendering
 * assertion here would be theatre. What it can do is stop the rule being
 * deleted or quietly detached from the authority boundary it is keyed on, which
 * is the realistic failure: a tidy-up removes an "unused-looking" selector from
 * `index.css` and nothing anywhere goes red.
 *
 * The visual claim itself is a BROWSER claim and is verified on the deployed
 * build, not here.
 *
 * ## The defect it guards
 *
 * `InspectorRouter` wraps every panel in `<fieldset disabled
 * data-authority="disabled">`. That genuinely inerts the controls. Measured on
 * deployed staging, it did not LOOK inert: the dead value input and a live
 * input on the same screen had identical opacity, identical text colour and
 * identical border colour, differing only in `cursor` — invisible until hover,
 * absent on touch. A field captioned "Enter value" swallowed clicks in silence.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
const selfSource = readFileSync(__filename, 'utf8')
const router = readFileSync(
  resolve(__dirname, '../ui/inspector-v2/InspectorRouter.tsx'),
  'utf8',
)

describe('read-only Inspector — inert controls read as inert', () => {
  it('styles disabled controls under the authority boundary', () => {
    expect(css).toMatch(/\[data-authority="disabled"\]\s+:disabled\s*\{/)
  })

  it('the rule is keyed on the SAME attribute the router actually emits', () => {
    // The pairing is the whole point: a rule keyed on an attribute nothing
    // renders is a rule that silently does nothing. This asserts both halves
    // rather than the CSS alone, so renaming the attribute on one side goes red
    // instead of going quiet (CLAUDE.md trap 12).
    expect(router).toMatch(/data-authority="disabled"/)
    expect(router).toMatch(/<fieldset[\s\S]{0,200}?disabled/)
  })

  it('carries BOTH channels — a colour change alone is not a signal every user has', () => {
    const rule = css.match(/\[data-authority="disabled"\]\s+:disabled\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/opacity/)
    expect(rule).toMatch(/cursor:\s*not-allowed/)
  })

  it('the correction is in BOTH files, not just the one that was corrected', () => {
    // A correction reached `index.css` and this spec kept the withdrawn claim —
    // twice in one night, in two different PRs. Sweeping ONE file cannot catch
    // that.
    //
    // ⚠ This is a PRESENCE assertion on this file and an ABSENCE assertion on
    // the CSS, deliberately. A first attempt scanned both for the forbidden
    // phrase and RED on itself: a guard that names the string it bans contains
    // that string. So each side asserts what it can assert without quoting the
    // claim — the CSS must not restate it, and this file must carry the fact
    // that replaced it.
    const normalise = (text: string) => text.replace(/\/\//g, ' ').replace(/\s+/g, ' ')

    // POSITIVE CONTROL: an absence assertion is vacuous unless the probe is
    // shown to see a phrase that IS present in the file it scans.
    const normalisedCss = normalise(css)
    expect(normalisedCss, 'probe is blind — the control phrase is absent').toMatch(
      /form-associated/i,
    )
    // Built from fragments so this line is not itself a match.
    const withdrawn = new RegExp(['one control', ' that (still )?', 'works'].join(''), 'i')
    expect(normalisedCss, 'index.css restates the withdrawn claim').not.toMatch(withdrawn)

    // And this file's own escaper block must not restate it either — that is
    // where the stale copy survived. Scoped to that block so the guard is not
    // scanning the fragments it just built.
    const escaperBlock = normalise(
      selfSource.slice(selfSource.indexOf('does NOT claim to cover every control')),
    )
    expect(escaperBlock, 'probe is blind — the escaper block was not found').toMatch(
      /form-associated/i,
    )
    expect(escaperBlock, 'this spec restates the withdrawn claim').not.toMatch(withdrawn)
  })

  it('⚠ does NOT claim to cover every control — the one live escaper must keep looking live', () => {
    // `<fieldset disabled>` inerts FORM-ASSOCIATED descendants only.
    // `inspectorAuthorityBinding.spec.tsx` pins the single control it does not
    // reach: the Context prompt, a `<div role="button" tabindex="0">`. That div
    // is genuinely still interactive — it responds, and swaps itself for an
    // editor. But that editor is a `<textarea>` inside this same disabled
    // fieldset, so the control is an entrance to a dead end, NOT a control that
    // works. Painting it inert would not fix the dead end; it would only hide
    // the entrance to one, and `:disabled` — the browser's own answer to "is
    // this inert" — correctly says the div is not inert. That is the reason to
    // leave the scope alone, and it does not rest on the div working.
    //
    // This asserts the rule's SCOPE stays honest: `:disabled` only, never a
    // `[role="button"]` or `[tabindex]` selector that would sweep the escaper in.
    const rule = css.match(/\[data-authority="disabled"\][^{]*\{/g)?.join(' ') ?? ''
    expect(rule).not.toMatch(/role=|tabindex|\*/)
    // And the comment must not restate the claim that was false.
    const block = css.slice(Math.max(0, css.indexOf('Read-only Inspector')), css.indexOf('[data-authority="disabled"] :disabled'))
    expect(block).not.toMatch(/covers every control inside it/i)
  })

  it('selects via :disabled rather than a hand-listed set of controls', () => {
    // Derived, not enumerated: the browser's own answer to "is this inert"
    // covers every control inside the boundary, including ones added later. A
    // list of element selectors would drift the moment a panel gained a
    // control (CLAUDE.md trap 12).
    const rule = css.match(/\[data-authority="disabled"\][^{]*\{/)?.[0] ?? ''
    expect(rule).toContain(':disabled')
    expect(rule).not.toMatch(/\binput\b|\btextarea\b|\bselect\b/)
  })
})
