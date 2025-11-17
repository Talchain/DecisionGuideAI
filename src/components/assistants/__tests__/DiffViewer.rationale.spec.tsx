/**
 * S7-RATIONALE: DiffViewer Inline Rationales Tests
 *
 * Tests that rationales are displayed correctly:
 * - Show rationales for nodes and edges when provided
 * - Accessibility attributes
 * - Integration with selection and expand/collapse
 * - Visual indicators (Info icon)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiffViewer } from '../DiffViewer'
import type { DraftResponse } from '../../../adapters/assistants/types'

describe('S7-RATIONALE: DiffViewer Inline Rationales', () => {
  const mockOnApply = vi.fn()
  const mockOnReject = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Display Node Rationales', () => {
    it('should show rationale for node when provided', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Increase Revenue',
              type: 'goal',
              rationale: 'This goal aligns with your stated priority of maximizing revenue in Q4.'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText('This goal aligns with your stated priority of maximizing revenue in Q4.')).toBeInTheDocument()
    })

    it('should not show rationale for node when not provided', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Increase Revenue',
              type: 'goal'
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // No rationale container should be present
      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(0)
    })

    it('should show Info icon with node rationale', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Risk Factor',
              type: 'risk',
              rationale: 'Identified from your mention of market volatility.'
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Check for Info icon (lucide-react renders SVG with specific class)
      const infoIcon = container.querySelector('svg.lucide-info')
      expect(infoIcon).toBeInTheDocument()
    })

    it('should show multiple node rationales', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node 1',
              rationale: 'Rationale for node 1'
            },
            {
              id: 'n2',
              label: 'Node 2',
              rationale: 'Rationale for node 2'
            },
            {
              id: 'n3',
              label: 'Node 3'
              // No rationale
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText('Rationale for node 1')).toBeInTheDocument()
      expect(screen.getByText('Rationale for node 2')).toBeInTheDocument()

      // Should have exactly 2 rationale containers
      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(2)
    })
  })

  describe('Display Edge Rationales', () => {
    it('should show rationale for edge when provided', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              label: 'influences',
              rationale: 'This relationship is implied by your description of the decision flow.'
            }
          ]
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText('This relationship is implied by your description of the decision flow.')).toBeInTheDocument()
    })

    it('should not show rationale for edge when not provided', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2'
            }
          ]
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(0)
    })

    it('should show multiple edge rationales', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: 'Edge rationale 1'
            },
            {
              id: 'e2',
              from: 'n2',
              to: 'n3',
              rationale: 'Edge rationale 2'
            }
          ]
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText('Edge rationale 1')).toBeInTheDocument()
      expect(screen.getByText('Edge rationale 2')).toBeInTheDocument()

      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(2)
    })
  })

  describe('Mixed Rationales (Nodes and Edges)', () => {
    it('should show rationales for both nodes and edges', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Goal',
              rationale: 'Node rationale'
            }
          ],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: 'Edge rationale'
            }
          ]
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText('Node rationale')).toBeInTheDocument()
      expect(screen.getByText('Edge rationale')).toBeInTheDocument()

      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(2)
    })

    it('should handle empty rationale strings as no rationale', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: ''
            }
          ],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: ''
            }
          ]
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleContainers = container.querySelectorAll('[role="note"]')
      expect(rationaleContainers).toHaveLength(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'Important information'
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleContainer = container.querySelector('[role="note"]')
      expect(rationaleContainer).toHaveAttribute('aria-label', 'Rationale')
    })

    it('should use role="note" for semantic meaning', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: 'Edge explanation'
            }
          ]
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleContainer = container.querySelector('[role="note"]')
      expect(rationaleContainer?.getAttribute('role')).toBe('note')
    })
  })

  describe('Integration with Selection', () => {
    it('should show rationale regardless of selection state', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'This is why this node exists'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Rationale should be visible initially
      expect(screen.getByText('This is why this node exists')).toBeInTheDocument()

      // Deselect the node
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      // Rationale should still be visible
      expect(screen.getByText('This is why this node exists')).toBeInTheDocument()
    })

    it('should work with deselect all', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node 1',
              rationale: 'Rationale 1'
            },
            {
              id: 'n2',
              label: 'Node 2',
              rationale: 'Rationale 2'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Click "Deselect all" button for nodes (first one)
      const deselectAllButtons = screen.getAllByText('Deselect all')
      fireEvent.click(deselectAllButtons[0]) // Click the nodes "Deselect all" button

      // Rationales should still be visible
      expect(screen.getByText('Rationale 1')).toBeInTheDocument()
      expect(screen.getByText('Rationale 2')).toBeInTheDocument()
    })
  })

  describe('Integration with Expand/Collapse', () => {
    it('should show rationales when section is expanded', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'Node explanation'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Section should be expanded by default
      expect(screen.getByText('Node explanation')).toBeInTheDocument()
    })

    it('should hide rationales when section is collapsed', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'Node explanation'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Collapse nodes section
      const collapseButton = screen.getByRole('button', { name: /1 nodes/ })
      fireEvent.click(collapseButton)

      // Rationale should no longer be visible
      expect(screen.queryByText('Node explanation')).not.toBeInTheDocument()
    })

    it('should show rationales again when section is re-expanded', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: 'Edge explanation'
            }
          ]
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      // Collapse edges section
      const collapseButton = screen.getByRole('button', { name: /1 edges/ })
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Edge explanation')).not.toBeInTheDocument()

      // Re-expand edges section
      fireEvent.click(collapseButton)

      expect(screen.getByText('Edge explanation')).toBeInTheDocument()
    })
  })

  describe('Visual Styling', () => {
    it('should have distinct styling from item labels', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node label',
              rationale: 'Rationale text'
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleContainer = container.querySelector('[role="note"]')

      // Should have blue background
      expect(rationaleContainer).toHaveClass('bg-blue-50')

      // Should have border
      expect(rationaleContainer).toHaveClass('border-blue-100')

      // Should have padding
      expect(rationaleContainer).toHaveClass('px-3')
      expect(rationaleContainer).toHaveClass('py-2')
    })

    it('should use smaller text size for rationales', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'Explanation'
            }
          ],
          edges: []
        }
      }

      const { container } = render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rationaleText = container.querySelector('[role="note"] p')
      expect(rationaleText).toHaveClass('text-xs')
    })
  })

  describe('Long Rationale Text', () => {
    it('should handle long multi-line rationales gracefully', () => {
      const longRationale = 'This is a very long rationale that explains in great detail why this particular node was added to the graph, including context about user inputs, domain knowledge, and inferred relationships that justify its inclusion in the decision model.'

      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: longRationale
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      expect(screen.getByText(longRationale)).toBeInTheDocument()
    })
  })

  describe('Apply/Reject Functionality', () => {
    it('should not affect Apply button when rationales are present', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [
            {
              id: 'n1',
              label: 'Node',
              rationale: 'Rationale'
            }
          ],
          edges: []
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const applyButton = screen.getByText(/Apply Changes/)
      fireEvent.click(applyButton)

      expect(mockOnApply).toHaveBeenCalledWith(['n1'], [])
    })

    it('should not affect Reject button when rationales are present', () => {
      const mockDraft: DraftResponse = {
        schema: 'draft.v1',
        graph: {
          nodes: [],
          edges: [
            {
              id: 'e1',
              from: 'n1',
              to: 'n2',
              rationale: 'Edge rationale'
            }
          ]
        }
      }

      render(<DiffViewer draft={mockDraft} onApply={mockOnApply} onReject={mockOnReject} />)

      const rejectButton = screen.getByText('Reject')
      fireEvent.click(rejectButton)

      expect(mockOnReject).toHaveBeenCalled()
    })
  })
})
