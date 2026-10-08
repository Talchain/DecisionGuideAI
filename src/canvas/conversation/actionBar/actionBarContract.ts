/**
 * ⭐ S-B ACTION SYSTEM, slice 1 — THE ONE PRESENTER CONTRACT: `action_bar` v1.
 *
 * CEE owns the registry and the ranking (Paul approved the proposal, 7 Oct 2026;
 * `ACTION-SYSTEM-DRAFT-20261007.md` §C + §D and the AIE amendment are binding).
 * The bar rides the turn as ONE root key and carries everything a surface needs
 * to draw and press an action: label, icon name, press id, the user's line, why
 * it is offered now. This module is DGAI's one reader of it.
 *
 * ⚠ `action_id` AND `icon` ARE OPAQUE HERE. No enum of actions lives in DGAI, so
 * CEE adding an action needs no DGAI change, and the two repos cannot drift on
 * a list. An offer is skipped only when its SHAPE is wrong; the bar survives.
 *
 * ⚠ NOT `.strict()`. A field CEE adds later must not blank the bar: unknown keys
 * are dropped, and `v` is the only breaking-change signal (an unknown `v`
 * renders nothing and is logged).
 *
 * ⚠ NO SCHEMAS RELEASE. `OlumiResponseSchema` is strict, so `responseParser`
 * keeps every undeclared 2xx root key in its additive sidecar; the bar is read
 * top level first, then there (the `guidance` pattern, `guidanceRows.ts`).
 */
import { z } from 'zod'

import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../../v5/responseParser'
import { parseBiasRisk, type BiasRiskView } from './biasRiskContract'

export const ACTION_BAR_KEY = 'action_bar' as const
export const ACTION_BAR_VERSION = 1 as const

/** The contract's own limits (CEE holds to them; DGAI trims rather than fails). */
export const ACTION_BAR_LIMITS = { priority: 2, standard: 4, more: 20 } as const

const HEX16 = /^[0-9a-f]{16}$/

const ItemRefSchema = z.union([
  z.object({ kind: z.enum(['option', 'factor', 'risk', 'outcome', 'goal']), id: z.string().min(1) }),
  z.object({ kind: z.literal('link'), from_id: z.string().min(1), to_id: z.string().min(1) }),
])
export type ItemRef = z.infer<typeof ItemRefSchema>

/** What the bar was made for. No graph yet → no graph hash; no Run (or a Run-independent bar) → no run key. */
const RevisionSchema = z.object({ graph_hash: z.string().min(1).nullable(), run_key: z.string().min(1).nullable() })
export type ActionBarRevision = z.infer<typeof RevisionSchema>

const OfferSchema = z
  .object({
    action_id: z.string().min(1).max(64),
    label: z.string().min(1).max(24),
    icon: z.string().min(1).max(40),
    group: z.enum(['gap', 'method', 'review']),
    press_id: z.string().min(1).max(200),
    user_line: z.string().min(1).max(200),
    enabled: z.boolean(),
    why_now: z.string().min(1).max(90).optional(),
    disabled_reason: z.string().min(1).max(160).optional(),
    target: ItemRefSchema.optional(),
    protocol: z.object({ id: z.string().min(1), version: z.string().min(1) }).optional(),
    offer_key: z.string().regex(HEX16),
  })
  // An enabled offer says why now; a disabled one says what stops it. Neither is ever a bare control.
  .refine((o) => (o.enabled ? o.why_now !== undefined : o.disabled_reason !== undefined))
export type ActionOffer = z.infer<typeof OfferSchema>

const EnvelopeSchema = z.object({
  v: z.literal(ACTION_BAR_VERSION),
  state_key: z.string().regex(HEX16),
  revision: RevisionSchema,
  priority: z.array(z.unknown()),
  standard: z.array(z.unknown()),
  more: z.array(z.unknown()),
})

