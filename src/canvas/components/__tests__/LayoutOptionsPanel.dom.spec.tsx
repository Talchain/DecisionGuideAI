import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LayoutOptionsPanel } from '../LayoutOptionsPanel'

const runLayoutWithProgressMock = vi.fn<[], Promise<boolean>>()
const showToastMock = vi.fn()

vi.mock('../../layout/runLayoutWithProgress', () => ({
  runLayoutWithProgress: () => runLayoutWithProgressMock(),
}))

vi.mock('../../ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

describe('LayoutOptionsPanel DOM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens layout options when the trigger is clicked', () => {
    render(<LayoutOptionsPanel />)

    const trigger = screen.getByText('🔧 Layout')
    fireEvent.click(trigger)

    expect(screen.getByText('Layout Options')).toBeInTheDocument()
  })

  it('runs layout, shows toasts, and closes on success', async () => {
    runLayoutWithProgressMock.mockResolvedValueOnce(true)

    render(<LayoutOptionsPanel />)

    fireEvent.click(screen.getByText('🔧 Layout'))

    const applyButton = await screen.findByRole('button', { name: /apply layout/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(runLayoutWithProgressMock).toHaveBeenCalledTimes(1)
    })

    expect(showToastMock).toHaveBeenCalledWith('Loading layout engine...', 'info')
    expect(showToastMock).toHaveBeenCalledWith('Layout applied successfully', 'success')

    await waitFor(() => {
      expect(screen.queryByText('Layout Options')).not.toBeInTheDocument()
    })
  })

  it('shows error toast and keeps panel open on failure', async () => {
    runLayoutWithProgressMock.mockResolvedValueOnce(false)

    render(<LayoutOptionsPanel />)

    fireEvent.click(screen.getByText('🔧 Layout'))

    const applyButton = await screen.findByRole('button', { name: /apply layout/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(runLayoutWithProgressMock).toHaveBeenCalledTimes(1)
    })

    expect(showToastMock).toHaveBeenCalledWith('Loading layout engine...', 'info')
    expect(showToastMock).toHaveBeenCalledWith('Layout failed. Please try again.', 'error')

    expect(screen.getByText('Layout Options')).toBeInTheDocument()
  })
})
