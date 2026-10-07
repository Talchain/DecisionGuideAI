import { AlertTriangle } from 'lucide-react'
import { useCanvasStore, selectPremortemWorksheet } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useOptionalConversationContext } from '../../../../canvas/conversation/ConversationContext'
import { openNodeInspector } from '../../../../canvas/nodes/shared/openNodeInspector'
import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { resolveModelTarget } from '../../../../canvas/utils/focusHelpers'
import { bindAskTarget } from '../../../../canvas/ui/inspector-v2/askTargetBinding'
import { PREMORTEM_COPY, samePremortemRun } from '../../../../v5/readPremortemWorksheet'
import type { PremortemWorksheetV1 } from '../../../../v5/readPremortemWorksheet'
import { typography } from '../../../../styles/typography'
import { SectionShell } from './SectionShell'

type Row = PremortemWorksheetV1['rows'][number]
export interface PreMortemWorksheetProps {
  isBusy?: boolean
  isStale?: boolean
}
const buttonClass = `${typography.panelBody} min-h-[24px] min-w-[24px] px-2 rounded text-info hover:underline disabled:opacity-50 disabled:no-underline focus-visible:ring-2 focus-visible:ring-info`

/** Read only worksheet projection. Risk buttons prepare a chip turn for the existing consent card. */
export function PreMortemWorksheet({ isBusy = false, isStale = false }: PreMortemWorksheetProps) {
  const read = useCanvasStore(selectPremortemWorksheet)
  const heldRun = useCanvasStore(s => s.runMeta.premortemRun)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const graphHash = useCanvasStore(s => s.lastServerGraphHash)
  const dirty = useCanvasStore(s => s.analysisFreshnessDirty)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const dispatch = useGuidanceStore(s => s._dispatchAction)
  const sendChip = useGuidanceStore(s => s._sendChip)
  const conversation = useOptionalConversationContext()
  const busy = isBusy || conversation?.isThinking === true
  const worksheet = read?.status === 'available' && read.worksheet.scenario_id === scenarioId ? read.worksheet : null
  const target = (id: string) => resolveModelTarget(id, nodes, edges, { endpointFallback: false })
  const stale = !!worksheet && (isStale || dirty || graphHash !== worksheet.run.graph_hash_at_run ||
    !samePremortemRun(heldRun, { scenarioId: worksheet.scenario_id, graphHashAtRun: worksheet.run.graph_hash_at_run, computedAt: worksheet.run.computed_at }) ||
    worksheet.rows.some(row => !nodes.some(node => node.id === row.option_id) || !target(row.risk_request.affected_node_id) || row.risk_request.grounding_ids.some(id => !target(id))))
  const groundingLabel = (id: string) => {
    const resolved = target(id)
    const nodeLabel = (nodeId: string) => String(nodes.find(node => node.id === nodeId)?.data.label ?? '')
    if (resolved?.kind === 'node') return nodeLabel(resolved.id)
    const edge = edges.find(edge => edge.id === resolved?.id)
    return edge ? `${nodeLabel(edge.source)} → ${nodeLabel(edge.target)}` : PREMORTEM_COPY.outside
  }
  const openElement = (id: string) => {
    if (stale) return
    const resolved = target(id)
    if (resolved?.kind === 'node') openNodeInspector(resolved.id)
    if (resolved?.kind === 'edge') openEdgeStrengthEditor(resolved.id, { centre: false })
  }
  const addRisk = (row: Row) => {
    if (stale || busy || !dispatch) return
    const ids = [...new Set([row.risk_request.affected_node_id, ...row.risk_request.grounding_ids])]
    const resolved = ids.map(target)
    if (resolved.some(element => element === null)) return
    const nodeIds = resolved.flatMap(element => element?.kind === 'node' ? [element.id] : [])
    const edgeIds = resolved.flatMap(element => element?.kind === 'edge' ? [element.id] : [])
    const selected_elements = resolved.flatMap(element => {
      if (element?.kind === 'edge') {
        const edge = edges.find(edge => edge.id === element.id)!
        return [{ id: `${edge.source}→${edge.target}`, kind: 'edge' }]
      }
      const node = nodes.find(node => node.id === element?.id)
      return node ? [{ id: node.id, kind: node.type ?? 'node', label: String(node.data.label ?? '') }] : []
    })
    // Reuse the existing send-time target binding; no change to the graph or the live selection.
    bindAskTarget(row.risk_request.message, nodeIds, edgeIds)
    const request = { id: 'agent-next-suggest-risks', label: 'Add this as a risk', message: row.risk_request.message, source: 'chip', selected_elements }
    dispatch(request)
  }
  const options = nodes.filter(node => node.type === 'option')
  return <SectionShell title={PREMORTEM_COPY.title} icon={AlertTriangle} count={worksheet?.rows.length ?? null} testId="premortem-worksheet">
    {worksheet ? <div className={`space-y-3 ${stale ? 'opacity-60' : ''}`}>
      {stale ? <p role="status" className={`${typography.panelBody} text-text-body`}>This Run is stale. Run the analysis again to use this worksheet.</p> : null}
      {options.map(option => {
        const rows = worksheet.rows.filter(row => row.option_id === option.id)
        return <div key={option.id} data-option-id={option.id} className="space-y-2">
          <button type="button" className={buttonClass} disabled={stale} onClick={() => openElement(option.id)}>{String(option.data.label ?? '')}</button>
          {rows.length === 0 ? <p className={`${typography.panelBody} text-text-light`}>Not stress-tested</p> : rows.map(row => <div key={row.row_id} className="space-y-1" data-row-id={row.row_id}>
            <p className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.provenance}</p>
            <p className={`${typography.panelBody} text-text-body`}>{row.failure_way}</p>
            <p className={`${typography.panelBody} text-text-body`}>{PREMORTEM_COPY.warning}: {row.early_warning}</p>
            <div className="flex flex-wrap gap-1">
              {row.grounding.kind === 'not_in_model' ? <span className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.outside}</span> : row.grounding.ids.map(id =>
                target(id) ? <button key={id} type="button" className={buttonClass} disabled={stale} onClick={() => openElement(id)}>
                  {groundingLabel(id)}
                </button> : <span key={id} className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.outside}</span>) }
            </div>
            <button type="button" className={buttonClass} disabled={stale || busy || !dispatch} onClick={() => addRisk(row)}>Add this as a risk</button>
          </div>)}
        </div>
      })}
      <footer className={`${typography.panelMeta} text-text-light space-y-1`}>
        <p>Run: <time dateTime={worksheet.run.computed_at}>{new Date(worksheet.run.computed_at).toLocaleString('en-GB')}</time></p>
        <p>{worksheet.blindspot_question}</p>
      </footer>
    </div> : <div className="space-y-2">
      {read?.status === 'unavailable' ? <p className={`${typography.panelBody} text-text-light`} role="status">Worksheet unavailable</p> : null}
      <button type="button" className={buttonClass} disabled={busy || isStale || !sendChip} onClick={() => sendChip?.(
        'Generate worksheet',
        'Run a pre-mortem with me: imagine this decision went badly. What most plausibly went wrong?',
        { id: 'agent-next-pre-mortem' },
      )}>Generate worksheet</button>
    </div>}
  </SectionShell>
}
