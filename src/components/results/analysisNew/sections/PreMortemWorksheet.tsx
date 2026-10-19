import { useCanvasStore, selectPremortemWorksheet } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useOptionalConversationContext } from '../../../../canvas/conversation/ConversationContext'
import { openNodeInspector } from '../../../../canvas/nodes/shared/openNodeInspector'
import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { resolveModelTarget } from '../../../../canvas/utils/focusHelpers'
import { bindAskTarget } from '../../../../canvas/ui/inspector-v2/askTargetBinding'
import { PREMORTEM_COPY, samePremortemRun } from '../../../../v5/readPremortemWorksheet'
import { canvasLinkOfTarget, useCanvasLight } from '../../../../canvas/graphChanges/rowCanvasLink'
import type { PremortemWorksheetV1 } from '../../../../v5/readPremortemWorksheet'
import { typography } from '../../../../styles/typography'
import { action, ACTION_FOCUS } from '../panelSurfaces'
import { Eye, Plus, ShieldCheck } from 'lucide-react'

type Row = PremortemWorksheetV1['rows'][number]
export interface PreMortemWorksheetProps {
  isBusy?: boolean
  isStale?: boolean
}
const buttonClass = `${typography.panelBody} ${action('inline')} disabled:opacity-50 disabled:no-underline`
/** An element the worksheet names, as an outlined pill that lights it on the canvas and opens it on press. */
const chipClass = `inline-flex min-h-[28px] min-w-[28px] items-center gap-2 rounded-full border px-3 transition-colors duration-200 disabled:opacity-50 ${ACTION_FOCUS}`

/**
 * Read only worksheet projection, shown in the "If it failed" lens's key card (`canvas/components/LensInfoPanel.tsx`;
 * `canvas/artefacts/lenses.ts` restores it on reload). Risk buttons prepare a chip turn for the existing consent card. Every option and
 * grounding control lights its element on the canvas on hover and keyboard focus, by identity only.
 */
