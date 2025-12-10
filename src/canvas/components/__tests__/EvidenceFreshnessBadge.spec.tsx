/**
 * EvidenceFreshnessBadge Component Tests
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  EvidenceFreshnessBadge,
  EvidenceFreshnessCompact,
  calculateAggregateFreshness,
  useFreshnessLevel,
} from '../EvidenceFreshnessBadge'

// Mock current time for consistent testing
const NOW = new Date('2025-01-15T12:00:00Z').getTime()

describe('EvidenceFreshnessBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('freshness level calculation', () => {
    it('shows "fresh" for updates within 24 hours with neutral background', () => {
      const recentDate = new Date(NOW - 2 * 60 * 60 * 1000) // 2 hours ago
      render(<EvidenceFreshnessBadge lastUpdated={recentDate} />)

      expect(screen.getByText('Fresh')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-freshness-badge')).toHaveClass('bg-paper-50')
    })

    it('shows "recent" for updates within 7 days with neutral background', () => {
      const recentDate = new Date(NOW - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      render(<EvidenceFreshnessBadge lastUpdated={recentDate} />)

      expect(screen.getByText('Recent')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-freshness-badge')).toHaveClass('bg-paper-50')
    })

    it('shows "aging" for updates within 30 days with neutral background', () => {
      const agingDate = new Date(NOW - 14 * 24 * 60 * 60 * 1000) // 14 days ago
      render(<EvidenceFreshnessBadge lastUpdated={agingDate} />)

      expect(screen.getByText('Aging')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-freshness-badge')).toHaveClass('bg-paper-50')
    })

    it('shows "stale" for updates over 30 days ago with neutral background', () => {
      const staleDate = new Date(NOW - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      render(<EvidenceFreshnessBadge lastUpdated={staleDate} />)

      expect(screen.getByText('Stale')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-freshness-badge')).toHaveClass('bg-paper-50')
    })

    it('shows "stale" when lastUpdated is null', () => {
      render(<EvidenceFreshnessBadge lastUpdated={null} />)

      expect(screen.getByText('Stale')).toBeInTheDocument()
    })
  })

  describe('relative time display', () => {
    it('shows "Just now" for very recent updates', () => {
      const justNow = new Date(NOW - 30 * 1000) // 30 seconds ago
      render(<EvidenceFreshnessBadge lastUpdated={justNow} />)

      expect(screen.getByText('(Just now)')).toBeInTheDocument()
    })

    it('shows hours for same-day updates', () => {
      const hoursAgo = new Date(NOW - 5 * 60 * 60 * 1000) // 5 hours ago
      render(<EvidenceFreshnessBadge lastUpdated={hoursAgo} />)

      expect(screen.getByText('(5h ago)')).toBeInTheDocument()
    })

    it('shows days for recent updates', () => {
      const daysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      render(<EvidenceFreshnessBadge lastUpdated={daysAgo} />)

      expect(screen.getByText('(3d ago)')).toBeInTheDocument()
    })

    it('hides relative time when showRelativeTime is false', () => {
      const daysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000)
      render(<EvidenceFreshnessBadge lastUpdated={daysAgo} showRelativeTime={false} />)

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
    })
  })

  describe('level override', () => {
    it('uses provided level instead of calculating', () => {
      const freshDate = new Date(NOW - 1 * 60 * 60 * 1000) // 1 hour ago (would be fresh)
      render(<EvidenceFreshnessBadge lastUpdated={freshDate} level="stale" />)

      expect(screen.getByText('Stale')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has correct role and aria-label', () => {
      render(<EvidenceFreshnessBadge lastUpdated={new Date()} />)

      const badge = screen.getByTestId('evidence-freshness-badge')
      expect(badge).toHaveAttribute('role', 'status')
      expect(badge).toHaveAttribute('aria-label', 'Evidence freshness: Fresh')
    })
  })

  describe('string date parsing', () => {
    it('parses ISO string dates correctly', () => {
      const isoString = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()
      render(<EvidenceFreshnessBadge lastUpdated={isoString} />)

      expect(screen.getByText('Fresh')).toBeInTheDocument()
    })
  })
})

describe('EvidenceFreshnessCompact', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders compact variant with relative time', () => {
    const hoursAgo = new Date(NOW - 3 * 60 * 60 * 1000)
    render(<EvidenceFreshnessCompact lastUpdated={hoursAgo} />)

    expect(screen.getByTestId('evidence-freshness-compact')).toBeInTheDocument()
    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('shows Never updated for null date', () => {
    render(<EvidenceFreshnessCompact lastUpdated={null} />)

    expect(screen.getByText('Never updated')).toBeInTheDocument()
  })
})

describe('calculateAggregateFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns stale for empty array', () => {
    expect(calculateAggregateFreshness([])).toBe('stale')
  })

  it('returns the stalest level from array', () => {
    const timestamps = [
      new Date(NOW - 1 * 60 * 60 * 1000), // fresh (1h ago)
      new Date(NOW - 3 * 24 * 60 * 60 * 1000), // recent (3d ago)
      new Date(NOW - 60 * 24 * 60 * 60 * 1000), // stale (60d ago)
    ]

    expect(calculateAggregateFreshness(timestamps)).toBe('stale')
  })

  it('handles mixed string and Date objects', () => {
    const timestamps = [
      new Date(NOW - 1 * 60 * 60 * 1000).toISOString(),
      new Date(NOW - 14 * 24 * 60 * 60 * 1000), // aging
    ]

    expect(calculateAggregateFreshness(timestamps)).toBe('aging')
  })

  it('handles null values in array', () => {
    const timestamps = [
      new Date(NOW - 1 * 60 * 60 * 1000), // fresh
      null, // will be stale
    ]

    expect(calculateAggregateFreshness(timestamps)).toBe('stale')
  })
})

describe('useFreshnessLevel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates freshness level correctly', () => {
    const freshDate = new Date(NOW - 1 * 60 * 60 * 1000)
    expect(useFreshnessLevel(freshDate)).toBe('fresh')

    const staleDate = new Date(NOW - 60 * 24 * 60 * 60 * 1000)
    expect(useFreshnessLevel(staleDate)).toBe('stale')
  })
})
