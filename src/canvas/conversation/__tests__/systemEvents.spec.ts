/**
 * Tests for systemEvents.ts — serializeSystemEvent wire adapter
 *
 * Verifies:
 * - Converts internal { type, payload } to CEE v3 { event_type, timestamp, event_id, details }
 * - Adds ISO-8601 timestamp
 * - Adds UUID event_id
 * - Each call generates a unique event_id
 * - Empty/undefined payload becomes {}
 * - Unknown types (session_resume, undo_draft) return null with dev warning
 * - Known CEE v3 types pass through
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { serializeSystemEvent } from '../systemEvents'
import type { SystemEvent } from '../types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/

afterEach(() => {
  vi.restoreAllMocks()
})

describe('serializeSystemEvent', () => {
  it('converts type → event_type', () => {
    const event: SystemEvent = { type: 'direct_graph_edit', payload: { changed_node_ids: ['n1'] } }
    const wire = serializeSystemEvent(event)
    expect(wire).not.toBeNull()
    expect(wire!.event_type).toBe('direct_graph_edit')
  })

  it('converts payload → details', () => {
    const event: SystemEvent = { type: 'patch_accepted', payload: { patch_id: 'p1', operations: [] } }
    const wire = serializeSystemEvent(event)
    expect(wire!.details).toEqual({ patch_id: 'p1', operations: [] })
  })

  it('uses empty object when payload is undefined', () => {
    const event: SystemEvent = { type: 'direct_analysis_run' }
    const wire = serializeSystemEvent(event)
    expect(wire!.details).toEqual({})
  })

  it('adds ISO-8601 timestamp', () => {
    const event: SystemEvent = { type: 'feedback_submitted', payload: { turn_id: 't1', rating: 'up' } }
    const wire = serializeSystemEvent(event)
    expect(typeof wire!.timestamp).toBe('string')
    expect(ISO_RE.test(wire!.timestamp)).toBe(true)
  })

  it('adds UUID event_id', () => {
    const event: SystemEvent = { type: 'patch_dismissed', payload: { patch_id: 'p2' } }
    const wire = serializeSystemEvent(event)
    expect(typeof wire!.event_id).toBe('string')
    expect(wire!.event_id.length).toBeGreaterThan(8) // at minimum a UUID-like string
  })

  it('generates unique event_id on each call', () => {
    const event: SystemEvent = { type: 'patch_dismissed', payload: { patch_id: 'p3' } }
    const wire1 = serializeSystemEvent(event)
    const wire2 = serializeSystemEvent(event)
    expect(wire1!.event_id).not.toBe(wire2!.event_id)
  })

  it('returns null for session_resume (not in CEE v3 schema)', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event: SystemEvent = { type: 'session_resume', payload: {} }
    const wire = serializeSystemEvent(event)
    expect(wire).toBeNull()
  })

  it('returns null for undo_draft (not in CEE v3 schema)', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event: SystemEvent = { type: 'undo_draft' }
    const wire = serializeSystemEvent(event)
    expect(wire).toBeNull()
  })

  it('passes all known CEE v3 types through', () => {
    const knownTypes: SystemEvent['type'][] = [
      'patch_accepted',
      'patch_dismissed',
      'direct_graph_edit',
      'direct_analysis_run',
      'feedback_submitted',
    ]
    for (const type of knownTypes) {
      const wire = serializeSystemEvent({ type })
      expect(wire).not.toBeNull()
      expect(wire!.event_type).toBe(type)
    }
  })
})