export function PreMortemWorksheet({ isBusy = false, isStale = false }: PreMortemWorksheetProps) {
  const read = useCanvasStore(selectPremortemWorksheet)
  const heldRun = useCanvasStore(s => s.runMeta.premortemRun)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const graphHash = useCanvasStore(s => s.lastServerGraphHash)
  const dirty = useCanvasStore(s => s.analysisFreshnessDirty)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const dispatch = useGuidanceStore(s => s._dispatchAction)
  const conversation = useOptionalConversationContext()
  const busy = isBusy || conversation?.isThinking === true
  const worksheet = read?.status === 'available' && read.worksheet.scenario_id === scenarioId ? read.worksheet : null
  const light = useCanvasLight()
  const target = (id: string) => resolveModelTarget(id, nodes, edges, { endpointFallback: false })
  const stale = !!worksheet && (isStale || dirty || graphHash !== worksheet.run.graph_hash_at_run ||
    !samePremortemRun(heldRun, { scenarioId: worksheet.scenario_id, graphHashAtRun: worksheet.run.graph_hash_at_run, computedAt: worksheet.run.computed_at }) ||
    worksheet.rows.some(row => !nodes.some(node => node.id === row.option_id)
      || (row.risk_request !== undefined && (!target(row.risk_request.affected_node_id) || row.risk_request.grounding_ids.some(id => !target(id))))
      || (row.on_map !== undefined && !target(row.on_map.node_id))))
  const groundingLabel = (id: string) => {
    const resolved = target(id)
    const nodeLabel = (nodeId: string) => String(nodes.find(node => node.id === nodeId)?.data.label ?? '')
    if (resolved?.kind === 'node') return nodeLabel(resolved.id)
    const edge = edges.find(edge => edge.id === resolved?.id)
    return edge ? `${nodeLabel(edge.source)} → ${nodeLabel(edge.target)}` : PREMORTEM_COPY.outside
  }
  // Lights the element a control names; a stale worksheet names elements that may have moved, so it lights nothing.
  const lightProps = (id: string) => {
    const link = stale ? null : canvasLinkOfTarget(target(id))
    return link === null ? {} : {
      onMouseEnter: () => light.on(link), onMouseLeave: light.off, onFocus: () => light.on(link), onBlur: light.off,
    }
  }
  const openElement = (id: string) => {
    if (stale) return
    const resolved = target(id)
    if (resolved?.kind === 'node') openNodeInspector(resolved.id)
    if (resolved?.kind === 'edge') openEdgeStrengthEditor(resolved.id, { centre: false })
  }
  const addRisk = (row: Row) => {
    if (stale || busy || !dispatch || !row.risk_request) return
    // This typed message is outbound request text, never a worksheet readout.
    const { message } = row.risk_request
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
    bindAskTarget(message, nodeIds, edgeIds)
    const request = { id: 'agent-next-suggest-risks', label: 'Add this as a risk', message, source: 'chip', selected_elements }
    dispatch(request)
  }
  // CODEX-BRIEF-R2: ordinary Runs carry no worksheet and gain no empty section.
  if (!worksheet) return null
  const options = nodes.filter(node => node.type === 'option')
  return <div data-testid="premortem-worksheet" data-row-count={worksheet.rows.length} className={`space-y-6 transition-opacity duration-200 ${stale ? 'opacity-60' : ''}`}>
      {stale ? <p role="status" className={`${typography.panelBody} rounded-xl border border-warning/30 px-3 py-2 text-text-body`}>This Run is stale. Run the analysis again to use this worksheet.</p> : null}
      {/* Said once for the worksheet, never as a label above each story: every story Olumi drafted is its hypothesis. */}
      {worksheet.rows.some(row => row.source !== 'server_built')
        ? <p className={`${typography.panelMeta} inline-flex rounded-full border border-dashed border-info px-3 py-0.5 text-text-body`}>{PREMORTEM_COPY.provenance}</p>
        : null}
      {options.map(option => {
        const rows = worksheet.rows.filter(row => row.option_id === option.id)
        return <section key={option.id} data-option-id={option.id} className="space-y-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" className={`${typography.panelBody} ${chipClass} border-option/30 text-text-header`} disabled={stale} onClick={() => openElement(option.id)} {...lightProps(option.id)}>
              <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-option" />
              {String(option.data.label ?? '')}
            </button>
            {rows.length === 0 ? <p className={`${typography.panelMeta} text-text-light`}>Not stress-tested</p> : null}
          </div>
          {rows.map(row => <article key={row.row_id} data-row-id={row.row_id} className="space-y-3">
            <p className={`${typography.panelQuestion} text-text-header`}>{row.failure_way}</p>
            {row.source === 'server_built' ? <p className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.serverBuilt}</p> : null}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Eye aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" />
                <p className={`${typography.panelBody} text-text-body`}>{PREMORTEM_COPY.warning}: {row.early_warning}</p>
              </div>
              {row.mitigation ? <div className="flex items-start gap-2">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" />
                <p className={`${typography.panelBody} text-text-body`} data-testid="premortem-mitigation">{PREMORTEM_COPY.mitigate}: {row.mitigation}</p>
              </div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {row.grounding.kind === 'not_in_model' ? <span className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.outside}</span> : row.grounding.ids.map(id =>
                target(id) ? <button key={id} type="button" className={`${typography.panelMeta} ${chipClass} border-panel-border text-text-body`} disabled={stale} onClick={() => openElement(id)} {...lightProps(id)}>
                  {groundingLabel(id)}
                </button> : <span key={id} className={`${typography.panelMeta} text-text-light`}>{PREMORTEM_COPY.outside}</span>) }
            </div>
            {row.on_map ? <p className={`${typography.panelMeta} text-text-light`} data-testid="premortem-on-map">
              {PREMORTEM_COPY.onMap}: <button type="button" className={buttonClass} disabled={stale} onClick={() => openElement(row.on_map!.node_id)} {...lightProps(row.on_map.node_id)}>Inspect ‘{row.on_map.label}’</button>
            </p> : row.risk_request ? <button type="button" className={`${typography.panelBody} ${action('secondary')} gap-1 px-3 disabled:opacity-50`} disabled={stale || busy || !dispatch} onClick={() => addRisk(row)}><Plus aria-hidden="true" className="h-3.5 w-3.5" />Add this as a risk</button> : null}
          </article>)}
        </section>
      })}
      <footer className={`${typography.panelMeta} space-y-1 pt-2 text-text-light`}>
        <p className={`${typography.panelBody} text-text-body`}>{worksheet.blindspot_question}</p>
        <p>Run: <time dateTime={worksheet.run.computed_at}>{new Date(worksheet.run.computed_at).toLocaleString('en-GB')}</time></p>
      </footer>
  </div>
}
