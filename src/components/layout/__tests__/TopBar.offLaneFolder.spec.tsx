/** v11 item B contrast: off the olumi-core lane the scenario name keeps its folder icon (the lane drops it to give the name room). */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../../canvas/ToastContext'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'maya@example.test' }, profile: null, signOut: vi.fn() }) }))
vi.mock('../../../olumiCore/lane', async (orig) => ({ ...(await orig<typeof import('../../../olumiCore/lane')>()), isOlumiCoreLane: () => false }))
afterEach(cleanup)

describe('the bar off the olumi-core lane', async () => {
  const { TopBar } = await import('../TopBar')
  it('keeps the folder icon before the name and shows no core Share button', () => {
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="A long scenario name" onTitleChange={() => {}} /></ToastProvider></MemoryRouter>)
    expect(screen.getByTestId('scenario-switcher-pill').querySelector('svg.lucide-folder')).not.toBeNull()
    expect(screen.queryByTestId('topbar-share-core')).toBeNull()
  })
})
