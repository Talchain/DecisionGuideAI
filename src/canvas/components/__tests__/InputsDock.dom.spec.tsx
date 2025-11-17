import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputsDock } from '../InputsDock'

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

describe('InputsDock DOM', () => {
  const STORAGE_KEY = 'canvas.inputsDock.v1'

  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  })

  it('renders with correct ARIA attributes and sections', () => {
    render(<InputsDock />)

    const aside = screen.getByLabelText('Inputs dock')
    expect(aside).toBeInTheDocument()

    const tabs = screen.getAllByRole('button', { name: /documents|scenarios|limits/i })
    expect(tabs.map(t => t.textContent)).toEqual([
      'Documents',
      'Scenarios',
      'Limits & health',
    ])
  })

  it('persists active tab and open state via useDockState', () => {
    const { unmount } = render(<InputsDock />)

    // Switch to Limits tab and leave dock open
    const limitsTab = screen.getByRole('button', { name: 'Limits & health' })
    fireEvent.click(limitsTab)

    // Unmount and remount to verify persisted state
    unmount()

    render(<InputsDock />)

    const aside = screen.getByLabelText('Inputs dock') as HTMLElement
    // Width style should reflect expanded state via CSS variable
    expect(aside.style.width).toContain('var(--dock-left-expanded')
    // Dock should reserve space for the bottom toolbar via CSS variable
    expect(aside.style.bottom).toBe('var(--bottombar-h)')

    // Limits tab should be active (aria-live label shows current section)
    const headerLabel = screen.getByText('Limits & health', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })
})
