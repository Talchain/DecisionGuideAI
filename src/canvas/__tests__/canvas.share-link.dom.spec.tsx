/**
 * Share-link resolver integration tests
 * Tests parseRunHash utility and localStorage lookup logic
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseRunHash } from '../utils/shareLink'
import { loadRuns } from '../store/runHistory'
import { createStoredRun, cleanupCanvas } from './__helpers__/renderCanvas'

describe('Canvas: Share-link resolver', () => {
  beforeEach(() => {
    cleanupCanvas()
  })

  describe('parseRunHash utility', () => {
    it('parses 64-char hex hash', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const url = `#/canvas?run=${hash}`

      const result = parseRunHash(url)

      expect(result).toBe(hash)
    })

    it('parses hash with sha256: prefix', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const url = `#/canvas?run=sha256:${hash}`

      const result = parseRunHash(url)

      expect(result).toBe(hash)
    })

    it('handles percent-encoded sha256: prefix', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const url = `#/canvas?run=sha256%3A${hash}`

      const result = parseRunHash(url)

      expect(result).toBe(hash)
    })

    it('rejects hash with invalid characters', () => {
      const invalidHash = 'abc<script>alert("xss")</script>1234567890abcdef12345678'
      const url = `#/canvas?run=${invalidHash}`

      const result = parseRunHash(url)

      expect(result).toBeNull()
    })

    it('rejects hash shorter than 8 characters', () => {
      const shortHash = 'abc123'
      const url = `#/canvas?run=${shortHash}`

      const result = parseRunHash(url)

      expect(result).toBeNull()
    })

    it('accepts hash with minimum 8 characters', () => {
      const minHash = 'abcd1234'
      const url = `#/canvas?run=${minHash}`

      const result = parseRunHash(url)

      expect(result).toBe(minHash)
    })

    it('returns null when run parameter is missing', () => {
      const url = '#/canvas?foo=bar'

      const result = parseRunHash(url)

      expect(result).toBeNull()
    })

    it('handles empty URL', () => {
      const result = parseRunHash('')

      expect(result).toBeNull()
    })
  })

  describe('localStorage run lookup', () => {
    it('finds run by exact hash match', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const storedRun = createStoredRun({ hash, summary: 'Test run' })

      localStorage.setItem('olumi-canvas-run-history', JSON.stringify([storedRun]))

      const runs = loadRuns()
      const found = runs.find(r => r.hash === hash)

      expect(found).toBeDefined()
      expect(found?.summary).toBe('Test run')
    })

    it('returns empty array when no runs stored', () => {
      const runs = loadRuns()

      expect(runs).toEqual([])
    })

    it('handles multiple runs in history', () => {
      const run1 = createStoredRun({
        hash: 'aaaa1111111111111111111111111111111111111111111111111111111111',
        summary: 'Run 1'
      })
      const run2 = createStoredRun({
        hash: 'bbbb2222222222222222222222222222222222222222222222222222222222',
        summary: 'Run 2'
      })

      localStorage.setItem('olumi-canvas-run-history', JSON.stringify([run1, run2]))

      const runs = loadRuns()

      expect(runs).toHaveLength(2)
      // Sorted by ts desc, so order might not be guaranteed unless we set different ts
      const foundRun1 = runs.find(r => r.summary === 'Run 1')
      const foundRun2 = runs.find(r => r.summary === 'Run 2')
      expect(foundRun1).toBeDefined()
      expect(foundRun2).toBeDefined()
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('olumi-canvas-run-history', 'invalid json{')

      const runs = loadRuns()

      expect(runs).toEqual([])
    })
  })
})
