/**
 * Edge property inspector
 * Debounced sliders (~120ms) with aria-live announcements
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useCanvasStore, selectReport } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, DEFAULT_EDGE_DATA } from '../domain/edges'
import { useToast } from '../ToastContext'
import { Tooltip } from '../components/Tooltip'
import { GlossaryTerm } from '../components/GlossaryTerm'
import { ExternalLink, Info } from 'lucide-react'
import { focusNodeById } from '../utils/focusHelpers'
import { parseDebugInspectorEdges } from '../../adapters/plot/types'

interface EdgeInspectorProps {
  edgeId: string
  onClose: () => void
}

/**
 * Debounced edge property inspector
 * INP target: ≤100ms p75 for slider interactions
 */
export const EdgeInspector = memo(({ edgeId, onClose }: EdgeInspectorProps) => {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const deleteEdge = useCanvasStore(s => s.deleteEdge)
  const beginReconnect = useCanvasStore(s => s.beginReconnect)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const report = useCanvasStore(selectReport)
  const { showToast } = useToast()

  const edge = edges.find(e => e.id === edgeId)

  // Debug inspector facts (Phase 6+)
  const debugEnabled = import.meta.env.VITE_FEATURE_INSPECTOR_DEBUG === '1'
  const edgeFacts = useMemo(() => {
    if (!debugEnabled || !report?.debug?.inspector?.edges) return null

    const parsedEdges = parseDebugInspectorEdges(report.debug.inspector.edges)
    if (!parsedEdges) return null

    // Find facts for this edge
    return parsedEdges.find(e => e.edge_id === edgeId) || null
  }, [debugEnabled, report, edgeId])

  // Local state for immediate UI updates with proper defaults
  const [weight, setWeight] = useState<number>(edge?.data?.weight ?? 1.0)
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')
  const [curvature, setCurvature] = useState<number>(edge?.data?.curvature ?? 0.15)
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  
  // Debounce timer refs
  const weightTimerRef = useRef<NodeJS.Timeout>()
  const curvatureTimerRef = useRef<NodeJS.Timeout>()

  // Live region for announcements
  const [announcement, setAnnouncement] = useState('')

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(weightTimerRef.current)
      clearTimeout(curvatureTimerRef.current)
    }
  }, [])
  
  // Debounced weight update (~120ms)
  const handleWeightChange = useCallback((value: number) => {
    setWeight(value)
    clearTimeout(weightTimerRef.current)
    weightTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, weight: value } })
      setAnnouncement(`Weight set to ${value.toFixed(1)}`)
    }, 120)
  }, [edgeId, edge?.data, updateEdge])
  
  // Immediate style update (no debounce needed for discrete choice)
  const handleStyleChange = useCallback((value: EdgeStyle) => {
    setStyle(value)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, style: value } })
    setAnnouncement(`Style changed to ${value}`)
  }, [edgeId, edge?.data, updateEdge])
  
  // Debounced curvature update (~120ms)
  const handleCurvatureChange = useCallback((value: number) => {
    setCurvature(value)
    clearTimeout(curvatureTimerRef.current)
    curvatureTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, curvature: value } })
      setAnnouncement(`Curvature set to ${(value * 100).toFixed(0)}%`)
    }, 120)
  }, [edgeId, edge?.data, updateEdge])
  
  // Immediate label update (on blur)
  const handleLabelBlur = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, label: label || undefined } })
  }, [edgeId, edge?.data, label, updateEdge])
  // Delete edge
  const handleDelete = useCallback(() => {
    deleteEdge(edgeId)
    showToast('Connector deleted — press ⌘Z to undo.', 'success')
    onClose()
  }, [edgeId, deleteEdge, showToast, onClose])
  
  // Begin reconnect mode
  const handleReconnectSource = useCallback(() => {
    beginReconnect(edgeId, 'source')
    showToast('Reconnect source: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])
  
  const handleReconnectTarget = useCallback(() => {
    beginReconnect(edgeId, 'target')
    showToast('Reconnect target: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])
  
  // Keyboard: Esc closes and returns focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])
  
  if (!edge) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No edge selected
      </div>
    )
  }
  
  return (
    <div 
      className="p-4 border-t border-gray-200" 
      role="region" 
      aria-label="Edge properties"
      data-testid="panel-edge-properties"
      onKeyDown={handleKeyDown}
    >
      {/* Live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Edge Properties</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>
      
      {/* Weight control - Read-only with deep link */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <GlossaryTerm
            term="Weight"
            definition="How strongly this connection influences the outcome (also affects line thickness)."
          />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 bg-gray-50" style={{ color: 'var(--olumi-text)' }}>
            {weight.toFixed(1)}
          </div>
        </div>
        <button
          onClick={() => {
            if (edge?.source) {
              focusNodeById(edge.source)
              setTimeout(() => {
                showToast('Navigate to the parent decision to edit probabilities', 'info')
              }, 100)
            }
          }}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          style={{ fontSize: '0.75rem' }}
        >
          <ExternalLink className="w-3 h-3" />
          Edit in parent decision
        </button>
      </div>

      {/* Debug Facts Table (Phase 6+) - Feature Flag Gated */}
      {debugEnabled && edgeFacts && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-700">Debug Facts</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-normal"
              style={{
                backgroundColor: 'rgba(91, 108, 255, 0.15)',
                color: 'var(--olumi-primary)'
              }}
            >
              Beta
            </span>
          </div>
          <div className="rounded border" style={{ borderColor: 'rgba(91, 108, 255, 0.2)' }}>
            <table className="w-full text-xs">
              <tbody>
                {/* Weight */}
                <tr>
                  <td className="px-3 py-2 font-medium text-gray-700 border-b border-gray-100">
                    <Tooltip content="Probability weight from analysis" position="right">
                      <div className="flex items-center gap-1">
                        <span>Weight</span>
                        <Info className="w-3 h-3 text-gray-400" />
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-gray-900 border-b border-gray-100">
                    {edgeFacts.weight.toFixed(2)}
                  </td>
                </tr>

                {/* Belief */}
                <tr>
                  <td className="px-3 py-2 font-medium text-gray-700 border-b border-gray-100">
                    <Tooltip content="Confidence level in this connection (0-1)" position="right">
                      <div className="flex items-center gap-1">
                        <span>Belief</span>
                        <Info className="w-3 h-3 text-gray-400" />
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-gray-900 border-b border-gray-100">
                    {edgeFacts.belief?.toFixed(2) ?? '1.00'}
                  </td>
                </tr>

                {/* Provenance */}
                <tr>
                  <td className="px-3 py-2 font-medium text-gray-700">
                    <Tooltip content="Source of this edge data" position="right">
                      <div className="flex items-center gap-1">
                        <span>Provenance</span>
                        <Info className="w-3 h-3 text-gray-400" />
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: 'rgba(91, 108, 255, 0.08)' }}>
                      {edgeFacts.provenance ?? 'template'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Style control */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Style
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Edge style">
          {(['solid', 'dashed', 'dotted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStyleChange(s)}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded border
                ${style === s
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
              style={style === s ? { backgroundColor: 'rgba(91,108,255,0.1)', borderColor: 'var(--olumi-primary)', color: 'var(--olumi-primary)' } : {}}
              role="radio"
              aria-checked={style === s}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Curvature control */}
      <div className="mb-4">
        <label htmlFor="edge-curvature" className="block text-xs font-medium text-gray-700 mb-1">
          Curvature
        </label>
        <input
          id="edge-curvature"
          type="range"
          min={EDGE_CONSTRAINTS.curvature.min}
          max={EDGE_CONSTRAINTS.curvature.max}
          step={0.01}
          value={curvature}
          onChange={(e) => handleCurvatureChange(parseFloat(e.target.value))}
          className="w-full"
          aria-valuemin={EDGE_CONSTRAINTS.curvature.min}
          aria-valuemax={EDGE_CONSTRAINTS.curvature.max}
          aria-valuenow={curvature}
          aria-valuetext={`${(curvature * 100).toFixed(0)}%`}
        />
      </div>
      
      {/* Label control */}
      <div className="mb-4">
        <label htmlFor="edge-label" className="block text-xs font-medium text-gray-700 mb-1">
          Label (optional)
        </label>
        <input
          id="edge-label"
          type="text"
          maxLength={50}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          placeholder="Add a label..."
          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
        />
      </div>
      
      {/* Probability - CTA to parent decision */}
      <div className="mb-4">
        <Tooltip content="% likelihood this connector is taken (all from the same step must total 100%)" position="right">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Probability
          </label>
        </Tooltip>
        <div className="p-3 rounded" style={{ backgroundColor: 'rgba(91, 108, 255, 0.05)', border: '1px solid rgba(91, 108, 255, 0.2)' }}>
          <p className="text-xs text-gray-600 mb-2">
            Edit probabilities in this decision (or press <kbd className="px-1 py-0.5 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">P</kbd> after selecting)
          </p>
          <button
            type="button"
            onClick={() => {
              // Select the source decision node
              if (edge?.source) {
                selectNodeWithoutHistory(edge.source)
                onClose()
              }
            }}
            className="w-full px-3 py-1.5 text-xs font-medium rounded transition-colors"
            style={{
              backgroundColor: 'var(--olumi-primary, #5B6CFF)',
              color: '#ffffff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600, #4256F6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--olumi-primary, #5B6CFF)'
            }}
          >
            Go to decision probabilities
          </button>
        </div>
      </div>
      
      {/* Connection endpoints */}
      <div className="mb-4 pb-4 border-t border-gray-200 pt-4">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Connection
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Source:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {nodes.find(n => n.id === edge.source)?.data?.label || edge.source}
              </span>
              <button
                onClick={handleReconnectSource}
                className="text-xs underline"
                style={{ color: 'var(--olumi-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
                data-testid="btn-edge-reconnect-source"
              >
                Change…
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Target:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {nodes.find(n => n.id === edge.target)?.data?.label || edge.target}
              </span>
              <button
                onClick={handleReconnectTarget}
                className="text-xs underline"
                style={{ color: 'var(--olumi-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
                data-testid="btn-edge-reconnect-target"
              >
                Change…
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete button */}
      <div className="pt-2 border-t border-gray-200">
        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-sm font-medium text-white rounded transition-colors"
          style={{ backgroundColor: 'var(--olumi-danger)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e63946'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-danger)'}
          data-testid="btn-edge-delete"
        >
          Delete Connector
        </button>
      </div>
    </div>
  )
})

EdgeInspector.displayName = 'EdgeInspector'
