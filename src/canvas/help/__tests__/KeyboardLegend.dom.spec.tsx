import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KeyboardLegend, useKeyboardLegend } from '../KeyboardLegend'

const STORAGE_KEY = 'olumi_keys_seen'

function HookHarness({ autoShow = true }: { autoShow?: boolean }) {
  const { isOpen, close, open, toggle } = useKeyboardLegend({ autoShow })
  return (
    <div>
      <div data-testid="legend-open">{isOpen ? 'true' : 'false'}</div>
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

  afterEach(() => {
    localStorage.clear()
  })

  describe('component rendering', () => {
    it('does not render when closed', () => {
      render(<KeyboardLegend isOpen={false} onClose={() => {}} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders headings and shortcuts when open', () => {
      render(<KeyboardLegend isOpen={true} onClose={() => {}} />)
      expect(screen.getByRole('dialog', { name: /keyboard legend/i })).toBeInTheDocument()
      expect(screen.getByText('Navigate and inspect')).toBeInTheDocument()
      expect(screen.getByText('Workspace')).toBeInTheDocument()
      expect(screen.getByText('Run and analyse')).toBeInTheDocument()
      expect(screen.getByText('Cmd/Ctrl + Enter')).toBeInTheDocument()
      expect(screen.queryByText('Weights and belief sliders')).not.toBeInTheDocument()
      expect(screen.queryByText('Toggle quick-add mode')).not.toBeInTheDocument()
    })

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn()
      render(<KeyboardLegend isOpen={true} onClose={onClose} />)
      fireEvent.click(screen.getByLabelText('Close keyboard legend'))
      expect(onClose).toHaveBeenCalled()
    })

    it('closes when backdrop clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardLegend isOpen={true} onClose={onClose} />)
      fireEvent.click(container.firstChild as HTMLElement)
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('useKeyboardLegend hook', () => {
    it('auto-opens on first run when not seen', () => {
      render(<HookHarness autoShow={true} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('true')
    })

    it('respects persisted seen flag (remains closed)', () => {
      localStorage.setItem(STORAGE_KEY, 'v1')
      render(<HookHarness autoShow={true} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })

    it('marks as seen when opened manually', () => {
      render(<HookHarness autoShow={false} />)
      fireEvent.click(screen.getByText('open'))
      expect(localStorage.getItem(STORAGE_KEY)).toBe('v1')
    })

    it('toggles with ? key', () => {
      render(<HookHarness autoShow={false} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
      act(() => {
        fireEvent.keyDown(window, { key: '?' })
      })
      expect(screen.getByTestId('legend-open')).toHaveTextContent('true')
      act(() => {
        fireEvent.keyDown(window, { key: '?' })
      })
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })

    it('ignores ? presses inside inputs', () => {
      render(
        <div>
          <input data-testid="editor" />
          <HookHarness autoShow={false} />
        </div>
      )
      const input = screen.getByTestId('editor')
      input.focus()
      fireEvent.keyDown(input, { key: '?' })
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })

    it('closes with Escape key', () => {
      render(<HookHarness autoShow={true} />)
      expect(screen.getByTestId('legend-open')).toHaveTextContent('true')
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' })
      })
      expect(screen.getByTestId('legend-open')).toHaveTextContent('false')
    })
  })
})

describe('KeyboardLegend advertises only shortcuts that have a live handler', () => {
  // Derived at staging a7e119ef: the ONLY `(metaKey||ctrlKey) && key === 'k'` handler in src/
  // lives in canvas/palette/usePalette.ts, whose sole non-test importer is
  // canvas/palette/CommandPalette.tsx -- a twin with zero non-test importers. The MOUNTED
  // palette (canvas/components/CommandPalette.tsx, ReactFlowGraph.tsx:48) cannot be opened:
  // setShowCommandPalette is referenced exactly twice and never set true. The live canvas
  // shortcut hook (useCanvasKeyboardShortcuts.ts) binds no 'k'.
  it('does not advertise Cmd/Ctrl + K, which no live handler implements', () => {
    render(<KeyboardLegend isOpen={true} onClose={() => {}} />)

    // Positive control, same render: Cmd/Ctrl + D IS advertised and IS live
    // (useCanvasKeyboardShortcuts.ts). Without this the absence assertions
    // below would also pass on an empty or non-rendering legend.
    //
    // ⚠ The description was "Toggle Documents drawer" until 29 Aug 2026. That
    // wording was itself a small lie -- `showDocuments` in ReactFlowGraph only
    // ever calls setShowDocumentsDrawer(true), so the second press does
    // nothing -- and it is now "Open Documents drawer".
    expect(screen.getByText('Cmd/Ctrl + D')).toBeInTheDocument()
    expect(screen.getByText('Open Documents drawer')).toBeInTheDocument()

    expect(screen.queryByText('Cmd/Ctrl + K')).not.toBeInTheDocument()
    expect(screen.queryByText('Jump to global search or command palette')).not.toBeInTheDocument()
  })
})
