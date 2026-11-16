/**
 * The look's recipes are each written once (Paul 16 Nov: "consistent, strict coded rules"). Read from the stylesheet itself: a card's small
 * text takes its size and line height from ONE rule, a text action is never blue, and the sheet names the design system's tokens directly.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(',').map((s) => s.trim()), body: m[2]! }))
const SMALL = ['.ok-qual', '.ok-status', '.ok-count', '.ok-tag', '.ok-caption', '.ok-quiet', '.ok-by', '.ok-limit', '.ok-next', '.ok-rail-label', '.ok-rail-rest']

describe("the look's recipes, each written once", () => {
  it("a card's small text takes its size and line height from one rule (the compact card draws at the board's scale like every card, R4, 16 Nov)", () => {
    for (const cls of SMALL) {
      const sizing = rules.filter((r) => /font-size|line-height/.test(r.body) && r.selectors.some((s) => s.endsWith(cls) && !s.includes('[data-simple-compact]')))
      expect(sizing.map((r) => r.body.trim()), cls).toEqual(['font-size: calc(12px * var(--o-s)); line-height: 1.4;'])
    }
  })
  it('a text action (a press that opens something) is light and underlined, never blue', () => {
    const actions = rules.filter((r) => r.selectors.some((s) => /summary$|\.ok-share$/.test(s)))
    expect(actions.length).toBeGreaterThan(0)
    for (const r of actions) expect(r.body, r.selectors.join(', ')).not.toMatch(/--info\b|--info-ink\b/)
    const recipe = rules.find((r) => r.selectors.includes('.olumi-look .ok-steps > summary') && /color:/.test(r.body))!
    expect(recipe.selectors).toEqual(['.olumi-look .ok-steps > summary', '.olumi-look .ok-share', '.ok-explain .ok-steps > summary'])
    expect(recipe.body).toMatch(/color: var\(--text-light\); text-decoration: underline;/)
  })
  it("names the design system's tokens directly: no alias layer but the canvas label scale, and no colour literal", () => {
    expect([...new Set(css.match(/--o-[a-z-]+/g) ?? [])]).toEqual(['--o-s'])
    expect(css.match(/rgba?\(|#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })
})
