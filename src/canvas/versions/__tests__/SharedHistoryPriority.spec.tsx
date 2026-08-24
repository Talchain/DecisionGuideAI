import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'

const listModelVersions = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../adapters/cee/modelVersions')>()
  return {
    ...original,
    listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  }
})

const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

import { WhatChangedPanel } from '../WhatChangedPanel'
import { useCanvasStore } from '../../store'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  authState.user = { id: USER }
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [] } as never)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: [],
    currentVersionId: null,
    contractVersion: 'v2',
    nextCursor: null,
    requestId: 'req-list',
  })
})

describe('Version history information hierarchy', () => {
  it('puts authoritative shared model history before device-local checkpoints', async () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('server-versions-empty')).toBeInTheDocument())

    const shared = screen.getByText('Shared model history')
    const local = screen.getByText('On this device — checkpoints')
    expect(shared.compareDocumentPosition(local) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(screen.getByTestId('server-versions-disclosure')).toHaveTextContent(
      /authoritative shared model history/i,
    )
    expect(screen.getByTestId('versions-storage-disclosure')).toHaveTextContent(
      /not authoritative shared history/i,
    )
  })

  it('keeps device checkpoints and sign-in guidance together for a purely local guest draft', () => {
    authState.user = null
    useCanvasStore.setState({ currentScenarioId: 'local-draft-1' } as never)
    render(<WhatChangedPanel isOpen onClose={() => {}} />)

    const shared = screen.getByText('Shared model history')
    const local = screen.getByText('On this device — checkpoints')
    expect(shared.compareDocumentPosition(local) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(screen.getByTestId('server-versions-local-draft-signin')).toHaveTextContent(
      /only on this device.*sign in.*shared scenario/i,
    )
    expect(screen.getByTestId('versions-storage-disclosure')).toHaveTextContent(
      /not authoritative shared history/i,
    )
    expect(screen.queryByRole('button', { name: /save shared version/i })).not.toBeInTheDocument()
    expect(listModelVersions).not.toHaveBeenCalled()
  })
})
