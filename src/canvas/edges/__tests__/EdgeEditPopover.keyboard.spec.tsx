/**
 * EdgeEditPopover — keyboard interaction contract.
 *
 * Arrow keys adjust only the local strength preview. The shared-model write
 * happens once, on an explicit Enter commit; Escape discards the preview.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EdgeEditPopover } from '../EdgeEditPopover'

describe('EdgeEditPopover keyboard navigation', () => {
  const onUpdate = vi.fn()
  const onClose = vi.fn()

  const renderPopover = (weight = 0.5) => render(
    <EdgeEditPopover
      edge={{ id: 'edge-1', data: { weight, belief: 0.9 } }}
      position={{ x: 100, y: 100 }}
      onUpdate={onUpdate}
      onClose={onClose}
    />,
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['ArrowUp', '0.51'],
    ['ArrowRight', '0.51'],
    ['ArrowDown', '0.49'],
    ['ArrowLeft', '0.49'],
  ])('adjusts the local preview by 0.01 for %s', (key, expected) => {
    renderPopover()
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key })

    expect(slider).toHaveValue(expected)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it.each([
    ['ArrowUp', '0.55'],
    ['ArrowRight', '0.55'],
    ['ArrowDown', '0.45'],
    ['ArrowLeft', '0.45'],
  ])('adjusts the local preview by 0.05 for Shift+%s', (key, expected) => {
    renderPopover()
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key, shiftKey: true })

    expect(slider).toHaveValue(expected)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('clamps repeated keyboard increments at 1', () => {
    renderPopover(0.98)
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })

    expect(slider).toHaveValue('1')
  })

  it('clamps repeated keyboard decrements at 0', () => {
    renderPopover(0.02)
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    fireEvent.keyDown(slider, { key: 'ArrowDown' })

    expect(slider).toHaveValue('0')
  })

  it('commits the final keyboard preview exactly once on Enter', () => {
    renderPopover()
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true })
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.keyDown(slider, { key: 'Enter' })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.56 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('discards the final keyboard preview on Escape', () => {
    renderPopover()
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(slider, { key: 'Escape' })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated keys', () => {
    renderPopover()
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.keyDown(slider, { key: 'PageUp' })

    expect(slider).toHaveValue('0.5')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not expose or mutate the unsupported legacy belief field', () => {
    renderPopover()

    expect(screen.queryByLabelText(/belief/i)).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
