/**
 * A BLOCKED REFUSAL MUST NOT SURVIVE A RELOAD.
 *
 * ── THE MECHANISM, and it is the third instance of one shape today ────────
 * `validateCeeAnalysisReady` gates every restore of `ceeAnalysisReady` —
 * sessionStorage, the autosave projection, and the graph-load path. It rejected
 * blocked refusals ONLY BY ACCIDENT: a refusal used to carry `options: []`, so
 * the `empty_options` check caught it and nothing was ever restored.
 *
 * CEE now carries model identity on refusals — correctly, since a refusal that
 * cannot name the model is one a user cannot act on. The payload therefore has
 * non-empty options and the validator ADMITS it. The accident has stopped
 * happening, and nothing replaced it: `validateCeeAnalysisReady` reads `.status`
 * zero times.
 *
 * ⭐ THE ARGUMENT IS ALREADY IN THIS CODEBASE, ABOUT THE SIBLING FIELD.
 * `store.ts`'s `setAnalysisRefusalNotice` is deliberately a bare `set` with no
 * sessionStorage write, and says why: doing so "would restore a refusal into a
 * session where no analysis was refused."
 *
 * So after the producer change the refusal's PAYLOAD gets exactly the treatment
 * its EXPLANATION is denied. Reload the tab and the user holds the evidence of a
 * refusal with no account of it — on a session where nothing was refused.
 *
 * ── BOTH DIRECTIONS ──────────────────────────────────────────────────────
 * The opposite harm is worse: a genuine readiness verdict that stops surviving a
 * refresh would silently lose real state on every reload. Every case below is
 * paired against a non-blocked payload built from the same fixture.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { validateCeeAnalysisReady } from '../ceeAnalysisReadyValidation'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import type { Node } from '@xyflow/react'

const GOAL_ID = 'goal_1'
const OPTION_ID = 'opt_rebuild'

const NODES = [
  { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: {} },
  { id: OPTION_ID, type: 'option', position: { x: 0, y: 0 }, data: {} },
] as unknown as Node[]

/** The shape CEE now sends on a refusal: identity present, status blocked. */
const payload = (status?: string): CEEAnalysisReady =>
  ({
    goal_node_id: GOAL_ID,
    options: [{ id: OPTION_ID, label: 'Rebuild', interventions: {} }],
    ...(status === undefined ? {} : { status }),
  }) as unknown as CEEAnalysisReady

describe('a blocked refusal is not restored', () => {
  it('PRECONDITION — the fixture would OTHERWISE validate, so a rejection is the status doing it', () => {
    // Without this, `blocked` could be rejected for a missing goal or absent
    // option and the case would pass for the wrong reason (trap 13).
    expect(validateCeeAnalysisReady(payload(undefined), null, NODES).isValid).toBe(true)
  })

  it('⛔ a BLOCKED payload is rejected, and named as such', () => {
    const result = validateCeeAnalysisReady(payload('blocked'), null, NODES)
    expect(result.isValid).toBe(false)
    expect(result.reason).toBe('blocked_refusal')
  })

  it('⛔ OPPOSITE DIRECTION — a genuine readiness verdict still restores', () => {
    // The harm this must not cause: silently losing real state on every reload.
    for (const status of ['ready', 'needs_encoding', 'needs_user_mapping', 'needs_user_input']) {
      expect(
        validateCeeAnalysisReady(payload(status), null, NODES).isValid,
        `status ${status} must still restore`,
      ).toBe(true)
    }
  })

  it('DISCRIMINATING — the rejection is not swallowing the other reasons', () => {
    // A gate that rejected everything would satisfy the blocked case while
    // destroying the validator's real work.
    const missingGoal = validateCeeAnalysisReady(payload('ready'), null, [])
    expect(missingGoal.isValid).toBe(false)
    expect(missingGoal.reason).toBe('missing_goal')

    const noOptions = { ...payload('ready'), options: [] } as unknown as CEEAnalysisReady
    expect(validateCeeAnalysisReady(noOptions, null, NODES).reason).toBe('empty_options')
  })
})

/**
 * BELT AND BRACES: it is not WRITTEN in the first place.
 *
 * The validator gates the way back in; this gates the way out. Not writing a
 * refusal is cheaper than relying on every restore path to check for one — and
 * `setCeeAnalysisReady` is the single writer of both sessionStorage keys, so it
 * is the one place that can be sure.
 *
 * ⚠ It also CLEARS any prior entry. A session that stored a genuine verdict and
 * then received a refusal would otherwise keep the stale verdict on disk and
 * restore THAT on reload — a different wrong answer, and a quieter one.
 */
describe('a blocked refusal is not written to sessionStorage', () => {
  const KEY = 'olumi-cee-analysis-ready'
  const IDS = 'olumi-cee-analysis-ready-node-ids'

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('⛔ BLOCKED — nothing is written, and any prior entry is cleared', async () => {
    const { useCanvasStore } = await import('../../store')
    // PRECONDITION: a genuine verdict really does persist, so the absence below
    // is this status's doing and not a broken writer.
    useCanvasStore.getState().setCeeAnalysisReady(payload('ready') as never)
    expect(sessionStorage.getItem(KEY), 'precondition: a ready verdict persists').not.toBeNull()

    useCanvasStore.getState().setCeeAnalysisReady(payload('blocked') as never)
    expect(sessionStorage.getItem(KEY)).toBeNull()
    expect(sessionStorage.getItem(IDS)).toBeNull()
  })

  it('⛔ OPPOSITE DIRECTION — a genuine verdict is still written', async () => {
    const { useCanvasStore } = await import('../../store')
    useCanvasStore.getState().setCeeAnalysisReady(payload('ready') as never)
    expect(sessionStorage.getItem(KEY)).not.toBeNull()
    expect(sessionStorage.getItem(IDS)).not.toBeNull()
  })
})
