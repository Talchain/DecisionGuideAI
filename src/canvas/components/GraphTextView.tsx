/**
 * GraphTextView - Hierarchical text representation of decision graph
 *
 * Displays a read-only tree view of the graph structure for validation
 * and navigation. Click any node name to focus it on the canvas.
 *
 * Features:
 * - Hierarchical tree rendering by node type
 * - Search/filter functionality
 * - Copy structure button (exports as plaintext)
 * - Collapsible sections by node type
 * - Click-to-focus canvas integration
 * - Node type breakdown with visual bars
 * - Section-level error boundaries for resilience
 */

import { useState, useMemo, useCallback, Component, type ReactNode } from 'react'
import {
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Target,
  Crosshair,
  Lightbulb,
  Settings,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { NodeType } from '../domain/nodes'
import { getDisplayEdgeId } from '../utils/edgeIdentity'
import { qualitativeTierLabel, formatInterventionValue, CURRENCY_SYMBOLS } from '../utils/labelUtils'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'

interface GraphTextViewProps {
  nodes: Node[]
  edges: Edge[]
  onNodeClick: (nodeId: string) => void
  onEdgeClick?: (edgeId: string) => void
  fragileEdgeIds?: Set<string>
  robustEdgeIds?: Set<string>
}

/**
 * Lightweight error boundary for Structure tab sections.
 * Catches render errors in individual sections so one broken section
 * doesn't crash the entire tab.
 */
export class SectionErrorBoundary extends Component<
  { children: ReactNode; section: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; section: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error(`[GraphTextView] Error in ${this.props.section}:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-panel border border-warning/30 rounded-md">
          <p className="text-sm text-warning">
            Unable to display {this.props.section}.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-1 text-xs text-warning hover:text-warning underline"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface GroupedNodes {
  goal: Node[]
  decision: Node[]
  option: Node[]
  factor: Node[]
  risk: Node[]
  outcome: Node[]
}

const NODE_TYPE_CONFIG: Record<NodeType, { icon: typeof Target; label: string; order: number; color: string }> = {
  goal: { icon: Target, label: 'Goals', order: 0, color: 'bg-warning' },
  decision: { icon: Crosshair, label: 'Decisions', order: 1, color: 'bg-sky-500' },
  option: { icon: Lightbulb, label: 'Options', order: 2, color: 'bg-option' },
  factor: { icon: Settings, label: 'Factors', order: 3, color: 'bg-sand-400' },
  risk: { icon: AlertTriangle, label: 'Risks', order: 4, color: 'bg-danger' },
  outcome: { icon: TrendingUp, label: 'Outcomes', order: 5, color: 'bg-success' },
}

/**
 * Get the node type, handling various field locations
 */
function getNodeType(node: Node): NodeType {
  const type = node.type || node.data?.type || node.data?.kind || 'decision'
  return type as NodeType
}

/**
 * Get the node label
 */
function getNodeLabel(node: Node): string {
  const label = node.data?.label
  return typeof label === 'string' ? label : String(label ?? node.id)
}

/**
 * Group nodes by type
 */
function groupNodesByType(nodes: Node[]): GroupedNodes {
  const groups: GroupedNodes = {
    goal: [],
    decision: [],
    option: [],
    factor: [],
    risk: [],
    outcome: [],
  }

  for (const node of nodes) {
    const type = getNodeType(node)
    if (groups[type]) {
      groups[type].push(node)
    }
  }

  return groups
}

/**
 * Find edges connected to a node
 */
function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(e => e.source === nodeId)
}


/**
 * Safe wrapper for getDisplayEdgeId — returns fallback for edges with no id
 */
function safeEdgeId(edge: Edge): string {
  try {
    return getDisplayEdgeId(edge) || `${edge.source}-${edge.target}`
  } catch {
    return `${edge.source ?? 'unknown'}-${edge.target ?? 'unknown'}`
  }
}

/**
 * Format edge belief and effect for display
 * Uses beliefStrength for effect magnitude and beliefExists for belief percentage
 * DO NOT display weight - it's visual, not causal
 */
function formatEdgeInfo(edge: Edge): { effect: string; belief: string; strengthStd: string | null } {
  const data = edge.data as any
  if (!data || typeof data !== 'object') {
    return { effect: '', belief: '', strengthStd: null }
  }

  // Effect: beliefStrength (magnitude, 0-1)
  const beliefStrength = data?.beliefStrength
  const direction = data?.direction
  let effect = ''
  if (typeof beliefStrength === 'number' && isFinite(beliefStrength)) {
    // Use ± when direction is unknown/missing to avoid misleading display
    const sign = direction === 'negative' ? '-' : direction === 'positive' ? '+' : '±'
    effect = `effect: ${sign}${beliefStrength.toFixed(1)}`
  }

  // Belief: beliefExists (probability edge exists, 0-1)
  const beliefExists = data?.beliefExists
  let belief = ''
  if (typeof beliefExists === 'number' && isFinite(beliefExists)) {
    belief = `belief: ${Math.round(beliefExists * 100)}%`
  }

  // Uncertainty: strengthStd (for tooltip only)
  const strengthStd = data?.strengthStd
  const strengthStdStr = typeof strengthStd === 'number' && isFinite(strengthStd) ? `Uncertainty: ±${strengthStd.toFixed(2)}` : null

  return { effect, belief, strengthStd: strengthStdStr }
}

/**
 * Get observed state info for factor nodes
 * Supports both numeric and string values
 */
function getObservedStateInfo(node: Node): { value: string | null; unit: string | null; source: string | null } {
  const data = node.data as any
  const observedState = data?.observedState ?? data?.observed_state

  if (!observedState) {
    return { value: null, unit: null, source: null }
  }

  // Format value for human comprehension (no raw floats)
  let value: string | null = null
  const rawVal = observedState.raw_value
  const unit = typeof observedState.unit === 'string' ? observedState.unit : null
  const numValue = typeof observedState.value === 'number' ? observedState.value : null

  if (rawVal != null && String(rawVal).trim() !== '') {
    const numeric = Number(rawVal)
    if (unit && CURRENCY_SYMBOLS.has(unit[0]) && !isNaN(numeric)) {
      value = formatInterventionValue(numeric, unit, observedState.factor_type)
    } else {
      value = unit ? `${rawVal} ${unit}` : String(rawVal)
    }
  } else if (numValue !== null) {
    if (unit) {
      value = formatInterventionValue(numValue, unit, observedState.factor_type)
    } else {
      value = qualitativeTierLabel(numValue)
    }
  }

  // Map raw source token to user-friendly label
  const rawSource = typeof observedState.source === 'string' ? observedState.source : null
  const source = rawSource ? getProvenanceLabel(rawSource) : null

  return { value, unit: null, source }
}

/**
 * Get body/description for a node
 */
function getNodeBody(node: Node): string | null {
  const data = node.data as any
  return typeof data?.body === 'string' && data.body.trim() ? data.body : null
}

export function GraphTextView({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  fragileEdgeIds,
  robustEdgeIds,
}: GraphTextViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<NodeType>>(
    new Set(['goal', 'decision', 'option', 'factor', 'risk', 'outcome'])
  )
  const [copied, setCopied] = useState(false)

  // Group and filter nodes
  const groupedNodes = useMemo(() => groupNodesByType(nodes), [nodes])

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedNodes

    const query = searchQuery.toLowerCase()
    const filtered: GroupedNodes = {
      goal: [],
      decision: [],
      option: [],
      factor: [],
      risk: [],
      outcome: [],
    }

    for (const [type, nodeList] of Object.entries(groupedNodes)) {
      filtered[type as NodeType] = nodeList.filter(node =>
        getNodeLabel(node).toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [groupedNodes, searchQuery])

  // Toggle section expansion
  const toggleSection = useCallback((type: NodeType) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // Generate text export
  const generateTextExport = useCallback(() => {
    const lines: string[] = ['DECISION GRAPH STRUCTURE', '']

    const typeOrder: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

    for (const type of typeOrder) {
      const nodeList = groupedNodes[type]
      if (nodeList.length === 0) continue

      const config = NODE_TYPE_CONFIG[type]
      lines.push(`${config.label.toUpperCase()} (${nodeList.length})`)

      for (const node of nodeList) {
        const label = getNodeLabel(node)
        const outgoing = getOutgoingEdges(node.id, edges)
        lines.push(`  ${label}`)

        for (const edge of outgoing) {
          const targetNode = nodes.find(n => n.id === edge.target)
          const targetLabel = targetNode ? getNodeLabel(targetNode) : edge.target
          const edgeInfo = formatEdgeInfo(edge)
          const displayParts: string[] = []
          if (edgeInfo.effect) displayParts.push(edgeInfo.effect)
          if (edgeInfo.belief) displayParts.push(edgeInfo.belief)
          const displayStr = displayParts.join(' | ')
          lines.push(`    → ${targetLabel}${displayStr ? ` (${displayStr})` : ''}`)
        }
      }
      lines.push('')
    }

    lines.push(`CONNECTIONS: ${edges.length} edges`)

    return lines.join('\n')
  }, [nodes, edges, groupedNodes])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const text = generateTextExport()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[GraphTextView] Failed to copy:', err)
    }
  }, [generateTextExport])

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeClick(nodeId)
  }, [onNodeClick])

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        className="p-6 bg-paper-50 rounded-lg border border-sand-200"
        data-testid="graph-text-view-empty"
      >
        <p className={`${typography.body} text-ink-500 text-center`}>
          Add nodes to see structure
        </p>
      </div>
    )
  }

  const typeOrder: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

  return (
    <div
      className="bg-paper-50 rounded-lg border border-sand-200"
      data-testid="graph-text-view"
    >
      {/* Header with search and copy */}
      <div className="p-4 border-b border-sand-200">
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 bg-white border border-sand-200 rounded-md ${typography.body} text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent`}
              aria-label="Search nodes"
              data-testid="graph-text-view-search"
            />
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border border-sand-200 bg-white ${typography.label} text-ink-900 hover:bg-sand-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors`}
            aria-label={copied ? 'Copied!' : 'Copy structure'}
            data-testid="graph-text-view-copy"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-success" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Enhanced Summary with visual breakdown */}
        <SectionErrorBoundary section="node breakdown">
          <div className="mt-4 space-y-3">
            {/* Node type breakdown - mini bar chart */}
            <div className="space-y-1.5">
              <div className={`${typography.caption} text-ink-600 font-medium`}>
                Node breakdown
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-sand-100">
                {typeOrder.map(type => {
                  const count = groupedNodes[type].length
                  if (count === 0) return null
                  const percent = (count / nodes.length) * 100
                  const config = NODE_TYPE_CONFIG[type]
                  return (
                    <div
                      key={type}
                      className={`${config.color} transition-all`}
                      style={{ width: `${percent}%` }}
                      title={`${config.label}: ${count}`}
                    />
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {typeOrder.map(type => {
                  const count = groupedNodes[type].length
                  if (count === 0) return null
                  const config = NODE_TYPE_CONFIG[type]
                  const Icon = config.icon
                  return (
                    <div key={type} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-sm ${config.color}`} />
                      <Icon className="w-3 h-3 text-ink-500" aria-hidden="true" />
                      <span className={`${typography.caption} text-ink-600`}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionErrorBoundary>
      </div>

      {/* Tree structure */}
      <SectionErrorBoundary section="graph tree">
      <div className={`p-4 ${typography.code}`} data-testid="graph-text-view-tree">
        {typeOrder.map(type => {
          const nodeList = filteredGroups[type]
          if (nodeList.length === 0) return null

          const config = NODE_TYPE_CONFIG[type]
          const Icon = config.icon
          const isExpanded = expandedSections.has(type)

          return (
            <div key={type} className="mb-4" data-testid={`graph-text-view-section-${type}`}>
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(type)}
                className="flex items-center gap-2 w-full text-left py-1 hover:bg-sand-100 rounded px-1 -mx-1 transition-colors"
                aria-expanded={isExpanded}
                aria-controls={`graph-section-${type}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-sand-400" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-sand-400" aria-hidden="true" />
                )}
                <Icon className="w-4 h-4 text-ink-500" aria-hidden="true" />
                <span className={`${typography.label} font-semibold text-ink-900`}>
                  {config.label}
                </span>
                <span className={`${typography.caption} text-ink-500`}>
                  ({nodeList.length})
                </span>
              </button>

              {/* Section content */}
              {isExpanded && (
                <div
                  id={`graph-section-${type}`}
                  className="ml-6 mt-1 border-l-2 border-sand-200 pl-4"
                >
                  {nodeList.map(node => {
                    const label = getNodeLabel(node)
                    const outgoing = getOutgoingEdges(node.id, edges)
                    const nodeType = getNodeType(node)
                    const observedInfo = nodeType === 'factor' ? getObservedStateInfo(node) : null
                    const nodeBody = getNodeBody(node)

                    return (
                      <div key={node.id} className="py-1">
                        {/* Node name (clickable) */}
                        <button
                          type="button"
                          onClick={() => handleNodeClick(node.id)}
                          className="text-sky-600 hover:text-sky-700 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-1 -mx-1"
                          title={nodeBody ? `Focus "${label}" on canvas. ${nodeBody}` : `Focus "${label}" on canvas`}
                          data-testid={`graph-text-view-node-${node.id}`}
                        >
                          {label}
                        </button>

                        {/* Factor observed state — human-readable value + provenance */}
                        {observedInfo && observedInfo.value && (
                          <div className={`ml-4 ${typography.caption} text-ink-500`}>
                            <span className="text-ink-600">{observedInfo.value}</span>
                            {observedInfo.source && (
                              <span className="ml-2 text-ink-400">• {observedInfo.source}</span>
                            )}
                          </div>
                        )}

                        {/* Outgoing connections */}
                        {outgoing.length > 0 && (
                          <div className="ml-4 text-ink-500">
                            {outgoing.map(edge => {
                              const targetNode = nodes.find(n => n.id === edge.target)
                              const targetLabel = targetNode ? getNodeLabel(targetNode) : edge.target
                              const edgeInfo = formatEdgeInfo(edge)
                              const edgeId = safeEdgeId(edge)
                              const isFragile = fragileEdgeIds?.has(edgeId) ?? false
                              const isRobust = robustEdgeIds?.has(edgeId) ?? false

                              // Build display string: effect | belief
                              const displayParts: string[] = []
                              if (edgeInfo.effect) displayParts.push(edgeInfo.effect)
                              if (edgeInfo.belief) displayParts.push(edgeInfo.belief)
                              const displayStr = displayParts.join(' | ')

                              return (
                                <div key={edgeId} className="flex items-center gap-1 py-0.5 flex-wrap">
                                  <span className="text-sand-400">→</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onEdgeClick) {
                                        onEdgeClick(edgeId)
                                      } else if (targetNode) {
                                        handleNodeClick(targetNode.id)
                                      }
                                    }}
                                    className="text-sky-500 hover:text-sky-600 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
                                    title={edgeInfo.strengthStd ? `Focus edge on canvas. ${edgeInfo.strengthStd}` : 'Focus edge on canvas'}
                                  >
                                    {targetLabel}
                                  </button>
                                  {displayStr && (
                                    <span
                                      className={`text-ink-400 ${typography.caption} cursor-help`}
                                      title="Effect is an estimate of impact size; belief is probability the relationship exists."
                                    >
                                      ({displayStr})
                                    </span>
                                  )}
                                  {/* Fragile badge */}
                                  {isFragile && (
                                    <span
                                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-panel text-warning border border-warning/30`}
                                      title="This edge is sensitive - changes here could affect the result"
                                    >
                                      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                                      Sensitive
                                    </span>
                                  )}
                                  {/* Robust badge */}
                                  {isRobust && !isFragile && (
                                    <span
                                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-panel text-success border border-success/30`}
                                      title="This edge is robust - stable under uncertainty"
                                    >
                                      ✓ Robust
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </SectionErrorBoundary>
    </div>
  )
}
