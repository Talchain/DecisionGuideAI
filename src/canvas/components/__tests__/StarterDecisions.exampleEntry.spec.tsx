/**
 * Investor step 0's entry on the first-use gallery: guests only, one click → `openExampleDecision`, an honest failure.
 * The flow itself (fresh id, verbatim seed, never over a model) is pinned in `openExampleDecision.spec.ts`.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openMock = vi.fn()
const sessionActive = vi.fn(() => false)
const showToastMock = vi.fn()
vi.mock('../../example/exampleDecision', () => ({ openExampleDecision: () => openMock() }))
vi.mock('../../../lib/persistenceSession', async (orig) => ({
  ...(await orig<typeof import('../../../lib/persistenceSession')>()),
  isPersistenceSessionActive: () => sessionActive(),
}))
vi.mock('../../ToastContext', () => ({ useShowToastSafe: () => showToastMock }))
vi.mock('../../blueprints/loadTemplateBlueprint', async (orig) => ({
  ...(await orig<typeof import('../../blueprints/loadTemplateBlueprint')>()),
  confirmReplaceCanvas: () => true,
}))

import { StarterDecisions, EXAMPLE_DECISION_LABEL, EXAMPLE_OPEN_FAILED_MESSAGE, EXAMPLE_READ_BACK_FAILED_MESSAGE } from '../StarterDecisions'
import { useCanvasStore } from '../../store'

afterEach(cleanup)
beforeEach(() => {
  openMock.mockReset(); showToastMock.mockReset(); sessionActive.mockReturnValue(false)
  useCanvasStore.setState({ nodes: [], edges: [] })
})

describe('"Open the example decision" on the first-use gallery', () => {
  it('a guest sees it, labelled, with the graph’s own goal and option count', () => {
    render(<StarterDecisions />)
    const b = screen.getByTestId('open-example-decision')
    expect(b).toHaveTextContent(EXAMPLE_DECISION_LABEL)
    // RT-12 (Science d1.patch, 5 Oct 2026): the example's goal node is now labelled "Grow quarterly revenue" (held sense by label).
    expect(b).toHaveTextContent('Goal: Grow quarterly revenue · 4 options')
  })

  it('⛔ a signed-in session does not see it (guest mints are refused there)', () => {
    sessionActive.mockReturnValue(true)
    render(<StarterDecisions />)
    expect(screen.queryByTestId('open-example-decision')).toBeNull()
    expect(screen.getByTestId('starter-decisions')).toBeInTheDocument()
  })

  it('one click → one open, and a double click does not open twice', async () => {
    let release: (v: unknown) => void = () => {}
    openMock.mockReturnValue(new Promise((r) => { release = r }))
    render(<StarterDecisions />)
    const b = screen.getByTestId('open-example-decision')
    await userEvent.click(b)
    await userEvent.click(b)
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(b).toHaveTextContent('Opening the example…')
    release({ status: 'opened', scenarioId: 'x' })
    await waitFor(() => expect(b).toHaveTextContent(EXAMPLE_DECISION_LABEL))
    expect(showToastMock).not.toHaveBeenCalled()
  })

  it('registered but not read back says so, and tells the user a reload opens it (no second mint)', async () => {
    openMock.mockResolvedValue({ status: 'not_read_back', scenarioId: 'x', read: 'unavailable' })
    render(<StarterDecisions />)
    await userEvent.click(screen.getByTestId('open-example-decision'))
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith(EXAMPLE_READ_BACK_FAILED_MESSAGE, 'error'))
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it.each(['canvas_changed', 'signed_in'] as const)('%s is silent: nothing was opened over the user’s own move', async (status) => {
    openMock.mockResolvedValue({ status })
    render(<StarterDecisions />)
    await userEvent.click(screen.getByTestId('open-example-decision'))
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1))
    expect(showToastMock).not.toHaveBeenCalled()
  })

  it('a write that did not land says so (never a dead click)', async () => {
    openMock.mockResolvedValue({ status: 'not_opened', reason: 'unavailable' })
    render(<StarterDecisions />)
    await userEvent.click(screen.getByTestId('open-example-decision'))
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith(EXAMPLE_OPEN_FAILED_MESSAGE, 'error'))
  })
})
