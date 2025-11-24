/**
 * M2.3: Draft Stream Panel
 * Real-time streaming UI with 2.5s test fixture
 */

import { useState, useEffect } from 'react'
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import type { DraftStreamEvent, DraftResponse } from '../../adapters/assistants/types'

interface DraftStreamPanelProps {
  isStreaming: boolean
  events: DraftStreamEvent[]
  onComplete?: (response: DraftResponse) => void
  onError?: (error: string) => void
}

export function DraftStreamPanel({
  isStreaming,
  events,
  onComplete,
  onError,
}: DraftStreamPanelProps) {
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [status, setStatus] = useState<'streaming' | 'complete' | 'error'>('streaming')

  useEffect(() => {
    let nodes = 0
    let edges = 0

    for (const event of events) {
      if (event.type === 'node') {
        nodes++
      } else if (event.type === 'edge') {
        edges++
      } else if (event.type === 'complete') {
        setStatus('complete')
        onComplete?.(event.data)
      } else if (event.type === 'error') {
        setStatus('error')
        onError?.(event.data.message)
      }
    }

    setNodeCount(nodes)
    setEdgeCount(edges)
  }, [events, onComplete, onError])

  if (!isStreaming && events.length === 0) {
    return null
  }

  return (
    <div className="p-4 bg-paper-50 rounded-lg border border-sand-200 shadow-panel">
      <div className="flex items-center gap-2 mb-3">
        {status === 'streaming' && (
          <>
            <Sparkles className="w-5 h-5 text-sky-500 animate-pulse" />
            <span className="font-medium text-ink-900">Drafting your model...</span>
          </>
        )}
        {status === 'complete' && (
          <>
            <CheckCircle2 className="w-5 h-5 text-sun-500" />
            <span className="font-medium text-ink-900">Draft complete!</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-5 h-5 text-carrot-500" />
            <span className="font-medium text-ink-900">
              Draft failed. Check your connection or try a shorter, simpler description.
            </span>
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-ink-900/70">
              <strong>{nodeCount}</strong> nodes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sun-500" />
            <span className="text-ink-900/70">
              <strong>{edgeCount}</strong> edges
            </span>
          </div>
        </div>

        {/* Recent events */}
        <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-ink-900/70">
          {events.slice(-5).map((event, i) => (
            <div key={i} className="py-1">
              {event.type === 'node' && `+ Node: ${event.data.label}`}
              {event.type === 'edge' && `+ Edge: ${event.data.from} → ${event.data.to}`}
              {event.type === 'provenance' && `+ Provenance data`}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * M2.3: Test fixture for streaming (2.5s total)
 * Returns mock stream events for development/testing
 */
export async function* mockDraftStream(): AsyncGenerator<DraftStreamEvent> {
  const events: DraftStreamEvent[] = [
    { type: 'node', data: { id: 'n1', label: 'Launch Product X', type: 'decision' } },
    { type: 'node', data: { id: 'n2', label: 'Market Size' } },
    { type: 'node', data: { id: 'n3', label: 'Development Cost' } },
    { type: 'edge', data: { id: 'e1', from: 'n2', to: 'n1' } },
    { type: 'edge', data: { id: 'e2', from: 'n3', to: 'n1' } },
    {
      type: 'complete',
      data: {
        schema: 'draft.v1',
        graph: {
          nodes: [
            { id: 'n1', label: 'Launch Product X', type: 'decision' },
            { id: 'n2', label: 'Market Size' },
            { id: 'n3', label: 'Development Cost' },
          ],
          edges: [
            { id: 'e1', from: 'n2', to: 'n1' },
            { id: 'e2', from: 'n3', to: 'n1' },
          ],
        },
      },
    },
  ]

  // M2.3: 2.5s total, ~500ms per event
  for (const event of events) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    yield event
  }
}
