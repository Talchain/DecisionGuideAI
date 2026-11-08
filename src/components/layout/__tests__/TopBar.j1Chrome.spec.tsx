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
  it('CONTRAST: before core has a model version, neither shows', () => {
    useViewStore.setState({ view: null, sid: null })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="x" onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    expect(screen.queryByTestId('topbar-version-pill')).toBeNull()
    expect(screen.queryByTestId('topbar-share-core')).toBeNull()
  })
})
