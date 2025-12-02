/**
 * M2.3: Draft Stream Panel Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraftStreamPanel, mockDraftStream } from '../DraftStreamPanel'
import type { DraftStreamEvent } from '../../../adapters/assistants/types'

describe('DraftStreamPanel (M2.3)', () => {
  it('shows nothing when not streaming and no events', () => {
    const { container } = render(
      <DraftStreamPanel isStreaming={false} events={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows streaming status with node/edge counts', () => {
    const events: DraftStreamEvent[] = [
      { type: 'node', data: { id: 'n1', label: 'Node 1' } },
      { type: 'node', data: { id: 'n2', label: 'Node 2' } },
      { type: 'edge', data: { id: 'e1', from: 'n1', to: 'n2' } },
    ]

    render(<DraftStreamPanel isStreaming={true} events={events} />)

    expect(screen.getByText(/drafting your model/i)).toBeInTheDocument()
    const nodeMatches = screen.getAllByText((_, element) =>
      /2\s*nodes/i.test(element?.textContent || '')
    )
    expect(nodeMatches.length).toBeGreaterThan(0)

    const edgeMatches = screen.getAllByText((_, element) =>
      /1\s*edges/i.test(element?.textContent || '')
    )
    expect(edgeMatches.length).toBeGreaterThan(0)
  })

  it('shows complete status when stream finishes', () => {
    const onComplete = vi.fn()
    const events: DraftStreamEvent[] = [
      { type: 'node', data: { id: 'n1', label: 'Node 1' } },
      {
        type: 'complete',
        data: {
          schema: 'draft.v1',
          graph: {
            nodes: [{ id: 'n1', label: 'Node 1' }],
            edges: [],
          },
        },
      },
    ]

    render(
      <DraftStreamPanel
        isStreaming={false}
        events={events}
        onComplete={onComplete}
      />
    )

    expect(screen.getByText(/draft complete/i)).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledWith({
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'Node 1' }],
        edges: [],
      },
    })
  })

  it('shows error status when stream fails', () => {
    const onError = vi.fn()
    const events: DraftStreamEvent[] = [
      { type: 'node', data: { id: 'n1', label: 'Node 1' } },
      { type: 'error', data: { message: 'Draft failed' } },
    ]

    render(
      <DraftStreamPanel
        isStreaming={false}
        events={events}
        onError={onError}
      />
    )

    expect(screen.getByText(/draft failed/i)).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith('Draft failed')
  })

  it('displays recent events (last 5)', () => {
    const events: DraftStreamEvent[] = [
      { type: 'node', data: { id: 'n1', label: 'Node 1' } },
      { type: 'node', data: { id: 'n2', label: 'Node 2' } },
      { type: 'node', data: { id: 'n3', label: 'Node 3' } },
      { type: 'edge', data: { id: 'e1', from: 'n1', to: 'n2' } },
      { type: 'edge', data: { id: 'e2', from: 'n2', to: 'n3' } },
      { type: 'edge', data: { id: 'e3', from: 'n1', to: 'n3' } },
    ]

    render(<DraftStreamPanel isStreaming={true} events={events} />)

    // Should show last 5 events (n3, e1, e2, e3)
    expect(screen.getByText(/Node 3/i)).toBeInTheDocument()
    expect(screen.getByText(/n1 → n2/i)).toBeInTheDocument()
    expect(screen.getByText(/n2 → n3/i)).toBeInTheDocument()
  })
})

describe('mockDraftStream (M2.3)', () => {
  it('generates events over 2.5 seconds', async () => {
    const events: DraftStreamEvent[] = []

    for await (const event of mockDraftStream()) {
      events.push(event)
    }

    expect(events.length).toBe(6) // 3 nodes + 2 edges + 1 complete
    expect(events[0].type).toBe('node')
    expect(events[events.length - 1].type).toBe('complete')
  }, 8000)

  it('emits nodes before edges before complete', async () => {
    const types: string[] = []

    for await (const event of mockDraftStream()) {
      types.push(event.type)
    }

    const nodeIndex = types.indexOf('node')
    const edgeIndex = types.indexOf('edge')
    const completeIndex = types.indexOf('complete')

    expect(nodeIndex).toBeLessThan(edgeIndex)
    expect(edgeIndex).toBeLessThan(completeIndex)
  }, 8000)
})
