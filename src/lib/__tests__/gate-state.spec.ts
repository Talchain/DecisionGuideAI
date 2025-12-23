/**
 * Tests for gate-state.ts
 *
 * Verifies:
 * - Gate initialization with defaults
 * - Gate status updates
 * - Blocking/demotion logic
 * - Reset functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGateStore,
  _resetGateStore,
  getBlockedElement,
  getGateDefault,
  ALL_GATES,
  updateRobustnessGate,
  type GateName,
} from '../gate-state'

describe('gate-state', () => {
  beforeEach(() => {
    _resetGateStore()
  })

  describe('initialization', () => {
    it('initializes all gates with defaults', () => {
      const { gates } = useGateStore.getState()

      expect(gates.graph_readiness.status).toBe('fail')
      expect(gates.validation.status).toBe('warn')
      expect(gates.run.status).toBe('fail')
      expect(gates.robustness.status).toBe('warn')
    })

    it('sets updatedAt timestamp on initialization', () => {
      const { gates } = useGateStore.getState()

      for (const gate of ALL_GATES) {
        expect(gates[gate].updatedAt).toBeDefined()
        expect(new Date(gates[gate].updatedAt).getTime()).toBeLessThanOrEqual(Date.now())
      }
    })
  })

  describe('setGate', () => {
    it('updates gate status', () => {
      const { setGate, gates } = useGateStore.getState()

      setGate('graph_readiness', 'pass')

      const updated = useGateStore.getState().gates
      expect(updated.graph_readiness.status).toBe('pass')
    })

    it('updates timestamp on status change', () => {
      const { setGate } = useGateStore.getState()
      const before = useGateStore.getState().gates.graph_readiness.updatedAt

      // Small delay to ensure different timestamp
      setGate('graph_readiness', 'pass')

      const after = useGateStore.getState().gates.graph_readiness.updatedAt
      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
    })

    it('stores optional metadata', () => {
      const { setGate } = useGateStore.getState()

      setGate('validation', 'fail', {
        requestId: 'test-123',
        message: 'Validation failed due to missing edges',
        service: 'isl',
      })

      const { gates } = useGateStore.getState()
      expect(gates.validation.requestId).toBe('test-123')
      expect(gates.validation.message).toBe('Validation failed due to missing edges')
      expect(gates.validation.service).toBe('isl')
    })
  })

  describe('resetGate', () => {
    it('resets a single gate to its default', () => {
      const { setGate, resetGate } = useGateStore.getState()

      setGate('graph_readiness', 'pass')
      expect(useGateStore.getState().gates.graph_readiness.status).toBe('pass')

      resetGate('graph_readiness')
      expect(useGateStore.getState().gates.graph_readiness.status).toBe('fail')
    })

    it('does not affect other gates', () => {
      const { setGate, resetGate } = useGateStore.getState()

      setGate('graph_readiness', 'pass')
      setGate('validation', 'pass')

      resetGate('graph_readiness')

      const { gates } = useGateStore.getState()
      expect(gates.graph_readiness.status).toBe('fail')
      expect(gates.validation.status).toBe('pass')
    })
  })

  describe('resetAllGates', () => {
    it('resets all gates to defaults', () => {
      const { setGate, resetAllGates } = useGateStore.getState()

      // Set all gates to pass
      for (const gate of ALL_GATES) {
        setGate(gate, 'pass')
      }

      resetAllGates()

      const { gates } = useGateStore.getState()
      expect(gates.graph_readiness.status).toBe('fail')
      expect(gates.validation.status).toBe('warn')
      expect(gates.run.status).toBe('fail')
      expect(gates.robustness.status).toBe('warn')
    })
  })

  describe('getGateStatus', () => {
    it('returns current gate status', () => {
      const { setGate, getGateStatus } = useGateStore.getState()

      setGate('run', 'pass')
      expect(getGateStatus('run')).toBe('pass')
    })

    it('returns default if gate not explicitly set', () => {
      const { getGateStatus } = useGateStore.getState()
      expect(getGateStatus('graph_readiness')).toBe('fail')
    })
  })

  describe('isBlocked', () => {
    it('returns true for fail status on graph_readiness', () => {
      const { isBlocked } = useGateStore.getState()
      expect(isBlocked('graph_readiness')).toBe(true)
    })

    it('returns false for pass status', () => {
      const { setGate, isBlocked } = useGateStore.getState()
      setGate('graph_readiness', 'pass')
      expect(useGateStore.getState().isBlocked('graph_readiness')).toBe(false)
    })

    it('validation only blocks on fail, not warn', () => {
      const { setGate, isBlocked } = useGateStore.getState()

      // Default is warn
      expect(isBlocked('validation')).toBe(false)

      setGate('validation', 'fail')
      expect(useGateStore.getState().isBlocked('validation')).toBe(true)
    })

    it('robustness only blocks on fail, not warn', () => {
      const { setGate, isBlocked } = useGateStore.getState()

      // Default is warn
      expect(isBlocked('robustness')).toBe(false)

      setGate('robustness', 'fail')
      expect(useGateStore.getState().isBlocked('robustness')).toBe(true)
    })
  })

  describe('isDemoted', () => {
    it('returns true for warn status', () => {
      const { isDemoted } = useGateStore.getState()
      expect(isDemoted('validation')).toBe(true)
      expect(isDemoted('robustness')).toBe(true)
    })

    it('returns false for pass status', () => {
      const { setGate, isDemoted } = useGateStore.getState()
      setGate('validation', 'pass')
      expect(useGateStore.getState().isDemoted('validation')).toBe(false)
    })

    it('returns false for fail status', () => {
      const { setGate, isDemoted } = useGateStore.getState()
      setGate('validation', 'fail')
      expect(useGateStore.getState().isDemoted('validation')).toBe(false)
    })
  })

  describe('getIssues', () => {
    it('returns all non-pass gates', () => {
      const { getIssues } = useGateStore.getState()

      const issues = getIssues()
      expect(issues.length).toBe(4) // All gates start with non-pass status
    })

    it('excludes passing gates', () => {
      const { setGate, getIssues } = useGateStore.getState()

      setGate('graph_readiness', 'pass')
      setGate('run', 'pass')

      const issues = useGateStore.getState().getIssues()
      expect(issues.length).toBe(2)
      expect(issues.map((i) => i.gate)).not.toContain('graph_readiness')
      expect(issues.map((i) => i.gate)).not.toContain('run')
    })

    it('returns empty array when all gates pass', () => {
      const { setGate, getIssues } = useGateStore.getState()

      for (const gate of ALL_GATES) {
        setGate(gate, 'pass')
      }

      const issues = useGateStore.getState().getIssues()
      expect(issues.length).toBe(0)
    })
  })

  describe('getGateSnapshot', () => {
    it('returns a copy of all gate records', () => {
      const { setGate, getGateSnapshot } = useGateStore.getState()

      setGate('graph_readiness', 'pass', { message: 'test message' })

      const snapshot = getGateSnapshot()
      expect(snapshot.graph_readiness.status).toBe('pass')
      expect(snapshot.graph_readiness.message).toBe('test message')

      // Verify it's a copy
      snapshot.graph_readiness.status = 'fail'
      expect(useGateStore.getState().gates.graph_readiness.status).toBe('pass')
    })
  })

  describe('helper functions', () => {
    it('getBlockedElement returns correct elements', () => {
      expect(getBlockedElement('graph_readiness')).toBe('run_button')
      expect(getBlockedElement('validation')).toBe('results_panel')
      expect(getBlockedElement('run')).toBe('insights_panel')
      expect(getBlockedElement('robustness')).toBe('confidence_display')
    })

    it('getGateDefault returns correct defaults', () => {
      expect(getGateDefault('graph_readiness')).toBe('fail')
      expect(getGateDefault('validation')).toBe('warn')
      expect(getGateDefault('run')).toBe('fail')
      expect(getGateDefault('robustness')).toBe('warn')
    })

    it('ALL_GATES contains all gate names', () => {
      expect(ALL_GATES).toContain('graph_readiness')
      expect(ALL_GATES).toContain('validation')
      expect(ALL_GATES).toContain('run')
      expect(ALL_GATES).toContain('robustness')
      expect(ALL_GATES.length).toBe(4)
    })
  })

  // =============================================================================
  // Factor Sensitivity Phase 1: updateRobustnessGate helper
  // =============================================================================

  describe('updateRobustnessGate', () => {
    it('sets pass when both edges and factors are available', () => {
      updateRobustnessGate(
        {
          edges: [{ edge_id: 'e1' }],
          factors: [{ factor_id: 'f1' }],
        },
        'available'
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('pass')
      expect(gates.robustness.message).toBe('Full sensitivity analysis complete')
    })

    it('sets warn when edges available but factor status is unavailable', () => {
      updateRobustnessGate(
        {
          edges: [{ edge_id: 'e1' }],
          factors: [],
        },
        'unavailable'
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('warn')
      expect(gates.robustness.message).toBe('Factor sensitivity temporarily unavailable')
    })

    it('sets warn when edges available but factor status is skipped', () => {
      updateRobustnessGate(
        {
          edges: [{ edge_id: 'e1' }],
        },
        'skipped'
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('warn')
      expect(gates.robustness.message).toBe('Add factor values for full analysis')
    })

    it('sets warn when edges available but no factor info', () => {
      updateRobustnessGate(
        {
          edges: [{ edge_id: 'e1' }],
        },
        null
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('warn')
      expect(gates.robustness.message).toBe('Edge sensitivity only')
    })

    it('sets fail when no sensitivity data available (null)', () => {
      updateRobustnessGate(null, null)

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('fail')
      expect(gates.robustness.message).toBe('No sensitivity data available')
    })

    it('sets fail when no sensitivity data available (empty edges)', () => {
      updateRobustnessGate(
        {
          edges: [],
          factors: [],
        },
        'available'
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('fail')
      expect(gates.robustness.message).toBe('No sensitivity data available')
    })

    it('handles undefined sensitivity', () => {
      updateRobustnessGate(undefined, undefined)

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('fail')
    })

    it('sets pass when factors present regardless of factor status field', () => {
      // Even if factorStatus is missing, having factors means we have the data
      updateRobustnessGate(
        {
          edges: [{ edge_id: 'e1' }],
          factors: [{ factor_id: 'f1' }],
        },
        undefined
      )

      const { gates } = useGateStore.getState()
      expect(gates.robustness.status).toBe('pass')
    })
  })
})
