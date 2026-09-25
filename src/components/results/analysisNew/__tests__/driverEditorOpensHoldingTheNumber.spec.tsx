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

  // Mirrors modelStripFactorValueEdit.spec.tsx's fourth case (#1955).
  it('saving the untouched seed proposes the same number back', async () => {
    const { user } = await openEditor('f_raw')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(proposeFactorValue).toHaveBeenCalledWith(49)
  })

  /**
   * The select-on-focus half of the fix, on its own. With the seed but no
   * selection, typing appends ("4972"); with neither, the field is empty and
   * this passes vacuously, so the PRECONDITION pins that the seed is there
   * before a key is pressed. `type="text"` supports `select()` in every
   * engine (unlike `type="number"`), and jsdom implements it.
   */
  it('typing replaces the seed rather than appending to it', async () => {
    const { user, input } = await openEditor('f_raw')
    expect(input.value, 'PRECONDITION: the field opened holding the seed').toBe('49')
    expect([input.selectionStart, input.selectionEnd], 'the seed is selected on open').toEqual([0, 2])
    await user.keyboard('72{Enter}')
    expect(proposeFactorValue).toHaveBeenCalledWith(72)
    expect(proposeFactorValue).not.toHaveBeenCalledWith(4972)
  })
})
