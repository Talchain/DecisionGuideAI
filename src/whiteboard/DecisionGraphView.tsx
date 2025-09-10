import React from 'react'
import { useBoardState } from '@/sandbox/state/boardState'
import { track } from '@/lib/analytics'

export interface DecisionGraphViewProps {
  decisionId: string
  onClose: () => void
}

export const DecisionGraphView: React.FC<DecisionGraphViewProps> = ({ decisionId, onClose }) => {
  const {
    board,
    getDecisionOptions,
    getProblemsForDecision,
    getActionsForDecision,
    getEdgesAmong,
  } = useBoardState(decisionId)

  React.useEffect(() => {
    track('graph_mount', { decisionId })
    return () => track('graph_unmount', { decisionId })
  }, [decisionId])

  const decisionLabel = React.useMemo(() => {
    const name = board?.nodes?.find(n => n.id === decisionId)?.label
    return name || decisionId
  }, [board, decisionId])

  const optionIds = React.useMemo(() => getDecisionOptions?.(decisionId) ?? [], [getDecisionOptions, decisionId, board])
  const problemIds = React.useMemo(() => getProblemsForDecision?.(decisionId) ?? [], [getProblemsForDecision, decisionId, board])
  const actionIds = React.useMemo(() => getActionsForDecision?.(decisionId) ?? [], [getActionsForDecision, decisionId, board])

  const allIds = React.useMemo(() => [decisionId, ...optionIds, ...problemIds, ...actionIds], [decisionId, optionIds, problemIds, actionIds])
  const edges = React.useMemo(() => getEdgesAmong?.(allIds) ?? [], [getEdgesAmong, allIds, board])

  const getNodeLabel = (id: string) => board?.nodes?.find(n => n.id === id)?.label || id

  const onSelectNode = (id: string, type: 'decision' | 'option' | 'problem' | 'action') => {
    track('graph_node_select', { decisionId, nodeId: id, type })
  }

  const onKeyActivate = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }

  return (
    <div
      role="region"
      aria-label="Decision Graph"
      className="w-full h-[70vh] flex flex-col bg-white border rounded"
      data-testid="graph-root"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="text-sm font-medium">
          Decision Graph – <span className="text-gray-700">{decisionLabel}</span>
        </div>
        <button
          aria-label="Close Decision Graph"
          data-testid="graph-close"
          onClick={() => { track('graph_close_click', { decisionId }); onClose() }}
          className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"
        >Close</button>
      </div>

      {/* Columns */}
      <div className="flex-1 grid grid-cols-4 gap-4 p-3 overflow-auto">
        {/* Decision */}
        <div aria-label="Decision Column" data-testid="graph-col-decision">
          <div className="text-xs font-medium mb-2 text-gray-700">Decision</div>
          <ul className="space-y-2">
            <li
              role="button"
              tabIndex={0}
              onClick={() => onSelectNode(decisionId, 'decision')}
              onKeyDown={(e) => onKeyActivate(e, () => onSelectNode(decisionId, 'decision'))}
              className="px-2 py-1 rounded border bg-white hover:bg-indigo-50 focus:outline-none focus-visible:ring"
              data-testid={`node-${decisionId}`}
              aria-label={`Decision ${decisionLabel}`}
            >
              {decisionLabel}
            </li>
          </ul>
        </div>

        {/* Options */}
        <div aria-label="Options Column" data-testid="graph-col-options">
          <div className="text-xs font-medium mb-2 text-gray-700">Options</div>
          <ul className="space-y-2">
            {optionIds.length === 0 && <li className="text-xs text-gray-500">None</li>}
            {optionIds.map(id => (
              <li
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectNode(id, 'option')}
                onKeyDown={(e) => onKeyActivate(e, () => onSelectNode(id, 'option'))}
                className="px-2 py-1 rounded border bg-white hover:bg-indigo-50 focus:outline-none focus-visible:ring"
                data-testid={`node-${id}`}
                aria-label={`Option ${getNodeLabel(id)}`}
              >
                {getNodeLabel(id)}
              </li>
            ))}
          </ul>
        </div>

        {/* Problems */}
        <div aria-label="Problems Column" data-testid="graph-col-problems">
          <div className="text-xs font-medium mb-2 text-gray-700">Problems</div>
          <ul className="space-y-2">
            {problemIds.length === 0 && <li className="text-xs text-gray-500">None</li>}
            {problemIds.map(id => (
              <li
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectNode(id, 'problem')}
                onKeyDown={(e) => onKeyActivate(e, () => onSelectNode(id, 'problem'))}
                className="px-2 py-1 rounded border bg-white hover:bg-indigo-50 focus:outline-none focus-visible:ring"
                data-testid={`node-${id}`}
                aria-label={`Problem ${getNodeLabel(id)}`}
              >
                {getNodeLabel(id)}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div aria-label="Actions Column" data-testid="graph-col-actions">
          <div className="text-xs font-medium mb-2 text-gray-700">Actions</div>
          <ul className="space-y-2">
            {actionIds.length === 0 && <li className="text-xs text-gray-500">None</li>}
            {actionIds.map(id => (
              <li
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectNode(id, 'action')}
                onKeyDown={(e) => onKeyActivate(e, () => onSelectNode(id, 'action'))}
                className="px-2 py-1 rounded border bg-white hover:bg-indigo-50 focus:outline-none focus-visible:ring"
                data-testid={`node-${id}`}
                aria-label={`Action ${getNodeLabel(id)}`}
              >
                {getNodeLabel(id)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Edges summary */}
      <div className="border-t px-3 py-2 bg-gray-50" aria-label="Edges" data-testid="graph-edges">
        <div className="text-[11px] text-gray-600 mb-1">Edges among visible nodes</div>
        {edges.length === 0 ? (
          <div className="text-xs text-gray-500">No edges</div>
        ) : (
          <ul className="text-xs text-gray-700 grid grid-cols-2 gap-x-4">
            {edges.map(e => (
              <li key={e.id} data-testid={`edge-${e.id}`}>{getNodeLabel(e.source)} → {getNodeLabel(e.target)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
