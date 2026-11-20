/**
 * P6 (panel system): the spacing recipes `.ok-section` (a 1 px line in the border token, 12 px above its content) and `.ok-stack` (8 px between children),
 * built from the brand `--space-*` tokens and applied to the reply-facts disclosure. jsdom does not resolve `var()`, so the REAL olumiLook.css rules of the
 * panel block are taken, each token resolved against the REAL brand.css value, injected as a stylesheet, and the rendered elements' COMPUTED style is read
 * (the cascade, not the declaration text): a changed rule, a changed token, a class dropped from the component or a later rule that overrides it fails here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ReplyFacts } from '../ReplyFacts'
import { OkIconButton } from '../../../look/icons'

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const look = strip(readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8'))
const brand = strip(readFileSync(path.resolve('src/styles/brand.css'), 'utf8'))
const resolve = (v: string): string => (/var\(/.test(v) ? resolve(v.replace(/var\((--[a-z0-9-]+)\)/g, (_m, n: string) => raw(n))) : v)
const raw = (name: string): string => { const m = new RegExp(`${name}:\\s*([^;]+);`).exec(brand); if (m === null) throw new Error(`no token ${name}`); return m[1]!.trim() }
const token = (name: string): string => resolve(raw(name))
/** The declarations of the (one) rule whose selector is exactly `sel`, with every var() resolved. */
const rule = (sel: string): Record<string, string> => {
  const i = look.indexOf(`${sel} {`)
  if (i < 0) throw new Error(`no rule ${sel}`)
  const body = look.slice(i + sel.length + 2, look.indexOf('}', i))
  return Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), resolve(d.slice(k + 1).trim())] }))
}

afterEach(() => cleanup())

describe('the tick-box accent is brand green everywhere (Paul 20 Nov: the review ticks drew browser blue)', () => {
  it('one brand-wide rule, because the chat panel and dock sit outside .olumi-look (a ReactFlow class) and a scoped rule would miss the review ticks', () => {
    expect(look.split('\n')).toContain("input[type='checkbox'] { accent-color: var(--success); }")
    expect(look).not.toContain(".olumi-look input[type='checkbox']")
  })
})

/** The real rules of the panel block, tokens resolved, as one stylesheet text. */
const commas = (v: string): string => v.replace(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/g, 'rgb($1, $2, $3)')
const panelCss = (sels: string[]): string => sels.map((sel) => `${sel} { ${Object.entries(rule(sel)).map(([k, v]) => `${k}: ${commas(v)};`).join(' ')} }`).join('\n')
const withSheet = (sels: string[]): HTMLStyleElement => { const st = document.createElement('style'); st.textContent = panelCss(sels); document.head.appendChild(st); return st }
const cs = (el: Element) => getComputedStyle(el)
/** jsdom's cssstyle may keep `gap` only as its longhands: read the shorthand, else the row gap. */
const gapOf = (el: Element) => cs(el).getPropertyValue('gap') || cs(el).getPropertyValue('row-gap')

describe('P6 spacing: .ok-section and .ok-stack, from the brand tokens (computed on the rendered panel)', () => {
  it('the rules are built from the tokens, never a hand-typed length or colour', () => {
    const text = (sel: string) => look.slice(look.indexOf(`${sel} {`), look.indexOf('}', look.indexOf(`${sel} {`)))
    expect([text('.ok-section').includes('var(--space-3)'), text('.ok-section').includes('var(--border-default)'), text('.ok-stack').includes('var(--space-2)')]).toEqual([true, true, true])
    expect([token('--space-3'), token('--space-2'), token('--space-1')]).toEqual(['12px', '8px', '4px'])
  })
  it('the open reply-facts body, computed: a 1 px solid line above, 12 px before its content, and its sections 8 px apart', () => {
    const sheet = withSheet(['.ok-section', '.ok-stack', '.ok-facts'])
    try {
      const { container, getByTestId } = render(<ReplyFacts at="chat.0" about={[]} rests={<p>Receipts</p>} why={<ul><li>Why</li></ul>} />)
      fireEvent.click(getByTestId('view-reply-rests'))
      const body = getByTestId('view-reply-rests-body')
      expect(body).toHaveClass('ok-section', 'ok-stack')
      expect(container.querySelectorAll('.ok-section')).toHaveLength(1)
      expect([cs(body).borderTopWidth, cs(body).borderTopStyle, cs(body).paddingTop, cs(body).display, gapOf(body)]).toEqual(['1px', 'solid', '12px', 'grid', '8px'])
      for (const sec of body.querySelectorAll('section')) expect([cs(sec).display, gapOf(sec)], 'each section is itself a stack').toEqual(['grid', '8px'])
      const row = getByTestId('view-reply-tools')
      expect([cs(row).display, gapOf(row)], 'the icon row').toEqual(['flex', '4px'])
    } finally { sheet.remove() }
  })
  it('CONTRAST: an element without the classes gets none of it (the computed result comes from the recipe, not from the harness)', () => {
    const sheet = withSheet(['.ok-section', '.ok-stack'])
    try {
      const { container } = render(<div data-testid="plain"><p>x</p></div>)
      const el = container.querySelector('[data-testid="plain"]')!
      expect([cs(el).borderTopWidth === '1px', cs(el).paddingTop === '12px', cs(el).display]).toEqual([false, false, 'block'])
    } finally { sheet.remove() }
  })
  it('a ghost registry icon button in the facts row and the panel's top row carries no sizing utilities of its own (the registry\'s recipe is the one source)', () => {
    const { getByTestId } = render(<ReplyFacts at="chat.0" about={[]} rests={<p>Receipts</p>} why={null} />)
    expect(getByTestId('view-reply-rests').className).not.toMatch(/(^|\s)(h|w)-\d/)
    expect(render(<OkIconButton id="commit-action" tone="ghost" testid="x" onClick={() => {}} />).getByTestId('x').className).not.toMatch(/(^|\s)(h|w)-\d/)
  })
})

describe('panel recipes added for the fixes: Latest, inline Keep, waiting row (computed)', () => {
  it('Latest: a 1 px solid line on a panel surface; the waiting row is a flex row with an 8 px gap', () => {
    const sheet = withSheet(['.ok-to-latest', '.ok-waiting'])
    try {
      const { container } = render(<><button className="ok-to-latest" type="button">x</button><div className="ok-waiting" /></>)
      const latest = container.querySelector('.ok-to-latest')!, wait = container.querySelector('.ok-waiting')!
      expect([cs(latest).borderTopWidth, cs(latest).borderTopStyle]).toEqual(['1px', 'solid'])
      expect([cs(wait).display, gapOf(wait), cs(wait).alignItems]).toEqual(['flex', '8px', 'center'])
    } finally { sheet.remove() }
  })
  it('inline Keep: hidden at rest (opacity 0), and the rule that shows it is bound to its item\'s hover and focus, to focus within it, to a said refusal, and to touch (no hover)', () => {
    const sheet = withSheet(['.ok-keep-inline'])
    try {
      const { container } = render(<span className="ok-keep-inline">k</span>)
      expect(cs(container.querySelector('.ok-keep-inline')!).opacity, 'hidden at rest').toBe('0')
    } finally { sheet.remove() }
    expect(look).toContain('.group\\/item:hover .ok-keep-inline')
    expect(look).toContain('.group\\/item:focus-within .ok-keep-inline')
    expect(look).toContain('.ok-keep-inline:focus-within')
    expect(look).toContain('.ok-keep-inline[data-said]')
    expect(look).toMatch(/@media \(hover: none\) \{ \.ok-keep-inline \{ opacity: 1; \} \}/)
  })
})
