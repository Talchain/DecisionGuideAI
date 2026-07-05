import { describe, it, expect } from 'vitest'
import {
  checkAskPreflight,
  isWithinAskLimits,
  getAskLimitStatus,
  ASK_LIMITS,
} from '../askPreflight'

describe('askPreflight', () => {
  describe('checkAskPreflight', () => {
    it('allows graph within limits', () => {
      const result = checkAskPreflight(new Array(12), new Array(20))
      expect(result.allowed).toBe(true)
      expect(result.nodeCount).toBe(12)
      expect(result.edgeCount).toBe(20)
      expect(result.reason).toBeUndefined()
    })

    it('allows empty graph', () => {
      const result = checkAskPreflight([], [])
      expect(result.allowed).toBe(true)
      expect(result.nodeCount).toBe(0)
      expect(result.edgeCount).toBe(0)
    })

    it('rejects graph with too many nodes', () => {
      const result = checkAskPreflight(new Array(51), new Array(10))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('50 nodes')
      expect(result.reason).toContain('51')
    })

    it('rejects graph with too many edges', () => {
      const result = checkAskPreflight(new Array(10), new Array(41))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('40 edges')
      expect(result.reason).toContain('41')
    })

    it('rejects graph exceeding both limits (reports nodes first)', () => {
      const result = checkAskPreflight(new Array(51), new Array(41))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('nodes') // Nodes checked first
    })

    it('allows exactly at limits', () => {
      const result = checkAskPreflight(
        new Array(ASK_LIMITS.MAX_NODES),
        new Array(ASK_LIMITS.MAX_EDGES)
      )
      expect(result.allowed).toBe(true)
    })
  })

  describe('isWithinAskLimits', () => {
    it('returns true for counts within limits', () => {
      expect(isWithinAskLimits(5, 10)).toBe(true)
      expect(isWithinAskLimits(12, 20)).toBe(true)
      expect(isWithinAskLimits(0, 0)).toBe(true)
    })

    it('returns false for counts exceeding limits', () => {
      expect(isWithinAskLimits(51, 10)).toBe(false)
      expect(isWithinAskLimits(10, 41)).toBe(false)
      expect(isWithinAskLimits(51, 41)).toBe(false)
    })
  })

  describe('getAskLimitStatus', () => {
    it('shows status for counts within limits', () => {
      const status = getAskLimitStatus(5, 10)
      expect(status).toBe('5/50 nodes, 10/40 edges')
    })

    it('shows over limit message when nodes exceed', () => {
      const status = getAskLimitStatus(51, 10)
      expect(status).toContain('Over limit')
      expect(status).toContain('51/50 nodes')
    })

    it('shows over limit message when edges exceed', () => {
      const status = getAskLimitStatus(10, 41)
      expect(status).toContain('Over limit')
      expect(status).toContain('41/40 edges')
    })
  })

  describe('ASK_LIMITS', () => {
    it('has correct values per CEE contract', () => {
      expect(ASK_LIMITS.MAX_NODES).toBe(50)
      expect(ASK_LIMITS.MAX_EDGES).toBe(40)
    })
  })
})
