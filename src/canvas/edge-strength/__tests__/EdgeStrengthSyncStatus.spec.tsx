import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EdgeStrengthEndpointStatus } from '../edgeStrengthCoordinator'
import { EdgeStrengthSyncStatus } from '../EdgeStrengthSyncStatus'

const coordinatorMocks = vi.hoisted(() => ({
  status: { kind: 'idle' } as unknown,
  refresh: vi.fn(() => Promise.resolve(true)),
  useShared: vi.fn(() => Promise.resolve(true)),
  applyMine: vi.fn(() => true),
}))

vi.mock('../edgeStrengthCoordinator', () => ({
  getEdgeStrengthEndpointStatus: () => coordinatorMocks.status,
  refreshEdgeStrengthAuthority: coordinatorMocks.refresh,
  acceptSharedEdgeStrengthValue: coordinatorMocks.useShared,
  applyMyEdgeStrengthValue: coordinatorMocks.applyMine,
}))

vi.mock('../../store', () => ({
  useCanvasStore: (selector: (state: { edgeStrengthSync: { revision: number } }) => unknown) =>
    selector({ edgeStrengthSync: { revision: 1 } }),
}))

const recovery = {
  cause: 'conflict' as const,
  edgeId: 'rf-edge-1',
  from: 'fac_a',
  to: 'goal_b',
  expected: { mean: -0.4, effectDirection: 'negative' as const, std: 0.1 },
  attempted: { mean: -0.7, effectDirection: 'negative' as const, std: 0.1 },
  sharedCurrent: { mean: -0.5, effectDirection: 'negative' as const, std: 0.1 },
  at: 1,
}

function setStatus(status: EdgeStrengthEndpointStatus): void {
  coordinatorMocks.status = status
}

function renderStatus() {
  return render(
    <EdgeStrengthSyncStatus scenarioId="scenario-1" from="fac_a" to="goal_b" />,
  )
}

describe('EdgeStrengthSyncStatus', () => {
  beforeEach(() => {
    setStatus({ kind: 'idle' })
    coordinatorMocks.refresh.mockReset()
    coordinatorMocks.refresh.mockResolvedValue(true)
    coordinatorMocks.useShared.mockReset()
    coordinatorMocks.useShared.mockResolvedValue(true)
    coordinatorMocks.applyMine.mockReset()
    coordinatorMocks.applyMine.mockReturnValue(true)
  })

  it('announces queued and saving states without claiming persistence', () => {
    setStatus({ kind: 'queued', edgeId: 'rf-edge-1' })
    const { rerender } = renderStatus()

    const live = screen.getByTestId('edge-strength-sync-status')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    expect(live).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Change ready to save')).toBeVisible()
    expect(screen.queryByText(/saved to the shared model/i)).not.toBeInTheDocument()

    setStatus({ kind: 'saving', edgeId: 'rf-edge-1' })
    rerender(<EdgeStrengthSyncStatus key="saving" scenarioId="scenario-1" from="fac_a" to="goal_b" />)
    expect(screen.getByText('Saving relationship…')).toBeVisible()
  })

  it.each([
    [{ kind: 'saved', edgeId: 'rf-edge-1', at: 1 } as const, 'Relationship saved to the shared model'],
    [{ kind: 'confirmed', edgeId: 'rf-edge-1', at: 1 } as const, 'Shared value confirmed'],
  ])('uses receipt-specific success copy for $expected', (status, expected) => {
    setStatus(status)
    renderStatus()

    expect(screen.getByText(expected)).toBeVisible()
    expect(screen.getByTestId('edge-strength-sync-status')).not.toHaveAttribute('role', 'alert')
  })

  it('retains dissent on 409 and offers explicit, keyboard-native choices', async () => {
    setStatus({ kind: 'conflict', recovery })
    renderStatus()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Shared value: −0.50; your change: −0.70')
    expect(alert).not.toHaveTextContent(/saved to the shared model/i)

    fireEvent.click(screen.getByRole('button', { name: 'Apply my change' }))
    expect(coordinatorMocks.applyMine).toHaveBeenCalledWith('scenario-1', 'fac_a', 'goal_b')

    fireEvent.click(screen.getByRole('button', { name: 'Use shared value' }))
    await waitFor(() => expect(coordinatorMocks.useShared).toHaveBeenCalledWith(
      'scenario-1',
      'fac_a',
      'goal_b',
    ))
  })

  it('keeps ambiguous delivery blocked behind an explicit read/restore recovery', async () => {
    setStatus({
      kind: 'unconfirmed',
      recovery: { ...recovery, cause: 'unconfirmed', sharedCurrent: undefined },
    })
    renderStatus()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not confirm whether your −0.70 change was saved',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Check shared model' }))
    await waitFor(() => expect(coordinatorMocks.refresh).toHaveBeenCalledWith('scenario-1'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore shared model' })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Restore shared model' }))
    await waitFor(() => expect(coordinatorMocks.refresh).toHaveBeenCalledWith(
      'scenario-1',
      { replaceLocalGraph: true },
    ))
  })
})
