/**
 * Tests for stableId utility
 *
 * Verifies that the ID generation produces:
 * - Deterministic output (same input = same output)
 * - Collision-resistant IDs for similar inputs
 */

import { describe, it, expect } from 'vitest'
import { stableId, stableImprovementId } from '../stableId'

describe('stableId', () => {
  describe('determinism', () => {
    it('should produce the same ID for the same input', () => {
      const id1 = stableId('test', 'content', 'here')
      const id2 = stableId('test', 'content', 'here')
      expect(id1).toBe(id2)
    })

    it('should produce consistent IDs across multiple calls', () => {
      const ids = Array(100).fill(null).map(() =>
        stableId('prefix', 'some', 'content')
      )
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(1)
    })
  })

  describe('collision resistance', () => {
    it('should produce different IDs for different inputs', () => {
      const id1 = stableId('test', 'content-a')
      const id2 = stableId('test', 'content-b')
      expect(id1).not.toBe(id2)
    })

    it('should produce different IDs for similar long strings', () => {
      // These would collide with slice(0, 20) approach
      const longText1 = 'Add supporting evidence for Factor A which affects outcome'
      const longText2 = 'Add supporting evidence for Factor B which affects outcome'

      const id1 = stableId('readiness', longText1)
      const id2 = stableId('readiness', longText2)

      expect(id1).not.toBe(id2)
    })

    it('should handle undefined/null parts gracefully', () => {
      const id1 = stableId('test', 'content', undefined, 'more')
      const id2 = stableId('test', 'content', null, 'more')
      // Both should be valid and exclude the null/undefined
      expect(id1).toMatch(/^test-[0-9a-f]{8}$/)
      expect(id1).toBe(id2)
    })
  })

  describe('format', () => {
    it('should produce IDs in expected format', () => {
      const id = stableId('prefix', 'content')
      expect(id).toMatch(/^prefix-[0-9a-f]{8}$/)
    })

    it('should include the prefix', () => {
      const id = stableId('myprefix', 'content')
      expect(id.startsWith('myprefix-')).toBe(true)
    })
  })
})

describe('stableImprovementId', () => {
  it('should produce stable IDs for improvements', () => {
    const id1 = stableImprovementId('factors', 'Add supporting evidence', ['node-1', 'node-2'])
    const id2 = stableImprovementId('factors', 'Add supporting evidence', ['node-1', 'node-2'])
    expect(id1).toBe(id2)
  })

  it('should produce different IDs for different actions', () => {
    const id1 = stableImprovementId('factors', 'Add evidence A', ['node-1'])
    const id2 = stableImprovementId('factors', 'Add evidence B', ['node-1'])
    expect(id1).not.toBe(id2)
  })

  it('should produce different IDs for different affected nodes', () => {
    const id1 = stableImprovementId('factors', 'Same action', ['node-1'])
    const id2 = stableImprovementId('factors', 'Same action', ['node-2'])
    expect(id1).not.toBe(id2)
  })

  it('should sort affected nodes for consistency', () => {
    const id1 = stableImprovementId('factors', 'Action', ['node-1', 'node-2'])
    const id2 = stableImprovementId('factors', 'Action', ['node-2', 'node-1'])
    expect(id1).toBe(id2)
  })

  it('should start with readiness prefix', () => {
    const id = stableImprovementId('category', 'action')
    expect(id.startsWith('readiness-')).toBe(true)
  })

  it('should avoid collisions for long similar action texts', () => {
    // This is the key test - would fail with slice(0, 20)
    const action1 = 'Add supporting evidence for customer satisfaction metrics'
    const action2 = 'Add supporting evidence for market research analysis'

    // First 20 chars are the same: "Add supporting evide"
    expect(action1.slice(0, 20)).toBe(action2.slice(0, 20))

    const id1 = stableImprovementId('factors', action1)
    const id2 = stableImprovementId('factors', action2)

    // But our IDs should be different!
    expect(id1).not.toBe(id2)
  })
})
