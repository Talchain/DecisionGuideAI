/**
 * J1 step 5 (DL 8 Nov, Codex's order: "the version pill and Share"): on the olumi-core lane the bar shows core's version label beside the
 * name, and Share opens the Team tab, where the invite is: no link is claimed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useViewStore } from '../../../olumiView/store'
import { useUIStore } from '../../../stores/uiStore'
import type { View } from '../../../olumiView/client'
import { ToastProvider } from '../../../canvas/ToastContext'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'maya@example.test' }, profile: null, signOut: vi.fn() }) }))

vi.mock('../../../olumiCore/lane', async (orig) => ({ ...(await orig<typeof import('../../../olumiCore/lane')>()), isOlumiCoreLane: () => true }))
const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1.core-5d8a009b.view3.json'), 'utf8'))
afterEach(() => { cleanup(); useViewStore.setState({ view: null, sid: null }) })

describe('the bar on the olumi-core lane', async () => {
  const { TopBar } = await import('../TopBar')
  it('says the version in core’s words, and Share opens the Team tab', () => {
    useViewStore.setState({ view, sid: view.id })
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle={view.title} onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    expect(screen.getByTestId('topbar-version-pill').textContent).toBe(view.version!.label)
    fireEvent.click(screen.getByTestId('topbar-share-core'))
    expect(force).toHaveBeenCalledWith('team')
  })
  it('V11 J1 #7: the version’s save date in core’s words beside its label (core ad57a105 `version.at_text`); a core that sends none shows the label alone', () => {
    const dated: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/version-at/app-launch.core-ad57a105.view3.json'), 'utf8'))
    expect([dated.version!.id, dated.version!.at_text]).toEqual([1, '2 Nov 2026'])
    useViewStore.setState({ view: dated, sid: dated.id })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle={dated.title} onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    const pill = screen.getByTestId('topbar-version-pill')
    expect(pill.querySelector('[data-view="version.label"]')!.textContent).toBe(dated.version!.label)
    expect(pill.querySelector('[data-view="version.at_text"]')!.textContent).toBe(dated.version!.at_text)
    expect(pill.textContent).toBe(`${dated.version!.label} · ${dated.version!.at_text}`)
    expect(pill.textContent).not.toContain(dated.version!.at!)
    cleanup()
    // CONTRAST: the same View from a core before at_text: the label alone, no separator, never the raw stamp
    const { at_text: _gone, ...undated } = dated.version!
    useViewStore.setState({ view: { ...dated, version: undated }, sid: dated.id })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle={dated.title} onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    expect(screen.getByTestId('topbar-version-pill').textContent).toBe(dated.version!.label)
  })
  it('CONTRAST: before core has a model version, neither shows', () => {
    useViewStore.setState({ view: null, sid: null })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="x" onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    expect(screen.queryByTestId('topbar-version-pill')).toBeNull()
    expect(screen.queryByTestId('topbar-share-core')).toBeNull()
  })
})
