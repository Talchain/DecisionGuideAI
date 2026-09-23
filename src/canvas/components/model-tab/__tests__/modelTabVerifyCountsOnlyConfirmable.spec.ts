/**
 * ⛔ THE MODEL TAB'S "N TO VERIFY" MAY COUNT ONLY WHAT THE MODEL TAB CAN CONFIRM.
 *
 * Measured on deployed `db758d83` (22 Sep 2026, guest, International Expansion
 * Strategy): the Model tab badge (`model-tab-verify-badge`) read 4, the user set
 * a value on a factor that had none, and the badge went to **5**. The act the
 * product invited moved the count the wrong way, and nothing on the tab could
 * bring it back down — because the act the badge names, CONFIRMING an estimate,
 * is not mounted anywhere on the Model tab:
 * `CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation` is `'disabled'`, so the v2
 * panel's `FACTOR_CONFIRMATION_CONNECTED` is false and its Confirm chip, its own
 * "N to verify" chip and the whole confirm queue never render.
 *
 * The badge counted `factorIsConfirmable` alone. The confirm path offers
 * `hasServerGraphAuthority(modelFactorConfirmation) && factorIsConfirmable`.
 * Two readings of one question — the sibling surface kept the half the panel
 * had already withheld.
 *
 * ⭐ Every assertion here binds BY FACTOR ID, never by a count another set could
 * satisfy, and the set is compared against the confirm path's OWN derivation
 * (`toRepairQueueItems(…, 'confirm-estimates')` under the same authority read).
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../../domain/edges'
import { modelTabFactorsToVerify } from '../utils'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
  type MutationAuthority,
} from '../../../mutations/mutationAuthority'
import { toRepairQueueItems } from '../../../model-tab-v2/adapters'

function factor(id: string, observedState: Record<string, unknown> | null): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: observedState === null ? { label: id, type: 'factor' } : { label: id, type: 'factor', observedState },
  }
}

/** Mirrors `proposeFactorConfirmation`'s write: `setObservedSource('user_confirmed')`. */
function confirm(nodes: readonly Node[], id: string): Node[] {
  return nodes.map(n => {
    if (n.id !== id) return n
    const d = n.data as Record<string, unknown>
    const obs = d.observedState as Record<string, unknown>
    return { ...n, data: { ...d, observedState: { ...obs, source: 'user_confirmed' } } }
  })
}

const CORPUS: readonly Node[] = [
  // Countable when confirmation is connected: an Olumi estimate with a number.
  factor('f-estimate', { value: 0.4, raw_value: 40, source: 'cee_inference' }),
  // A capped factor off the wire carries `value` and no `raw_value` — still ratifiable.
  factor('f-capped', { value: 0.7, source: 'cee_inference' }),
  // No number: nothing to ratify, so never countable (the writer refuses it).
  factor('f-no-value', { source: 'cee_inference' }),
  factor('f-no-state', null),
  // Contrast: a person already owns these numbers.
  factor('f-user-set', { value: 0.9, raw_value: 90, source: 'user_override' }),
  factor('f-confirmed', { value: 0.5, raw_value: 50, source: 'user_confirmed' }),
]

/** What the v2 panel's confirm path would offer, derived the way the panel derives it. */
function confirmPathOffers(nodes: readonly Node[], authority: MutationAuthority): string[] {
  if (!hasServerGraphAuthority(authority)) return []
  return toRepairQueueItems(
    { nodes, edges: [] as Edge<EdgeData>[], goalThreshold: null },
    'confirm-estimates',
  ).map(item => item.rowId)
}

describe('Model tab "N to verify" — only factors the confirm path can take', () => {
  it('(a) with confirmation CONNECTED, counts exactly the unconfirmed estimates that carry a number', () => {
    expect(modelTabFactorsToVerify(CORPUS, 'server_graph')).toEqual(['f-estimate', 'f-capped'])
  })

  it('(b) with confirmation NOT connected, counts NOTHING — no factor there can be confirmed', () => {
    for (const authority of ['disabled', 'local_presentation', 'server_fact'] as const) {
      expect(`${authority}: ${JSON.stringify(modelTabFactorsToVerify(CORPUS, authority))}`).toBe(
        `${authority}: []`,
      )
    }
  })

  it('(b) under the DEPLOYED table the Model tab cannot confirm, so the badge counts nothing', () => {
    // ⚠ PINNED LITERAL. If `modelFactorConfirmation` gains a carrier and flips,
    // this reds and forces a re-read of the badge — the derivation below alone
    // would move with the key and prove nothing (see
    // `model-tab-v2/__tests__/affordancesFollowTheAuthorityTable.spec.tsx`).
    expect(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation).toBe('disabled')
    // Default argument = the table's own key, read through the table's own reader.
    expect(modelTabFactorsToVerify(CORPUS)).toEqual([])
    // ⭐ Positive control in the same run: the SAME corpus is non-empty the moment
    // the authority is connected, so the empty answer above is the gate, not a
    // corpus with nothing in it.
    expect(modelTabFactorsToVerify(CORPUS, 'server_graph').length).toBeGreaterThan(0)
  })

  it('⭐ the count IS the confirm path — same ids as the v2 confirm queue under the same authority', () => {
    for (const authority of ['server_graph', 'disabled'] as const) {
      expect(modelTabFactorsToVerify(CORPUS, authority)).toEqual(confirmPathOffers(CORPUS, authority))
    }
    expect(modelTabFactorsToVerify(CORPUS)).toEqual(
      confirmPathOffers(CORPUS, CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation),
    )
  })

  it('(c) confirming a counted factor removes EXACTLY that factor — the count goes down by one, never up', () => {
    const before = modelTabFactorsToVerify(CORPUS, 'server_graph')
    const after = modelTabFactorsToVerify(confirm(CORPUS, 'f-estimate'), 'server_graph')
    expect(before).toContain('f-estimate')
    expect(after).toEqual(before.filter(id => id !== 'f-estimate'))
  })

  it('(d) contrast: a user-set or already-confirmed factor is never counted, connected or not', () => {
    for (const authority of ['server_graph', 'disabled'] as const) {
      const ids = modelTabFactorsToVerify(CORPUS, authority)
      expect(ids).not.toContain('f-user-set')
      expect(ids).not.toContain('f-confirmed')
      expect(ids).not.toContain('f-no-value')
      expect(ids).not.toContain('f-no-state')
    }
  })

  it('⛔ the measured regression: giving a valueless factor a number does NOT raise the deployed count', () => {
    // The optimistic value write (`setObservedValue` with the stamp deferred to
    // the receipt) lands a number while the source is still unstamped. That was
    // the 4 → 5 on `db758d83`.
    const withValue = CORPUS.map(n =>
      n.id === 'f-no-value'
        ? { ...n, data: { ...(n.data as object), observedState: { value: 0.6, raw_value: 0.6 } } }
        : n,
    )
    expect(modelTabFactorsToVerify(CORPUS)).toEqual([])
    expect(modelTabFactorsToVerify(withValue)).toEqual([])
  })
})
