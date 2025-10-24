/**
 * LayerProvider tests
 * Tests z-index management, mutual exclusivity, and Esc key handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LayerProvider, useLayer, useLayerRegistration, Z_INDEX } from '../LayerProvider'
import { useState } from 'react'

// Test component that uses the layer context
function TestConsumer() {
  const { layers, pushLayer, popLayer, closeTopmost, getZIndex } = useLayer()

  return (
    <div>
      <div data-testid="layer-count">{layers.length}</div>
      <div data-testid="layers">
        {layers.map(l => (
          <div key={l.id} data-testid={`layer-${l.id}`} data-type={l.type} data-zindex={l.zIndex}>
            {l.id}
          </div>
        ))}
      </div>

      <button
        onClick={() => pushLayer({ id: 'panel-1', type: 'panel', onClose: () => {} })}
        data-testid="add-panel"
      >
        Add Panel
      </button>

      <button
        onClick={() => pushLayer({ id: 'dialog-1', type: 'dialog', onClose: () => {} })}
        data-testid="add-dialog"
      >
        Add Dialog
      </button>

      <button
        onClick={() => pushLayer({ id: 'toast-1', type: 'toast' })}
        data-testid="add-toast"
      >
        Add Toast
      </button>

      <button onClick={() => popLayer('panel-1')} data-testid="remove-panel">
        Remove Panel
      </button>

      <button onClick={closeTopmost} data-testid="close-topmost">
        Close Topmost
      </button>

      <div data-testid="panel-zindex">{getZIndex('panel')}</div>
      <div data-testid="dialog-zindex">{getZIndex('dialog')}</div>
      <div data-testid="toast-zindex">{getZIndex('toast')}</div>
    </div>
  )
}

// Test component for useLayerRegistration hook
function TestLayerComponent({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useLayerRegistration('test-layer', 'panel', isOpen, onClose)

  return (
    <div data-testid="test-component">
      {isOpen ? 'Open' : 'Closed'}
    </div>
  )
}

describe('LayerProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any event listeners
    window.removeEventListener('keydown', () => {})
  })

  it('provides layer context to children', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    expect(screen.getByTestId('layer-count')).toHaveTextContent('0')
  })

  it('returns correct z-index values for each layer type', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    expect(screen.getByTestId('panel-zindex')).toHaveTextContent(String(Z_INDEX.PANEL))
    expect(screen.getByTestId('dialog-zindex')).toHaveTextContent(String(Z_INDEX.DIALOG))
    expect(screen.getByTestId('toast-zindex')).toHaveTextContent(String(Z_INDEX.TOAST))
  })

  it('adds layers to the stack', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    fireEvent.click(screen.getByTestId('add-panel'))

    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')
    expect(screen.getByTestId('layer-panel-1')).toBeInTheDocument()
  })

  it('removes layers from the stack', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    fireEvent.click(screen.getByTestId('add-panel'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('remove-panel'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('0')
  })

  it('maintains mutual exclusivity - opening dialog closes existing panel', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    // Add panel
    fireEvent.click(screen.getByTestId('add-panel'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    // Add dialog (should close panel)
    fireEvent.click(screen.getByTestId('add-dialog'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    // Only dialog should remain
    expect(screen.queryByTestId('layer-panel-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('layer-dialog-1')).toBeInTheDocument()
  })

  it('allows toasts to coexist with other layers', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    // Add panel
    fireEvent.click(screen.getByTestId('add-panel'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    // Add toast (should not close panel)
    fireEvent.click(screen.getByTestId('add-toast'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('2')

    // Both should be present
    expect(screen.getByTestId('layer-panel-1')).toBeInTheDocument()
    expect(screen.getByTestId('layer-toast-1')).toBeInTheDocument()
  })

  it('assigns correct z-index to layers', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    fireEvent.click(screen.getByTestId('add-panel'))
    fireEvent.click(screen.getByTestId('add-toast'))

    const panel = screen.getByTestId('layer-panel-1')
    const toast = screen.getByTestId('layer-toast-1')

    expect(panel).toHaveAttribute('data-zindex', String(Z_INDEX.PANEL))
    expect(toast).toHaveAttribute('data-zindex', String(Z_INDEX.TOAST))
  })

  it('closes topmost layer on Esc key', () => {
    const { container } = render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    // Add a panel
    fireEvent.click(screen.getByTestId('add-panel'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    // Panel should be closed
    waitFor(() => {
      expect(screen.getByTestId('layer-count')).toHaveTextContent('0')
    })
  })

  it('does not close toasts when pressing Esc', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    // Add toast only
    fireEvent.click(screen.getByTestId('add-toast'))
    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    // Press Escape (should not close toast)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')
    expect(screen.getByTestId('layer-toast-1')).toBeInTheDocument()
  })

  it('calls onClose callback when closing layer', () => {
    const onClose = vi.fn()

    function TestComponent() {
      const { pushLayer, closeTopmost } = useLayer()

      return (
        <>
          <button
            onClick={() => pushLayer({ id: 'test', type: 'panel', onClose })}
            data-testid="add"
          >
            Add
          </button>
          <button onClick={closeTopmost} data-testid="close">
            Close
          </button>
        </>
      )
    }

    render(
      <LayerProvider>
        <TestComponent />
      </LayerProvider>
    )

    fireEvent.click(screen.getByTestId('add'))
    fireEvent.click(screen.getByTestId('close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns focus to invoker element after closing layer', async () => {
    const onClose = vi.fn()

    function TestComponent() {
      const { pushLayer, popLayer } = useLayer()
      const [layerId, setLayerId] = useState<string | null>(null)

      return (
        <div>
          <button
            data-testid="invoker"
            onClick={() => {
              const id = pushLayer({ id: 'test', type: 'panel', onClose })
              setLayerId(id)
            }}
          >
            Open
          </button>
          <button
            data-testid="close-btn"
            onClick={() => layerId && popLayer(layerId)}
          >
            Close
          </button>
        </div>
      )
    }

    render(
      <LayerProvider>
        <TestComponent />
      </LayerProvider>
    )

    const invoker = screen.getByTestId('invoker')
    invoker.focus()

    // Open layer (focus shifts away from invoker)
    fireEvent.click(invoker)

    // Close layer
    fireEvent.click(screen.getByTestId('close-btn'))

    // Focus should return to invoker
    await waitFor(() => {
      expect(document.activeElement).toBe(invoker)
    })
  })
})

describe('useLayerRegistration', () => {
  it('registers layer when isOpen is true', () => {
    const onClose = vi.fn()

    function TestWrapper() {
      const [isOpen, setIsOpen] = useState(false)
      return (
        <LayerProvider>
          <TestLayerComponent isOpen={isOpen} onClose={onClose} />
          <button onClick={() => setIsOpen(true)} data-testid="open">
            Open
          </button>
          <TestConsumer />
        </LayerProvider>
      )
    }

    render(<TestWrapper />)

    expect(screen.getByTestId('layer-count')).toHaveTextContent('0')

    fireEvent.click(screen.getByTestId('open'))

    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')
  })

  it('unregisters layer when isOpen becomes false', () => {
    const onClose = vi.fn()

    function TestWrapper() {
      const [isOpen, setIsOpen] = useState(true)
      return (
        <LayerProvider>
          <TestLayerComponent isOpen={isOpen} onClose={onClose} />
          <button onClick={() => setIsOpen(false)} data-testid="close">
            Close
          </button>
          <TestConsumer />
        </LayerProvider>
      )
    }

    render(<TestWrapper />)

    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('close'))

    expect(screen.getByTestId('layer-count')).toHaveTextContent('0')
  })

  it('unregisters layer on unmount', () => {
    const onClose = vi.fn()

    function TestWrapper() {
      const [show, setShow] = useState(true)
      return (
        <LayerProvider>
          {show && <TestLayerComponent isOpen={true} onClose={onClose} />}
          <button onClick={() => setShow(false)} data-testid="unmount">
            Unmount
          </button>
          <TestConsumer />
        </LayerProvider>
      )
    }

    render(<TestWrapper />)

    expect(screen.getByTestId('layer-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('unmount'))

    expect(screen.getByTestId('layer-count')).toHaveTextContent('0')
  })
})

describe('LayerProvider z-index hierarchy', () => {
  it('maintains correct z-index ordering', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    // Verify hierarchy
    const panelZ = parseInt(screen.getByTestId('panel-zindex').textContent || '0')
    const dialogZ = parseInt(screen.getByTestId('dialog-zindex').textContent || '0')
    const toastZ = parseInt(screen.getByTestId('toast-zindex').textContent || '0')

    expect(toastZ).toBeGreaterThan(dialogZ)
    expect(dialogZ).toBeGreaterThan(panelZ)
  })

  it('matches defined Z_INDEX constants', () => {
    render(
      <LayerProvider>
        <TestConsumer />
      </LayerProvider>
    )

    expect(screen.getByTestId('panel-zindex')).toHaveTextContent(String(Z_INDEX.PANEL))
    expect(screen.getByTestId('dialog-zindex')).toHaveTextContent(String(Z_INDEX.DIALOG))
    expect(screen.getByTestId('toast-zindex')).toHaveTextContent(String(Z_INDEX.TOAST))

    // Verify constants are in correct order
    expect(Z_INDEX.TOAST).toBe(9000)
    expect(Z_INDEX.DIALOG).toBe(5000)
    expect(Z_INDEX.PANEL).toBe(2000)
    expect(Z_INDEX.TOOLBAR).toBe(1000)
    expect(Z_INDEX.BADGE).toBe(50)
  })
})
