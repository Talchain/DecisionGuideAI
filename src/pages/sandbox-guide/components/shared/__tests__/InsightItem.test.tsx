/**
 * InsightItem Component Tests
 *
 * Tests for parsing and rendering node/edge references in insight text
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { InsightItem } from '../InsightItem'

// Mock canvas store
vi.mock('../../../../../canvas/store', () => ({
  useCanvasStore: vi.fn(() => ({
    nodes: [
      { id: 'node-1', data: { label: 'Market Demand' } },
      { id: 'node-2', data: { label: 'Product Quality' } },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2', data: { label: 'Influences' } },
    ],
  })),
}))

describe('InsightItem', () => {
  describe('Text Parsing', () => {
    it('renders plain text without references', () => {
      render(<InsightItem text="This is plain text" />)
      expect(screen.getByText('This is plain text')).toBeInTheDocument()
    })

    it('parses node reference with auto-label', () => {
      render(<InsightItem text="Risk in [node:node-1] detected" />)

      expect(screen.getByText('Risk in')).toBeInTheDocument()
      expect(screen.getByText('Market Demand')).toBeInTheDocument()
      expect(screen.getByText('detected')).toBeInTheDocument()
    })

    it('parses node reference with custom label', () => {
      render(<InsightItem text="Check [node:node-1:Custom Label] for issues" />)

      expect(screen.getByText('Custom Label')).toBeInTheDocument()
      expect(screen.queryByText('Market Demand')).not.toBeInTheDocument()
    })

    it('parses edge reference with auto-label', () => {
      render(<InsightItem text="Strengthen [edge:edge-1] connection" />)

      expect(screen.getByText('Strengthen')).toBeInTheDocument()
      expect(screen.getByText('Influences')).toBeInTheDocument()
      expect(screen.getByText('connection')).toBeInTheDocument()
    })

    it('parses edge reference with custom label', () => {
      render(<InsightItem text="Review [edge:edge-1:Link A→B] carefully" />)

      expect(screen.getByText('Link A→B')).toBeInTheDocument()
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

    it('handles mixed node and edge references', () => {
      render(
        <InsightItem text="Node [node:node-1] and edge [edge:edge-1] are critical" />
      )

      expect(screen.getByText('Market Demand')).toBeInTheDocument()
      expect(screen.getByText('Influences')).toBeInTheDocument()
      expect(screen.getByText('are critical')).toBeInTheDocument()
    })
  })

  describe('Click Handlers', () => {
    it('calls onNodeClick when node badge is clicked', async () => {
      const user = userEvent.setup()
      const onNodeClick = vi.fn()

      render(<InsightItem text="Check [node:node-1]" onNodeClick={onNodeClick} />)

      const badge = screen.getByText('Market Demand')
      await user.click(badge)

      expect(onNodeClick).toHaveBeenCalledWith('node-1')
    })

    it('calls onEdgeClick when edge badge is clicked', async () => {
      const user = userEvent.setup()
      const onEdgeClick = vi.fn()

      render(<InsightItem text="Review [edge:edge-1]" onEdgeClick={onEdgeClick} />)

      const badge = screen.getByText('Influences')
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

      await user.click(screen.getByText('Market Demand'))
      expect(onNodeClick).toHaveBeenCalledWith('node-1')

      await user.click(screen.getByText('Product Quality'))
      expect(onNodeClick).toHaveBeenCalledWith('node-2')
    })
  })

  describe('Edge Cases', () => {
    it('handles unknown node IDs gracefully', () => {
      render(<InsightItem text="Check [node:unknown-node]" />)

      // Should fall back to node ID as label
      expect(screen.getByText('unknown-node')).toBeInTheDocument()
    })

    it('handles unknown edge IDs gracefully', () => {
      render(<InsightItem text="Check [edge:unknown-edge]" />)

      // Should fall back to edge ID as label
      expect(screen.getByText('unknown-edge')).toBeInTheDocument()
    })

    it('handles malformed references', () => {
      render(<InsightItem text="Broken [node:] reference" />)

      // Should render as plain text
      expect(screen.getByText(/Broken.*reference/)).toBeInTheDocument()
    })

    it('handles empty text', () => {
      render(<InsightItem text="" />)

      // Should render nothing or empty div
      expect(screen.queryByText(/./)).not.toBeInTheDocument()
    })

    it('handles text with only whitespace', () => {
      render(<InsightItem text="   " />)

      expect(screen.getByText(/\s+/)).toBeInTheDocument()
    })
  })

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      const { container } = render(
        <InsightItem text="Test" className="custom-class" />
      )

      const div = container.querySelector('.custom-class')
      expect(div).toBeInTheDocument()
    })
  })
})