export interface ActionBarV1 {
  readonly v: typeof ACTION_BAR_VERSION
  readonly state_key: string
  readonly revision: ActionBarRevision
  /** At most two pills, the most important first (the one a narrow surface shows). */
  readonly priority: readonly ActionOffer[]
  /** The fixed-position icons, in CEE's order. */
  readonly standard: readonly ActionOffer[]
  /** Everything else that is relevant, ranked: the ⋯ menu. */
  readonly more: readonly ActionOffer[]
  readonly bias_risk?: BiasRiskView
}

/** Why a bar, or part of one, was not rendered. Reported once per read, never thrown. */
export type ActionBarIssue =
  | { readonly kind: 'unknown_version'; readonly v: unknown }
  | { readonly kind: 'malformed_envelope' }
  | { readonly kind: 'malformed_offer'; readonly slot: keyof typeof ACTION_BAR_LIMITS; readonly index: number }
  | { readonly kind: 'duplicate_offer'; readonly slot: keyof typeof ACTION_BAR_LIMITS; readonly action_id: string }

/** One place per action: the same action on the same target is one offer. */
export function offerIdentity(offer: Pick<ActionOffer, 'action_id' | 'target'>): string {
  const t = offer.target
  const target = t === undefined ? '' : t.kind === 'link' ? `link:${t.from_id}>${t.to_id}` : `${t.kind}:${t.id}`
  return `${offer.action_id}|${target}`
}

export function parseActionBar(raw: unknown, report: (issue: ActionBarIssue) => void = () => {}): ActionBarV1 | null {
  if (raw === undefined || raw === null) return null
  const v = (raw as { v?: unknown }).v
  if (typeof raw !== 'object' || v !== ACTION_BAR_VERSION) {
    report(typeof raw === 'object' && v !== undefined ? { kind: 'unknown_version', v } : { kind: 'malformed_envelope' })
    return null
  }
  const envelope = EnvelopeSchema.safeParse(raw)
  if (!envelope.success) {
    report({ kind: 'malformed_envelope' })
    return null
  }
  const seen = new Set<string>()
  const standardIds = new Set<string>()
  const slot = (name: keyof typeof ACTION_BAR_LIMITS, items: readonly unknown[]): ActionOffer[] => {
    const out: ActionOffer[] = []
    items.slice(0, ACTION_BAR_LIMITS[name]).forEach((item, index) => {
      const offer = OfferSchema.safeParse(item)
      if (!offer.success) return report({ kind: 'malformed_offer', slot: name, index })
      const identity = offerIdentity(offer.data)
      // A pill never repeats one of the fixed icons, and no action sits in two places.
      if (seen.has(identity) || (name === 'priority' && standardIds.has(offer.data.action_id))) {
        return report({ kind: 'duplicate_offer', slot: name, action_id: offer.data.action_id })
      }
      seen.add(identity)
      out.push(offer.data)
    })
    return out
  }
  // The fixed icons are read first: they keep their places whatever else is sent.
  const standard = slot('standard', envelope.data.standard)
  for (const offer of standard) standardIds.add(offer.action_id)
  const priority = slot('priority', envelope.data.priority)
  const more = slot('more', envelope.data.more)
  const biasRisk = parseBiasRisk((raw as Record<string, unknown>).bias_risk, [...priority, ...standard, ...more])
  return { v: ACTION_BAR_VERSION, state_key: envelope.data.state_key, revision: envelope.data.revision, priority, standard, more, ...(biasRisk ? { bias_risk: biasRisk } : {}) }
}

/** `action_bar` from a parsed turn or a scenario read: top level first, then the additive sidecar. */
export function readActionBar(source: unknown, report?: (issue: ActionBarIssue) => void): ActionBarV1 | null {
  if (source === null || typeof source !== 'object') return null
  const top = (source as Record<string, unknown>)[ACTION_BAR_KEY]
  const additive = (source as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return parseActionBar(top !== undefined ? top : additive?.[ACTION_BAR_KEY], report)
}

/** Every press id the bar holds: a suggested action with one of these ids is already on the bar. */
export function pressIdsOnBar(bar: ActionBarV1 | null): ReadonlySet<string> {
  return new Set(bar === null ? [] : [...bar.priority, ...bar.standard, ...bar.more].map((offer) => offer.press_id))
}
