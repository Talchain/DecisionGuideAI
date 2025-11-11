/**
 * Unit tests for InspectorPanel
 * Tests edge metadata editing, validation, and UX behaviors
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InspectorPanel } from '../../../src/canvas/panels/InspectorPanel'
import { useCanvasStore } from '../../../src/canvas/store'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../../../src/canvas/domain/edges'

// Mock zustand store
vi.mock('../../../src/canvas/store', () => ({
  useCanvasStore: vi.fn()
}))

const mockUseCanvasStore = vi.mocked(useCanvasStore)

describe('InspectorPanel', () => {
  const mockUpdateEdge = vi.fn()
  const mockEdge: Edge<EdgeData> = {
    id: 'e1',
    source: 'node1',
    target: 'node2',
    label: '50%',
    data: {
      weight: 1.0,
      belief: 0.5,
      provenance: 'Test source',
      style: 'solid',
      curvature: 0.15,
      kind: 'decision-probability',
      schemaVersion: 3
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default store state with one edge selected
    mockUseCanvasStore.mockImplementation((selector: any) => {
      const state = {
        edges: [mockEdge],
        selection: { nodeIds: new Set(), edgeIds: new Set(['e1']) },
        updateEdge: mockUpdateEdge
      }
      return selector(state)
    })
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument()
      expect(screen.getByText('Inspector')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(<InspectorPanel isOpen={false} onClose={() => {}} />)

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })

    it('shows empty state when no edge selected', () => {
      mockUseCanvasStore.mockImplementation((selector: any) => {
        const state = {
          edges: [],
          selection: { nodeIds: new Set(), edgeIds: new Set() },
          updateEdge: mockUpdateEdge
        }
        return selector(state)
      })

      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByText('Select an edge to inspect')).toBeInTheDocument()
    })

    it('shows multi-selection message when multiple edges selected', () => {
      mockUseCanvasStore.mockImplementation((selector: any) => {
        const state = {
          edges: [mockEdge, { ...mockEdge, id: 'e2' }],
          selection: { nodeIds: new Set(), edgeIds: new Set(['e1', 'e2']) },
          updateEdge: mockUpdateEdge
        }
        return selector(state)
      })

      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByText('Multiple edges selected')).toBeInTheDocument()
      expect(screen.getByText(/only supports editing one edge at a time/i)).toBeInTheDocument()
    })
  })

  describe('Edge Details Display', () => {
    it('displays edge ID, source, and target', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByText('e1')).toBeInTheDocument()
      expect(screen.getByText('node1')).toBeInTheDocument()
      expect(screen.getByText('node2')).toBeInTheDocument()
    })

    it('displays edge label when present', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('loads initial belief value', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefInput = screen.getByRole('spinbutton', { name: /uncertainty level/i }) as HTMLInputElement
      expect(beliefInput.value).toBe('0.50')
    })

    it('loads initial provenance value', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const provenanceTextarea = screen.getByPlaceholderText(/source or rationale/i) as HTMLTextAreaElement
      expect(provenanceTextarea.value).toBe('Test source')
    })
  })

  describe('Belief Slider', () => {
    it('updates belief value when slider moves', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.75' } })

      expect(beliefSlider.value).toBe('0.75')

      const beliefNumericInput = screen.getByRole('spinbutton', { name: /uncertainty level/i }) as HTMLInputElement
      expect(beliefNumericInput.value).toBe('0.75')
    })

    it('syncs slider and numeric input', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefNumericInput = screen.getByRole('spinbutton', { name: /uncertainty level/i }) as HTMLInputElement
      fireEvent.change(beliefNumericInput, { target: { value: '0.25' } })

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      expect(beliefSlider.value).toBe('0.25')
    })
  })

  describe('Provenance Character Counter', () => {
    it('shows character count', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      expect(screen.getByText('11/100')).toBeInTheDocument()
    })

    it('updates character count on input', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const provenanceTextarea = screen.getByPlaceholderText(/source or rationale/i) as HTMLTextAreaElement
      fireEvent.change(provenanceTextarea, { target: { value: 'New source text' } })

      expect(screen.getByText('15/100')).toBeInTheDocument()
    })

    it('warns when approaching character limit', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const provenanceTextarea = screen.getByPlaceholderText(/source or rationale/i) as HTMLTextAreaElement
      const longText = 'a'.repeat(95)
      fireEvent.change(provenanceTextarea, { target: { value: longText } })

      const counter = screen.getByText('95/100')
      expect(counter).toHaveClass('text-amber-600')
    })
  })

  describe('Validation', () => {
    it('shows error when belief ≥ 0.7 but provenance is empty', async () => {
      mockUseCanvasStore.mockImplementation((selector: any) => {
        const state = {
          edges: [{
            ...mockEdge,
            data: { ...mockEdge.data, belief: 0.7, provenance: '' }
          }],
          selection: { nodeIds: new Set(), edgeIds: new Set(['e1']) },
          updateEdge: mockUpdateEdge
        }
        return selector(state)
      })

      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.8' } })

      await waitFor(() => {
        expect(screen.getByText(/high belief.*requires provenance justification/i)).toBeInTheDocument()
      })
    })

    it('disables Apply button when there are validation errors', async () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      // Clear provenance and set high belief
      const provenanceTextarea = screen.getByPlaceholderText(/source or rationale/i) as HTMLTextAreaElement
      fireEvent.change(provenanceTextarea, { target: { value: '' } })

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.8' } })

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply/i })
        expect(applyButton).toBeDisabled()
      })
    })
  })

  describe('Change Tracking', () => {
    it('disables Apply and Reset buttons when unchanged', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const applyButton = screen.getByRole('button', { name: /apply/i })
      const resetButton = screen.getByRole('button', { name: /reset/i })

      expect(applyButton).toBeDisabled()
      expect(resetButton).toBeDisabled()
    })

    it('enables Apply and Reset when values change', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.75' } })

      const applyButton = screen.getByRole('button', { name: /apply/i })
      const resetButton = screen.getByRole('button', { name: /reset/i })

      expect(applyButton).not.toBeDisabled()
      expect(resetButton).not.toBeDisabled()
    })
  })

  describe('Apply and Reset', () => {
    it('calls updateEdge when Apply clicked', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.75' } })

      const applyButton = screen.getByRole('button', { name: /apply/i })
      fireEvent.click(applyButton)

      expect(mockUpdateEdge).toHaveBeenCalledWith('e1', {
        data: expect.objectContaining({
          belief: 0.75,
          provenance: 'Test source',
          weight: 1.0
        })
      })
    })

    it('resets values to original when Reset clicked', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      // Change belief
      const beliefSlider = screen.getByRole('slider', { name: /belief/i }) as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.75' } })
      expect(beliefSlider.value).toBe('0.75')

      // Click Reset
      const resetButton = screen.getByRole('button', { name: /reset/i })
      fireEvent.click(resetButton)

      // Value should revert to original
      expect(beliefSlider.value).toBe('0.5')
    })

    it('clamps belief to 0-1 range on Apply', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const beliefNumericInput = screen.getByRole('spinbutton', { name: /uncertainty level/i }) as HTMLInputElement
      fireEvent.change(beliefNumericInput, { target: { value: '1.5' } })

      const applyButton = screen.getByRole('button', { name: /apply/i })
      fireEvent.click(applyButton)

      expect(mockUpdateEdge).toHaveBeenCalledWith('e1', {
        data: expect.objectContaining({
          belief: 1 // Clamped to max
        })
      })
    })

    it('trims provenance to 100 chars on Apply', () => {
      render(<InspectorPanel isOpen={true} onClose={() => {}} />)

      const longText = 'a'.repeat(150)
      const provenanceTextarea = screen.getByPlaceholderText(/source or rationale/i) as HTMLTextAreaElement
      fireEvent.change(provenanceTextarea, { target: { value: longText } })

      const applyButton = screen.getByRole('button', { name: /apply/i })
      fireEvent.click(applyButton)

      expect(mockUpdateEdge).toHaveBeenCalledWith('e1', {
        data: expect.objectContaining({
          provenance: 'a'.repeat(100) // Trimmed to 100
        })
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('closes panel on Escape key', () => {
      const onClose = vi.fn()
      render(<InspectorPanel isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Close Button', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn()
      render(<InspectorPanel isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: /close panel/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })
})
