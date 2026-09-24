/**
 * ⭐ THE DRIVERS CHART'S VALUE EDITOR OPENS HOLDING THE CURRENT NUMBER — the
 * same fix #1955 made for the model strip, found by that PR's reviewer
 * (5820138122): `DriverInfluenceChart` shares `useFactorValueCommit`, the same
 * write authority, but still opened empty, so the reader had to recall a value
 * to change it. It seeds from `resolveValueInputSeed`, the reading the commit
 * itself uses, and typing replaces the seed.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const proposeFactorValue = vi.fn(() => 'dispatched')
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeFactorValue, proposeOptionIntervention: vi.fn(), proposeFactorConfirmation: vi.fn() }),
}))

import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import { useCanvasStore } from '../../../../canvas/store'
import type { DriverInfluenceRow } from '../analysisNewTypes'

const TID = 'chart'
const row = (id: string): DriverInfluenceRow => ({ id, label: id, fraction: 0.5, direction: 'positive', targetId: id })

let previous: unknown
beforeEach(() => {
  previous = useCanvasStore.getState().nodes
  useCanvasStore.setState({
    nodes: [
      { id: 'f_raw', type: 'factor', data: { label: 'Licensing', observedState: { value: 0.49, raw_value: 49, unit: '£' } } },
      { id: 'f_model', type: 'factor', data: { label: 'Adoption', observedState: { value: 0.7 } } },
      { id: 'f_bare', type: 'factor', data: { label: 'Pressure' } },
    ],
  } as never)
  proposeFactorValue.mockReset().mockReturnValue('dispatched')
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous } as never)
})

const openEditor = async (id: string) => {
  const user = userEvent.setup()
  render(<DriverInfluenceChart rows={[row('f_raw'), row('f_model'), row('f_bare')]} onCommitOutcome={vi.fn()} testId={TID} />)
  const li = screen.getAllByTestId(`${TID}-row`).find((el) => el.getAttribute('data-node-id') === id)!
  await user.click(li.querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
  return { user, input: screen.getByTestId(`${TID}-input`) as HTMLInputElement }
}

describe('the drivers chart value editor', () => {
  it('a factor with a user-unit magnitude opens with it (49 for £49)', async () => {
    expect((await openEditor('f_raw')).input.value).toBe('49')
  })

  it('a factor with only a model-scale value opens with that value', async () => {
    expect((await openEditor('f_model')).input.value).toBe('0.7')
  })

  it('CONTRAST: a factor with no number opens empty', async () => {
    expect((await openEditor('f_bare')).input.value).toBe('')
  })

  it('typing replaces the seed, and the untouched seed saves as the same number', async () => {
    const { user, input } = await openEditor('f_raw')
    await user.keyboard('72{Enter}')
    expect(proposeFactorValue).toHaveBeenCalledWith(72)
    expect(input).toBeDefined()
  })
})
