/**
 * T4 — the coaching row (Reasoning Coach contract @1c355d57; carrier: AI HARNESS 5937532945).
 *
 * The Agent turn may carry ONE optional root key `guidance: { slot1?, slot2? }`. Each row is the selector's own
 * `Selection` (#2469 `types.ts`): `{policy_id, priority, variant?, target?, item?, primary_action, state_key_hash,
 * copy: {title, why, question}, item_ref}`. `item_ref` names the subject by ID (`{kind:'link', from_id, to_id}` or
 * `{kind:'factor', factor_id}`), so an action binds to the model by identity and never parses `item`.
 *
 * ⛔ The UI renders the row's OWN copy and authors none. A row without a policy id, a state key or a title is not a
 * row: it is dropped, never half-rendered. Absent `guidance` = no row this turn.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export type GuidanceItemRef =
  | { readonly kind: 'link'; readonly fromId: string; readonly toId: string }
  | { readonly kind: 'factor'; readonly factorId: string }

export interface GuidanceRow {
  readonly policyId: string
  readonly variant: string | null
  readonly priority: string | null
  readonly stateKeyHash: string
  /** CEE `SelectedRow.primary_action` (guidance/types.ts @f6d6c079): an object, never a bare string. */
  readonly primaryAction: { readonly label: string; readonly actionKind: string | null } | null
  readonly copy: { readonly title: string; readonly why: string | null; readonly question: string | null }
  readonly itemRef: GuidanceItemRef | null
}

export interface TurnGuidance {
  readonly slot1: GuidanceRow | null
  readonly slot2: GuidanceRow | null
}

/** The policy whose S1 row binds to the served Reasoning-tab Accept/Edit (RC card_first.ui_path). */
export const STRENGTHEN_ITEM_POLICY = 'RC-STRENGTHEN-ITEM'

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

function readItemRef(raw: unknown): GuidanceItemRef | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'link') {
    const fromId = str(r.from_id ?? r.fromId)
    const toId = str(r.to_id ?? r.toId)
    return fromId && toId ? { kind: 'link', fromId, toId } : null
  }
  if (r.kind === 'factor') {
    const factorId = str(r.factor_id ?? r.factorId)
    return factorId ? { kind: 'factor', factorId } : null
  }
  return null
}

function readPrimaryAction(raw: unknown): GuidanceRow['primaryAction'] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const label = str(r.label)
  return label ? { label, actionKind: str(r.action_kind ?? r.actionKind) } : null
}

/** One row, from the wire (snake_case) or from the saved transcript (camelCase). `null` = not a row. */
export function readGuidanceRow(raw: unknown): GuidanceRow | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const policyId = str(r.policy_id ?? r.policyId)
  const stateKeyHash = str(r.state_key_hash ?? r.stateKeyHash)
  const copy = (r.copy !== null && typeof r.copy === 'object' ? r.copy : {}) as Record<string, unknown>
  const title = str(copy.title)
  if (!policyId || !stateKeyHash || !title) return null
  return {
    policyId,
    variant: str(r.variant),
    priority: str(r.priority),
    stateKeyHash,
    primaryAction: readPrimaryAction(r.primary_action ?? r.primaryAction),
    copy: { title, why: str(copy.why), question: str(copy.question) },
    itemRef: readItemRef(r.item_ref ?? r.itemRef),
  }
}

/** Both slots from a stored or wire object. `null` when neither slot holds a row. */
export function readGuidanceSlots(raw: unknown): TurnGuidance | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const g = raw as Record<string, unknown>
  const slot1 = readGuidanceRow(g.slot1)
  const slot2 = readGuidanceRow(g.slot2)
  return slot1 || slot2 ? { slot1, slot2 } : null
}

/** `guidance` from a parsed turn: top level first, then the additive sidecar (the `narration` pattern). */
export function readGuidance(response: unknown): TurnGuidance | null {
  if (response === null || typeof response !== 'object') return null
  const top = (response as Record<string, unknown>).guidance
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return readGuidanceSlots(top !== undefined ? top : additive?.guidance)
}
