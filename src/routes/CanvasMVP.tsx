// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor on dedicated route

import '../styles/plot.css'
import { useState, useEffect } from 'react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'
import { Node, Edge } from '@xyflow/react'

export default function CanvasMVP() {
  // Demo data: 5-node graph
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: '1',
      type: 'decision',
      position: { x: 250, y: 100 },
      data: { label: 'Start' }
    },
    {
      id: '2',
      type: 'decision',
      position: { x: 100, y: 250 },
      data: { label: 'Option A' }
    },
    {
      id: '3',
      type: 'decision',
      position: { x: 400, y: 250 },
      data: { label: 'Option B' }
    },
    {
      id: '4',
      type: 'decision',
      position: { x: 250, y: 400 },
      data: { label: 'Outcome' }
    }
  ])

  const [edges, setEdges] = useState<Edge[]>([
    { id: 'e1-2', source: '1', target: '2', label: 'Path A' },
    { id: 'e1-3', source: '1', target: '3', label: 'Path B' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' }
  ])

  // Console boot line
  useEffect(() => {
    const commit = import.meta.env?.VITE_BUILD_SHA?.substring(0, 7) || 'unknown'
    // eslint-disable-next-line no-console
    console.log('[CANVAS] route=/canvas component=CanvasMVP graph=ReactFlow commit=%s', commit)
  }, [])

  const handleAddNode = () => {
    const newId = String(Date.now())
    const newNode: Node = {
      id: newId,
      type: 'decision',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: `Node ${nodes.length + 1}` }
    }
    setNodes([...nodes, newNode])
  }

  const handleReset = () => {
    setNodes([
      {
        id: '1',
        type: 'decision',
        position: { x: 250, y: 100 },
        data: { label: 'Start' }
      },
      {
        id: '2',
        type: 'decision',
        position: { x: 100, y: 250 },
        data: { label: 'Option A' }
      },
      {
        id: '3',
        type: 'decision',
        position: { x: 400, y: 250 },
        data: { label: 'Option B' }
      },
      {
        id: '4',
        type: 'decision',
        position: { x: 250, y: 400 },
        data: { label: 'Outcome' }
      }
    ])
    setEdges([
      { id: 'e1-2', source: '1', target: '2', label: 'Path A' },
      { id: 'e1-3', source: '1', target: '3', label: 'Path B' },
      { id: 'e2-4', source: '2', target: '4' },
      { id: 'e3-4', source: '3', target: '4' }
    ])
  }

  const commit = import.meta.env?.VITE_BUILD_SHA?.substring(0, 7) || 'unknown'

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Build Badge */}
      <div 
        className="fixed left-2 top-2 z-[9999] rounded bg-black/80 px-2 py-1 text-[11px] text-cyan-300"
        data-testid="build-badge"
      >
        ROUTE=/canvas • COMMIT={commit} • MODE=RF
      </div>

      {/* Toolbar */}
      <div className="fixed left-2 top-14 z-[9999] flex flex-col gap-2">
        <button
          onClick={handleAddNode}
          className="px-3 py-2 bg-[#EA7B4B] hover:bg-[#d86a3e] text-white text-sm rounded-lg shadow-md transition-colors"
          aria-label="Add Node"
        >
          + Node
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg shadow-md transition-colors"
          aria-label="Reset Demo"
        >
          Reset
        </button>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative" data-testid="rf-root">
        <ReactFlowGraph
          initialNodes={nodes}
          initialEdges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
        />
      </div>
    </div>
  )
}
