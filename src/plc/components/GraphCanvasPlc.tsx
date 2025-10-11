// src/plc/components/GraphCanvasPlc.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { LocalEdits, Node, Edge } from '../types'
import { snapPoint } from '../utils/snap'
import { computeGuides } from '../utils/guides'

export default function GraphCanvasPlc({
  nodes,
  edges,
  localEdits,
  onOp,
  snap,
  guides,
}: {
  nodes: Node[]
  edges: Edge[]
  localEdits: LocalEdits
  onOp?: (op: any) => void
  snap?: { enabled: boolean; grid: number; tol: number }
  guides?: { enabled: boolean; tol: number; snapToGuide: boolean }
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragging, setDragging] = useState<{
    id: string
    from: { x: number; y: number }
    offset: { dx: number; dy: number }
  } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [guideV, setGuideV] = useState<number | null>(null)
  const [guideH, setGuideH] = useState<number | null>(null)

  const allNodes = useMemo(() => nodes, [nodes])
  const allEdges = useMemo(() => edges, [edges])

  const getSvgPoint = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    const cx = 'clientX' in e ? e.clientX : 0
    const cy = 'clientY' in e ? e.clientY : 0
    const rect = svg?.getBoundingClientRect()
    return { x: rect ? cx - rect.left : 0, y: rect ? cy - rect.top : 0 }
  }

  const onNodeMouseDown = (node: { id: string; x?: number; y?: number }) => (e: React.MouseEvent) => {
    const p = getSvgPoint(e)
    const nx = node.x ?? 0
    const ny = node.y ?? 0
    setSelectedId(node.id)
    setDragging({ id: node.id, from: { x: nx, y: ny }, offset: { dx: p.x - nx, dy: p.y - ny } })
  }

  const onSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const p = getSvgPoint(e)
    let nx = p.x - dragging.offset.dx
    let ny = p.y - dragging.offset.dy

    // Smart guides: compute against other rects
    if (guides?.enabled) {
      const moving = { x: nx, y: ny, w: 120, h: 40 }
      const others = allNodes.filter(n => n.id !== dragging.id).map(n => ({ x: n.x ?? 0, y: n.y ?? 0, w: 120, h: 40 }))
      const g = computeGuides(moving, others, guides.tol)
      setGuideV(g.v?.ref ?? null)
      setGuideH(g.h?.ref ?? null)
      if (guides.snapToGuide) {
        if (g.v) nx = g.v.snapTo
        if (g.h) ny = g.h.snapTo
      }
    } else {
      setGuideV(null); setGuideH(null)
    }

    // Grid snap (applied after guide snapping)
    if (snap?.enabled) {
      const sp = snapPoint({ x: nx, y: ny }, snap.grid, snap.tol)
      nx = sp.x; ny = sp.y
    }
    setDragPos({ id: dragging.id, x: nx, y: ny })
  }, [dragging, guides, allNodes, snap])

  const onSvgMouseUp = useCallback(() => {
    if (!dragging) return
    const final = dragPos && dragPos.id === dragging.id ? { x: dragPos.x, y: dragPos.y } : dragging.from
    const to = snap?.enabled ? snapPoint(final, snap.grid, snap.tol) : final
    if (to.x !== dragging.from.x || to.y !== dragging.from.y) {
      onOp?.({ type: 'move', payload: { id: dragging.id, from: dragging.from, to } })
    }
    setDragging(null)
    setDragPos(null)
    setGuideV(null); setGuideH(null)
  }, [dragging, dragPos, snap, onOp])

  return (
    <div data-testid="plc-canvas" tabIndex={0} role="application" aria-label="PLC canvas">
      <svg
        ref={svgRef}
        width={800}
        height={Math.max(300, Math.ceil(allNodes.length / 3) * 120 + 80)}
        style={{ border: '1px solid #e5e7eb', borderRadius: 4 }}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        data-testid="plc-whiteboard"
      >
        {/* Guides */}
        {guideV != null && (
          <line data-testid="plc-guide-v" x1={guideV} y1={0} x2={guideV} y2={2000} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {guideH != null && (
          <line data-testid="plc-guide-h" x1={0} y1={guideH} x2={2000} y2={guideH} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {/* Edges */}
        {allEdges.map((edge, i) => {
          const fromNode = allNodes.find(n => n.id === edge.from)
          const toNode = allNodes.find(n => n.id === edge.to)
          if (!fromNode || !toNode) return null
          return (
            <line
              key={`e-${i}`}
              x1={(fromNode.x ?? 0) + 60}
              y1={(fromNode.y ?? 0) + 20}
              x2={(toNode.x ?? 0) - 10}
              y2={(toNode.y ?? 0) + 20}
              stroke="#94a3b8"
              strokeWidth={2}
            />
          )
        })}

        {/* Nodes */}
        {allNodes.map((node) => {
          const isDragging = dragPos && dragPos.id === node.id
          const nx = isDragging ? dragPos!.x : (node.x ?? 0)
          const ny = isDragging ? dragPos!.y : (node.y ?? 0)
          const selected = selectedId === node.id
          return (
            <g key={node.id} data-testid="plc-node" aria-selected={selected ? 'true' : undefined}>
              <rect
                x={nx}
                y={ny}
                width={120}
                height={40}
                rx={8}
                fill={selected ? '#eef2ff' : '#f8f8f8'}
                stroke={selected ? '#6366f1' : '#d1d5db'}
                strokeWidth={2}
                onMouseDown={onNodeMouseDown(node)}
              />
              <text
                x={nx + 60}
                y={ny + 25}
                fontSize={12}
                fill="#111827"
                textAnchor="middle"
                style={{ userSelect: 'none', cursor: 'pointer' }}
                onMouseDown={onNodeMouseDown(node)}
              >
                {node.label.length > 15 ? node.label.slice(0, 15) + '…' : node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
