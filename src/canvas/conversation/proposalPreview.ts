/**
 * Suggestion preview: the carrier (DL ruling 5941839936 on PANEL 5941783386; T2 `guidance` precedent).
 *
 * The Agent turn may carry ONE optional root key `proposal_preview: { proposal_id, ops }`. It is a DISPLAY projection
 * of the STORED proposal CEE offers on the consent chip `agent-approve-proposal:<proposal_id>`: ids, op class, band and
 * flags only, never values, reasons or prose. The canvas draws it as a ghost until the proposal settles. Accept stays
 * on the existing consent chip, so nothing here writes the model.
 *
 * The ops are the PRODUCER's (CEE #2494 `turn-context/proposal-preview.ts`): `add_edge {from_id,to_id,band?}`,
 * `update_edge {from_id,to_id,band,keeps,reverses}`, `set_link_strength {from_id,to_id,band,keeps}`,
 * `set_option_status {option_id,status}`. `keeps: true` = the Yes only RECORDS the strength the link already has
 * (`confirm_current`), so it is never drawn as a change. `add_node {id,label,kind}` is read too, but no producer emits
 * it yet (INERT).
 *
 * ⛔ Identity, not position: a preview is shown only while the latest REPLY still offers the consent chip for THAT
 *   proposal id. A preview whose chip is gone (Accepted, declined, withdrawn, or dropped on reload, which keeps no chips
 *   and no preview) or names another proposal shows nothing.
 * ⛔ Strict, as the producer is: an op of another class, or missing an id, a known band or status, or its boolean
 *   flags, is dropped. A preview with no ops is none.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'
import { CONSENT_CHIP_PREFIX } from './messageComposition'
import type { ConversationMessage } from './types'

/** The producer's bands (CEE `InfluenceBand`), shown in its words: the consent card says "as moderate" too. */
export type PreviewBand = 'weak' | 'moderate' | 'strong' | 'very strong'
export type PreviewOptionStatus = 'feasible' | 'infeasible' | 'removed'
const BANDS: ReadonlySet<string> = new Set<PreviewBand>(['weak', 'moderate', 'strong', 'very strong'])
const OPTION_STATUSES: ReadonlySet<string> = new Set<PreviewOptionStatus>(['feasible', 'infeasible', 'removed'])

export type ProposalPreviewOp =
  | { readonly op: 'add_node'; readonly id: string; readonly label: string; readonly kind: string | null }
  | { readonly op: 'add_edge'; readonly fromId: string; readonly toId: string; readonly band: PreviewBand | null }
  | { readonly op: 'set_link_strength'; readonly fromId: string; readonly toId: string; readonly band: PreviewBand; readonly keeps: boolean }
  | {
      readonly op: 'update_edge'
      readonly fromId: string
      readonly toId: string
      readonly band: PreviewBand
      readonly keeps: boolean
      readonly reverses: boolean
    }
  | { readonly op: 'set_option_status'; readonly optionId: string; readonly status: PreviewOptionStatus }

export interface ProposalPreview {
  readonly proposalId: string
  readonly ops: readonly ProposalPreviewOp[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const bandOf = (v: unknown): PreviewBand | null => (typeof v === 'string' && BANDS.has(v) ? (v as PreviewBand) : null)
const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** One op, from the wire (snake_case) or the message (camelCase). Only the whitelisted display fields are copied. */
function readOp(raw: unknown): ProposalPreviewOp | null {
  if (!isRec(raw)) return null
  if (raw.op === 'add_node') {
    const id = str(raw.id)
    const label = str(raw.label)
    return id && label ? { op: 'add_node', id, label, kind: str(raw.kind) } : null
  }
  if (raw.op === 'set_option_status') {
    const optionId = str(raw.option_id ?? raw.optionId)
    const status = typeof raw.status === 'string' && OPTION_STATUSES.has(raw.status) ? (raw.status as PreviewOptionStatus) : null
    return optionId && status ? { op: 'set_option_status', optionId, status } : null
  }
  const fromId = str(raw.from_id ?? raw.fromId)
  const toId = str(raw.to_id ?? raw.toId)
  if (!fromId || !toId) return null
  const band = bandOf(raw.band)
  if (raw.op === 'add_edge') {
    // The band is optional here (a new link with no stored strength), but a band that is present must be a known one.
    return raw.band === undefined || raw.band === null || band ? { op: 'add_edge', fromId, toId, band } : null
  }
  if (!band || typeof raw.keeps !== 'boolean') return null
  if (raw.op === 'set_link_strength') return { op: 'set_link_strength', fromId, toId, band, keeps: raw.keeps }
  if (raw.op === 'update_edge') {
    return typeof raw.reverses === 'boolean'
      ? { op: 'update_edge', fromId, toId, band, keeps: raw.keeps, reverses: raw.reverses }
      : null
  }
  return null
}

/** A preview value (wire or message shape). `null` = no preview. */
export function readProposalPreviewValue(raw: unknown): ProposalPreview | null {
  if (!isRec(raw)) return null
  const proposalId = str(raw.proposal_id ?? raw.proposalId)
  if (!proposalId || !Array.isArray(raw.ops)) return null
  const ops = raw.ops.map(readOp).filter((o): o is ProposalPreviewOp => o !== null)
  return ops.length > 0 ? { proposalId, ops } : null
}

/** `proposal_preview` from a parsed turn: top level first, then the additive sidecar (the `guidance` pattern). */
export function readProposalPreview(response: unknown): ProposalPreview | null {
  if (!isRec(response)) return null
  const top = response.proposal_preview
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return readProposalPreviewValue(top !== undefined ? top : additive?.proposal_preview)
}

/** The consent chip that settles this proposal. */
export function consentChipIdFor(proposalId: string): string {
  return `${CONSENT_CHIP_PREFIX}${proposalId}`
}

/**
 * The preview the canvas may show NOW: the latest REPLY's (a restore's "Session resumed" divider is not a reply), and
 * only while that reply still offers the consent chip for its proposal id.
 */
export function previewOfLatestReply(messages: readonly ConversationMessage[]): ProposalPreview | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant' || typeof m.sessionDivider === 'string') continue
    const preview = m.proposalPreview ?? null
    if (preview === null) return null
    const chip = consentChipIdFor(preview.proposalId)
    return (m.actionChips ?? []).some((c) => c.id === chip) ? preview : null
  }
  return null
}
