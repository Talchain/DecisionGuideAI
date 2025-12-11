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
 * - Connected vs orphan counts
 * - Edge evidence status summary
 */

import { useState, useMemo, useCallback } from 'react'
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
  Link2,
  Unlink2,
  FileText,
  Zap,
} from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { NodeType } from '../domain/nodes'
import { countEdgesWithEvidence } from '../utils/evidenceCoverage'

interface GraphTextViewProps {
  nodes: Node[]
  edges: Edge[]
  onNodeClick: (nodeId: string) => void
}

interface GroupedNodes {
  goal: Node[]
  decision: Node[]
  option: Node[]
  factor: Node[]
  risk: Node[]
  outcome: Node[]
  action: Node[]
}

const NODE_TYPE_CONFIG: Record<NodeType, { icon: typeof Target; label: string; order: number; color: string }> = {
  goal: { icon: Target, label: 'Goals', order: 0, color: 'bg-amber-500' },
  decision: { icon: Crosshair, label: 'Decisions', order: 1, color: 'bg-sky-500' },
  option: { icon: Lightbulb, label: 'Options', order: 2, color: 'bg-purple-500' },
  factor: { icon: Settings, label: 'Factors', order: 3, color: 'bg-slate-400' },
  risk: { icon: AlertTriangle, label: 'Risks', order: 4, color: 'bg-red-500' },
  outcome: { icon: TrendingUp, label: 'Outcomes', order: 5, color: 'bg-emerald-500' },
  action: { icon: Zap, label: 'Actions', order: 6, color: 'bg-emerald-500' },
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
  return node.data?.label || node.id
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
    action: [],
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
 * Check if a node is an orphan (no connections)
 */
function isOrphanNode(nodeId: string, edges: Edge[]): boolean {
  return !edges.some(e => e.source === nodeId || e.target === nodeId)
}

/**
 * Count orphan nodes
 */
function countOrphans(nodes: Node[], edges: Edge[]): number {
  return nodes.filter(n => isOrphanNode(n.id, edges)).length
}

/**
 * Format edge weight for display
 */
function formatEdgeWeight(edge: Edge): string {
  const weight = edge.data?.weight
  if (weight === undefined || weight === null) return ''
  const sign = weight >= 0 ? '+' : ''
  return `weight: ${sign}${weight}`
}

export function GraphTextView({ nodes, edges, onNodeClick }: GraphTextViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<NodeType>>(
    new Set(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action'])
  )
  const [copied, setCopied] = useState(false)

  // Group and filter nodes
  const groupedNodes = useMemo(() => groupNodesByType(nodes), [nodes])

  // Computed statistics
  const orphanCount = useMemo(() => countOrphans(nodes, edges), [nodes, edges])
  const connectedCount = nodes.length - orphanCount
  const evidenceStats = useMemo(() => countEdgesWithEvidence(edges), [edges])

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
      action: [],
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

    const typeOrder: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action']

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
          const weight = formatEdgeWeight(edge)
          lines.push(`    → ${targetLabel}${weight ? ` (${weight})` : ''}`)
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

  const typeOrder: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action']

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
                <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
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

          {/* Connection and evidence stats */}
          <div className="grid grid-cols-2 gap-3">
            {/* Connected vs Orphan */}
            <div className="flex items-center gap-2 p-2 bg-white rounded border border-sand-200">
              <Link2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              <div>
                <div className={`${typography.caption} text-ink-500`}>Connected</div>
                <div className={`${typography.label} text-ink-900`}>{connectedCount}</div>
              </div>
              {orphanCount > 0 && (
                <>
                  <div className="w-px h-8 bg-sand-200" />
                  <Unlink2 className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  <div>
                    <div className={`${typography.caption} text-ink-500`}>Orphan</div>
                    <div className={`${typography.label} text-amber-600`}>{orphanCount}</div>
                  </div>
                </>
              )}
            </div>

            {/* Evidence coverage */}
            <div className="flex items-center gap-2 p-2 bg-white rounded border border-sand-200">
              <FileText className="w-4 h-4 text-sky-500" aria-hidden="true" />
              <div>
                <div className={`${typography.caption} text-ink-500`}>Edges with evidence</div>
                <div className={`${typography.label} text-ink-900`}>
                  {evidenceStats.evidenced}/{evidenceStats.total}
                  {evidenceStats.total > 0 && (
                    <span className="text-ink-500 font-normal ml-1">
                      ({Math.round((evidenceStats.evidenced / evidenceStats.total) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tree structure */}
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

                    return (
                      <div key={node.id} className="py-1">
                        {/* Node name (clickable) */}
                        <button
                          type="button"
                          onClick={() => handleNodeClick(node.id)}
                          className="text-sky-600 hover:text-sky-700 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-1 -mx-1"
                          title={`Focus "${label}" on canvas`}
                          data-testid={`graph-text-view-node-${node.id}`}
                        >
                          {label}
                        </button>

                        {/* Outgoing connections */}
                        {outgoing.length > 0 && (
                          <div className="ml-4 text-ink-500">
                            {outgoing.map(edge => {
                              const targetNode = nodes.find(n => n.id === edge.target)
                              const targetLabel = targetNode ? getNodeLabel(targetNode) : edge.target
                              const weight = formatEdgeWeight(edge)

                              return (
                                <div key={edge.id} className="flex items-center gap-1 py-0.5">
                                  <span className="text-sand-400">→</span>
                                  <button
                                    type="button"
                                    onClick={() => targetNode && handleNodeClick(targetNode.id)}
                                    className="text-sky-500 hover:text-sky-600 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
                                    title={`Focus "${targetLabel}" on canvas`}
                                  >
                                    {targetLabel}
                                  </button>
                                  {weight && (
                                    <span className={`text-ink-400 ${typography.caption}`}>({weight})</span>
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
    </div>
  )
}
