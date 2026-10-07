/**
 * S-D slice 1 (§15): the ONE reader of CEE's held-proposal projection, `_proposal_fields` on a turn and
 * `proposal_fields` on the graph read. Pure: no React, no store, so the restore path can use it too.
 */
import { z } from 'zod'
import type { ActionChip } from './types'

// Slice 1 §15 projection only. The stored, type-specific operations never come back from this panel.
const bandSchema = z.enum(['slight', 'moderate', 'strong', 'very_strong'])
const actionSchema = z.object({ id: z.string().min(1), label: z.string().min(1), message: z.string().min(1), detail: z.string().optional() })
const proposalSchema = z.object({
  proposal_id: z.string().regex(/^(?:gmh_[0-9a-f]{12}|prop_[0-9a-f]{32})$/),
  revision: z.string().min(1),
  digest: z.string().regex(/^[0-9a-f]{32}$/),
  approve_action: actionSchema,
  decline_action: actionSchema.extend({ label: z.literal('Not now'), message: z.literal('Not now.') }),
  fields: z.array(z.object({
    field_id: z.string().min(1), kind: z.literal('link_strength'),
    from_id: z.string().min(1), to_id: z.string().min(1), from_label: z.string().min(1), to_label: z.string().min(1),
    direction: z.enum(['positive', 'negative']),
    current: z.object({ band: bandSchema, source: z.enum(['placeholder', 'estimate', 'yours']) }),
    allowed_bands: z.tuple([z.literal('slight'), z.literal('moderate'), z.literal('strong'), z.literal('very_strong')]),
    editable: z.boolean(),
  })),
  missing: z.array(z.object({ node_id: z.string().min(1), label: z.string().min(1), kind: z.enum(['risk', 'factor']), what: z.literal('level_today') })),
}).refine(p => p.approve_action.id === `agent-approve-proposal:${p.proposal_id}`
  && p.decline_action.id === `agent-decline-proposal:${p.proposal_id}`
  && new Set(p.fields.map(f => f.field_id)).size === p.fields.length)
// CEE pins `_proposal_fields` to its 16-hex freshness token (graph-hash.ts HASH_HEX_LENGTH; served 4f9f9e5); 64 hex is its durable form.
const wireSchema = z.object({ version: z.literal(1), graph_hash: z.string().regex(/^(?:[0-9a-f]{16}|[0-9a-f]{64})$/), proposals: z.array(z.unknown()) })
export type Proposal = z.infer<typeof proposalSchema>
export type Band = z.infer<typeof bandSchema>
export interface ProposalEdits {
  proposal_id: string
  revision: string
  digest: string
  graph_hash: string
  fields: Array<{ field_id: string; band: Band }>
}
export type ProposalPanelAction = ActionChip & { proposalEdits?: ProposalEdits }

export function readTurnProposalFields(response: unknown): unknown {
  if (!response || typeof response !== 'object') return undefined
  const additive = (response as { __additive__?: { _proposal_fields?: unknown } }).__additive__
  return additive?._proposal_fields
}

export function readProposalFields(raw: unknown) {
  const parsed = wireSchema.safeParse(raw)
  if (!parsed.success) return null
  const proposals = parsed.data.proposals.flatMap(entry => {
    const p = proposalSchema.safeParse(entry)
    return p.success ? [p.data] : []
  })
  // An ambiguous identity must never authorise either reading.
  return { graph_hash: parsed.data.graph_hash, proposals: proposals.filter(p => proposals.filter(other => other.proposal_id === p.proposal_id).length === 1) }
}

/** CEE's amend control, byte-identical to its AMEND_CHIP; it carries no proposal id of its own. */
export const AMEND_PROPOSAL_ACTION = { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' } as const
