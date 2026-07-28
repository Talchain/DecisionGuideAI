/**
 * UI WireSystemEventType ↔ V5 SystemEventKind / buildV5Payload parity.
 *
 * Contract test ensuring the UI event model and the outbound V5 payload
 * builder stay in lockstep as either side evolves:
 *
 *   - Every UI WireSystemEventType reaches buildV5Payload and either
 *     produces an `ok: true` payload whose kind/event matches the V5
 *     schema, OR is deliberately deferred with a recognised reason.
 *
 *   - Every V5 SystemEventKind has a documented UI emission status
 *     (emitted today, deferred to future UI product work, or declared
 *     unsupported on the UI side).
 *
 * Motivation: during the v5-ui-exclusive-path reviewer pass, the UI
 * WireSystemEventType union (5 kinds) and the V5 SystemEventKind union
 * (6 kinds) were documented as misaligned. This test locks the current
 * coverage boundary so future schema or UI changes surface as failures
 * here rather than as silent 422s in production.
 */
import { describe, it, expect } from 'vitest'
import { SystemEventKind } from '@talchain/schemas/boundary'
import { buildV5Payload } from '../buildPayload'
import type { WireSystemEventType } from '../../canvas/conversation/types'
import { WIRE_SYSTEM_EVENT_TYPES } from '../../canvas/conversation/types'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

// Exhaustive list of UI WireSystemEventType values. `const satisfies` gives
// us both the runtime array (for iteration) and compile-time exhaustiveness
// — if a new member is added to WireSystemEventType, this array must be
// extended for the file to compile.
const UI_WIRE_EVENT_TYPES = [
  'direct_graph_edit',
  'direct_analysis_run',
  'patch_accepted',
  'patch_dismissed',
  'feedback_submitted',
  'factor_value_edit',
] as const satisfies readonly WireSystemEventType[]

// The `satisfies` above is ONE-DIRECTIONAL: it proves every listed member is a
// real WireSystemEventType, but NOT that every WireSystemEventType is listed —
// so a new union member could be added and silently skip this entire file,
// which is how a wire event ships with no parity coverage at all. The other
// direction is closed by a RUNTIME assertion below ('the coverage table covers
// every wire event type'), not by a type annotation: a type-level assignment
// here would be satisfied by any subset and would fail nothing.

// v0.7.0 SystemEventKind values (authoritative wire surface).
const V5_EVENT_KINDS = SystemEventKind.options

/**
 * Outbound coverage table — mirrors docs/v5/ui-outbound-payload-coverage.md.
 * Each UI event type declares how it reaches V5.
 */
const UI_COVERAGE: Record<
  (typeof UI_WIRE_EVENT_TYPES)[number],
  | { kind: 'system_event'; eventKind: (typeof V5_EVENT_KINDS)[number]; payload: Record<string, unknown> }
  | { kind: 'message_via_chip'; chipActionType: string }
  | { kind: 'ui_deferred'; reason: string }
  | { kind: 'unsupported'; reason: string }
> = {
  direct_graph_edit: {
    kind: 'system_event',
    eventKind: 'direct_graph_edit',
    payload: { target_id: 'node-1', operation: 'set_factor_value' },
  },
  patch_accepted: {
    kind: 'system_event',
    eventKind: 'patch_accepted',
    payload: { patch_id: 'patch-1' },
  },
  patch_dismissed: {
    kind: 'system_event',
    eventKind: 'patch_dismissed',
    payload: { patch_id: 'patch-1' },
  },
  // direct_analysis_run is the UI's analytics/analysis trigger. CEE routes
  // analysis runs through kind='message' with chip.action_type='run_analysis'
  // — the builder maps this automatically (see buildDirectAnalysisRunMessage).
  direct_analysis_run: {
    kind: 'message_via_chip',
    chipActionType: 'run_analysis',
  },
  // feedback_submitted: F7 (feedback thumbs = wire). `feedback` joined
  // SystemEventKind in 0.22.0 and CEE >=0.22.0 is deploy-verified, so the
  // ingress-mirror hold is LIFTED. buildV5Payload maps the emitter's
  // { turn_id, rating } shape onto the typed `feedback` system event (a
  // whole-turn thumbs rating → target.kind 'turn').
  feedback_submitted: {
    kind: 'system_event',
    eventKind: 'feedback',
    payload: { turn_id: TURN_ID, rating: 'up' },
  },
  // ROADMAP 1.346: the value-CARRYING inspector edit. `factor_value_edit`
  // joined SystemEventKind in 0.29.0 and CEE (build 74d997a6, pin >=0.29.0) is
  // deploy-verified, so the reader-first hold is LIFTED and the UI emits it.
  // Reader-first is mandatory for this union, not a preference: every member is
  // `.strict()` inside a discriminatedUnion on `kind`, so a consumer pinned
  // below 0.29.0 that receives this member rejects the WHOLE turn.
  factor_value_edit: {
    kind: 'system_event',
    eventKind: 'factor_value_edit',
    payload: { target_id: 'fac_monthly_eng_cost', value: 0.5, raw_value: 15000, unit: '£' },
  },
}

