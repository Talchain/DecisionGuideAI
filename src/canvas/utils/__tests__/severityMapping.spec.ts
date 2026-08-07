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
  // v2.1: New unified display utilities
  SEVERITY_DISPLAY,
  getSeverityDisplay,
  getSeverityContainerClass,
  hasBlocker,
  sortBySeverity,
  normaliseSeverity,
  type DraftWarningSeverity,
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

  // ==========================================================================
  // v2.1: Unified Severity Display Tests
  // ==========================================================================

  describe('SEVERITY_DISPLAY', () => {
    it('has all four severity levels', () => {
      expect(SEVERITY_DISPLAY.blocker).toBeDefined()
      expect(SEVERITY_DISPLAY.high).toBeDefined()
      expect(SEVERITY_DISPLAY.medium).toBeDefined()
      expect(SEVERITY_DISPLAY.low).toBeDefined()
    })

    it('blocker blocks analysis', () => {
      expect(SEVERITY_DISPLAY.blocker.blocksAnalysis).toBe(true)
    })

    it('other severities do not block analysis', () => {
      expect(SEVERITY_DISPLAY.high.blocksAnalysis).toBe(false)
      expect(SEVERITY_DISPLAY.medium.blocksAnalysis).toBe(false)
      expect(SEVERITY_DISPLAY.low.blocksAnalysis).toBe(false)
    })

    it('has correct sort order', () => {
      expect(SEVERITY_DISPLAY.blocker.sortOrder).toBeLessThan(SEVERITY_DISPLAY.high.sortOrder)
      expect(SEVERITY_DISPLAY.high.sortOrder).toBeLessThan(SEVERITY_DISPLAY.medium.sortOrder)
      expect(SEVERITY_DISPLAY.medium.sortOrder).toBeLessThan(SEVERITY_DISPLAY.low.sortOrder)
    })

    it('has all required styling properties', () => {
      const severities: DraftWarningSeverity[] = ['blocker', 'high', 'medium', 'low']
      for (const sev of severities) {
        const display = SEVERITY_DISPLAY[sev]
        expect(display.label).toBeTruthy()
        expect(display.bg).toMatch(/^bg-/)
        expect(display.border).toMatch(/^border-/)
        expect(display.text).toMatch(/^text-/)
        expect(display.icon).toMatch(/^text-/)
        expect(display.caption).toMatch(/^text-/)
      }
    })
  })

  describe('getSeverityDisplay', () => {
    it('returns correct display for each severity', () => {
      expect(getSeverityDisplay('blocker').label).toBe('Blocker')
      expect(getSeverityDisplay('high').label).toBe('High')
      expect(getSeverityDisplay('medium').label).toBe('Medium')
      expect(getSeverityDisplay('low').label).toBe('Low')
    })

    it('returns low display for unknown severity', () => {
      // @ts-expect-error Testing invalid input
      expect(getSeverityDisplay('invalid')).toEqual(SEVERITY_DISPLAY.low)
    })
  })

  describe('getSeverityContainerClass', () => {
    it('returns combined bg and border classes', () => {
      const classes = getSeverityContainerClass('blocker')
      expect(classes).toContain('bg-panel')
      expect(classes).toContain('border-danger/30')
    })
  })

  describe('hasBlocker', () => {
    it('returns true when blocker severity present', () => {
      const warnings = [
        { severity: 'high' as const },
        { severity: 'blocker' as const },
        { severity: 'low' as const },
      ]
      expect(hasBlocker(warnings)).toBe(true)
    })

    it('returns false when no blocker severity', () => {
      const warnings = [
        { severity: 'high' as const },
        { severity: 'medium' as const },
        { severity: 'low' as const },
      ]
      expect(hasBlocker(warnings)).toBe(false)
    })

    it('returns false for empty array', () => {
      expect(hasBlocker([])).toBe(false)
    })
  })

  describe('sortBySeverity', () => {
    it('sorts warnings by severity order', () => {
      const warnings = [
        { severity: 'low' as const, id: '1' },
        { severity: 'blocker' as const, id: '2' },
        { severity: 'medium' as const, id: '3' },
        { severity: 'high' as const, id: '4' },
      ]

      const sorted = sortBySeverity(warnings)

      expect(sorted[0].severity).toBe('blocker')
      expect(sorted[1].severity).toBe('high')
      expect(sorted[2].severity).toBe('medium')
      expect(sorted[3].severity).toBe('low')
    })

    it('preserves original array', () => {
      const warnings = [
        { severity: 'low' as const },
        { severity: 'blocker' as const },
      ]

      sortBySeverity(warnings)

      expect(warnings[0].severity).toBe('low')
      expect(warnings[1].severity).toBe('blocker')
    })
  })

  describe('normaliseSeverity', () => {
    it('normalises BLOCKER variants to blocker', () => {
      expect(normaliseSeverity('BLOCKER')).toBe('blocker')
      expect(normaliseSeverity('blocker')).toBe('blocker')
      expect(normaliseSeverity('ERROR')).toBe('blocker')
      expect(normaliseSeverity('CRITICAL')).toBe('blocker')
    })

    it('normalises HIGH variants to high', () => {
      expect(normaliseSeverity('HIGH')).toBe('high')
      expect(normaliseSeverity('high')).toBe('high')
      expect(normaliseSeverity('WARNING')).toBe('high')
    })

    it('normalises MEDIUM to medium', () => {
      expect(normaliseSeverity('MEDIUM')).toBe('medium')
      expect(normaliseSeverity('medium')).toBe('medium')
    })

    it('normalises LOW and INFO to low', () => {
      expect(normaliseSeverity('LOW')).toBe('low')
      expect(normaliseSeverity('low')).toBe('low')
      expect(normaliseSeverity('INFO')).toBe('low')
    })

    it('handles null and undefined', () => {
      expect(normaliseSeverity(null)).toBe('low')
      expect(normaliseSeverity(undefined)).toBe('low')
    })

    it('defaults unknown values to low', () => {
      expect(normaliseSeverity('unknown')).toBe('low')
      expect(normaliseSeverity('')).toBe('low')
    })
  })
})
