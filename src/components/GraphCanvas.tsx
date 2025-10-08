// src/components/GraphCanvas.tsx
// POC: Pure React + SVG graph renderer with local edits (no external libs)

import { useRef, useState, useMemo, useCallback } from 'react'
import type { Op } from '../poc/state/history'

export interface Node {
  id: string
  label: string
  x?: number
  y?: number
}

export interface Edge {
  from: string
  to: string
  label?: string
}

export interface LocalEdits {
  addedNodes: Node[]
  renamedNodes: Record<string, string>
  addedEdges: Edge[]
}

interface GraphCanvasProps {
  nodes: Node[]
  edges: Edge[]
  localEdits: LocalEdits
  onEditsChange: (edits: LocalEdits) => void
  onOp?: (op: Op) => void
}

// (No internal history; parent owns ops via onOp)

export default function GraphCanvas({ nodes, edges, localEdits, onEditsChange: _onEditsChange, onOp }: GraphCanvasProps) {
  const [mode, setMode] = useState<'view' | 'connect'>('view')
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<{
    id: string
    from: { x: number; y: number }
    offset: { dx: number; dy: number }
  } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null)

  // Merge server nodes with local additions (PoC: if parent manages state, localEdits will be empty)
  const allNodes = [
    ...nodes.map(n => ({
      ...n,
      label: localEdits.renamedNodes[n.id] || n.label
    })),
    ...localEdits.addedNodes
  ]

  // Merge server edges with local additions
  const allEdges = [...edges, ...localEdits.addedEdges]

  // Simple grid layout
  const nodePositions = useMemo(() => allNodes.map((node, i) => {
    if (node.x !== undefined && node.y !== undefined) {
      return { ...node, x: node.x, y: node.y }
    }
    const col = i % 3
    const row = Math.floor(i / 3)
    return {
      ...node,
      x: 100 + col * 200,
      y: 80 + row * 120
    }
  }), [allNodes])

  // Parent will own ops/history; this component emits ops.

  const getSvgPoint = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    const rect = svg?.getBoundingClientRect()
    const x = 'clientX' in e ? e.clientX : 0
    const y = 'clientY' in e ? e.clientY : 0
    return { x: rect ? x - rect.left : 0, y: rect ? y - rect.top : 0 }
  }

  const addNode = useCallback(() => {
    const newNode: Node = {
      id: `n${Date.now()}`,
      label: 'New Node',
      x: 100 + (allNodes.length % 3) * 200,
      y: 80 + Math.floor(allNodes.length / 3) * 120
    }
    onOp?.({ type: 'add', payload: { kind: 'node', node: newNode as any } })
  }, [allNodes.length, onOp])

  const renameNode = useCallback((nodeId: string, newLabel: string) => {
    onOp?.({ type: 'edit', payload: { id: nodeId, to: newLabel } })
    setEditingNode(null)
  }, [onOp])

  const handleNodeClick = (nodeId: string) => {
    if (mode === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeId)
      } else if (connectFrom !== nodeId) {
        onOp?.({ type: 'connect', payload: { edge: { from: connectFrom, to: nodeId, label: 'proceed' } as any } })
        setConnectFrom(null)
        setGhostPos(null)
        setMode('view')
      }
    } else {
      // select node in view mode
      setSelectedNode(nodeId)
      setSelectedEdgeKey(null)
    }
  }

  const startRename = (nodeId: string, currentLabel: string) => {
    setEditingNode(nodeId)
    setEditValue(currentLabel)
  }

  const onNodeMouseDown = (node: { id: string; x?: number; y?: number }) => (e: React.MouseEvent) => {
    const p = getSvgPoint(e)
    const nx = node.x ?? 0
    const ny = node.y ?? 0
    setDragging({ id: node.id, from: { x: nx, y: ny }, offset: { dx: p.x - nx, dy: p.y - ny } })
  }

  const onSvgMouseMove = useCallback((e: React.MouseEvent) => {
    const p = getSvgPoint(e)
    if (dragging) {
      const x = p.x - dragging.offset.dx
      const y = p.y - dragging.offset.dy
      setDragPos({ id: dragging.id, x, y })
    }
    if (mode === 'connect' && connectFrom) {
      setGhostPos({ x: p.x, y: p.y })
    }
  }, [dragging, mode, connectFrom])

  const onSvgMouseUp = useCallback(() => {
    if (!dragging) return
    const final = dragPos && dragPos.id === dragging.id ? { x: dragPos.x, y: dragPos.y } : dragging.from
    if (final.x !== dragging.from.x || final.y !== dragging.from.y) {
      onOp?.({ type: 'move', payload: { id: dragging.id, from: dragging.from, to: final } })
    }
    setDragging(null)
    setDragPos(null)
  }, [dragging, dragPos, onOp])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || target?.getAttribute('contenteditable')) return
    // Toggle connect mode with 'c' key
    if (e.key === 'c' || e.key === 'C') {
      setMode(prev => (prev === 'connect' ? 'view' : 'connect'))
      setConnectFrom(null)
      setGhostPos(null)
      e.preventDefault()
      return
    }
    // Esc cancels ghost/connect
    if (e.key === 'Escape') {
      setConnectFrom(null)
      setGhostPos(null)
      setMode('view')
      e.preventDefault()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNode) {
        onOp?.({ type: 'remove', payload: { kind: 'node', id: selectedNode } })
        setSelectedNode(null)
        e.preventDefault()
        return
      }
      if (selectedEdgeKey) {
        const match = allEdges.find(e2 => (e2 as any).id === selectedEdgeKey) || allEdges.find(e2 => `${e2.from}->${e2.to}` === selectedEdgeKey)
        if (match) {
          onOp?.({ type: 'disconnect', payload: { id: (match as any).id, from: match.from as any, to: match.to as any } })
          setSelectedEdgeKey(null)
          e.preventDefault()
          return
        }
      }
    }
  }, [selectedNode, selectedEdgeKey, allEdges, onOp])

  return (
    <div
      ref={containerRef}
      style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fff' }}
      data-testid="graph-canvas"
      tabIndex={0}
      role="application"
      aria-label="Graph canvas"
      onKeyDown={onKeyDown}
    >
      {/* Controls */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={addNode}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: '#f8f8f8',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          data-testid="add-node-btn"
        >
          + Add Node
        </button>
        <button
          onClick={() => setMode(mode === 'connect' ? 'view' : 'connect')}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: mode === 'connect' ? '#10b981' : '#f8f8f8',
            color: mode === 'connect' ? '#fff' : '#000',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          data-testid="connect-toggle-btn"
          aria-pressed={mode === 'connect'}
          aria-label="Connect Nodes"
        >
          {mode === 'connect' ? 'Cancel Connect' : 'Connect Nodes'}
        </button>
      </div>

      {mode === 'connect' && connectFrom && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          Click target node to connect from: <strong>{nodePositions.find(n => n.id === connectFrom)?.label}</strong>
        </div>
      )}

      {/* SVG Canvas */}
      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        <svg
          ref={svgRef}
          width="600"
          height={Math.max(300, Math.ceil(allNodes.length / 3) * 120 + 80)}
          style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          data-testid="whiteboard-canvas"
        >
          {/* Arrow marker */}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>

          {/* Edges */}
          {allEdges.map((edge, i) => {
            const fromNode = nodePositions.find(n => n.id === edge.from)
            const toNode = nodePositions.find(n => n.id === edge.to)
            if (!fromNode || !toNode) {
              try {
                // Dev-only warn to catch reducer/persistence shape issues early in PoC
                // eslint-disable-next-line no-console
                if ((import.meta as any)?.env?.MODE === 'development') console.warn('GraphCanvas: missing node(s) for edge', { i, edge })
              } catch {}
              return null
            }

            return (
              <g key={`edge-${i}`} data-testid="graph-edge">
                <line
                  x1={fromNode.x! + 60}
                  y1={fromNode.y! + 20}
                  x2={toNode.x! - 10}
                  y2={toNode.y! + 20}
                  stroke="#6b7280"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(fromNode.x! + toNode.x!) / 2}
                    y={(fromNode.y! + toNode.y!) / 2 - 5}
                    fontSize="10"
                    fill="#6b7280"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Ghost edge (rubber-band) */}
          {mode === 'connect' && connectFrom && ghostPos && (() => {
            const fromNode = nodePositions.find(n => n.id === connectFrom)
            if (!fromNode) return null
            const x1 = (fromNode.x ?? 0) + 60
            const y1 = (fromNode.y ?? 0) + 20
            const x2 = ghostPos.x
            const y2 = ghostPos.y
            return (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
                data-testid="ghost-edge"
              />
            )
          })()}

          {/* Nodes */}
          {nodePositions.map((node) => {
            const isDragging = dragPos && dragPos.id === node.id
            const nx = isDragging ? dragPos!.x : node.x
            const ny = isDragging ? dragPos!.y : node.y
            return (
            <g key={node.id} data-testid="graph-node" data-node-id={node.id}>
              <rect
                x={nx}
                y={ny}
                width="120"
                height="40"
                rx="8"
                fill={connectFrom === node.id ? '#10b981' : '#f8f8f8'}
                stroke={connectFrom === node.id ? '#10b981' : '#d1d5db'}
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseDown={onNodeMouseDown(node)}
                onClick={() => handleNodeClick(node.id)}
              />
              {editingNode === node.id ? (
                <foreignObject x={nx} y={ny} width="120" height="40">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameNode(node.id, editValue)
                      if (e.key === 'Escape') setEditingNode(null)
                    }}
                    onBlur={() => renameNode(node.id, editValue)}
                    style={{
                      width: '110px',
                      height: '30px',
                      margin: '5px',
                      border: '1px solid #10b981',
                      borderRadius: '4px',
                      padding: '4px',
                      fontSize: '12px'
                    }}
                  />
                </foreignObject>
              ) : (
                <text
                  x={(nx ?? 0) + 60}
                  y={(ny ?? 0) + 25}
                  fontSize="12"
                  fill={connectFrom === node.id ? '#fff' : '#000'}
                  textAnchor="middle"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleNodeClick(node.id)}
                  onDoubleClick={() => startRename(node.id, node.label)}
                >
                  {node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label}
                </text>
              )}
            </g>
            )
          })}
        </svg>
      </div>

      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
        Double-click node to rename • Connect mode: click source then target • Edits are session-local
      </div>
    </div>
  )
}
