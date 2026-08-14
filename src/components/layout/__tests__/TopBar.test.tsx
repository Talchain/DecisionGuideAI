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

  // ⭐ 14 Aug 2026 (Paul's ruling): the bar's own plain-title control is gone.
  // The model name now lives on the ScenarioSwitcher, which this bar feeds with
  // `scenarioTitle` and `onTitleChange`. These three tests keep their original
  // intent — renders the name, edits it, caps it at 60 chars — retargeted at
  // the surviving control by testid. Full coverage of the new interaction is in
  // TopBar.singleModelName.spec.tsx.
  it('renders the model name', () => {
    renderTopBar(mockProps)
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Pricing Decision 2025')
  })

  it('allows name editing', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByTestId('scenario-name-button'))

    const input = screen.getByTestId('scenario-name-input') as HTMLInputElement
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: 'New Title' } })
    // Blur triggers submit
    fireEvent.blur(input)

    expect(mockProps.onTitleChange).toHaveBeenCalledWith('New Title')
  })

  it('limits the name to 60 characters', async () => {
    renderTopBar(mockProps)

    fireEvent.click(screen.getByTestId('scenario-name-button'))

    const input = screen.getByTestId('scenario-name-input') as HTMLInputElement
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
