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
import { readProposalFields, type Band, type Proposal, changeNotesOf, otherChangeCountOf } from './proposalFields'

const DECLINE_CHIP_PREFIX = 'agent-decline-proposal:'
import type { ActionChip, ConversationMessage } from './types'

/** The producer's bands (CEE `InfluenceBand`), shown in its words: the consent card says "as moderate" too. */
export type PreviewBand = 'weak' | 'moderate' | 'strong' | 'very strong'
export type PreviewOptionStatus = 'feasible' | 'infeasible' | 'removed'
const BANDS: ReadonlySet<string> = new Set<PreviewBand>(['weak', 'moderate', 'strong', 'very strong'])
const OPTION_STATUSES: ReadonlySet<string> = new Set<PreviewOptionStatus>(['feasible', 'infeasible', 'removed'])

export type ProposalPreviewOp =
  | {
      readonly op: 'add_node'
      readonly id: string
      readonly label: string
      readonly kind: string | null
      /** Core only (`adds`): its point level, when it has one, and whose item it is. */
      readonly value?: { readonly value: number; readonly unit: string } | null
      readonly source?: 'estimate' | 'yours'
    }
  | {
      readonly op: 'add_edge'
      readonly fromId: string
      readonly toId: string
      readonly band: PreviewBand | null
      /** Core only (`adds`): which way the new link moves its target, and whose link it is. */
      readonly direction?: 'positive' | 'negative'
      readonly source?: 'estimate' | 'yours'
    }
  | {
      readonly op: 'set_link_strength'
      readonly fromId: string
      readonly toId: string
      readonly band: PreviewBand
      readonly keeps: boolean
      /** Core only (`_proposal_fields`): whose strength it is, as the held card says it. Absent on the legacy wire. */
      readonly source?: 'estimate' | 'yours'
    }
  | {
      readonly op: 'update_edge'
      readonly fromId: string
      readonly toId: string
      readonly band: PreviewBand
      readonly keeps: boolean
      readonly reverses: boolean
    }
  | { readonly op: 'set_option_status'; readonly optionId: string; readonly status: PreviewOptionStatus }
  /** Core lane only, from `_proposal_fields` (never the legacy wire): a new value on a factor already on the canvas. */
  | {
      readonly op: 'set_factor_value'
      readonly nodeId: string
      readonly value: number
      readonly unit: string
      readonly source: 'estimate' | 'yours' | 'from_brief'
    }

export interface ProposalPreview {
  readonly proposalId: string
  readonly ops: readonly ProposalPreviewOp[]
  /** Core only, present when the held card lists changes in words (`change_note`): how many it does not draw (may be 0). */
  readonly otherChanges?: number
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

/** The chips that settle a proposal on screen, as the reply offers them: its approve, and its "Not now" when offered. */
export interface ProposalConsentChips { readonly approve: ActionChip; readonly decline: ActionChip | null }

/**
 * ⭐ THE GHOST'S OWN BUTTONS ARE THE CARD'S (Reasoning Canvas plan, step 3: "approve from the ghost or the chat card").
 * The SAME chip objects the chat card presses, read from the reply that offers them, so the ghost adds no second
 * approval path and no words of its own. Null when no real reply offers the approve.
 */
export function consentChipsFor(messages: readonly ConversationMessage[], proposalId: string): ProposalConsentChips | null {
  const offered = (id: string): ActionChip | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role !== 'assistant' || m.synthetic) continue
      const chip = (m.actionChips ?? []).find((c) => c.id === id)
      if (chip !== undefined) return chip
    }
    return null
  }
  const approve = offered(consentChipIdFor(proposalId))
  return approve === null ? null : { approve, decline: offered(`${DECLINE_CHIP_PREFIX}${proposalId}`) }
}

/**
 * The preview the canvas may show NOW: the latest REAL reply's (a restore's "Session resumed" divider and a synthetic
 * notice are not replies, as in ChatThread), and only while its consent chip is offered.
 */
