/**
 * buildV5Payload — the 0.34.0 judgement events reach the wire TYPED.
 *
 * P4 transport (lane evidence:
 * PHASE0-EVIDENCE-2026-07-28/lane-p4-transport-2026-08-05.md): the two
 * human-judgement signals that previously terminated in the client store —
 * the contested-edge verdict and the prior-range edit — now map onto the
 * contract's `edge_adjudication` / `prior_range_edit` system events.
 *
 * Fail-closed rule (same as every sibling adapter): a payload the wire's
 * cross-field rules would refuse (overridden with no value; inverted range) is
 * never built — `null` → unsupported, not a production 422.
 *
 * ⚠ Reader-first: these payloads must not be EMITTED until CEE's 0.34.0 leg
 * is deployed — an older CEE pin rejects the whole turn on either kind. The
 * dependency-ordered merge train is the gate (no runtime flag).
 */
import { describe, it, expect } from 'vitest'

import { buildV5Payload } from '../buildPayload'
import type { WireSystemEventType } from '../../canvas/conversation/types'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

const base = {
  turnId: TURN_ID,
  scenarioId: SCENARIO_ID,
  stage: 'analyse' as const,
  turnClass: 'review' as const,
  mode: 'system' as const,
}

function build(type: WireSystemEventType, payload: Record<string, unknown>) {
  return buildV5Payload({
    ...base,
    systemEvent: { type, payload },
  })
}

describe('edge_adjudication — buildV5Payload mapping', () => {
  const full = {
    from: 'fac_price',
    to: 'out_churn',
    edge_id: 'reactflow__edge-fac_price-out_churn',
    verdict: 'overridden',
    resolved_strength_mean: -0.45,
  }

  it('maps the full overridden shape onto the typed event', () => {
    const r = build('edge_adjudication', full)
    expect(r.ok).toBe(true)
    if (r.ok && r.payload.kind === 'system_event') {
      expect(r.payload.event).toEqual({
        kind: 'edge_adjudication',
        from: 'fac_price',
        to: 'out_churn',
        edge_id: 'reactflow__edge-fac_price-out_churn',
        verdict: 'overridden',
        resolved_strength_mean: -0.45,
      })
    }
  })

  it('maps a minimal accepted verdict (no edge_id, no value)', () => {
    const r = build('edge_adjudication', { from: 'a', to: 'b', verdict: 'accepted_pass2' })
    expect(r.ok).toBe(true)
    if (r.ok && r.payload.kind === 'system_event') {
      expect(r.payload.event).toEqual({
        kind: 'edge_adjudication',
        from: 'a',
        to: 'b',
        verdict: 'accepted_pass2',
      })
    }
  })

  it('REFUSES an overridden verdict with no value — the wire rule, enforced client-side first', () => {
    const { resolved_strength_mean: _v, ...noValue } = full
    expect(build('edge_adjudication', noValue).ok).toBe(false)
  })

  it('REFUSES a dismissed verdict carrying a value', () => {
    const r = build('edge_adjudication', {
      from: 'a',
      to: 'b',
      verdict: 'dismissed',
      resolved_strength_mean: 0.3,
    })
    expect(r.ok).toBe(false)
  })

  it('REFUSES an unknown verdict — including pending', () => {
    expect(build('edge_adjudication', { from: 'a', to: 'b', verdict: 'pending' }).ok).toBe(false)
    expect(build('edge_adjudication', { from: 'a', to: 'b', verdict: 'accepted' }).ok).toBe(false)
  })

  it('REFUSES missing node ids — identity or silence', () => {
    expect(build('edge_adjudication', { to: 'b', verdict: 'dismissed' }).ok).toBe(false)
    expect(build('edge_adjudication', { from: 'a', verdict: 'dismissed' }).ok).toBe(false)
  })
})

describe('prior_range_edit — buildV5Payload mapping', () => {
  it('maps a full range edit onto the typed event', () => {
    const r = build('prior_range_edit', {
      target_id: 'fac_adoption',
      range_min: 0.2,
      range_max: 0.6,
      distribution: 'beta',
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.payload.kind === 'system_event') {
      expect(r.payload.event).toEqual({
        kind: 'prior_range_edit',
        target_id: 'fac_adoption',
        range_min: 0.2,
        range_max: 0.6,
        distribution: 'beta',
      })
    }
  })

  it('accepts a point range (min === max)', () => {
    const r = build('prior_range_edit', { target_id: 'f', range_min: 0.4, range_max: 0.4 })
    expect(r.ok).toBe(true)
  })

  it('REFUSES an inverted range — the wire rule, enforced client-side first', () => {
    expect(
      build('prior_range_edit', { target_id: 'f', range_min: 0.9, range_max: 0.1 }).ok,
    ).toBe(false)
  })

  it('REFUSES non-finite or missing bounds', () => {
    expect(build('prior_range_edit', { target_id: 'f', range_min: 0.2 }).ok).toBe(false)
    expect(
      build('prior_range_edit', { target_id: 'f', range_min: Number.NaN, range_max: 0.5 }).ok,
    ).toBe(false)
  })

  it('REFUSES a missing target_id — id-addressed, never label-matched', () => {
    expect(build('prior_range_edit', { range_min: 0.2, range_max: 0.6 }).ok).toBe(false)
  })
})
