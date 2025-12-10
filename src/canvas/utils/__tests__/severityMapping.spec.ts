/**
 * Severity Mapping Utility Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mapSeverityToPriority,
  mapSeverityToGuidance,
  mapCeeLevelToSeverity,
  priorityToGuidanceSeverity,
  isBlockingPriority,
  sortByPriority,
  PRIORITY_ORDER,
  type ActionPriority,
} from '../severityMapping'

describe('severityMapping', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('mapSeverityToPriority', () => {
    describe('validation source', () => {
      it('maps ERROR to critical', () => {
        expect(mapSeverityToPriority('ERROR', 'validation')).toBe('critical')
        expect(mapSeverityToPriority('error', 'validation')).toBe('critical')
      })

      it('maps BLOCKER to critical', () => {
        expect(mapSeverityToPriority('BLOCKER', 'validation')).toBe('critical')
        expect(mapSeverityToPriority('blocker', 'validation')).toBe('critical')
      })

      it('maps WARNING to high', () => {
        expect(mapSeverityToPriority('WARNING', 'validation')).toBe('high')
        expect(mapSeverityToPriority('warning', 'validation')).toBe('high')
      })

      it('maps INFO to medium', () => {
        expect(mapSeverityToPriority('INFO', 'validation')).toBe('medium')
      })

      it('maps unknown to medium', () => {
        expect(mapSeverityToPriority('unknown', 'validation')).toBe('medium')
      })
    })

    describe('critique source', () => {
      it('maps BLOCKER to critical', () => {
        expect(mapSeverityToPriority('BLOCKER', 'critique')).toBe('critical')
      })

      it('maps WARNING to high', () => {
        expect(mapSeverityToPriority('WARNING', 'critique')).toBe('high')
      })

      it('maps INFO to medium', () => {
        expect(mapSeverityToPriority('INFO', 'critique')).toBe('medium')
      })
    })

    describe('bias source', () => {
      it('maps CRITICAL to critical', () => {
        expect(mapSeverityToPriority('CRITICAL', 'bias')).toBe('critical')
      })

      it('maps HIGH to critical', () => {
        expect(mapSeverityToPriority('HIGH', 'bias')).toBe('critical')
      })

      it('maps MEDIUM to high', () => {
        expect(mapSeverityToPriority('MEDIUM', 'bias')).toBe('high')
      })

      it('maps WARNING to high', () => {
        expect(mapSeverityToPriority('WARNING', 'bias')).toBe('high')
      })

      it('maps LOW to medium', () => {
        expect(mapSeverityToPriority('LOW', 'bias')).toBe('medium')
      })
    })

    describe('readiness source', () => {
      it('maps HIGH to high', () => {
        expect(mapSeverityToPriority('HIGH', 'readiness')).toBe('high')
      })

      it('maps MEDIUM to medium', () => {
        expect(mapSeverityToPriority('MEDIUM', 'readiness')).toBe('medium')
      })

      it('maps LOW to low', () => {
        expect(mapSeverityToPriority('LOW', 'readiness')).toBe('low')
      })

      it('maps unknown to low', () => {
        expect(mapSeverityToPriority('unknown', 'readiness')).toBe('low')
      })
    })

    describe('cee source', () => {
      it('maps CRITICAL to critical', () => {
        expect(mapSeverityToPriority('CRITICAL', 'cee')).toBe('critical')
      })

      it('maps ERROR to critical', () => {
        expect(mapSeverityToPriority('ERROR', 'cee')).toBe('critical')
      })

      it('maps BLOCKER to critical', () => {
        expect(mapSeverityToPriority('BLOCKER', 'cee')).toBe('critical')
      })

      it('maps HIGH to high', () => {
        expect(mapSeverityToPriority('HIGH', 'cee')).toBe('high')
      })

      it('maps WARNING to high', () => {
        expect(mapSeverityToPriority('WARNING', 'cee')).toBe('high')
      })

      it('maps MEDIUM to medium', () => {
        expect(mapSeverityToPriority('MEDIUM', 'cee')).toBe('medium')
      })

      it('maps LOW to low', () => {
        expect(mapSeverityToPriority('LOW', 'cee')).toBe('low')
      })
    })

    describe('edge cases', () => {
      it('handles null severity', () => {
        expect(mapSeverityToPriority(null, 'validation')).toBe('medium')
      })

      it('handles undefined severity', () => {
        expect(mapSeverityToPriority(undefined, 'validation')).toBe('medium')
      })

      it('handles empty string severity', () => {
        expect(mapSeverityToPriority('', 'validation')).toBe('medium')
      })

      it('warns for unknown source', () => {
        mapSeverityToPriority('INFO', 'unknown' as any)
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown source')
        )
      })
    })
  })

  describe('mapSeverityToGuidance', () => {
    it('maps critical priority to blocker', () => {
      expect(mapSeverityToGuidance('ERROR', 'validation')).toBe('blocker')
    })

    it('maps high priority to warning', () => {
      expect(mapSeverityToGuidance('WARNING', 'validation')).toBe('warning')
    })

    it('maps medium priority to info', () => {
      expect(mapSeverityToGuidance('INFO', 'validation')).toBe('info')
    })

    it('maps low priority to info', () => {
      expect(mapSeverityToGuidance('LOW', 'readiness')).toBe('info')
    })
  })

  describe('mapCeeLevelToSeverity', () => {
    describe('critical levels', () => {
      it('maps CRITICAL to ERROR', () => {
        expect(mapCeeLevelToSeverity('CRITICAL')).toBe('ERROR')
      })

      it('maps WEAK to ERROR', () => {
        expect(mapCeeLevelToSeverity('WEAK')).toBe('ERROR')
        expect(mapCeeLevelToSeverity('weak')).toBe('ERROR')
      })

      it('maps NEEDS_WORK to ERROR', () => {
        expect(mapCeeLevelToSeverity('NEEDS_WORK')).toBe('ERROR')
      })

      it('maps POOR to ERROR', () => {
        expect(mapCeeLevelToSeverity('POOR')).toBe('ERROR')
      })

      it('maps MISSING to ERROR', () => {
        expect(mapCeeLevelToSeverity('MISSING')).toBe('ERROR')
      })
    })

    describe('warning levels', () => {
      it('maps WARNING to WARNING', () => {
        expect(mapCeeLevelToSeverity('WARNING')).toBe('WARNING')
      })

      it('maps FAIR to WARNING', () => {
        expect(mapCeeLevelToSeverity('FAIR')).toBe('WARNING')
        expect(mapCeeLevelToSeverity('fair')).toBe('WARNING')
      })

      it('maps MODERATE to WARNING', () => {
        expect(mapCeeLevelToSeverity('MODERATE')).toBe('WARNING')
      })

      it('maps PARTIAL to WARNING', () => {
        expect(mapCeeLevelToSeverity('PARTIAL')).toBe('WARNING')
      })
    })

    describe('info levels', () => {
      it('maps ADEQUATE to INFO', () => {
        expect(mapCeeLevelToSeverity('ADEQUATE')).toBe('INFO')
        expect(mapCeeLevelToSeverity('adequate')).toBe('INFO')
      })

      it('maps GOOD to INFO', () => {
        expect(mapCeeLevelToSeverity('GOOD')).toBe('INFO')
      })

      it('maps STRONG to INFO', () => {
        expect(mapCeeLevelToSeverity('STRONG')).toBe('INFO')
        expect(mapCeeLevelToSeverity('strong')).toBe('INFO')
      })

      it('maps EXCELLENT to INFO', () => {
        expect(mapCeeLevelToSeverity('EXCELLENT')).toBe('INFO')
      })
    })

    describe('edge cases', () => {
      it('handles null level', () => {
        expect(mapCeeLevelToSeverity(null)).toBe('INFO')
      })

      it('handles undefined level', () => {
        expect(mapCeeLevelToSeverity(undefined)).toBe('INFO')
      })

      it('handles empty string level', () => {
        expect(mapCeeLevelToSeverity('')).toBe('INFO')
      })

      it('warns for unknown level', () => {
        mapCeeLevelToSeverity('UNKNOWN_LEVEL')
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown CEE level')
        )
      })
    })
  })

  describe('priorityToGuidanceSeverity', () => {
    it('maps critical to blocker', () => {
      expect(priorityToGuidanceSeverity('critical')).toBe('blocker')
    })

    it('maps high to warning', () => {
      expect(priorityToGuidanceSeverity('high')).toBe('warning')
    })

    it('maps medium to info', () => {
      expect(priorityToGuidanceSeverity('medium')).toBe('info')
    })

    it('maps low to info', () => {
      expect(priorityToGuidanceSeverity('low')).toBe('info')
    })
  })

  describe('isBlockingPriority', () => {
    it('returns true for critical', () => {
      expect(isBlockingPriority('critical')).toBe(true)
    })

    it('returns false for high', () => {
      expect(isBlockingPriority('high')).toBe(false)
    })

    it('returns false for medium', () => {
      expect(isBlockingPriority('medium')).toBe(false)
    })

    it('returns false for low', () => {
      expect(isBlockingPriority('low')).toBe(false)
    })
  })

  describe('sortByPriority', () => {
    it('sorts items by priority order', () => {
      const items: Array<{ priority: ActionPriority; name: string }> = [
        { priority: 'low', name: 'low-item' },
        { priority: 'critical', name: 'critical-item' },
        { priority: 'medium', name: 'medium-item' },
        { priority: 'high', name: 'high-item' },
      ]

      const sorted = sortByPriority(items)

      expect(sorted[0].priority).toBe('critical')
      expect(sorted[1].priority).toBe('high')
      expect(sorted[2].priority).toBe('medium')
      expect(sorted[3].priority).toBe('low')
    })

    it('preserves original array', () => {
      const items: Array<{ priority: ActionPriority }> = [
        { priority: 'low' },
        { priority: 'critical' },
      ]

      sortByPriority(items)

      expect(items[0].priority).toBe('low')
      expect(items[1].priority).toBe('critical')
    })

    it('handles empty array', () => {
      expect(sortByPriority([])).toEqual([])
    })

    it('handles single item', () => {
      const items: Array<{ priority: ActionPriority }> = [{ priority: 'medium' }]
      expect(sortByPriority(items)).toHaveLength(1)
    })
  })

  describe('PRIORITY_ORDER constant', () => {
    it('has correct order values', () => {
      expect(PRIORITY_ORDER.critical).toBeLessThan(PRIORITY_ORDER.high)
      expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.medium)
      expect(PRIORITY_ORDER.medium).toBeLessThan(PRIORITY_ORDER.low)
    })
  })
})
