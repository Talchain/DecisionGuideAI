/**
 * Chart fill classes MUST compile — the regression net for the staging
 * "invisible range bars" defect.
 *
 * Root cause of that defect: the theme colours are plain `var(--x)` values,
 * so Tailwind 3 cannot apply opacity modifiers to them. `bg-option/40` and
 * `bg-primary/50` were silently NOT generated — the bar element had
 * geometry and animation but no background, and jsdom tests could not see
 * it (they assert structure, not compiled CSS). This suite closes that gap
 * by compiling the repo's REAL Tailwind config against the exact class
 * strings the chart uses and asserting each one emits a rule.
 */
import { describe, expect, it } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../../../../tailwind.config.js'
import { HERO_BAR_FILL, HERO_DOT_FILL } from '../HeroOptionRow'

const CHART_FILL_CLASSES = [
  ...Object.values(HERO_BAR_FILL),
  ...Object.values(HERO_DOT_FILL),
]

async function compile(classes: string[]): Promise<string> {
  const config = {
    ...(tailwindConfig as Record<string, unknown>),
    content: {
      files: [{ raw: `<div class="${classes.join(' ')}"></div>`, extension: 'html' }],
    },
  }
  const result = await postcss([tailwindcss(config as never)]).process(
    '@tailwind utilities;',
    { from: undefined },
  )
  return result.css
}

describe('hero chart classes compile against the real Tailwind config', () => {
  it('every bar/dot fill class generates a background-color rule', async () => {
    const css = await compile(CHART_FILL_CLASSES)
    for (const cls of CHART_FILL_CLASSES) {
      const selector = `.${cls.replace(/[./]/g, (m) => `\\${m}`)}`
      expect(
        css.includes(selector),
        `"${cls}" generated no CSS — the fill would render transparent (invisible-bar defect class)`,
      ).toBe(true)
      const idx = css.indexOf(selector)
      expect(css.slice(idx, css.indexOf('}', idx))).toContain('background-color')
    }
  })

  it('documents the defect class: opacity modifiers on these theme colours do NOT compile', async () => {
    // If this ever starts passing compilation (e.g. the theme moves to
    // alpha-capable `rgb(var(--x) / <alpha-value>)` colours), the solid
    // light-token workaround can be revisited — until then, any `/NN`
    // modifier on option/primary is an invisible no-op, not a style.
    const css = await compile(['bg-option/40', 'bg-primary/50'])
    expect(css).not.toContain('.bg-option\\/40')
    expect(css).not.toContain('.bg-primary\\/50')
  })
})
