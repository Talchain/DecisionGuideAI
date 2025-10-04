// src/components/GraphCanvas.tsx
// POC: Pure React + SVG graph renderer with local edits (no external libs)

import { useState } from 'react'

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
}

interface EditHistory {
  past: LocalEdits[]
  present: LocalEdits
  future: LocalEdits[]
}

export default function GraphCanvas({ nodes, edges, localEdits, onEditsChange }: GraphCanvasProps) {
  const [mode, setMode] = useState<'view' | 'connect'>('view')
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [history, setHistory] = useState<EditHistory>({
    past: [],
    present: localEdits,
    future: []
  })

  // Merge server nodes with local additions
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
  const nodePositions = allNodes.map((node, i) => {
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
  })

  const pushEdit = (newEdits: LocalEdits) => {
    setHistory({
      past: [...history.past, history.present],
      present: newEdits,
      future: []
    })
    onEditsChange(newEdits)
  }

  const undo = () => {
    if (history.past.length === 0) return
    const previous = history.past[history.past.length - 1]
    setHistory({
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future]
    })
    onEditsChange(previous)
  }

  const redo = () => {
    if (history.future.length === 0) return
    const next = history.future[0]
    setHistory({
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1)
    })
    onEditsChange(next)
  }

  const addNode = () => {
    const newNode: Node = {
      id: `n${Date.now()}`,
      label: 'New Node',
      x: 100 + (allNodes.length % 3) * 200,
      y: 80 + Math.floor(allNodes.length / 3) * 120
    }
    pushEdit({
      ...localEdits,
      addedNodes: [...localEdits.addedNodes, newNode]
    })
  }

  const renameNode = (nodeId: string, newLabel: string) => {
    pushEdit({
      ...localEdits,
      renamedNodes: { ...localEdits.renamedNodes, [nodeId]: newLabel }
    })
    setEditingNode(null)
  }

  const handleNodeClick = (nodeId: string) => {
    if (mode === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeId)
      } else if (connectFrom !== nodeId) {
        pushEdit({
          ...localEdits,
          addedEdges: [...localEdits.addedEdges, { from: connectFrom, to: nodeId, label: 'proceed' }]
        })
        setConnectFrom(null)
        setMode('view')
      }
    }
  }

  const startRename = (nodeId: string, currentLabel: string) => {
    setEditingNode(nodeId)
    setEditValue(currentLabel)
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fff' }}>
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
        >
          {mode === 'connect' ? 'Cancel Connect' : 'Connect Nodes'}
        </button>
        <button
          onClick={undo}
          disabled={history.past.length === 0}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: history.past.length === 0 ? '#e5e7eb' : '#f8f8f8',
            cursor: history.past.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          ↶ Undo
        </button>
        <button
          onClick={redo}
          disabled={history.future.length === 0}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: history.future.length === 0 ? '#e5e7eb' : '#f8f8f8',
            cursor: history.future.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          ↷ Redo
        </button>
      </div>

      {mode === 'connect' && connectFrom && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          Click target node to connect from: <strong>{nodePositions.find(n => n.id === connectFrom)?.label}</strong>
        </div>
      )}

      {/* SVG Canvas */}
      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        <svg width="600" height={Math.max(300, Math.ceil(allNodes.length / 3) * 120 + 80)} style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
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
            if (!fromNode || !toNode) return null

            return (
              <g key={`edge-${i}`}>
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

          {/* Nodes */}
          {nodePositions.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width="120"
                height="40"
                rx="8"
                fill={connectFrom === node.id ? '#10b981' : '#f8f8f8'}
                stroke={connectFrom === node.id ? '#10b981' : '#d1d5db'}
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node.id)}
              />
              {editingNode === node.id ? (
                <foreignObject x={node.x} y={node.y} width="120" height="40">
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
                  x={node.x! + 60}
                  y={node.y! + 25}
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
          ))}
        </svg>
      </div>

      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
        Double-click node to rename • Connect mode: click source then target • Edits are session-local
      </div>
    </div>
  )
}
