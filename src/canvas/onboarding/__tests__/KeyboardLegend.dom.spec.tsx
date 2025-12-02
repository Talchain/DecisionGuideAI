import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { KeyboardLegend, useKeyboardLegend } from '../../help/KeyboardLegend'

const STORAGE_KEY = 'olumi_keys_seen'

function Harness({ autoShow = true }: { autoShow?: boolean }) {
  const { isOpen, open, close, toggle } = useKeyboardLegend({ autoShow })
  return (
    <div>
      <div data-testid="legend-open">{String(isOpen)}</div>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
      <button onClick={() => toggle()}>toggle</button>
      <KeyboardLegend isOpen={isOpen} onClose={close} />
    </div>
  )
}

describe('KeyboardLegend', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('component rendering', () => {
    it('is hidden when closed', () => {
      render(<KeyboardLegend isOpen={false} onClose={() => {}} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders headings + shortcuts when open', () => {
      render(<KeyboardLegend isOpen={true} onClose={() => {}} />)
      expect(screen.getByRole('dialog', { name: /keyboard legend/i })).toBeInTheDocument()
      expect(screen.getByText('Graph Operations')).toBeInTheDocument()
      expect(screen.getByText('Run and analyse')).toBeInTheDocument()
      expect(screen.getByText('Weights and belief sliders')).toBeInTheDocument()
      expect(screen.getByText('Cmd/Ctrl + Enter')).toBeInTheDocument()
    })

    it('invokes onClose via close button + backdrop', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardLegend isOpen={true} onClose={onClose} />)
      fireEvent.click(screen.getByLabelText('Close keyboard legend'))
      expect(onClose).toHaveBeenCalledTimes(1)
      fireEvent.click(container.firstChild as HTMLElement)
      expect(onClose).toHaveBeenCalledTimes(2)
    })
  })

  describe('useKeyboardLegend hook', () => {
    it('auto-opens first run when not seen', () => {
      render(<Harness autoShow={true} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('true')
    })

    it('stays closed when localStorage marks as seen', () => {
      localStorage.setItem(STORAGE_KEY, 'v1')
      render(<Harness autoShow={true} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })

    it('persists seen flag when opened manually', () => {
      render(<Harness autoShow={false} />)
      fireEvent.click(screen.getByText('open'))
      expect(localStorage.getItem(STORAGE_KEY)).toBe('v1')
    })

    it('toggles with ? and closes with Escape', () => {
      render(<Harness autoShow={false} />)
      act(() => fireEvent.keyDown(window, { key: '?' }))
      expect(screen.getByTestId('legend-open')).toHaveTextContent('true')
      act(() => fireEvent.keyDown(window, { key: '?' }))
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
      act(() => fireEvent.keyDown(window, { key: 'Escape' }))
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })

    it('ignores ? key within editable fields', () => {
      render(
        <div>
          <input data-testid="editor" />
          <Harness autoShow={false} />
        </div>
      )
      const editor = screen.getByTestId('editor')
      editor.focus()
      fireEvent.keyDown(editor, { key: '?' })
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })
  })

  describe('localStorage handling', () => {
    it('handles failures when loading seen flag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const original = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage blocked')
      }) as typeof localStorage.getItem
      render(<Harness autoShow={true} />)
      // Should degrade gracefully and not crash
      expect(screen.getByTestId('legend-open')).toBeInTheDocument()
      localStorage.getItem = original
      warn.mockRestore()
    })

    it('marks as seen when hook close() is called', () => {
      render(<Harness autoShow={false} />)
      fireEvent.click(screen.getByText('close'))
      expect(localStorage.getItem(STORAGE_KEY)).toBe('v1')
    })
  })

  describe('presentation details', () => {
    it('centres overlay via flex helpers', () => {
      render(<KeyboardLegend isOpen={true} onClose={() => {}} />)
      const dialog = screen.getByRole('dialog', { name: /keyboard legend/i }) as HTMLElement
      expect(dialog).toHaveClass('flex', 'items-center', 'justify-center')
    })

    it('uses transition-colors utility on close button', () => {
      render(<KeyboardLegend isOpen={true} onClose={() => {}} />)
      expect(screen.getByLabelText('Close keyboard legend')).toHaveClass('transition-colors')
    })
  })
})
