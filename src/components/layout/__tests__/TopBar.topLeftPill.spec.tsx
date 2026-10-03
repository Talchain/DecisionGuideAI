/**
 * ⭐ THE APP BAR IS A TOP-LEFT PILL; THE RIGHT PANEL RUNS THE FULL HEIGHT (Paul, 1 Oct 2026 ~00:15Z).
 *
 * Supersedes the contract v3.1 `.app-top` full-width 51px bar (DESIGN-GAP #5, 26 Sep) on the owner's call; the
 * contract and DS v5 §8 "App bar: 64px" are to be updated to this, not the other way round.
 *
 * jsdom applies no CSS modules (`css: false`), so — as the toolbar specs do — the stylesheet's own rules are read by
 * exact selector, with a positive control. The runtime half (`--topbar-h` stays 0, `--chrome-top-left` is the pill's
 * bottom edge) is rendered.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'paul@example.test' }, profile: null, signOut: vi.fn() }),
}))

import { TopBar, TOP_PILL_BOTTOM_PX } from '../TopBar'
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

describe('TopBar — the top-left pill (Paul, 1 Oct 2026)', () => {
  it('POSITIVE CONTROL: the reader finds the bar rule', () => {
    expect(rule('.topBar').position).toBe('fixed')
    expect(Object.keys(rule('.topBar')).length).toBeGreaterThan(5)
  })

  it('⭐ a pill in the top-LEFT corner — never full width: 12px in, 40px tall, pill radius, the chrome border', () => {
    const bar = rule('.topBar')
    expect([bar.top, bar.left]).toEqual(['12px', '12px'])
    expect(bar.right).toBeUndefined()
    expect(bar.width).toBeUndefined()
    expect(bar.height).toBe('40px')
    expect(bar['border-radius']).toBe('999px')
    expect(bar.border).toBe('1px solid #DDD8D0')
    expect(bar['border-bottom']).toBeUndefined()
    expect(TOP_PILL_BOTTOM_PX).toBe(52)
  })

  it('the actions follow the name inside the pill (no right-edge push), and the save status is the 11px muted text', () => {
    expect(rule('.topBarRight')['margin-left']).toBeUndefined()
    expect(rule('.topBarRight')['border-left']).toBe('1px solid #DDD8D0')
    expect(rule('.saveStatus')['font-size']).toBe('11px')
    expect(rule('.saveStatus').color).toBe('var(--text-light)')
  })

  it('ONE chrome button: the top bar’s button is the canvas tools’ box — 29x31, radius 6, no border', () => {
    for (const prop of ['width', 'height', 'border-radius', 'border', 'color']) {
      expect(rule('.iconButton')[prop], prop).toBe(ruleIn(TOOLBAR_CSS, '.iconButton')[prop])
    }
    expect(rule('.iconButton').width).toBe('29px')
  })

  it('leaves `--topbar-h` at 0 (the dock runs full height) and publishes the pill edge as `--chrome-top-left`', () => {
    renderBar()
    expect(document.documentElement.style.getPropertyValue('--topbar-h')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--chrome-top-left')).toBe('52px')
    const avatar = screen.getByRole('button', { name: 'Account menu' })
    expect(avatar.className).toContain('h-[26px]')
    expect(avatar.className).toContain('w-[26px]')
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
