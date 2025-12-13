/**
 * Graph Preflight Validation Tests
 *
 * Task 4.5: Tests for constraint validation including disconnected constraint warning
 */
import { describe, it, expect } from 'vitest'
import { validateGraph } from '../graphPreflight'
import type { UiGraph } from '../../../types/plot'

describe('validateGraph', () => {
  describe('disconnected constraint validation (Task 4.5)', () => {
    it('warns when constraint node is not connected to any edges', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Choose Option' } },
          { id: 'option-1', type: 'option', data: { label: 'Option A' } },
          { id: 'constraint-1', type: 'constraint', data: { label: 'Budget Cap' } },
        ],
        edges: [
          { id: 'e1', source: 'decision-1', target: 'option-1', data: {} },
        ],
      }

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].code).toBe('BAD_INPUT')
      expect(result.violations[0].message).toContain('Budget Cap')
      expect(result.violations[0].message).toContain('not connected')
    })

    it('does not warn when constraint node is connected', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Choose Option' } },
          { id: 'option-1', type: 'option', data: { label: 'Option A' } },
          { id: 'constraint-1', type: 'constraint', data: { label: 'Budget Cap' } },
        ],
        edges: [
          { id: 'e1', source: 'decision-1', target: 'option-1', data: {} },
          { id: 'e2', source: 'constraint-1', target: 'option-1', data: {} },
        ],
      }

      const result = validateGraph(graph)

      // No constraint-related violations
      const constraintViolations = result.violations.filter((v) =>
        v.message.includes('Constraint')
      )
      expect(constraintViolations).toHaveLength(0)
    })

    it('handles constraint as target node', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'factor-1', type: 'factor', data: { label: 'Cost' } },
          { id: 'constraint-1', type: 'constraint', data: { label: 'Max Cost' } },
        ],
        edges: [
          { id: 'e1', source: 'factor-1', target: 'constraint-1', data: {} },
        ],
      }

      const result = validateGraph(graph)

      const constraintViolations = result.violations.filter((v) =>
        v.message.includes('Constraint')
      )
      expect(constraintViolations).toHaveLength(0)
    })

    it('warns for multiple disconnected constraints', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Choose' } },
          { id: 'constraint-1', type: 'constraint', data: { label: 'Budget' } },
          { id: 'constraint-2', type: 'constraint', data: { label: 'Timeline' } },
        ],
        edges: [],
      }

      const result = validateGraph(graph)

      const constraintViolations = result.violations.filter((v) =>
        v.message.includes('not connected')
      )
      expect(constraintViolations).toHaveLength(2)
    })

    it('does not warn for non-constraint disconnected nodes', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'factor-1', type: 'factor', data: { label: 'Disconnected Factor' } },
        ],
        edges: [],
      }

      const result = validateGraph(graph)

      const constraintViolations = result.violations.filter((v) =>
        v.message.includes('not connected')
      )
      expect(constraintViolations).toHaveLength(0)
    })
  })

  describe('basic validation', () => {
    it('validates empty graph as valid', () => {
      const graph: UiGraph = { nodes: [], edges: [] }
      const result = validateGraph(graph)
      expect(result.valid).toBe(true)
    })

    it('validates node with missing ID', () => {
      const graph: UiGraph = {
        nodes: [{ id: '', type: 'decision', data: { label: 'Test' } }],
        edges: [],
      }

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.violations.some((v) => v.code === 'MISSING_FIELD')).toBe(true)
    })

    it('validates edge with missing source', () => {
      const graph: UiGraph = {
        nodes: [{ id: 'node-1', type: 'decision', data: { label: 'Test' } }],
        edges: [{ id: 'e1', source: '', target: 'node-1', data: {} }],
      }

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.violations.some((v) => v.field.includes('source'))).toBe(true)
    })
  })
})
