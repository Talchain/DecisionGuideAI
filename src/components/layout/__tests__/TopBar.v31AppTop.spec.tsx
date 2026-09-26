/**
 * contract v3.1 `.app-top` — A FULL-WIDTH 51px BAR, NOT A FLOATING PILL
 * (DESIGN-GAP #5, 26 Sep 2026).
 *
 * MEASURED at base `6256a41f`, 1280x800: the bar was a 438.6x45 pill at
 * (12,12), radius 16, a two-layer shadow, with a bordered 216x31 radius-14 title
 * pill and a 32px avatar. v3.1:
 *   `.app-top{height:51px;border-bottom:1px solid #DDD8D0;display:flex;
 *    align-items:center;padding:0 18px;gap:20px;background:rgba(254,254,254,.94)}`
 *   `.app-project{…gap:8px;font-size:13px}` · `.app-top .avatar{26px}`.
 *
 * jsdom applies no CSS modules (`css: false`), so — as the toolbar specs do —
 * the stylesheet's own rules are read by exact selector, with a positive
 * control. The runtime half (`--topbar-h`, the compact avatar) is rendered.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'paul@example.test' }, profile: null, signOut: vi.fn() }),
}))

import { TopBar, TOP_BAR_HEIGHT_PX } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'

function renderBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar scenarioTitle="Pricing Model Transition Strategy" onTitleChange={() => {}} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const CSS = readFileSync(join(__dirname, '..', 'TopBar.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const TOOLBAR_CSS = readFileSync(join(__dirname, '..', 'CanvasFloatingToolbar.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function ruleIn(css: string, selector: string): Record<string, string> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)
  const out: Record<string, string> = {}
  for (const decl of (m?.[1] ?? '').split(';')) {
    const i = decl.indexOf(':')
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim()
  }
  return out
}
const rule = (s: string) => ruleIn(CSS, s)

describe('TopBar — contract v3.1 `.app-top` (DESIGN-GAP #5)', () => {
  it('POSITIVE CONTROL: the reader finds the bar rule', () => {
    expect(rule('.topBar').position).toBe('fixed')
    expect(Object.keys(rule('.topBar')).length).toBeGreaterThan(5)
  })

  it('⭐ full width at the top edge, 51px, the contract’s bottom rule and fill — no pill radius, no shadow', () => {
    const bar = rule('.topBar')
    expect([bar.top, bar.left, bar.right]).toEqual(['0', '0', '0'])
    expect(bar.height).toBe('51px')
    expect(bar['border-bottom']).toBe('1px solid #DDD8D0')
    expect(bar.background).toBe('rgba(254, 254, 254, 0.94)')
    expect(bar.padding).toBe('0 18px')
    expect(bar.gap).toBe('20px')
    expect(bar['border-radius']).toBeUndefined()
    expect(bar['box-shadow']).toBeUndefined()
    expect(TOP_BAR_HEIGHT_PX).toBe(51)
  })

  it('the controls are right-aligned (`.scope{margin-left:auto}`), and the save status is the 11px muted scope text', () => {
    expect(rule('.topBarRight')['margin-left']).toBe('auto')
    expect(rule('.saveStatus')['font-size']).toBe('11px')
    expect(rule('.saveStatus').color).toBe('var(--text-light)')
  })

  it('ONE chrome button: the top bar’s button is the canvas tools’ box — 29x31, radius 6, no border', () => {
    for (const prop of ['width', 'height', 'border-radius', 'border', 'color']) {
      expect(rule('.iconButton')[prop], prop).toBe(ruleIn(TOOLBAR_CSS, '.iconButton')[prop])
    }
    expect(rule('.iconButton').width).toBe('29px')
  })

  it('publishes its bottom edge as `--topbar-h` (51px), and draws the 26px avatar', () => {
    renderBar()
    expect(document.documentElement.style.getPropertyValue('--topbar-h')).toBe('51px')
    const avatar = screen.getByRole('button', { name: 'Account menu' })
    expect(avatar.className).toContain('h-[26px]')
    expect(avatar.className).toContain('w-[26px]')
    expect(avatar.className).not.toContain('h-8')
  })

  it('the model title is unboxed: no bordered pill around it', () => {
    renderBar()
    const pill = screen.getByTestId('scenario-switcher-pill')
    const cls = pill.className.split(/\s+/)
    expect(cls).not.toContain('border')
    expect(cls).not.toContain('bg-white')
    expect(cls).toContain('text-[13px]')
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Pricing Model Transition Strategy')
  })
})
