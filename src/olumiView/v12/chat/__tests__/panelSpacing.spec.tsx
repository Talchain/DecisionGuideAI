/**
 * P6 (panel system): the spacing recipes `.ok-section` (a 1 px line in the border token, 12 px above its content) and `.ok-stack` (8 px between children),
 * built from the brand `--space-*` tokens and applied to the reply-facts disclosure. jsdom does not resolve `var()`, so each declaration is read from the REAL
 * olumiLook.css rule and its token is resolved against the REAL brand.css value: a changed rule or a changed token fails here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ReplyFacts } from '../ReplyFacts'

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

describe('the tick-box accent is Olumi\'s look only', () => {
  it('the green accent rule is under the look container, never a bare global selector', () => {
    expect(look).toContain(".olumi-look input[type='checkbox'] { accent-color: var(--success); }")
    expect(look.split('\n').some((l) => l.startsWith("input[type='checkbox']")), 'no global checkbox rule').toBe(false)
  })
})

describe('P6 spacing: .ok-section and .ok-stack, from the brand tokens', () => {
  it('a section is a 1 px line in the border token with 12 px above its content; a stack is 8 px between its children (both computed from the tokens)', () => {
    expect(rule('.ok-section')).toMatchObject({ 'border-top': `1px solid ${token('--border-default')}`, 'padding-top': '12px' })
    expect(rule('.ok-stack')).toMatchObject({ display: 'grid', gap: '8px' })
    // contrast: the rules use the tokens, never a hand-typed length or colour
    const text = (sel: string) => look.slice(look.indexOf(`${sel} {`), look.indexOf('}', look.indexOf(`${sel} {`)))
    expect([text('.ok-section').includes('var(--space-3)'), text('.ok-section').includes('var(--border-default)'), text('.ok-stack').includes('var(--space-2)')]).toEqual([true, true, true])
  })
  it('the reply-facts disclosure draws them, once, and only when open', () => {
    const { container, getByTestId, queryByTestId } = render(<ReplyFacts at="chat.0" about={[]} rests={<p>Receipts</p>} why={<ul><li>Why</li></ul>} />)
    expect(queryByTestId('view-reply-rests-body')).toBeNull()
    fireEvent.click(getByTestId('view-reply-rests'))
    const body = getByTestId('view-reply-rests-body')
    expect(body).toHaveClass('ok-section', 'ok-stack')
    expect(container.querySelectorAll('.ok-section')).toHaveLength(1)
  })
})
