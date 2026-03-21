/**
 * InsightItem Component Tests
 *
 * Tests for parsing and rendering node/edge references in insight text.
 *
 * The component parses `[node:id]` / `[edge:id]` / `[node:id:Label]` syntax,
 * delegates rendering to NodeBadge/EdgeBadge (which resolve labels from the
 * canvas store), and renders plain text segments as bare Fragment children.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsightItem } from '../InsightItem'

// Mock the canvas store used by NodeBadge/EdgeBadge to resolve labels
vi.mock('../../../../../canvas/store', () => ({
  useCanvasStore: vi.fn((selector: (state: unknown) => unknown) => {
    const state = {
      nodes: [
        { id: 'node-1', data: { label: 'Market Demand' } },
        { id: 'node-2', data: { label: 'Product Quality' } },
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2', data: { label: 'Influences' } },
      ],
    }
    return selector(state)
  }),
}))

describe('InsightItem', () => {
  describe('Text Parsing', () => {
    it('renders plain text without references', () => {
      render(<InsightItem text="This is plain text" />)
      expect(screen.getByText('This is plain text')).toBeInTheDocument()
    })

    it('parses node reference and resolves label from store', () => {
      const { container } = render(<InsightItem text="Risk in [node:node-1] detected" />)

      // The surrounding text is rendered as Fragment text nodes
      expect(container.textContent).toContain('Risk in')
      expect(container.textContent).toContain('detected')
      // NodeBadge resolves the label from the store
      expect(screen.getByText('Market Demand')).toBeInTheDocument()
    })

    it('parses node reference with custom label', () => {
      render(<InsightItem text="Check [node:node-1:Custom Label] for issues" />)

      // Custom label should be used instead of store label
      expect(screen.getByText('Custom Label')).toBeInTheDocument()
      expect(screen.queryByText('Market Demand')).not.toBeInTheDocument()
    })

    it('parses edge reference and resolves label from store', () => {
      const { container } = render(<InsightItem text="Strengthen [edge:edge-1] connection" />)

      expect(container.textContent).toContain('Strengthen')
      expect(container.textContent).toContain('connection')
      // EdgeBadge resolves the label from the store
      expect(screen.getByText('Influences')).toBeInTheDocument()
    })

    it('parses edge reference with custom label', () => {
      render(<InsightItem text="Review [edge:edge-1:Link A-B] carefully" />)

      expect(screen.getByText('Link A-B')).toBeInTheDocument()
      expect(screen.queryByText('Influences')).not.toBeInTheDocument()
    })

    it('parses multiple references in one text', () => {
      render(
        <InsightItem text="Connect [node:node-1] via [edge:edge-1] to [node:node-2]" />
      )

      expect(screen.getByText('Market Demand')).toBeInTheDocument()
      expect(screen.getByText('Influences')).toBeInTheDocument()
      expect(screen.getByText('Product Quality')).toBeInTheDocument()
    })

    it('handles mixed node and edge references with surrounding text', () => {
      const { container } = render(
        <InsightItem text="Node [node:node-1] and edge [edge:edge-1] are critical" />
      )

      expect(screen.getByText('Market Demand')).toBeInTheDocument()
      expect(screen.getByText('Influences')).toBeInTheDocument()
      expect(container.textContent).toContain('are critical')
    })
  })

  describe('Click Handlers', () => {
    it('calls onNodeClick when node badge is clicked', async () => {
      const user = userEvent.setup()
      const onNodeClick = vi.fn()

      render(<InsightItem text="Check [node:node-1]" onNodeClick={onNodeClick} />)

      const badge = screen.getByRole('button', { name: /Market Demand/i })
      await user.click(badge)

      expect(onNodeClick).toHaveBeenCalledWith('node-1')
    })

    it('calls onEdgeClick when edge badge is clicked', async () => {
      const user = userEvent.setup()
      const onEdgeClick = vi.fn()

      render(<InsightItem text="Review [edge:edge-1]" onEdgeClick={onEdgeClick} />)

      const badge = screen.getByRole('button', { name: /Influences/i })
      await user.click(badge)

      expect(onEdgeClick).toHaveBeenCalledWith('edge-1')
    })

    it('handles clicks on multiple node references', async () => {
      const user = userEvent.setup()
      const onNodeClick = vi.fn()

      render(
        <InsightItem
          text="Compare [node:node-1] and [node:node-2]"
          onNodeClick={onNodeClick}
        />
      )

      await user.click(screen.getByRole('button', { name: /Market Demand/i }))
      expect(onNodeClick).toHaveBeenCalledWith('node-1')

      await user.click(screen.getByRole('button', { name: /Product Quality/i }))
      expect(onNodeClick).toHaveBeenCalledWith('node-2')
    })

    it('does not error when click handler is not provided', async () => {
      const user = userEvent.setup()

      render(<InsightItem text="Check [node:node-1]" />)

      // Should not throw when clicking without handler
      const badge = screen.getByRole('button', { name: /Market Demand/i })
      await user.click(badge)
    })
  })

  describe('Edge Cases', () => {
    it('falls back to node ID as label for unknown node IDs', () => {
      render(<InsightItem text="Check [node:unknown-node]" />)

      // NodeBadge falls back to nodeId when not found in store
      expect(screen.getByText('unknown-node')).toBeInTheDocument()
    })

    it('falls back to edge ID as label for unknown edge IDs', () => {
      render(<InsightItem text="Check [edge:unknown-edge]" />)

      // EdgeBadge falls back to edgeId when not found in store
      expect(screen.getByText('unknown-edge')).toBeInTheDocument()
    })

    it('renders malformed references as plain text', () => {
      const { container } = render(<InsightItem text="Broken [node:] reference" />)

      // [node:] has empty ID — regex requires at least one char, so no match
      expect(container.textContent).toBe('Broken [node:] reference')
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('handles empty text', () => {
      const { container } = render(<InsightItem text="" />)

      // Empty div with no text content
      expect(container.textContent).toBe('')
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('handles text with only whitespace', () => {
      const { container } = render(<InsightItem text="   " />)

      expect(container.textContent).toBe('   ')
    })

    it('handles consecutive references without text between them', () => {
      render(<InsightItem text="[node:node-1][node:node-2]" />)

      expect(screen.getByText('Market Demand')).toBeInTheDocument()
      expect(screen.getByText('Product Quality')).toBeInTheDocument()
    })
  })

  describe('Custom Classes', () => {
    it('applies custom className to the wrapper div', () => {
      const { container } = render(
        <InsightItem text="Test" className="custom-class" />
      )

      const div = container.querySelector('.custom-class')
      expect(div).toBeInTheDocument()
    })

    it('applies default text styling', () => {
      const { container } = render(<InsightItem text="Test" />)

      const div = container.firstElementChild
      expect(div).toHaveClass('text-sm')
    })
  })
})
