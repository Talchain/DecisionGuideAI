import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutputsDock } from '../OutputsDock'

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

describe('OutputsDock DOM', () => {
  const STORAGE_KEY = 'canvas.outputsDock.v1'

  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  })

  it('renders with correct ARIA attributes and sections', () => {
    render(<OutputsDock />)

    const aside = screen.getByLabelText('Outputs dock')
    expect(aside).toBeInTheDocument()

    const tabs = screen.getAllByRole('button', {
      name: /Results|Insights|Compare|Diagnostics/,
    })

    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Results',
      'Insights',
      'Compare',
      'Diagnostics',
    ])
  })

  it('persists active tab and open state via useDockState', () => {
    const { unmount } = render(<OutputsDock />)

    // Switch to Compare tab and leave dock open
    const compareTab = screen.getByRole('button', { name: 'Compare' })
    fireEvent.click(compareTab)

    // Unmount and remount to verify persisted state
    unmount()

    render(<OutputsDock />)

    const aside = screen.getByLabelText('Outputs dock') as HTMLElement
    // Width style should reflect expanded state via CSS variable
    expect(aside.style.width).toContain('var(--dock-right-expanded')
    // Dock should reserve space for the bottom toolbar via CSS variable
    expect(aside.style.bottom).toBe('var(--bottombar-h)')

    // Header label (aria-live) should reflect active tab
    const headerLabel = screen.getByText('Compare', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('calls onShowResults when CTA is clicked from Results tab', () => {
    const onShowResults = vi.fn()

    render(<OutputsDock onShowResults={onShowResults} />)

    const cta = screen.getByRole('button', { name: 'Open results panel' })
    fireEvent.click(cta)

    expect(onShowResults).toHaveBeenCalledTimes(1)
  })
})

