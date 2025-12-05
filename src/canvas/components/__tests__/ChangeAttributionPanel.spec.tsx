/**
 * ChangeAttributionPanel Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ChangeAttributionPanel,
  AttributionInline,
  type ChangeRecord,
} from '../ChangeAttributionPanel'

// Mock current time for consistent testing
const NOW = new Date('2025-01-15T12:00:00Z').getTime()

const mockChanges: ChangeRecord[] = [
  {
    id: 'change-1',
    timestamp: new Date(NOW - 5 * 60 * 1000), // 5 minutes ago
    source: 'user',
    actor: 'John Doe',
    description: 'Added decision node',
    affectedNodeIds: ['node-1'],
    revertable: true,
  },
  {
    id: 'change-2',
    timestamp: new Date(NOW - 30 * 60 * 1000), // 30 minutes ago
    source: 'ai',
    actor: 'Claude',
    description: 'Generated risk analysis',
    affectedNodeIds: ['node-2', 'node-3'],
    affectedEdgeIds: ['edge-1'],
  },
  {
    id: 'change-3',
    timestamp: new Date(NOW - 2 * 60 * 60 * 1000), // 2 hours ago
    source: 'template',
    description: 'Applied decision tree template',
    affectedNodeIds: ['node-4', 'node-5', 'node-6', 'node-7'],
  },
  {
    id: 'change-4',
    timestamp: new Date(NOW - 24 * 60 * 60 * 1000), // 1 day ago
    source: 'import',
    description: 'Imported from file',
  },
]

describe('ChangeAttributionPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders empty state when no changes', () => {
      render(<ChangeAttributionPanel changes={[]} />)

      expect(screen.getByText('No changes recorded')).toBeInTheDocument()
    })

    it('renders change count in header', () => {
      render(<ChangeAttributionPanel changes={mockChanges} />)

      expect(screen.getByText('(4)')).toBeInTheDocument()
    })

    it('renders all change items when expanded', () => {
      render(<ChangeAttributionPanel changes={mockChanges} defaultExpanded={true} />)

      expect(screen.getByText('Added decision node')).toBeInTheDocument()
      expect(screen.getByText('Generated risk analysis')).toBeInTheDocument()
      expect(screen.getByText('Applied decision tree template')).toBeInTheDocument()
      expect(screen.getByText('Imported from file')).toBeInTheDocument()
    })

    it('hides changes when collapsed', () => {
      render(<ChangeAttributionPanel changes={mockChanges} defaultExpanded={false} />)

      expect(screen.queryByText('Added decision node')).not.toBeInTheDocument()
    })
  })

  describe('timestamps', () => {
    it('shows relative timestamps', () => {
      render(<ChangeAttributionPanel changes={mockChanges} />)

      expect(screen.getByText('5m ago')).toBeInTheDocument()
      expect(screen.getByText('30m ago')).toBeInTheDocument()
      expect(screen.getByText('2h ago')).toBeInTheDocument()
      expect(screen.getByText('1d ago')).toBeInTheDocument()
    })
  })

  describe('actors', () => {
    it('displays actor names', () => {
      render(<ChangeAttributionPanel changes={mockChanges} />)

      expect(screen.getByText('by John Doe')).toBeInTheDocument()
      expect(screen.getByText('by Claude')).toBeInTheDocument()
    })
  })

  describe('affected elements', () => {
    it('shows affected element count', () => {
      render(<ChangeAttributionPanel changes={mockChanges} />)

      expect(screen.getByText('(1 element)')).toBeInTheDocument()
      expect(screen.getByText('(3 elements)')).toBeInTheDocument()
      expect(screen.getByText('(4 elements)')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('toggles expanded state on click', () => {
      render(<ChangeAttributionPanel changes={mockChanges} defaultExpanded={false} />)

      // Initially collapsed
      expect(screen.queryByTestId('change-list')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText('Change History'))
      expect(screen.getByTestId('change-list')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(screen.getByText('Change History'))
      expect(screen.queryByTestId('change-list')).not.toBeInTheDocument()
    })

    it('calls onRevert when revert button clicked', () => {
      const onRevert = vi.fn()
      render(<ChangeAttributionPanel changes={mockChanges} onRevert={onRevert} />)

      const revertButton = screen.getByLabelText('Revert change')
      fireEvent.click(revertButton)

      expect(onRevert).toHaveBeenCalledWith('change-1')
    })

    it('calls onFocusElement when node ID clicked', () => {
      const onFocusElement = vi.fn()
      render(
        <ChangeAttributionPanel changes={mockChanges} onFocusElement={onFocusElement} />
      )

      // Click the first node ID button
      const nodeButton = screen.getByText('node-1')
      fireEvent.click(nodeButton)

      expect(onFocusElement).toHaveBeenCalledWith('node-1')
    })
  })

  describe('show more/less', () => {
    it('shows "Show more" when changes exceed maxVisible', () => {
      const manyChanges = Array.from({ length: 15 }, (_, i) => ({
        id: `change-${i}`,
        timestamp: new Date(NOW - i * 60 * 60 * 1000),
        source: 'user' as const,
        description: `Change ${i}`,
      }))

      render(<ChangeAttributionPanel changes={manyChanges} maxVisible={5} />)

      expect(screen.getByText('Show 10 more')).toBeInTheDocument()
    })

    it('toggles show all when clicking show more', () => {
      const manyChanges = Array.from({ length: 15 }, (_, i) => ({
        id: `change-${i}`,
        timestamp: new Date(NOW - i * 60 * 60 * 1000),
        source: 'user' as const,
        description: `Change ${i}`,
      }))

      render(<ChangeAttributionPanel changes={manyChanges} maxVisible={5} />)

      fireEvent.click(screen.getByText('Show 10 more'))
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has correct aria attributes', () => {
      render(<ChangeAttributionPanel changes={mockChanges} />)

      const button = screen.getByRole('button', { name: /change history/i })
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(button).toHaveAttribute('aria-controls', 'change-history')
    })
  })
})

describe('AttributionInline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders source icon', () => {
    render(<AttributionInline source="user" />)

    expect(screen.getByTestId('attribution-inline')).toBeInTheDocument()
  })

  it('shows actor name when provided', () => {
    render(<AttributionInline source="ai" actor="Claude" />)

    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('shows timestamp when provided', () => {
    render(
      <AttributionInline
        source="user"
        timestamp={new Date(NOW - 10 * 60 * 1000)}
      />
    )

    expect(screen.getByText('10m ago')).toBeInTheDocument()
  })
})
