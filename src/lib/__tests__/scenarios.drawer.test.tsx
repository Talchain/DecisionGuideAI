import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

function stubClipboard() {
  ;(window as any).__copied = []
  const nav: any = (window as any).navigator || {}
  nav.clipboard = nav.clipboard || {}
  nav.clipboard.writeText = (val: string) => { (window as any).__copied.push(String(val || '')); return Promise.resolve() }
  ;(window as any).navigator = nav
}

describe('Scenarios drawer (flag-gated)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    try { localStorage.clear() } catch {}
    stubClipboard()
  })

  it('Flag ON: open, save, copy link, Esc returns focus to button', async () => {
    mockFlags({ isSseEnabled: () => true, isParamsEnabled: () => true, isScenariosEnabled: () => true })
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Set params first
    fireEvent.change(screen.getByTestId('param-seed'), { target: { value: '1234' } })
    fireEvent.change(screen.getByTestId('param-budget'), { target: { value: '1.0' } })
    fireEvent.change(screen.getByTestId('param-model'), { target: { value: 'gpt-4o-mini' } })

    const btn = screen.getByTestId('scenarios-btn') as HTMLButtonElement
    btn.focus()
    fireEvent.click(btn)

    const name = screen.getByTestId('scenario-name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Demo' } })
    fireEvent.click(screen.getByTestId('scenario-save-btn'))

    // saved toast
    expect(await screen.findByTestId('scenarios-toast')).toBeTruthy()

    // copy link
    const share = await screen.findByTestId('scenario-share-btn')
    fireEvent.click(share)
    expect(await screen.findByTestId('scenarios-toast')).toBeTruthy()

    // Esc close returns focus to trigger (allow a small macrotask)
    const drawer = screen.getByTestId('scenarios-drawer')
    fireEvent.keyDown(drawer, { key: 'Escape' })
    await new Promise((r) => setTimeout(r, 20))
    expect(document.activeElement).toBe(btn)
  })

  it('Flag OFF: scenarios button not rendered', async () => {
    mockFlags({ isSseEnabled: () => true, isScenariosEnabled: () => false })
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    const { container } = render(<SandboxStreamPanel />)
    expect(container.querySelector('[data-testid="scenarios-btn"]')).toBeNull()
  })
})
