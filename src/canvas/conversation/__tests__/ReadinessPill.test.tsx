/**
 * Component tests for ReadinessPill and BiasAlertIcon.
 *
 * Covers: stage gating, readiness labels, popover rows, bias icon rendering,
 * and tooltip text.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadinessPill } from '../ReadinessPill'
import { BiasAlertIcon } from '../BiasAlertIcon'
import type { RealtimeSignals } from '../../../signals/realtime-signals'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALL_FALSE: RealtimeSignals = {
  has_alternative: false,
  has_measurable_outcome: false,
  has_baseline: false,
  has_constraint: false,
  has_risk: false,
  has_constraint_or_risk: false,
  bias_detected: null,
  readiness: 'low',
}

const ALL_TRUE: RealtimeSignals = {
  has_alternative: true,
  has_measurable_outcome: true,
  has_baseline: true,
  has_constraint: true,
  has_risk: true,
  has_constraint_or_risk: true,
  bias_detected: null,
  readiness: 'strong',
}

const OK_SIGNALS: RealtimeSignals = {
  ...ALL_FALSE,
  has_alternative: true,
  has_constraint_or_risk: true,
  has_constraint: true,
  readiness: 'ok',
}

// ---------------------------------------------------------------------------
// ReadinessPill — label rendering
// ---------------------------------------------------------------------------

describe('ReadinessPill', () => {
  it('renders "Low" label for low readiness', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    expect(screen.getByTestId('readiness-pill')).toHaveTextContent('Low')
  })

  it('renders "OK" label for ok readiness', () => {
    render(<ReadinessPill signals={OK_SIGNALS} briefText="" />)
    expect(screen.getByTestId('readiness-pill')).toHaveTextContent('OK')
  })

  it('renders "Strong" label for strong readiness', () => {
    render(<ReadinessPill signals={ALL_TRUE} briefText="" />)
    expect(screen.getByTestId('readiness-pill')).toHaveTextContent('Strong')
  })

  // -------------------------------------------------------------------------
  // Popover
  // -------------------------------------------------------------------------

  it('opens popover on click', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    expect(screen.queryByTestId('readiness-popover')).toBeNull()
    fireEvent.click(screen.getByTestId('readiness-pill'))
    expect(screen.getByTestId('readiness-popover')).toBeTruthy()
  })

  it('closes popover on second click (toggle)', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    const pill = screen.getByTestId('readiness-pill')
    fireEvent.click(pill)
    expect(screen.getByTestId('readiness-popover')).toBeTruthy()
    fireEvent.click(pill)
    expect(screen.queryByTestId('readiness-popover')).toBeNull()
  })

  it('closes popover on Escape', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    fireEvent.click(screen.getByTestId('readiness-pill'))
    expect(screen.getByTestId('readiness-popover')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('readiness-popover')).toBeNull()
  })

  it('shows 4 missing-message rows when all signals are false', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    fireEvent.click(screen.getByTestId('readiness-pill'))
    expect(screen.getByText('No alternative spotted yet')).toBeTruthy()
    expect(screen.getByText('No success metric detected')).toBeTruthy()
    expect(screen.getByText('No baseline detected')).toBeTruthy()
    expect(screen.getByText('No constraint or risk mentioned')).toBeTruthy()
  })

  it('shows detected labels when signals are true', () => {
    const brief = 'Option A: expand versus Option B: consolidate. Target £200k MRR. From £100k to £200k. Budget of £50k.'
    render(<ReadinessPill signals={ALL_TRUE} briefText={brief} />)
    fireEvent.click(screen.getByTestId('readiness-pill'))
    // Should not show missing messages
    expect(screen.queryByText('No alternative spotted yet')).toBeNull()
    expect(screen.queryByText('No success metric detected')).toBeNull()
    expect(screen.queryByText('No baseline detected')).toBeNull()
    expect(screen.queryByText('No constraint or risk mentioned')).toBeNull()
  })

  it('popover has role="status" (not dialog)', () => {
    render(<ReadinessPill signals={ALL_FALSE} briefText="" />)
    fireEvent.click(screen.getByTestId('readiness-pill'))
    const popover = screen.getByTestId('readiness-popover')
    expect(popover.getAttribute('role')).toBe('status')
  })
})

// ---------------------------------------------------------------------------
// BiasAlertIcon
// ---------------------------------------------------------------------------

describe('BiasAlertIcon', () => {
  it('renders nothing when bias is null', () => {
    const { container } = render(<BiasAlertIcon bias={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders anchor icon for sunk_cost', () => {
    render(<BiasAlertIcon bias="sunk_cost" />)
    expect(screen.getByTestId('bias-alert-icon')).toBeTruthy()
  })

  it('renders anchor icon for anchoring', () => {
    render(<BiasAlertIcon bias="anchoring" />)
    expect(screen.getByTestId('bias-alert-icon')).toBeTruthy()
  })

  it('has correct aria-label for sunk_cost', () => {
    render(<BiasAlertIcon bias="sunk_cost" />)
    const icon = screen.getByTestId('bias-alert-icon')
    expect(icon.getAttribute('aria-label')).toContain('Past investment')
  })

  it('has correct aria-label for anchoring', () => {
    render(<BiasAlertIcon bias="anchoring" />)
    const icon = screen.getByTestId('bias-alert-icon')
    expect(icon.getAttribute('aria-label')).toContain('One number')
  })
})
