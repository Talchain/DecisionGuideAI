// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderWithSandboxBoard } from './testUtils'
import { screen, fireEvent, act } from '@testing-library/react'

const decisionId = 'rival-x'

describe('Rival edit indicator and telemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => { vi.useRealTimers() })

  it('flags cross-client collision, shows chip, clears on next recompute, single telemetry', async () => {
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) }, model_segment_changed: () => {} }))
    // Keep flags stable for test determinism
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return {
        ...actual,
        isScenarioSnapshotsEnabled: () => false,
        isOptionHandlesEnabled: () => false,
        isSandboxRealtimeEnabled: () => true,
      }
    })
    // Stub heavy UI deps to reduce memory/CPU
    vi.doMock('lucide-react', () => ({
      HelpCircle: () => null,
      Save: () => null,
      Undo2: () => null,
      Pointer: () => null,
      Square: () => null,
      Type: () => null,
      MessageSquareText: () => null,
      MoreVertical: () => null,
      Play: () => null,
      RotateCcw: () => null,
    }))
    vi.doMock('@/sandbox/lib/projection', () => ({ buildProjection: () => ({ expectedValue: 0, normalized: [] }) }))

    const { setPendingOps, reapply, getCollisions, clearCollisions, getLastClearedVersion, markClearedVersion } = await import('@/sandbox/state/reapply')
    const { subscribeRecompute, notifyRecompute } = await import('@/sandbox/state/recompute')

    // Lightweight harness that mirrors the rival chip behavior
    const RivalChipHarness: React.FC<{ did: string; rowId: string }> = ({ did, rowId }) => {
      const [panel, setPanel] = React.useState<'probabilities' | 'options'>('probabilities')
      const [collisions, setCollisions] = React.useState<Array<{ id: string; field: string }>>(() => getCollisions(did) as any)
      React.useEffect(() => {
        const unsub = subscribeRecompute(did, (s) => {
          const last = getLastClearedVersion(did)
          if (typeof s.version === 'number' && s.version > last) {
            clearCollisions(did)
            markClearedVersion(did, s.version)
            setCollisions([])
          }
        })
        const onReapply = (ev: any) => { if (ev?.detail?.decisionId === did) setCollisions(getCollisions(did) as any) }
        window.addEventListener('sandbox:reapply-done', onReapply as any)
        return () => { unsub(); window.removeEventListener('sandbox:reapply-done', onReapply as any) }
      }, [did])
      return (
        <div>
          <div role="radiogroup" aria-label="Model view">
            <button role="radio" aria-checked={panel === 'probabilities'} onClick={() => setPanel('probabilities')}>Probabilities</button>
          </div>
          {panel === 'probabilities' && (
            <div>
              <input aria-label={`Probability Value ${rowId}`} type="number" defaultValue={0.5} />
              {collisions.some(c => c.id === rowId && (c.field === 'prob' || c.field === 'value' || c.field === 'probability')) && (
                <span data-testid={`rival-${rowId}`}>edit collision</span>
              )}
            </div>
          )}
        </div>
      )
    }

    const { rerender } = renderWithSandboxBoard(<RivalChipHarness did={decisionId} rowId="p1" />)

    // Switch to Probabilities panel so spinbuttons exist
    const probRadio = screen.getByRole('radio', { name: 'Probabilities' })
    fireEvent.click(probRadio)

    // Extract a probability row id from an input aria-label
    const inputs = screen.getAllByRole('spinbutton')
    const target = inputs.find(el => (el.getAttribute('aria-label') || '').startsWith('Probability Value ')) as HTMLInputElement
    expect(target).toBeTruthy()
    const label = target.getAttribute('aria-label')!
    const id = label.replace('Probability Value ', '')

    // Two clients edit same field within window
    setPendingOps(decisionId, [
      { ts: 1, clientId: 'clientA', seq: 0, type: 'update', payload: { id, field: 'probability', value: 0.4 } },
      { ts: 2, clientId: 'clientB', seq: 0, type: 'update', payload: { id, field: 'probability', value: 0.7 } },
    ])
    await act(async () => { reapply(decisionId) })
    await vi.advanceTimersByTimeAsync(1)

    // Remount to pick up collisions via getCollisions on mount
    await act(async () => { rerender(<RivalChipHarness did={decisionId} rowId={id} />) })

    // Chip visible next to that row
    const chip = screen.getByTestId(`rival-${id}`)
    expect(chip).toBeTruthy()

    // Telemetry once with details
    const rival = calls.find(c => c.event === 'sandbox_rival_edit')
    expect(rival).toBeTruthy()
    expect(rival!.props).toHaveProperty('count', 1)
    const arr = (rival!.props as any).collisions as Array<any>
    expect(Array.isArray(arr)).toBe(true)
    expect(arr[0]).toMatchObject({ nodeId: id, field: 'probability', prev: 0.4, next: 0.7, winnerClientId: 'clientB' })

    // Next accepted recompute clears the chip
    await act(async () => { notifyRecompute(decisionId, 'prob_edit', [{ id, p: 0.7, c: 1 }], Date.now()) })
    // Allow microtasks
    await vi.advanceTimersByTimeAsync(1)

    const gone = screen.queryByTestId(`rival-${id}`)
    expect(gone).toBeNull()

    // No second telemetry
    const second = calls.filter(c => c.event === 'sandbox_rival_edit')
    expect(second.length).toBe(1)
  })
})
