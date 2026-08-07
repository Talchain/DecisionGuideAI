/**
 * ROADMAP 2.668 — the chip render vocabulary is DERIVED, and stays derived.
 *
 * These are the agreement guards. They cannot prove the vocabulary is COMPLETE
 * (trap 12d: derivation moves that risk, it does not remove it) — the corpus in
 * `proposeConfirmChipRender.spec.tsx` is the instrument for completeness, and
 * neither file supersedes the other.
 *
 * What each guard here is for:
 *   - "no silent drop" is the anti-regression pin. It is true by construction
 *     today, which is the point: it goes RED the moment anyone replaces the
 *     derivation with a hand list that has gone short — the exact failure this
 *     row exists to close, and the one a green suite hid for months.
 *   - "no promise without delivery" is the safety direction: nothing renders as
 *     executable that the wire would strip or the dispatcher would default.
 *   - the synthetic-registry cases drive the predicate directly so the AND is
 *     proven to bite, rather than being inferred from a composed result that
 *     could hold for another reason.
 */
import { describe, it, expect } from 'vitest'

import { ActionType } from '@talchain/schemas/boundary'

import {
  V5_ENABLED_ACTIONS,
  UI_LOCAL_RENDERABLE_ACTION_TYPES,
  isHonestlyDispatchableAction,
} from '../chipActionVocabulary'
import { ACTION_TO_TURN_TYPE, DISPATCHABLE_ACTION_TYPES } from '../actionTurnTypes'
import {
  KNOWN_ACTION_TYPES,
  CEE_ACCEPTED_ACTION_TYPES,
  isSendableToken,
} from '../../../v5/buildPayload'

describe('chip render vocabulary — derived from the wire, never mirrored', () => {
  it('NO SILENT DROP: every known, CEE-accepted, dispatchable action renders', () => {
    // The union assertion. If CEE's vocabulary grows a value that this client
    // both accepts and dispatches, it MUST be renderable — a chip CEE emits and
    // the UI deletes is the 2.668 defect, whatever the value.
    const shouldRender = ActionType.options.filter(
      (t) =>
        isSendableToken(t, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES) &&
        DISPATCHABLE_ACTION_TYPES.has(t),
    )
    const dropped = shouldRender.filter((t) => !V5_ENABLED_ACTIONS.has(t))
    expect(dropped, `these would be filtered out of the chip row: ${dropped.join(', ')}`).toEqual([])
  })

  it('the three graph-mutation actions — the whole propose-confirm channel — render', () => {
    // Named explicitly because they are the ones that were missing, and because
    // a derived guard passing says nothing about WHICH values it covered.
    // `intentToActionType` emits exactly these three.
    for (const actionType of ['add_constraint', 'set_factor_value', 'adjust_edge_strength']) {
      expect(V5_ENABLED_ACTIONS.has(actionType), `${actionType} must render`).toBe(true)
    }
  })

  it('NO PROMISE WITHOUT DELIVERY: every wire action it renders survives the send gate and has a mapping', () => {
    for (const actionType of V5_ENABLED_ACTIONS) {
      if (!KNOWN_ACTION_TYPES.has(actionType as never)) continue // pre-enum carve-out, below
      expect(
        isSendableToken(actionType, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES),
        `${actionType} renders but would be STRIPPED at the wire`,
      ).toBe(true)
      expect(
        DISPATCHABLE_ACTION_TYPES.has(actionType),
        `${actionType} renders but has no ACTION_TO_TURN_TYPE mapping — it would fall through to the default turn`,
      ).toBe(true)
    }
  })

  it('the pre-enum carve-out is disjoint from the wire vocabulary, so it can never mask drift', () => {
    // If a wire value could be hand-listed in the carve-out, the derivation
    // would be bypassable and the mirror would be back. It cannot be.
    for (const actionType of UI_LOCAL_RENDERABLE_ACTION_TYPES) {
      expect(
        KNOWN_ACTION_TYPES.has(actionType as never),
        `${actionType} is in the wire enum and must be derived, not carved out`,
      ).toBe(false)
    }
  })

  it('excluded enum values are excluded for a DERIVABLE reason, never a remembered one', () => {
    // The list this replaced pinned six exclusions with prose reasons, three of
    // which had gone false. Each exclusion must now be explainable by the two
    // conjuncts alone.
    const excluded = ActionType.options.filter((t) => !V5_ENABLED_ACTIONS.has(t))
    for (const actionType of excluded) {
      const sendable = isSendableToken(actionType, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES)
      const dispatchable = DISPATCHABLE_ACTION_TYPES.has(actionType)
      expect(
        sendable && dispatchable,
        `${actionType} is excluded but satisfies both conjuncts — the exclusion has no derivable reason`,
      ).toBe(false)
    }
  })

  it('DISPATCHABLE_ACTION_TYPES uses own keys only, not prototype members', () => {
    // `'constructor' in ACTION_TO_TURN_TYPE` is true on any object literal. A
    // membership test written with `in` would admit every Object.prototype
    // member as a dispatchable action.
    expect(DISPATCHABLE_ACTION_TYPES.has('constructor')).toBe(false)
    expect(DISPATCHABLE_ACTION_TYPES.has('toString')).toBe(false)
    expect(DISPATCHABLE_ACTION_TYPES.has('add_constraint')).toBe(true)
    expect(new Set(DISPATCHABLE_ACTION_TYPES)).toEqual(new Set(Object.keys(ACTION_TO_TURN_TYPE)))
  })
})

describe('isHonestlyDispatchableAction — the AND bites, proven on synthetic registries', () => {
  const published = new Set(['alpha', 'beta', 'gamma'])
  const accepted = new Set(['alpha', 'beta'])
  const dispatchable = new Set(['alpha', 'gamma'])

  it('admits a token only when all three hold', () => {
    expect(isHonestlyDispatchableAction('alpha', published, accepted, dispatchable)).toBe(true)
  })

  it('publication + acceptance alone is not enough — no dispatch mapping', () => {
    expect(isHonestlyDispatchableAction('beta', published, accepted, dispatchable)).toBe(false)
  })

  it('publication + dispatchability alone is not enough — CEE does not accept it', () => {
    expect(isHonestlyDispatchableAction('gamma', published, accepted, dispatchable)).toBe(false)
  })

  it('an unpublished token is never admitted, however else it is registered', () => {
    expect(
      isHonestlyDispatchableAction('delta', published, new Set(['delta']), new Set(['delta'])),
    ).toBe(false)
  })
})
