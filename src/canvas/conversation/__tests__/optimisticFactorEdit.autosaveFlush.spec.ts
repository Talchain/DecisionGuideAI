/**
 * "Checked by you" must survive a reload — the persistence half (L66,
 * final-walk defect 0, P1).
 *
 * THE WITNESSED DEFECT (journey-witness-final-2026-08-04-raw/runE, build
 * 610ed5f7): the reviewed stamp for `fac_pricing_level` ("Paid Tier Price
 * Point") was earned via CEE's applied receipt at ~02:25:33Z and the page
 * reloaded ~3 s later. The stamp existed ONLY in the in-memory store: the
 * receipt path writes no autosave, so the slot the boot restores predated the
 * stamp, and the row regressed to "Olumi estimate / check first" while the
 * value survived (CEE holds the value; only the client holds the mark).
 *
 * The autosave writers before this fix were: the 30 s useAutosave timer, draft
 * apply, auto-apply proposal patches, draft undo, resultsComplete, and the
 * error-boundary crash flush. The one interaction that EARNS the mark was not
 * on the list — any reload within up to ~30.5 s of a check lost it.
 *
 * THE RULE UNDER TEST: `confirmOptimisticFactorEdit`, on the 'stamped'
 * outcome, flushes the autosave THROUGH THE CANONICAL PROJECTION
 * (projectAutosaveData — the ci-guarded single constructor), so the earned
 * stamp is on disk the moment the claim is made on screen.
 *
 * Identity binding (trap 19): assertions bind to `fac_pricing_level` and read
 * the stamp back from the PERSISTED bytes at BOTH spellings —
 * `observed_state.source` is the key `isReviewedByUser` reads FIRST on
 * restore, so a camel-only persisted stamp would be read straight past.
 *
 * Controls: every non-'stamped' outcome ('no_stamp', 'value_moved_on',
 * 'node_gone') must leave the slot byte-untouched — a flush on those paths
 * would persist a claim the receipt did not earn (no_stamp) or a state the
 * function just declined to write (value_moved_on / node_gone).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import {
  captureOptimisticFactorEdit,
  confirmOptimisticFactorEdit,
} from '../optimisticFactorEdit'
import { loadAutosave } from '../../store/scenarios'

const NODE_ID = 'fac_pricing_level'
const LABEL = 'Paid Tier Price Point'
const AUTOSAVE_KEY = 'olumi-canvas-autosave'

/** The node as it stands AFTER the optimistic write, receipt pending. */
function pendingNode(value: number): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 100, y: 200 },
    data: {
      label: LABEL,
      kind: 'factor',
      provenance: 'ai_inferred',
      observedState: {
        value,
        raw_value: value,
        source: 'cee_inference',
        std: 0,
        baseline: 0,
      },
    },
  } as Node
}

/** Pre-write node data the wire event/undo snapshot was built from. */
const PRE_EDIT_DATA = {
  label: LABEL,
  kind: 'factor',
  observedState: { value: 0, source: 'cee_inference', std: 0, baseline: 0 },
}

function persistedNode(): Record<string, unknown> | undefined {
  const slot = loadAutosave()
  if (!slot) return undefined
  const node = (slot.nodes as Array<{ id?: string }>).find((n) => n?.id === NODE_ID)
  return node as Record<string, unknown> | undefined
}

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null } as never)
})

describe('confirmOptimisticFactorEdit — the earned stamp reaches the autosave slot', () => {
  it("'stamped' flushes the autosave, and the persisted node carries the stamp at BOTH spellings", () => {
    useCanvasStore.setState({ nodes: [pendingNode(0.7)], edges: [] } as never)
    const edit = captureOptimisticFactorEdit(NODE_ID, 0.7, PRE_EDIT_DATA, {
      source: 'user_override',
    })
    expect(edit).not.toBeNull()

    expect(confirmOptimisticFactorEdit(edit!)).toBe('stamped')

    const persisted = persistedNode()
    expect(persisted, 'the stamped node must be in the autosave slot').toBeDefined()
    const data = (persisted as { data?: Record<string, unknown> }).data ?? {}
    // Snake first — the key isReviewedByUser resolves FIRST on restore.
    expect((data.observed_state as { source?: string } | undefined)?.source).toBe('user_override')
    expect((data.observedState as { source?: string } | undefined)?.source).toBe('user_override')
    // The value the stamp describes rides in the same write.
    expect((data.observedState as { value?: number } | undefined)?.value).toBe(0.7)
  })

  it("CONTROL — 'no_stamp' (Model tab / inspector callers) writes nothing: the slot stays empty", () => {
    useCanvasStore.setState({ nodes: [pendingNode(0.41)], edges: [] } as never)
    const edit = captureOptimisticFactorEdit(NODE_ID, 0.41, PRE_EDIT_DATA)

    expect(confirmOptimisticFactorEdit(edit!)).toBe('no_stamp')

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it("CONTROL — 'value_moved_on' (late receipt) writes nothing: a stale stamp must not be persisted", () => {
    // The node has moved to 0.9 since the 0.62 edit was sent.
    useCanvasStore.setState({ nodes: [pendingNode(0.9)], edges: [] } as never)
    const edit = captureOptimisticFactorEdit(NODE_ID, 0.62, PRE_EDIT_DATA, {
      source: 'user_override',
    })

    expect(confirmOptimisticFactorEdit(edit!)).toBe('value_moved_on')

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it("CONTROL — 'node_gone' writes nothing", () => {
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    const edit = captureOptimisticFactorEdit(NODE_ID, 0.53, PRE_EDIT_DATA, {
      source: 'user_override',
    })

    expect(confirmOptimisticFactorEdit(edit!)).toBe('node_gone')

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })
})
