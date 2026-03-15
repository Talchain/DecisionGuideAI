/**
 * Wave 2 P0: UI Error-State Integration Tests
 *
 * Validates that error states render user-friendly messages with no crash.
 * Covers: DegradedStateBanner (timeout, partial), error taxonomy display,
 * and createErrorReport fallback.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DegradedStateBanner, type AnalysisTypeStatus } from '../canvas/components/DegradedStateBanner'
import { mapErrorType, type ErrorType } from '../lib/errorTaxonomy'
import { createErrorReport } from '../adapters/plot/v2/responseMapper'

// =============================================================================
// 1. DegradedStateBanner — timeout and partial analysis
// =============================================================================
describe('DegradedStateBanner — error-state rendering', () => {
  it('renders nothing when no degraded state', () => {
    const { container } = render(<DegradedStateBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders CEE timeout banner with role="alert"', () => {
    render(<DegradedStateBanner ceeDegraded ceeTimeoutReason="CEE response timeout after 30s" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.getAttribute('data-testid')).toBe('degraded-state-banner')
  })

  it('renders ISL partial banner with analysis type statuses', () => {
    const types: AnalysisTypeStatus[] = [
      { name: 'Sensitivity', available: true },
      { name: 'Robustness', available: false },
    ]
    render(<DegradedStateBanner islPartial analysisTypes={types} />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.textContent).toContain('Sensitivity')
    expect(alert.textContent).toContain('Robustness')
  })

  it('renders combined CEE + ISL degraded state', () => {
    render(<DegradedStateBanner ceeDegraded islPartial />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
  })

  it('banner headline is user-friendly regardless of raw reason prop', () => {
    render(<DegradedStateBanner ceeDegraded ceeTimeoutReason="Connection reset after 30s" />)
    const alert = screen.getByRole('alert')
    // Banner's own headline copy must be user-friendly (not derived from reason prop)
    expect(alert.textContent).toContain('timed out')
    expect(alert.textContent).toContain('review may be incomplete')
  })
})

// =============================================================================
// 2. Error taxonomy — user-facing messages for all error types
// =============================================================================
describe('Error taxonomy — user-visible messages', () => {
  const allTypes: ErrorType[] = ['TIMEOUT', 'RETRYABLE', 'INTERNAL', 'BAD_INPUT', 'RATE_LIMIT', 'BREAKER_OPEN']

  it.each(allTypes)('%s message contains no raw error class names', (errorType) => {
    const result = mapErrorType(errorType)
    const combined = `${result.label} ${result.message} ${result.suggestion}`
    // No raw error class names
    expect(combined).not.toMatch(/Error:|TypeError:|SyntaxError:|RangeError:/)
    // No stack trace fragments
    expect(combined).not.toMatch(/at \w+\.\w+/)
    // No HTTP method names (not user-friendly)
    expect(combined).not.toMatch(/GET |POST |PUT |DELETE /)
  })

  it('TIMEOUT suggestion mentions waiting', () => {
    const result = mapErrorType('TIMEOUT')
    expect(result.suggestion.toLowerCase()).toMatch(/wait|try again|moment/)
  })

  it('BAD_INPUT suggestion mentions checking input', () => {
    const result = mapErrorType('BAD_INPUT')
    expect(result.suggestion.toLowerCase()).toMatch(/check|review|input/)
  })

  it('RATE_LIMIT suggestion mentions throttling', () => {
    const result = mapErrorType('RATE_LIMIT')
    expect(result.suggestion.toLowerCase()).toMatch(/wait|moment|later|limit/)
  })
})

// =============================================================================
// 3. createErrorReport — fallback report for service failures
// =============================================================================
describe('createErrorReport — graceful degradation', () => {
  it('returns valid report schema on service failure', () => {
    const report = createErrorReport('Backend returned 503', [], { seed: 42 })
    expect(report.schema).toBe('report.v1')
    expect(report.confidence.level).toBe('low')
  })

  it('includes the error reason in confidence.why', () => {
    const report = createErrorReport('SSE connection dropped', [], { seed: 1 })
    expect(report.confidence.why).toContain('SSE connection dropped')
  })

  it('error report has no technical field leakage', () => {
    const report = createErrorReport('Network timeout', [], { seed: 99 })
    const json = JSON.stringify(report)
    expect(json).not.toContain('stack')
    expect(json).not.toContain('errno')
    expect(json).not.toContain('ECONNREFUSED')
  })
})
