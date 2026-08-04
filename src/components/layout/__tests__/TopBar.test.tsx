import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
// Lane 4 (P5): TopBar now mounts toast-consuming children (ScenarioSwitcher,
// KebabMenu's ImportExportDialog/SnapshotManager); useToast throws outside
// ToastProvider. Production (CanvasMVP) provides it at the route level.
import { ToastProvider } from '../../../canvas/ToastContext'

function renderTopBar(props: React.ComponentProps<typeof TopBar>) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar {...props} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TopBar', () => {
  const mockProps = {
    scenarioTitle: 'Pricing Decision 2025',
    onTitleChange: vi.fn(),
    onSave: vi.fn(),
    onShare: vi.fn(),
  }

  it('renders decision title', () => {
    renderTopBar(mockProps)
    expect(screen.getByText('Pricing Decision 2025')).toBeInTheDocument()
  })

  it('allows title editing', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByRole('button', { name: /edit decision title/i }))

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: 'New Title' } })
    // Blur triggers submit
    fireEvent.blur(input)

    expect(mockProps.onTitleChange).toHaveBeenCalledWith('New Title')
  })

  it('limits title to 60 characters', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByRole('button', { name: /edit decision title/i }))

    const input = screen.getByRole('textbox') as HTMLInputElement
    const longTitle = 'A'.repeat(70)
    fireEvent.change(input, { target: { value: longTitle } })

    expect(input).toHaveValue('A'.repeat(60))
  })

  it('shows save status when persisted and saving', () => {
    renderTopBar({...mockProps, isPersisted: true, saveStatus: 'saving'})
    expect(screen.getByText('Saving\u2026')).toBeInTheDocument()
  })

  it('shows unsaved status when persisted and dirty', () => {
    renderTopBar({...mockProps, isPersisted: true, isDirty: true, saveStatus: 'saved'})
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })

  it('renders version history button', () => {
    renderTopBar(mockProps)
    expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument()
  })

  it('opens menu dropdown', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /export/i })).toBeInTheDocument()
  })

  it('closes menu when clicking outside', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    fireEvent.mouseUp(document.body)
    fireEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
