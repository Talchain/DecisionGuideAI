/**
 * Document Memory Guard Tests (P0 Hotfix)
 *
 * Verifies that addDocument:
 * - Rejects files >1MB with proper error message
 * - Truncates content to 5k chars per file
 * - Enforces 25k total char limit across documents
 * - Stores text only + metadata (no blobs)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('Document Memory Guard', () => {
  beforeEach(() => {
    // Reset documents to clean state
    useCanvasStore.setState({
      documents: []
    })
  })

  describe('addDocument', () => {
    it('should reject files >1MB with proper error message', () => {
      const { addDocument } = useCanvasStore.getState()

      const largeDoc = {
        name: 'large-file.pdf',
        type: 'pdf' as const,
        content: 'Some content',
        size: 2 * 1024 * 1024 // 2MB
      }

      expect(() => addDocument(largeDoc)).toThrow(
        'This file is too large for in-app preview. Please reduce its size.'
      )
    })

    it('should truncate content to 5k chars and append ellipsis', () => {
      const { addDocument } = useCanvasStore.getState()

      const longContent = 'x'.repeat(6000) // 6k chars
      const doc = {
        name: 'long-doc.txt',
        type: 'txt' as const,
        content: longContent,
        size: 6000
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.content).toHaveLength(5001) // 5000 + '…'
      expect(stored!.content.endsWith('…')).toBe(true)
      expect(stored!.truncated).toBe(true)
      expect(stored!.displayBytes).toBe(5001)
    })

    it('should not truncate content ≤5k chars', () => {
      const { addDocument } = useCanvasStore.getState()

      const shortContent = 'x'.repeat(4000) // 4k chars
      const doc = {
        name: 'short-doc.txt',
        type: 'txt' as const,
        content: shortContent,
        size: 4000
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.content).toHaveLength(4000)
      expect(stored!.content).not.toContain('…')
      expect(stored!.truncated).toBe(false)
      expect(stored!.displayBytes).toBe(4000)
    })

    it('should enforce 25k total char limit', () => {
      const { addDocument } = useCanvasStore.getState()

      // Add first doc: 5k chars (will be stored as 5001 after truncation)
      addDocument({
        name: 'doc1.txt',
        type: 'txt',
        content: 'a'.repeat(6000), // Will be truncated to 5000 + '…'
        size: 6000
      })

      // Add second doc: 5k chars
      addDocument({
        name: 'doc2.txt',
        type: 'txt',
        content: 'b'.repeat(6000),
        size: 6000
      })

      // Add third doc: 5k chars
      addDocument({
        name: 'doc3.txt',
        type: 'txt',
        content: 'c'.repeat(6000),
        size: 6000
      })

      // Add fourth doc: 5k chars
      addDocument({
        name: 'doc4.txt',
        type: 'txt',
        content: 'd'.repeat(6000),
        size: 6000
      })

      // Total now: 4 * 5001 = 20004 chars

      // Try to add fifth doc: 5k chars (would exceed 25k limit)
      expect(() => addDocument({
        name: 'doc5.txt',
        type: 'txt',
        content: 'e'.repeat(6000),
        size: 6000
      })).toThrow('Document storage limit reached (25000 chars)')
    })

    it('should store text only + metadata (no blobs)', () => {
      const { addDocument } = useCanvasStore.getState()

      const doc = {
        name: 'test.md',
        type: 'md' as const,
        content: 'Markdown content here',
        size: 100
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.id).toBe(id)
      expect(stored!.name).toBe('test.md')
      expect(stored!.type).toBe('md')
      expect(stored!.content).toBe('Markdown content here')
      expect(stored!.size).toBe(100)
      expect(stored!.displayBytes).toBe(21)
      expect(stored!.truncated).toBe(false)
      expect(stored!.checksum).toBeDefined()
      expect(stored!.uploadedAt).toBeInstanceOf(Date)

      // Should not have any Blob or File properties
      expect(stored).not.toHaveProperty('blob')
      expect(stored).not.toHaveProperty('file')
      expect(stored).not.toHaveProperty('arrayBuffer')
    })

    it('should generate checksum for content', () => {
      const { addDocument } = useCanvasStore.getState()

      const doc = {
        name: 'test.txt',
        type: 'txt' as const,
        content: 'Test content',
        size: 50
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.checksum).toBeDefined()
      expect(typeof stored!.checksum).toBe('string')
      expect(stored!.checksum!.length).toBeGreaterThan(0)
    })

    it('should handle empty content', () => {
      const { addDocument } = useCanvasStore.getState()

      const doc = {
        name: 'empty.txt',
        type: 'txt' as const,
        content: '',
        size: 0
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.content).toBe('')
      expect(stored!.displayBytes).toBe(0)
      expect(stored!.truncated).toBe(false)
    })

    it('should handle exactly 5k chars (boundary)', () => {
      const { addDocument } = useCanvasStore.getState()

      const exactContent = 'x'.repeat(5000) // Exactly 5k
      const doc = {
        name: 'exact-5k.txt',
        type: 'txt' as const,
        content: exactContent,
        size: 5000
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.content).toHaveLength(5000)
      expect(stored!.content).not.toContain('…')
      expect(stored!.truncated).toBe(false)
      expect(stored!.displayBytes).toBe(5000)
    })

    it('should handle exactly 5001 chars (just over boundary)', () => {
      const { addDocument } = useCanvasStore.getState()

      const overContent = 'x'.repeat(5001) // 1 char over
      const doc = {
        name: 'over-5k.txt',
        type: 'txt' as const,
        content: overContent,
        size: 5001
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.content).toHaveLength(5001) // 5000 + '…'
      expect(stored!.content.endsWith('…')).toBe(true)
      expect(stored!.truncated).toBe(true)
    })

    it('should calculate displayBytes correctly after truncation', () => {
      const { addDocument } = useCanvasStore.getState()

      const doc = {
        name: 'test.txt',
        type: 'txt' as const,
        content: 'x'.repeat(7000), // Will be truncated
        size: 7000
      }

      const id = addDocument(doc)
      const stored = useCanvasStore.getState().documents.find(d => d.id === id)

      expect(stored).toBeDefined()
      expect(stored!.displayBytes).toBe(5001) // 5000 + '…'
      expect(stored!.size).toBe(7000) // Original size preserved
    })
  })
})
