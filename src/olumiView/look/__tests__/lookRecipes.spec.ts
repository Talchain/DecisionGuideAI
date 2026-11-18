/**
 * The look's recipes are each written once (Paul 16 Nov: "consistent, strict coded rules"). Read from the stylesheet itself: a card's small
 * text takes its size and line height from ONE rule, a text action is never blue, and the sheet names the design system's tokens directly.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(',').map((s) => s.trim()), body: m[2]! }))
// CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov): the question's rail names options by letter (v12/detailed/charts.tsx); its label and rest lines are gone.
const SMALL = ['.ok-qual', '.ok-status', '.ok-count', '.ok-tag', '.ok-caption', '.ok-quiet', '.ok-by', '.ok-limit', '.ok-next']

describe("the look's recipes, each written once", () => {
  it("a card's small text takes its size and line height from one rule (the compact card draws at the board's scale like every card, R4, 16 Nov)", () => {
    for (const cls of SMALL) {
      const sizing = rules.filter((r) => /font-size|line-height/.test(r.body) && r.selectors.some((s) => s.endsWith(cls) && !s.includes('[data-simple-compact]')))
      expect(sizing.map((r) => r.body.trim()), cls).toEqual(['font-size: calc(12px * var(--o-s)); line-height: 1.4;'])
    }
  })
  it('a ruled-out card\'s name is light, and the Simple foot\'s marks are sized by the board\'s scale (each rule once, bound to its own hook)', () => {
    const bodyOf = (needle: string) => rules.filter((r) => r.selectors.some((x) => x.includes(needle))).map((r) => r.body.trim())
    // One rule greys a ruled-out card's name on both faces: the Simple and the Detailed hook are its two selectors.
    const greys = rules.filter((r) => r.selectors.some((x) => x.includes(":has([data-simple-set-aside]) [data-testid='node-title']")))
    expect(greys.map((r) => [r.selectors.map((x) => /data-(simple|detailed)-set-aside/.exec(x)?.[1] ?? null), r.body.trim()])).toEqual([[['simple', 'detailed'], 'color: var(--text-light) !important;']])
    expect(bodyOf('[data-simple-foot] .ok-am svg')).toEqual(['width: calc(12px * var(--o-s)); height: calc(12px * var(--o-s));'])
    // CONTRAST: a live card's name keeps the header ink (the base title rule), and no rule sizes a mark outside the Simple foot this way.
    expect(rules.filter((r) => r.selectors.includes(".olumi-look .react-flow__node [data-testid='node-title']") && /color:/.test(r.body)).map((r) => /color: var\(--text-header\) !important/.test(r.body))).toEqual([true])
    expect(rules.filter((r) => /\.ok-am svg/.test(r.selectors.join(',')) && !r.selectors.every((x) => x.includes('[data-simple-foot]')))).toEqual([])
  })
  it('the Detailed card\'s floor is never wider than its layout slot (--ok-slot): at 1232 a 228.8 px floor drew cards over their neighbours', () => {
    const r = rules.filter((x) => x.selectors.some((y) => y.includes(':has([data-ok-detailed])') && y.includes("[role='group'][aria-label]")))
    expect(r.map((x) => /min-width: min\(calc\(208px \* var\(--o-s\)\), var\(--ok-slot,/.test(x.body))).toEqual([true])
  })
  it('a text action (a press that opens something) is light and underlined, never blue', () => {
    const actions = rules.filter((r) => r.selectors.some((s) => /summary$|\.ok-share$/.test(s)))
    expect(actions.length).toBeGreaterThan(0)
    for (const r of actions) expect(r.body, r.selectors.join(', ')).not.toMatch(/--info\b|--info-ink\b/)
    const recipe = rules.find((r) => r.selectors.includes('.olumi-look .ok-steps > summary') && /color:/.test(r.body))!
    expect(recipe.selectors).toEqual(['.olumi-look .ok-steps > summary', '.olumi-look .ok-share', '.ok-explain .ok-steps > summary'])
    expect(recipe.body).toMatch(/color: var\(--text-light\); text-decoration: underline;/)
  })
  it("the question's rail never cuts core's words: no rail rule carries nowrap, an ellipsis, a line clamp or a clipping box. CONTRAST: the strips' axis ends (two numbers of the axis, not core's sentence) keep their nowrap, so the probe sees such a rule", () => {
    const clips = /white-space:\s*nowrap|text-overflow|line-clamp|overflow:\s*hidden/
    const rail = rules.filter((r) => r.selectors.some((s) => s.includes('.ok-dt-rail')))
    expect(rail.some((r) => r.selectors.some((s) => s.endsWith('.ok-dt-rail-val'))), 'the rail value rule is among those read').toBe(true)
    expect(rail.filter((r) => clips.test(r.body)).map((r) => r.selectors.join(', '))).toEqual([])
    expect(rules.filter((r) => r.selectors.some((s) => s.endsWith('.ok-dt-strip-ends')) && clips.test(r.body)).length).toBe(1)
  })
  it("names the design system's tokens directly: no alias layer but the canvas label scale, and no colour literal", () => {
    expect([...new Set(css.match(/--o-[a-z-]+/g) ?? [])]).toEqual(['--o-s'])
    expect(css.match(/rgba?\(|#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })
})
