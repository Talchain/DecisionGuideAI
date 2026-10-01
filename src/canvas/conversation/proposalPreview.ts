/**
 * Suggestion preview: the carrier (DL ruling 5941839936 on PANEL 5941783386; T2 `guidance` precedent).
 *
 * The Agent turn may carry ONE optional root key `proposal_preview: { proposal_id, ops }`. It is a DISPLAY projection
 * of the STORED proposal CEE offers on the consent chip `agent-approve-proposal:<proposal_id>`: ids, labels, op class
 * and band only, never values, reasons or prose. The canvas draws it as a ghost until the proposal settles. Accept stays
 * on the existing consent chip, so nothing here writes the model.
 *
 * ⛔ Identity, not position: a preview is shown only while the latest REPLY still offers the consent chip for THAT
 *   proposal id. A preview whose chip is gone (Accepted, declined, withdrawn, or dropped on reload, which keeps no chips
 *   and no preview) or names another proposal shows nothing.
 * ⛔ Strict: an op that is not one of the three classes, or misses an id, is dropped. A preview with no ops is none.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'
import { CONSENT_CHIP_PREFIX } from './messageComposition'
import type { ConversationMessage } from './types'

export type ProposalPreviewOp =
  | { readonly op: 'add_node'; readonly id: string; readonly label: string; readonly kind: string | null }
  | { readonly op: 'add_edge'; readonly fromId: string; readonly toId: string }
  | { readonly op: 'set_link_strength'; readonly fromId: string; readonly toId: string; readonly band: string }

export interface ProposalPreview {
  readonly proposalId: string
  readonly ops: readonly ProposalPreviewOp[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** One op, from the wire (snake_case) or the message (camelCase). Only the whitelisted display fields are copied. */
function readOp(raw: unknown): ProposalPreviewOp | null {
  if (!isRec(raw)) return null
  if (raw.op === 'add_node') {
    const id = str(raw.id)
    const label = str(raw.label)
    return id && label ? { op: 'add_node', id, label, kind: str(raw.kind) } : null
  }
  const fromId = str(raw.from_id ?? raw.fromId)
  const toId = str(raw.to_id ?? raw.toId)
  if (!fromId || !toId) return null
  if (raw.op === 'add_edge') return { op: 'add_edge', fromId, toId }
  if (raw.op === 'set_link_strength') {
    const band = str(raw.band)
    return band ? { op: 'set_link_strength', fromId, toId, band } : null
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
