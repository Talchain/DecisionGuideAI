/**
 * Chart classes MUST compile — the regression net for the staging
 * "invisible range bars" defect.
 *
 * Root cause of that defect: the theme colours are plain `var(--x)` values,
 * so Tailwind 3 cannot apply opacity modifiers to them. `bg-option/40` and
 * `bg-primary/50` were silently NOT generated — the bar element had
 * geometry and animation but no background, and jsdom tests could not see
 * it (they assert structure, not compiled CSS). This suite closes that gap
 * by compiling the repo's REAL Tailwind config against the exact class
 * strings the chart uses and asserting each one emits the property it is
 * relied on for.
 *
 * Matching is BOUNDARY-ANCHORED: `.bg-option` must not be satisfied by the
 * `.bg-option-light` rule (a plain substring check would silently pass the
 * exact class this guard exists to protect).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import type { Config } from 'tailwindcss'
// @ts-expect-error TS7016 — the root Tailwind config ships no declaration
// file; its runtime shape is exercised by the compile below.
import tailwindConfig from '../../../../../tailwind.config.js'
import { HERO_BAR_FILL, HERO_DOT_FILL, HERO_TOKEN_BORDER } from '../HeroOptionRow'

/** Every guarded class with the CSS property its element relies on. */
const CHART_CLASS_EXPECTATIONS: ReadonlyArray<{ cls: string; property: string }> = [
  ...Object.values(HERO_BAR_FILL).map((cls) => ({ cls, property: 'background-color' })),
  ...Object.values(HERO_DOT_FILL).map((cls) => ({ cls, property: 'background-color' })),
  { cls: HERO_TOKEN_BORDER, property: 'border-color' },
]

/**
 * The three modifier forms this chart originally used, and which silently
 * compiled to NOTHING — the cause of the invisible-range-bars defect.
 *
 * They COMPILE NOW. The theme moved to alpha-capable
 * `rgb(var(--x-rgb) / <alpha-value>)` colours, which is the exact condition
 * the previous version of this pin named as its trigger:
 *
 *     "If this ever starts failing (the classes begin to compile — e.g. the
 *      theme moves to alpha-capable rgb(var(--x) / <alpha-value>) colours),
 *      the solid light-token workaround can be revisited"
 *
 * That tripwire fired exactly as designed, and this is it being answered. The
 * assertion is INVERTED rather than deleted, so it stays bidirectional: if the
 * theme ever regresses to bare `var(--x)`, these go red again instead of the
 * defect returning unnoticed.
 *
 * THE WORKAROUND IS DELIBERATELY LEFT IN PLACE. `HERO_BAR_FILL` still uses
 * solid `-light` tokens (with two `brand-tokens/no-bare-light-bg` eslint
 * exceptions, issue 222). Reverting it to `/40` and `/50` would visibly change
 * this chart's fills, which is a design ruling and not this change's to make —
 * this change only removes the technical obstacle that forced the workaround.
 * Revisiting it is now unblocked.
 */
const PREVIOUSLY_NON_COMPILING = ['bg-option/40', 'bg-primary/50', 'border-option/40']

/**
 * Boundary-anchored selector matcher: `.cls` not followed by a word char or
 * hyphen, so `.bg-option` is never satisfied by the `.bg-option-light` rule.
 * Tailwind escapes special characters inside emitted selectors (e.g.
 * `.bg-option\/40`), so every non-word character matches with an optional
 * preceding backslash.
 */
function selectorPattern(cls: string): RegExp {
  const body = cls
    .split('')
    .map((ch) => (/[a-zA-Z0-9-]/.test(ch) ? ch : `\\\\?\\${ch}`))
    .join('')
  return new RegExp(`\\.${body}(?![\\w-])`)
}

let css = ''

beforeAll(async () => {
  const config: Config = {
    ...(tailwindConfig as Config),
    content: {
      files: [
        {
          raw: `<div class="${[
            ...CHART_CLASS_EXPECTATIONS.map((e) => e.cls),
            ...PREVIOUSLY_NON_COMPILING,
          ].join(' ')}"></div>`,
          extension: 'html',
        },
      ],
    },
  }
  const result = await postcss([tailwindcss(config)]).process('@tailwind utilities;', {
    from: undefined,
  })
  css = result.css
})

describe('hero chart classes compile against the real Tailwind config', () => {
  it('every guarded class generates a rule carrying the property its element relies on', () => {
    for (const { cls, property } of CHART_CLASS_EXPECTATIONS) {
      const match = css.match(selectorPattern(cls))
      expect(
        match,
        `"${cls}" generated no CSS — the element would render without its ${property} (invisible-styling defect class)`,
      ).not.toBeNull()
      const start = match!.index!
      const body = css.slice(start, css.indexOf('}', start))
      expect(body, `"${cls}" rule is missing ${property}`).toContain(property)
    }
  })

  it('opacity modifiers on these theme colours now compile (the defect that caused invisible bars)', () => {
    // The inversion of the original pin. These three classes emitted no rule
    // at all, so the bar had geometry and animation but no background. They
    // must now emit, AND carry a real alpha — a rule that compiled but ignored
    // the modifier would render identically to the broken behaviour.
    for (const cls of PREVIOUSLY_NON_COMPILING) {
      const match = css.match(selectorPattern(cls))
      expect(
        match,
        `"${cls}" compiled to nothing — the theme has regressed to a colour form that ` +
          `cannot take an opacity modifier, which is the invisible-styling defect class ` +
          `this suite exists for.`,
      ).not.toBeNull()

      const start = match!.index!
      const body = css.slice(start, css.indexOf('}', start))
      const alpha = cls.split('/')[1]
      expect(
        body,
        `"${cls}" emitted a rule but without its ${alpha}% alpha — it would look ` +
          `identical to the un-emitted case on screen.`,
      ).toMatch(/\/\s*0?\.\d+\)/)
    }
  })
})
