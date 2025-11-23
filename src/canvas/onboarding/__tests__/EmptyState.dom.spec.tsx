import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState, type Template } from '../EmptyState'

const STORAGE_KEY = 'canvas-empty-state-dismissed'

const TEMPLATES: Template[] = [
  {
    id: 't1',
    title: 'Hiring decision',
    description: 'Compare candidates and hiring plans.',
    tags: ['People', 'Hiring'],
  },
  {
    id: 't2',
    title: 'Launch strategy',
    description: 'Choose a go-to-market approach.',
    tags: ['Go-to-market'],
  },
]

describe('EmptyState DOM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      localStorage.clear()
    } catch {}
  })

  it('renders heading and subcopy when shown', () => {
    const onSelectTemplate = vi.fn()
    const onStartFromScratch = vi.fn()
    const onDismiss = vi.fn()

    render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={onSelectTemplate}
        onStartFromScratch={onStartFromScratch}
        show={true}
        onDismiss={onDismiss}
      />,
    )

    // Dialog wrapper and heading copy
    expect(
      screen.getByRole('dialog', { name: 'Get started with canvas' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Start your decision canvas')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Pick a starting template that fits your situation, or start from scratch to build your own model./i,
      ),
    ).toBeInTheDocument()
  })

  it('does not render when show=false', () => {
    const { container } = render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={vi.fn()}
        onStartFromScratch={vi.fn()}
        show={false}
        onDismiss={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('navigates templates with arrow keys and selects via Enter', () => {
    const onSelectTemplate = vi.fn()
    const onStartFromScratch = vi.fn()

    render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={onSelectTemplate}
        onStartFromScratch={onStartFromScratch}
        show={true}
        onDismiss={vi.fn()}
      />,
    )

    // Move selection from first template (index 0) to second (index 1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelectTemplate).toHaveBeenCalledTimes(1)
    expect(onSelectTemplate).toHaveBeenCalledWith('t2')

    // Move to "Start from Scratch" pseudo-card (index = templates.length)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onStartFromScratch).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape and persists dismissal flag', () => {
    const onDismiss = vi.fn()

    render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={vi.fn()}
        onStartFromScratch={vi.fn()}
        show={true}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('dismisses and sets storage flag when clicking "Don\'t show this again"', () => {
    const onDismiss = vi.fn()

    render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={vi.fn()}
        onStartFromScratch={vi.fn()}
        show={true}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByText("Don't show this again"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('auto-dismisses on mount when storage flag is set', () => {
    const onDismiss = vi.fn()
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}

    render(
      <EmptyState
        templates={TEMPLATES}
        onSelectTemplate={vi.fn()}
        onStartFromScratch={vi.fn()}
        show={true}
        onDismiss={onDismiss}
      />,
    )

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
