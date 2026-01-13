import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PayloadLabTab } from '../PayloadLabTab'
import { usePayloadTraceStore } from '../../../lib/payload-trace-store'
import * as ceeModule from '../../../adapters/cee/client'

vi.mock('../../../adapters/cee/client', () => {
  const draftModel = vi.fn<[], Promise<any>>()

  class CEEClient {
    draftModel = draftModel
  }

  return {
    CEEClient,
    __mock: {
      draftModel,
    },
  }
})

const getMock = () => (ceeModule as unknown as { __mock: { draftModel: ReturnType<typeof vi.fn> } }).__mock

function setPayloads(payloads: any[]) {
  usePayloadTraceStore.setState({ payloads, selectedId: null, filterService: null, filterStatus: null, searchQuery: '' })
}

describe('PayloadLabTab Prompt Tester', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    setPayloads([])

    const { draftModel } = getMock()
    draftModel.mockReset()
  })

  it('loads brief from last failure and runs draft', async () => {
    setPayloads([
      {
        id: 'req-fail',
        service: 'CEE',
        endpoint: '/bff/engine/v1/cee/draft-graph',
        method: 'POST',
        timestamp: Date.now(),
        status: 500,
        error: 'boom',
        completed: true,
        request: { headers: {}, body: { brief: 'FAILED BRIEF' } },
        response: { headers: {}, body: { error: true } },
      },
      {
        id: 'req-ok',
        service: 'CEE',
        endpoint: '/bff/engine/v1/cee/draft-graph',
        method: 'POST',
        timestamp: Date.now() - 1000,
        status: 200,
        completed: true,
        request: { headers: {}, body: { brief: 'SUCCESS BRIEF' } },
        response: { headers: {}, body: { ok: true } },
      },
    ])

    const { draftModel } = getMock()
    draftModel.mockResolvedValueOnce({
      nodes: [
        { id: 'd', type: 'decision', label: 'Decision' },
        { id: 'g', type: 'goal', label: 'Goal' },
        { id: 'o1', type: 'option', label: 'O1' },
        { id: 'o2', type: 'option', label: 'O2' },
      ],
      edges: [],
    })

    render(<PayloadLabTab />)

    fireEvent.click(screen.getByRole('button', { name: /Load from last failure/i }))
    expect((screen.getByPlaceholderText('Brief input...') as HTMLTextAreaElement).value).toBe('FAILED BRIEF')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Draft' }))
    })

    expect(screen.getByText('Single Run Result')).toBeInTheDocument()
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
  })

  it('disables action buttons during cooldown', async () => {
    const { draftModel } = getMock()
    draftModel.mockResolvedValueOnce({
      nodes: [
        { id: 'd', type: 'decision', label: 'Decision' },
        { id: 'g', type: 'goal', label: 'Goal' },
        { id: 'o1', type: 'option', label: 'O1' },
        { id: 'o2', type: 'option', label: 'O2' },
      ],
      edges: [],
    })

    render(<PayloadLabTab />)

    fireEvent.change(screen.getByPlaceholderText('Brief input...'), { target: { value: 'Test brief' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Draft' }))
    })

    // Cooldown is 5s; button should be disabled while in cooldown
    expect(screen.getByRole('button', { name: 'Run Draft' })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByRole('button', { name: 'Run Draft' })).not.toBeDisabled()
  })
})
