import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerProvider, useLayer, Z_INDEX } from '../../../src/canvas/components/LayerProvider'

function DialogTest() {
  const { layers, pushLayer, closeTopmost, getZIndex } = useLayer()

  return (
    <div>
      <div data-testid="dialog-count">{layers.filter(l => l.type === 'dialog').length}</div>
      <div data-testid="dialog-zindex">{getZIndex('dialog')}</div>
      <button
        onClick={() => pushLayer({ id: 'd1', type: 'dialog', onClose: () => {} })}
        data-testid="open-first"
      >
        Open first
      </button>
      <button
        onClick={() => pushLayer({ id: 'd2', type: 'dialog', onClose: () => {} })}
        data-testid="open-second"
      >
        Open second
      </button>
      <button onClick={closeTopmost} data-testid="close-topmost">Close topmost</button>
    </div>
  )
}

describe('LayerProvider (z-index)', () => {
  it('dialog getZIndex matches Z_INDEX.DIALOG', () => {
    render(
      <LayerProvider>
        <DialogTest />
      </LayerProvider>,
    )
    const el = screen.getByTestId('dialog-zindex')
    expect(el.textContent).toBe(String(Z_INDEX.DIALOG))
  })

  it('opening a second dialog keeps only one non-toast layer', () => {
    render(
      <LayerProvider>
        <DialogTest />
      </LayerProvider>,
    )

    fireEvent.click(screen.getByTestId('open-first'))
    expect(screen.getByTestId('dialog-count').textContent).toBe('1')

    fireEvent.click(screen.getByTestId('open-second'))
    // Second dialog should replace the first (mutual exclusivity)
    expect(screen.getByTestId('dialog-count').textContent).toBe('1')
  })

  it('closes topmost dialog on Escape', () => {
    render(
      <LayerProvider>
        <DialogTest />
      </LayerProvider>,
    )

    fireEvent.click(screen.getByTestId('open-first'))
    expect(screen.getByTestId('dialog-count')).toHaveTextContent('1')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('dialog-count').textContent).toBe('0')
  })
})
