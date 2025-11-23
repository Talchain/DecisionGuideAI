import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayoutProgressBanner } from '../LayoutProgressBanner'
import { useLayoutProgressStore } from '../../layoutProgressStore'

function resetStore() {
  useLayoutProgressStore.setState({
    status: 'idle',
    message: null,
    canRetry: false,
    retry: null,
  })
}

describe('LayoutProgressBanner DOM', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders nothing when idle', () => {
    const { container } = render(<LayoutProgressBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows loading status when layout is in progress', () => {
    useLayoutProgressStore.setState({
      status: 'loading',
      message: 'Applying layout…',
      canRetry: false,
      retry: null,
    })

    render(<LayoutProgressBanner />)

    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/applying layout/i)
  })

  it('shows error state with retry and cancel', () => {
    const retryMock = vi.fn()

    useLayoutProgressStore.setState({
      status: 'error',
      message: 'Layout failed. Please try again.',
      canRetry: true,
      retry: retryMock,
    })

    render(<LayoutProgressBanner />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/layout failed/i)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)
    expect(retryMock).toHaveBeenCalledTimes(1)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    const state = useLayoutProgressStore.getState()
    expect(state.status).toBe('idle')
  })
})
