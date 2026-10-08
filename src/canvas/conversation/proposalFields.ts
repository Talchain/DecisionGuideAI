/**
 * S-D slice 1 (§15): the ONE reader of CEE's held-proposal projection, `_proposal_fields` on a turn and
 * `proposal_fields` on the graph read. Pure: no React, no store, so the restore path can use it too.
 */
import { z } from 'zod'
import type { ActionChip } from './types'

// Slice 1 §15 projection only. The stored, type-specific operations never come back from this panel.
const bandSchema = z.enum(['slight', 'moderate', 'strong', 'very_strong'])
const actionSchema = z.object({ id: z.string().min(1), label: z.string().min(1), message: z.string().min(1), detail: z.string().optional() })
const linkStrengthFieldSchema = z.object({
  field_id: z.string().min(1), kind: z.literal('link_strength'),
  from_id: z.string().min(1), to_id: z.string().min(1), from_label: z.string().min(1), to_label: z.string().min(1),
  direction: z.enum(['positive', 'negative']),
  current: z.object({ band: bandSchema, source: z.enum(['placeholder', 'estimate', 'yours']) }),
  allowed_bands: z.tuple([z.literal('slight'), z.literal('moderate'), z.literal('strong'), z.literal('very_strong')]),
  editable: z.boolean(),
})
const factorValueFieldSchema = z.object({
  field_id: z.string().regex(/^factor_value:.+$/), kind: z.literal('factor_value'),
  node_id: z.string().min(1), label: z.string().min(1), unit: z.string(),
  cap: z.number().optional(), declared_scale: z.unknown().optional(),
  current: z.object({ value: z.number().finite(), unit: z.string(), source: z.enum(['estimate', 'yours', 'from_brief']) }),
  filled_missing: z.boolean(), editable: z.boolean(),
})
const fieldSchema = z.discriminatedUnion('kind', [linkStrengthFieldSchema, factorValueFieldSchema])
const proposalSchema = z.object({
  proposal_id: z.string().regex(/^(?:gmh_[0-9a-f]{12}|prop_[0-9a-f]{32})$/),
  revision: z.string().min(1),
  digest: z.string().regex(/^[0-9a-f]{32}$/),
  approve_action: actionSchema,
  decline_action: actionSchema.extend({ label: z.literal('Not now'), message: z.literal('Not now.') }),
  fields: z.array(z.unknown()).refine(fields => {
    // Check identity across the raw entries, including kinds this panel cannot render.
    const ids = fields.flatMap(field => field !== null && typeof field === 'object' && 'field_id' in field ? [field.field_id] : [])
    return new Set(ids).size === ids.length
  }).transform(fields => fields.filter(field => field !== null && typeof field === 'object' && 'kind' in field
    && (field.kind === 'link_strength' || field.kind === 'factor_value'))).pipe(z.array(fieldSchema)),
  missing: z.array(z.object({ node_id: z.string().min(1), label: z.string().min(1), kind: z.enum(['risk', 'factor']), what: z.literal('level_today') })),
}).refine(p => p.approve_action.id === `agent-approve-proposal:${p.proposal_id}`
  && p.decline_action.id === `agent-decline-proposal:${p.proposal_id}`)
// CEE pins `_proposal_fields` to its 16-hex freshness token (graph-hash.ts HASH_HEX_LENGTH; served 4f9f9e5); 64 hex is its durable form.
const wireSchema = z.object({ version: z.literal(1), graph_hash: z.string().regex(/^(?:[0-9a-f]{16}|[0-9a-f]{64})$/), proposals: z.array(z.unknown()) })
export type Proposal = z.infer<typeof proposalSchema>
export type Band = z.infer<typeof bandSchema>
export interface ProposalEdits {
  proposal_id: string
  revision: string
  digest: string
  graph_hash: string
  fields: Array<{ field_id: string; band: Band } | { field_id: string; value: number }>
}
export type ProposalPanelAction = ActionChip & { proposalEdits?: ProposalEdits }

/** CEE amend bounds apply to the stored value, without any unit conversion. */
export function factorValueAllowed(field: Pick<z.infer<typeof factorValueFieldSchema>, 'cap' | 'declared_scale'>, value: number): boolean {
  if (!Number.isFinite(value)) return false
  if (typeof field.cap === 'number' && !(value <= field.cap)) return false
  if (field.declared_scale === 'unit_interval' && !(value >= 0)) return false
  if (field.declared_scale !== null && typeof field.declared_scale === 'object') {
    const scale = field.declared_scale as { min?: unknown; max?: unknown }
    if (typeof scale.min === 'number' && !(value >= scale.min)) return false
    if (typeof scale.max === 'number' && !(value <= scale.max)) return false
  }
  return true
}

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
