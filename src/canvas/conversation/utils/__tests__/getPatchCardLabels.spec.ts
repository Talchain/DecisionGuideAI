/**
 * Tests for getPatchCardLabels — derives card header and badge from patch state.
 */

import { describe, it, expect } from 'vitest'
import { resolveCardState, getPatchCardLabels } from '../getPatchCardLabels'

describe('resolveCardState', () => {
  it('returns "proposed" for a pending proposal', () => {
    expect(resolveCardState('proposed', false, false)).toBe('proposed')
  })

  it('returns "accepted" when user accepted', () => {
    expect(resolveCardState('accepted', false, false)).toBe('accepted')
  })

  it('returns "auto_applied" when auto_apply is true', () => {
    expect(resolveCardState('accepted', true, false)).toBe('auto_applied')
  })

  it('returns "rejected" when PLoT validation failed', () => {
    expect(resolveCardState('rejected', false, false)).toBe('rejected')
  })

  it('returns "dismissed" when user dismissed', () => {
    expect(resolveCardState('dismissed', false, false)).toBe('dismissed')
  })

  it('returns "error" for network error in proposed state', () => {
    expect(resolveCardState('proposed', false, true)).toBe('error')
  })

  it('auto_apply takes precedence over accepted state', () => {
    expect(resolveCardState('accepted', true, false)).toBe('auto_applied')
  })

  it('network error only triggers error when state is proposed', () => {
    // If already accepted, network error flag is stale — trust the accepted state
    expect(resolveCardState('accepted', false, true)).toBe('accepted')
  })
})

describe('getPatchCardLabels', () => {
  it('proposed: header "Suggested change", no badge', () => {
    const labels = getPatchCardLabels('proposed')
    expect(labels.header).toBe('Suggested change')
    expect(labels.badge).toBeNull()
  })

  it('accepted: header "Change accepted", check badge in success', () => {
    const labels = getPatchCardLabels('accepted')
    expect(labels.header).toBe('Change accepted')
    expect(labels.badge).toEqual({ icon: 'check', colour: 'text-success' })
  })

  it('auto_applied: header "Model updated", check badge in success', () => {
    const labels = getPatchCardLabels('auto_applied')
    expect(labels.header).toBe('Model updated')
    expect(labels.badge).toEqual({ icon: 'check', colour: 'text-success' })
  })

  it('rejected: header "Change rejected", x badge in danger', () => {
    const labels = getPatchCardLabels('rejected')
    expect(labels.header).toBe('Change rejected')
    expect(labels.badge).toEqual({ icon: 'x', colour: 'text-danger' })
  })

  it('dismissed: header "Change dismissed", no badge', () => {
    const labels = getPatchCardLabels('dismissed')
    expect(labels.header).toBe('Change dismissed')
    expect(labels.badge).toBeNull()
  })

  it('error: header "Something went wrong", alert-triangle badge in danger', () => {
    const labels = getPatchCardLabels('error')
    expect(labels.header).toBe('Something went wrong')
    expect(labels.badge).toEqual({ icon: 'alert-triangle', colour: 'text-danger' })
  })
})
