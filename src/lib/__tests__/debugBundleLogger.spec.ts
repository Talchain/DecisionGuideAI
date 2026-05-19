/**
 * Tests for debugBundleLogger — the structured render-log events emitted
 * around debug-bundle export. Verifies the privacy guard:
 *   - Allowlisted fields only.
 *   - Known sensitive patterns (JWT, Bearer, key=value, email) scrubbed
 *     to '[REDACTED]'.
 *   - Missing fields emit as null, never as undefined or stripped.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS,
  buildDebugBundleEventFields,
  emitDebugBundleEvent,
} from '../debugBundleLogger'
import { logger } from '../logger'

describe('emitDebugBundleEvent — shape and allowlist', () => {
  beforeEach(() => {
    ;(logger.info as ReturnType<typeof vi.fn>).mockClear()
  })

  it('emits the event name in the payload', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_started',
      buildDebugBundleEventFields({ export_id: 'exp-1' }),
    )
    expect(payload.event).toBe('dgai.debug_bundle.export_started')
  })

  it('emits every allowed field — missing keys default to null', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_completed',
      buildDebugBundleEventFields({ export_id: 'exp-2' }),
    )
    for (const key of ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS) {
      expect(payload).toHaveProperty(key)
    }
    expect(payload.coherence_issue_count).toBeNull()
    expect(payload.scientific_validation_unavailable_count).toBeNull()
  })

  it('payload contains exactly the allowed keys + event', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.capture_status',
      buildDebugBundleEventFields({}),
    )
    const expectedKeys = new Set<string>([...ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS, 'event'])
    for (const key of Object.keys(payload)) {
      expect(expectedKeys.has(key)).toBe(true)
    }
  })

  it('logger.info is invoked with the emitted payload', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.scientific_validation_summary',
      buildDebugBundleEventFields({
        scientific_validation_available_count: 2,
        scientific_validation_unavailable_count: 5,
      }),
    )
    expect(logger.info).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(payload)
  })
})

describe('emitDebugBundleEvent — privacy guard', () => {
  beforeEach(() => {
    ;(logger.info as ReturnType<typeof vi.fn>).mockClear()
  })

  it('redacts JWT-shaped tokens leaking into string fields', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_started',
      buildDebugBundleEventFields({
        export_id: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      }),
    )
    expect(payload.export_id).toBe('[REDACTED]')
  })

  it('redacts Bearer tokens', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_started',
      buildDebugBundleEventFields({
        export_id: 'Bearer sk-1234567890abcdef',
      }),
    )
    expect(payload.export_id).toBe('[REDACTED]')
  })

  it('redacts api_key=value and similar patterns', () => {
    for (const value of [
      'api_key=abc',
      'api-key: 123',
      'token=xyz',
      'authorization: Bearer x',
      'password=hunter2',
    ]) {
      const payload = emitDebugBundleEvent(
        'dgai.debug_bundle.export_started',
        buildDebugBundleEventFields({ export_id: value }),
      )
      expect(payload.export_id).toBe('[REDACTED]')
    }
  })

  it('redacts email-shaped values', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_started',
      buildDebugBundleEventFields({ export_id: 'paul@example.com' }),
    )
    expect(payload.export_id).toBe('[REDACTED]')
  })

  it('leaves clean values untouched', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.export_started',
      buildDebugBundleEventFields({
        export_id: 'exp-abc',
        scenario_id_source: 'store',
        capture_pipeline_status: 'complete',
        coherence_state: 'complete',
        coherence_issue_count: 0,
        canonical_flag_on: true,
      }),
    )
    expect(payload.export_id).toBe('exp-abc')
    expect(payload.scenario_id_source).toBe('store')
    expect(payload.capture_pipeline_status).toBe('complete')
    expect(payload.canonical_flag_on).toBe(true)
    expect(payload.coherence_issue_count).toBe(0)
  })

  it('numeric and boolean values bypass the scrub', () => {
    const payload = emitDebugBundleEvent(
      'dgai.debug_bundle.capture_status',
      buildDebugBundleEventFields({
        coherence_issue_count: 3,
        canonical_flag_on: false,
        bundle_size_bytes: 12345,
      }),
    )
    expect(payload.coherence_issue_count).toBe(3)
    expect(payload.canonical_flag_on).toBe(false)
    expect(payload.bundle_size_bytes).toBe(12345)
  })
})

describe('buildDebugBundleEventFields', () => {
  it('emits every allowlisted field with null defaults', () => {
    const fields = buildDebugBundleEventFields({})
    for (const key of ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS) {
      expect(fields[key]).toBeNull()
    }
  })

  it('preserves provided values, defaults others to null', () => {
    const fields = buildDebugBundleEventFields({
      export_id: 'x',
      capture_pipeline_status: 'complete',
    })
    expect(fields.export_id).toBe('x')
    expect(fields.capture_pipeline_status).toBe('complete')
    expect(fields.scenario_id_source).toBeNull()
  })
})
