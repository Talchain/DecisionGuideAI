/**
 * Notes Store Tests - Undo/Redo functionality
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useNotesStore, type NoteBlock } from '../notesStore'

describe('notesStore', () => {
  beforeEach(() => {
    // Reset store
    useNotesStore.setState({
      blocks: [],
      history: { past: [], future: [] }
    })
  })

  it('starts with empty blocks', () => {
    const { blocks } = useNotesStore.getState()
    expect(blocks).toEqual([])
  })

  it('adds a block', () => {
    const { addBlock } = useNotesStore.getState()
    
    const block: NoteBlock = {
      id: 'test-1',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        template_id: 'pricing-v1',
        seed: 42,
        response_hash: 'abc123',
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 },
        belief_mode: 'strict'
      }
    }
    
    addBlock(block)
    
    const { blocks } = useNotesStore.getState()
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual(block)
  })

  it('undo removes the last added block', () => {
    const { addBlock, undo } = useNotesStore.getState()
    
    const block: NoteBlock = {
      id: 'test-1',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        seed: 42,
        response_hash: 'abc123',
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 },
        belief_mode: 'strict'
      }
    }
    
    addBlock(block)
    expect(useNotesStore.getState().blocks).toHaveLength(1)
    
    undo()
    expect(useNotesStore.getState().blocks).toHaveLength(0)
  })

  it('redo restores the undone block', () => {
    const { addBlock, undo, redo } = useNotesStore.getState()
    
    const block: NoteBlock = {
      id: 'test-1',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        seed: 42,
        response_hash: 'abc123',
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 },
        belief_mode: 'strict'
      }
    }
    
    addBlock(block)
    undo()
    redo()
    
    const { blocks } = useNotesStore.getState()
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual(block)
  })

  it('clears future when new action after undo', () => {
    const { addBlock, undo } = useNotesStore.getState()
    
    const block1: NoteBlock = {
      id: 'test-1',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        seed: 42,
        response_hash: 'abc123',
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 },
        belief_mode: 'strict'
      }
    }
    
    const block2: NoteBlock = {
      id: 'test-2',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        seed: 43,
        response_hash: 'def456',
        bands: { p10: 15, p50: 55, p90: 95 },
        confidence: { level: 'medium', score: 0.7 },
        belief_mode: 'as_provided'
      }
    }
    
    addBlock(block1)
    undo()
    
    // Future should have one entry
    expect(useNotesStore.getState().history.future).toHaveLength(1)
    
    // Add new block - should clear future
    addBlock(block2)
    expect(useNotesStore.getState().history.future).toHaveLength(0)
  })

  it('maintains immutability', () => {
    const { addBlock } = useNotesStore.getState()
    
    const block: NoteBlock = {
      id: 'test-1',
      type: 'plot_result',
      timestamp: new Date().toISOString(),
      data: {
        seed: 42,
        response_hash: 'abc123',
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 },
        belief_mode: 'strict'
      }
    }
    
    addBlock(block)
    
    const { blocks: blocks1 } = useNotesStore.getState()
    addBlock({ ...block, id: 'test-2' })
    const { blocks: blocks2 } = useNotesStore.getState()
    
    // Should be different arrays
    expect(blocks1).not.toBe(blocks2)
  })
})
