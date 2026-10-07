import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { typography } from '../../styles/typography'
import { buildSuggestedActionChips } from '../../v5/blocks/suggestedActionChips'
import { CHIP_CLASS, CHIP_PRIMARY_CLASS } from '../../v5/blocks/chipClass'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { useCanvasStore } from '../store'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../domain/vocabulary'
import { StrengthBandButtons } from '../ui/inspector-v2/shared/StrengthBandButtons'
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
const wireSchema = z.object({ version: z.literal(1), graph_hash: z.string().regex(/^[0-9a-f]{64}$/), proposals: z.array(z.unknown()) })
type Proposal = z.infer<typeof proposalSchema>
type Band = z.infer<typeof bandSchema>
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

/** Cold restore and §15 replay gap use the existing graph read, with its explicit conversation opt-in. */
export function useHeldProposalFields(raw: unknown, replyId: string | undefined, chips: readonly ActionChip[]) {
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const cardId = chips.find(c => c.id.startsWith('agent-approve-proposal:'))?.id
  const [reload, setReload] = useState<{ scenarioId: string; replyId: string | undefined; cardId: string; raw: unknown } | null>(null)
  useEffect(() => {
    if (raw !== undefined || !cardId || !scenarioId) return
    const controller = new AbortController()
    void (async () => {
      try {
        const identity = await getSessionIdentity()
        if (controller.signal.aborted) return
        const result = await fetchScenarioGraph(scenarioId, { ...identity, includeConversationTurns: true, signal: controller.signal, retry503: false })
        if (!controller.signal.aborted && result.status === 'graph' && result.scenarioId === scenarioId) {
          setReload({ scenarioId, replyId, cardId, raw: result.proposalFields })
        }
      } catch { /* Unreadable projection retains today's amend sentence. */ }
    })()
    return () => controller.abort()
  }, [raw, replyId, cardId, scenarioId])
  const candidate = raw !== undefined ? raw
    : reload?.scenarioId === scenarioId && reload.replyId === replyId && reload.cardId === cardId ? reload.raw : undefined
  return useMemo(() => readProposalFields(candidate), [candidate])
}

const sourceWords = { placeholder: "Olumi's placeholder", estimate: "Olumi's estimate", yours: 'Yours' } as const
function preset(band: Band) {
  return CANVAS_STRENGTH_BANDS.find(b => b.id === (band === 'very_strong' ? 'veryStrong' : band))!
}

export function HeldProposalPanel({ proposal, graphHash, disabled, onAction }: {
  proposal: Proposal; graphHash: string; disabled: boolean; onAction: (action: ProposalPanelAction) => void
}) {
  const [selections, setSelections] = useState<Record<string, Band | null>>({})
  const changed = proposal.fields.flatMap(field => {
    const band = selections[field.field_id]
    return field.editable && band && band !== field.current.band ? [{ field_id: field.field_id, band }] : []
  })
  const unset = proposal.fields.some(f => f.editable && selections[f.field_id] === null)
  const approve = (edits: boolean) => onAction({ ...buildSuggestedActionChips([], [proposal.approve_action])[0],
    ...(edits && changed.length > 0 ? { proposalEdits: { proposal_id: proposal.proposal_id, revision: proposal.revision,
      digest: proposal.digest, graph_hash: graphHash, fields: changed } } : {}),
  })
  return (
    <section role="region" aria-label="What this change assumes" className="rounded-lg border border-panel-border bg-panel p-3 space-y-3">
      <h3 className={typography.panelHeader}>What this change assumes</h3>
      {proposal.fields.map(field => {
        const selected = selections[field.field_id]
        const band = selected ?? field.current.band
        return (
          <div key={field.field_id} data-testid={`proposal-field-${proposal.proposal_id}-${field.field_id}`}>
            <p className={typography.chatBody}>{field.from_label} → {field.to_label}</p>
            {selected === undefined && <p className={`${typography.chatMeta} text-text-light`}>{sourceWords[field.current.source]}</p>}
            {field.editable ? <fieldset disabled={disabled}>
              <StrengthBandButtons value={preset(band).midpoint * (field.direction === 'negative' ? -1 : 1)} unset={selected === null}
                technicalDetails={false} size="chat" onChange={value => {
                  const id = getCanvasStrengthBand(Math.abs(value)).id
                  setSelections(s => ({ ...s, [field.field_id]: id === 'veryStrong' ? 'very_strong' : id }))
                }} />
              <button type="button" className={CHIP_CLASS} onClick={() => setSelections(s => ({ ...s, [field.field_id]: null }))}>Enter my own</button>
            </fieldset> : <p className={typography.chatBody}>{preset(field.current.band).label}</p>}
          </div>
        )
      })}
      {proposal.missing.length > 0 && <div>
        <h4 className={typography.panelHeader}>Missing data</h4>
        {proposal.missing.map(item => <p key={`${item.kind}:${item.node_id}`} className={typography.chatBody}>
          {`Olumi has no figure for how likely '${item.label}' is today; the analysis treats it as zero`}
        </p>)}
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={CHIP_PRIMARY_CLASS} disabled={disabled || unset} onClick={() => approve(true)}>Submit</button>
        <button type="button" className={CHIP_CLASS} disabled={disabled} onClick={() => approve(false)}>Use Olumi's suggestions</button>
        <button type="button" className={CHIP_CLASS} disabled={disabled} onClick={() => onAction(buildSuggestedActionChips([], [proposal.decline_action])[0])}>Not now</button>
      </div>
    </section>
  )
}
