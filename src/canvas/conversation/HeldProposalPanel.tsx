import { useEffect, useMemo, useState } from 'react'
import { typography } from '../../styles/typography'
import { buildSuggestedActionChips } from '../../v5/blocks/suggestedActionChips'
import { CHIP_CLASS, CHIP_PRIMARY_CLASS } from '../../v5/blocks/chipClass'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { useCanvasStore } from '../store'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../domain/vocabulary'
import { StrengthBandButtons } from '../ui/inspector-v2/shared/StrengthBandButtons'
import { readProposalFields, type Band, type Proposal, type ProposalPanelAction } from './proposalFields'
import type { ActionChip } from './types'

export { readProposalFields, readTurnProposalFields, type ProposalEdits, type ProposalPanelAction } from './proposalFields'

/** Cold restore and §15 replay gap use the existing graph read, with its explicit conversation opt-in. */
export function useHeldProposalFields(raw: unknown, replyId: string | undefined, chips: readonly ActionChip[]) {
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const cardId = chips.find(c => typeof c.id === 'string' && c.id.startsWith('agent-approve-proposal:'))?.id
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
    : reload !== null && reload.scenarioId === scenarioId && reload.replyId === replyId && reload.cardId === cardId ? reload.raw : undefined
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