export function previewOfLatestReply(messages: readonly ConversationMessage[]): ProposalPreview | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant' || m.synthetic || typeof m.sessionDivider === 'string') continue
    const preview = m.proposalPreview ?? null
    if (preview !== null) {
      if (!(m.actionChips ?? []).some((c) => c.id === consentChipIdFor(preview.proposalId))) return null
      // ⛔ CONSENT (Codex r2 #2904): an explicit preview's card can list changes in words too; the ghost must know (no approve).
      const held = readProposalFields(m.proposalFields)?.proposals.find((p) => p.proposal_id === preview.proposalId)
      return held && changeNotesOf(held).length > 0 ? { ...preview, otherChanges: otherChangeCountOf(held) } : preview
    }
    // ⭐ Core sends no `proposal_preview`: the held card's own fields (`_proposal_fields`) name what it changes or adds.
    // The latest reply's fields are CEE's CURRENT held set; the card itself sits on its ISSUING reply, which a reopen
    // puts it back on (`reconcileRestoredProposalFields`). So the ghost shows exactly while the chat shows the card: held
    // now, and its approve offered on some reply (served 21 Oct: a later reply, then a reopen, lost the ghost, not the card).
    const offered = (id: string) => messages.some((r) => r.role === 'assistant' && !r.synthetic
      && (r.actionChips ?? []).some((c) => c.id === consentChipIdFor(id)))
    // The card the person is looking at first: the one this reply issued, else the newest held (CEE lists them oldest
    // first). Served 22 Oct: a still-held Challenge card came first and its undrawable ghost hid the correction's.
    const held = readProposalFields(m.proposalFields)?.proposals ?? []
    const turnOfReply = new Set([m.id, m.id.replace(/^restored-assistant-/, ''), m.clientTurnId, m.serverTurnId])
    const issuedHere = held.filter((p) => p.issued_turn_id != null && turnOfReply.has(p.issued_turn_id))
    for (const p of [...issuedHere, ...[...held].reverse()]) {
      const derived = previewFromFields(p)
      if (derived !== null && offered(derived.proposalId)) return derived
    }
    return null
  }
  return null
}

/** The CEE edit panel's bands, in the producer's preview words (`slight` is the canvas word for `weak`). */
const FIELD_BAND: Readonly<Record<Band, PreviewBand>> = {
  slight: 'weak', moderate: 'moderate', strong: 'strong', very_strong: 'very strong',
}

/** A held proposal's fields as display ops. A link nobody has sized (`placeholder`) is never drawn as a size. */
export function previewFromFields(p: Proposal): ProposalPreview | null {
  const ops: ProposalPreviewOp[] = p.fields.flatMap<ProposalPreviewOp>((f) => {
    if (f.kind === 'factor_value') {
      // The held card's unit authority (HeldProposalPanel formats with `field.unit`), never `current.unit`.
      return [{ op: 'set_factor_value', nodeId: f.node_id, value: f.current.value, unit: f.unit, source: f.current.source }]
    }
    if (f.current.source === 'placeholder') return []
    return [{ op: 'set_link_strength', fromId: f.from_id, toId: f.to_id, band: FIELD_BAND[f.current.band], keeps: false, source: f.current.source }]
  })
  // A new factor is a ghost card (beside what its new link ties it to); a new link, a ghost line saying which way it moves.
  for (const add of p.adds) {
    // A change note is words on the card, not a shape on the canvas.
    if (add.kind === 'change_note') continue
    ops.push(add.kind === 'factor_add'
      ? { op: 'add_node', id: add.node_id, label: add.label, kind: 'factor', value: add.value, source: add.source }
      : { op: 'add_edge', fromId: add.from_id, toId: add.to_id, band: null, direction: add.direction, source: add.source })
  }
  // Any note at all keeps the approve off the ghost; the count says only the changes it does not draw.
  return ops.length > 0 ? { proposalId: p.proposal_id, ops, ...(changeNotesOf(p).length > 0 ? { otherChanges: otherChangeCountOf(p) } : {}) } : null
}
