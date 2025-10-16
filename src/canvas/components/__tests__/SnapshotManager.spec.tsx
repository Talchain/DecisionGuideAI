import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SnapshotManager } from '../SnapshotManager'
import { ToastProvider } from '../../ToastContext'
import * as persist from '../../persist'
import * as store from '../../store'

// Mock modules
vi.mock('../../persist')
vi.mock('../../store')

describe('SnapshotManager', () => {
  const mockOnClose = vi.fn()
  
  const renderWithToast = (component: React.ReactElement) => {
    return render(<ToastProvider>{component}</ToastProvider>)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock store
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [{ id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    } as any)
    
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null)
    Storage.prototype.setItem = vi.fn()
    Storage.prototype.removeItem = vi.fn()
  })
  
  afterEach(() => {
    cleanup()
  })

  it('renders when open', () => {
    vi.mocked(persist.listSnapshots).mockReturnValue([])
    
    const { container } = renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText('Snapshot Manager')).toBeTruthy()
    expect(screen.getByText('💾 Save Current Canvas')).toBeTruthy()
    expect(container.querySelector('[aria-label="Close snapshot manager"]')).toBeTruthy()
  })

  it('does not render when closed', () => {
    const { container } = renderWithToast(<SnapshotManager isOpen={false} onClose={mockOnClose} />)
    expect(container.firstChild).toBeNull()
  })

  it('displays empty state when no snapshots', () => {
    vi.mocked(persist.listSnapshots).mockReturnValue([])
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText('No snapshots yet')).toBeTruthy()
    expect(screen.getByText(/Save your current canvas/)).toBeTruthy()
  })

  it('lists existing snapshots with metadata', () => {
    const mockSnapshots = [
      { key: 'snap-1', timestamp: 1697500000000, size: 1024 }
    ]
    
    vi.mocked(persist.listSnapshots).mockReturnValue(mockSnapshots)
    vi.mocked(persist.loadSnapshot).mockReturnValue({
      version: 1,
      timestamp: 1697500000000,
      nodes: [{ id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
      edges: []
    })
    
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'snap-1-name') return 'My Snapshot'
      return null
    })
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText('My Snapshot')).toBeTruthy()
    expect(screen.getByText(/1 nodes, 0 edges/)).toBeTruthy()
    expect(screen.getByText('Restore')).toBeTruthy()
  })

  it('saves new snapshot successfully', () => {
    vi.mocked(persist.listSnapshots).mockReturnValue([])
    vi.mocked(persist.saveSnapshot).mockReturnValue(true)
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    const saveButton = screen.getByText('💾 Save Current Canvas')
    fireEvent.click(saveButton)
    
    expect(persist.saveSnapshot).toHaveBeenCalledWith({
      nodes: expect.any(Array),
      edges: expect.any(Array)
    })
  })

  it('shows alert when canvas exceeds 5MB', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Mock very large canvas
    const largeLabel = 'x'.repeat(1000)
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: Array(10000).fill({ id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: largeLabel } }),
      edges: []
    } as any)
    
    vi.mocked(persist.listSnapshots).mockReturnValue([])
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    const saveButton = screen.getByText('💾 Save Current Canvas')
    fireEvent.click(saveButton)
    
    expect(alertSpy).toHaveBeenCalled()
    expect(alertSpy.mock.calls[0][0]).toContain('>5MB')
    
    alertSpy.mockRestore()
  })

  it('deletes snapshot after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    const mockSnapshots = [
      { key: 'snap-1', timestamp: 1697500000000, size: 1024 }
    ]
    
    vi.mocked(persist.listSnapshots).mockReturnValue(mockSnapshots)
    vi.mocked(persist.loadSnapshot).mockReturnValue({
      version: 1,
      timestamp: 1697500000000,
      nodes: [],
      edges: []
    })
    vi.mocked(persist.deleteSnapshot).mockImplementation(() => {})
    
    Storage.prototype.getItem = vi.fn(() => 'Test Snapshot')
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)
    
    expect(confirmSpy).toHaveBeenCalled()
    expect(persist.deleteSnapshot).toHaveBeenCalledWith('snap-1')
    
    confirmSpy.mockRestore()
  })

  it('shows snapshot count indicator', () => {
    const mockSnapshots = [
      { key: 'snap-1', timestamp: 1697500000000, size: 1024 },
      { key: 'snap-2', timestamp: 1697500000001, size: 2048 }
    ]
    
    vi.mocked(persist.listSnapshots).mockReturnValue(mockSnapshots)
    vi.mocked(persist.loadSnapshot).mockReturnValue({
      version: 1,
      timestamp: 1697500000000,
      nodes: [],
      edges: []
    })
    
    Storage.prototype.getItem = vi.fn(() => 'Test')
    
    renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText(/2\/10 snapshots/)).toBeTruthy()
  })

  it('closes on close button click', () => {
    vi.mocked(persist.listSnapshots).mockReturnValue([])
    
    const { container } = renderWithToast(<SnapshotManager isOpen={true} onClose={mockOnClose} />)
    
    const closeButton = container.querySelector('[aria-label="Close snapshot manager"]')
    if (closeButton) {
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalled()
    }
  })
})
