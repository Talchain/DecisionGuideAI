/**
 * EdgeAssumptionsTable — collapsible cross-cutting edge table for pre-analysis panel.
 * Shows all causal edges with From, To, Direction, Strength (band), Confidence (%), Source.
 * Sortable by Strength and Confidence. Click row selects the edge.
 * Inferred rows get a subtle warning tint. Hidden when 0 causal edges.
 */

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'
import { typography } from '../../../styles/typography'
import { getStrengthLabel } from '../../ui/inspector-v2/inspectorStrings'
import { getProvenanceLabel } from '../../ui/inspector-v2/inspectorStrings'

type SortKey = 'strength' | 'confidence'
type SortDir = 'asc' | 'desc'

interface EdgeRow {
  edgeId: string
  fromLabel: string
  toLabel: string
  direction: 'positive' | 'negative'
  strength: number // 0-2 unsigned weight
  confidence: number | null // 0-1 beliefExists
  source: string | null
  isInferred: boolean
}

interface Props {
  edges: Edge<EdgeData>[]
  nodes: Node[]
  onSelectEdge: (edgeId: string) => void
}

export function EdgeAssumptionsTable({ edges, nodes, onSelectEdge }: Props) {
  const [open, setOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('strength')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const nodeLabel = (id: string) => {
    const n = (nodes ?? []).find(n => n.id === id)
    return String(n?.data?.label ?? id)
  }

  // Only causal edges (exclude structural option→decision, outcome→goal etc.)
  const rows = useMemo<EdgeRow[]>(() => {
    return (edges ?? [])
      .filter(e => {
        const src = nodes.find(n => n.id === e.source)
        const tgt = nodes.find(n => n.id === e.target)
        const srcKind = src?.type || (src?.data as any)?.kind
        const tgtKind = tgt?.type || (tgt?.data as any)?.kind
        // Keep factor→* and outcome→goal causal connections; skip option→* structural edges
        if (srcKind === 'option' || srcKind === 'decision') return false
        return true
      })
      .map(e => {
        const data = e.data as EdgeData | undefined
        const weight = data?.weight ?? 0
        const direction = (data?.direction ?? 'positive') as 'positive' | 'negative'
        const confidence = typeof data?.beliefExists === 'number' ? data.beliefExists : null
        const source = (data as any)?.source as string | undefined
        const isInferred = source === 'cee_inference' || source === 'inferred' || (data as any)?.inferredBy != null
        return {
          edgeId: e.id,
          fromLabel: nodeLabel(e.source),
          toLabel: nodeLabel(e.target),
          direction,
          strength: weight,
          confidence,
          source: source ?? null,
          isInferred,
        }
      })
  }, [edges, nodes])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let diff = 0
      if (sortKey === 'strength') {
        diff = a.strength - b.strength
      } else {
        const aConf = a.confidence ?? -1
        const bConf = b.confidence ?? -1
        diff = aConf - bConf
      }
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) return null

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null
    return sortDir === 'desc'
      ? <ArrowDown size={10} className="inline ml-0.5" />
      : <ArrowUp size={10} className="inline ml-0.5" />
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${typography.panelBody} flex items-center gap-1.5 w-full text-left text-text-body bg-transparent border-none cursor-pointer p-0 hover:text-info transition-colors`}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown size={14} className="text-text-light shrink-0" />
          : <ChevronRight size={14} className="text-text-light shrink-0" />}
        <span className="font-medium">Model assumptions</span>
        <span className={`${typography.panelMeta} text-text-light ml-1`}>({rows.length})</span>
      </button>

      {open && (
        <div className="mt-2 border border-panel-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-x-2 px-2 py-1.5 bg-panel border-b border-panel-border">
            <span className={`${typography.panelMeta} text-text-light font-medium`}>From</span>
            <span className={`${typography.panelMeta} text-text-light font-medium`}>To</span>
            <span className={`${typography.panelMeta} text-text-light font-medium`}>Dir</span>
            <button
              type="button"
              onClick={() => toggleSort('strength')}
              className={`${typography.panelMeta} text-text-light font-medium bg-transparent border-none cursor-pointer p-0 hover:text-info transition-colors text-left`}
            >
              Strength<SortIcon col="strength" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('confidence')}
              className={`${typography.panelMeta} text-text-light font-medium bg-transparent border-none cursor-pointer p-0 hover:text-info transition-colors text-left`}
            >
              Conf<SortIcon col="confidence" />
            </button>
            <span className={`${typography.panelMeta} text-text-light font-medium`}>Source</span>
          </div>

          {/* Rows */}
          {sorted.map(row => (
            <button
              key={row.edgeId}
              type="button"
              onClick={() => onSelectEdge(row.edgeId)}
              className={`grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-x-2 px-2 py-1.5 w-full text-left border-b border-panel-border last:border-b-0 cursor-pointer transition-colors hover:bg-panel-hover ${
                row.isInferred ? 'bg-warning/10' : 'bg-transparent'
              }`}
            >
              <span className={`${typography.panelMeta} text-text-body truncate`} title={row.fromLabel}>
                {row.fromLabel}
              </span>
              <span className={`${typography.panelMeta} text-text-body truncate`} title={row.toLabel}>
                {row.toLabel}
              </span>
              <span className={`${typography.panelMeta} font-medium ${row.direction === 'positive' ? 'text-success' : 'text-danger'}`}>
                {row.direction === 'positive' ? '+' : '\u2212'}
              </span>
              <span className={`${typography.panelMeta} text-text-body`}>
                {getStrengthLabel(row.strength)}
              </span>
              <span className={`${typography.panelMeta} text-text-body tabular-nums`}>
                {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : '—'}
              </span>
              <span className={`${typography.panelMeta} text-text-light truncate`} title={row.source ?? undefined}>
                {row.source ? getProvenanceLabel(row.source) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
