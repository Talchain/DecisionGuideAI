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

/** Known-broken modifier forms, pinned so the workaround is revisited if the theme ever becomes alpha-capable. */
const KNOWN_NON_COMPILING = ['bg-option/40', 'bg-primary/50', 'border-option/40']

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
            ...KNOWN_NON_COMPILING,
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

  it('documents the defect class: opacity modifiers on these theme colours do NOT compile', () => {
    // If this ever starts failing (the classes begin to compile — e.g. the
    // theme moves to alpha-capable `rgb(var(--x) / <alpha-value>)` colours),
    // the solid light-token workaround can be revisited — until then, any
    // `/NN` modifier on option/primary is an invisible no-op, not a style.
    for (const cls of KNOWN_NON_COMPILING) {
      expect(
        css.match(selectorPattern(cls)),
        `"${cls}" unexpectedly compiled — the alpha-capability assumption changed`,
      ).toBeNull()
    }
  })
})