describe('UI ↔ V5 system event parity', () => {
  it('every UI WireSystemEventType has a coverage entry', () => {
    for (const uiType of UI_WIRE_EVENT_TYPES) {
      expect(UI_COVERAGE[uiType], `missing UI_COVERAGE entry for "${uiType}"`).toBeDefined()
    }
  })

  it('the coverage table covers EVERY wire event type (no member can skip this file)', () => {
    // Derived from the union's own source array, so adding a wire event type
    // without a coverage entry fails HERE rather than shipping uncovered.
    expect([...UI_WIRE_EVENT_TYPES].sort()).toEqual([...WIRE_SYSTEM_EVENT_TYPES].sort())
  })

  it.each(UI_WIRE_EVENT_TYPES)(
    'UI event "%s" reaches V5 exactly as declared in coverage table',
    (uiType) => {
      const coverage = UI_COVERAGE[uiType]
      const baseInput = {
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame' as const,
        turnClass: 'frame' as const,
        mode: 'system' as const,
      }

      if (coverage.kind === 'system_event') {
        const r = buildV5Payload({
          ...baseInput,
          systemEvent: { type: uiType, payload: coverage.payload },
        })
        expect(r.ok, `expected ok for ${uiType}`).toBe(true)
        if (r.ok) {
          expect(r.payload.kind).toBe('system_event')
          if (r.payload.kind === 'system_event') {
            expect(r.payload.event.kind).toBe(coverage.eventKind)
          }
        }
      } else if (coverage.kind === 'message_via_chip') {
        const r = buildV5Payload({
          ...baseInput,
          systemEvent: { type: uiType },
        })
        expect(r.ok).toBe(true)
        if (r.ok) {
          expect(r.payload.kind, `${uiType} should become kind=message`).toBe('message')
          if (r.payload.kind === 'message') {
            expect(r.payload.chip?.action_type).toBe(coverage.chipActionType)
          }
        }
      } else if (coverage.kind === 'unsupported') {
        const r = buildV5Payload({
          ...baseInput,
          systemEvent: { type: uiType, payload: {} },
        })
        expect(r.ok, `${uiType} should be refused (unsupported)`).toBe(false)
        if (!r.ok) {
          expect(r.reason).toBe('unsupported_system_event')
        }
      } else {
        // ui_deferred — no dispatch path yet. Drive the builder and expect
        // unsupported until UI emission is wired.
        const r = buildV5Payload({
          ...baseInput,
          systemEvent: { type: uiType, payload: {} },
        })
        expect(r.ok).toBe(false)
      }
    },
  )

  it('every V5 SystemEventKind has a coverage status on the UI side', () => {
    // UI emission status: which V5 kinds the UI can emit today.
    const uiEmittedKinds = new Set(
      Object.values(UI_COVERAGE)
        .filter((c): c is Extract<typeof c, { kind: 'system_event' }> => c.kind === 'system_event')
        .map((c) => c.eventKind),
    )

    // Schema kinds NOT in the emitted set are deferred UI work — chip_click,
    // undo, redo, selection_change. They're valid on the wire (CEE handles them
    // per the turn-shape matrix) but the UI has no emission site yet. This is
    // the parity boundary the reviewer's P0 #3 flagged; the test locks it.
    // (0.22.0 `feedback` left this set in F7 — it is now UI-emitted, see above.)
    const knownDeferred: ReadonlySet<(typeof V5_EVENT_KINDS)[number]> = new Set([
      'chip_click',
      'undo',
      'redo',
      // 0.15.0: selection_change joined the wire union (R5). The UI emission
      // path (debounced selection_change on canvas selection) is the R5 UI
      // half — a scheduled Experience lane; CEE consumes it already.
      'selection_change',
    ])

    for (const kind of V5_EVENT_KINDS) {
      const emitted = uiEmittedKinds.has(kind)
      const deferred = knownDeferred.has(kind)
      expect(
        emitted || deferred,
        `V5 SystemEventKind "${kind}" is neither UI-emitted nor in the known-deferred set. ` +
          'Either wire a UI emission path or add it to knownDeferred with a product rationale.',
      ).toBe(true)
    }
  })

  it('locks UI emission count at 5 of 9 V5 SystemEventKind values', () => {
    // Explicit canary: if someone adds a new UI emission (extending the
    // system_event branch of UI_COVERAGE) without updating this test, the
    // count will drift and flag for docs reconciliation.
    // 0.22.0 grew the wire union to 8 (added `feedback`); F7 wired feedback
    // emission. 0.29.0 grew it to 9 (added `factor_value_edit`) and ROADMAP
    // 1.346 wired its emission, so UI emission count is now 5
    // (patch_accepted, patch_dismissed, direct_graph_edit, feedback,
    // factor_value_edit).
    const uiEmittedCount = Object.values(UI_COVERAGE).filter(
      (c) => c.kind === 'system_event',
    ).length
    expect(uiEmittedCount).toBe(5)
    expect(V5_EVENT_KINDS).toHaveLength(9)
  })
})
