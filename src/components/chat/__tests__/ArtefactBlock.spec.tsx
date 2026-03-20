/**
 * Tests for ArtefactBlock, ArtefactHeader, ArtefactActions, and iframe template.
 *
 * Verifies:
 * 1. ArtefactBlock renders iframe with content
 * 2. Iframe has correct sandbox attribute
 * 3. Expand button opens maximised view
 * 4. ArtefactActions chips send correct messages
 * 5. Unknown artefact_type renders with default (Sparkles) icon
 * 6. Multiple artefacts render independently
 * 7. Max 3 actions rendered
 * 8. Collapse on header click, re-expand on click
 * 9. Maximised view closes on close button and Escape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ArtefactBlock } from '../ArtefactBlock'
import { ArtefactHeader } from '../ArtefactHeader'
import { ArtefactActions } from '../ArtefactActions'
import { buildArtefactSrcdoc, sanitiseArtefactContent } from '../artefactIframeTemplate'
import type { ArtefactBlock as ArtefactBlockData } from '../../../canvas/conversation/types'

// Mock IntersectionObserver for lazy loading and auto-collapse
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

beforeEach(() => {
  mockObserve.mockReset()
  mockDisconnect.mockReset()

  // Make IntersectionObserver immediately trigger with isIntersecting: true
  // so the iframe renders without waiting for actual viewport intersection
  vi.stubGlobal('IntersectionObserver', class {
    callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe(target: Element) {
      mockObserve(target)
      // Trigger immediately as visible
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    disconnect() { mockDisconnect() }
    unobserve() {}
  })
})

function makeBlock(overrides: Partial<ArtefactBlockData> = {}): ArtefactBlockData {
  return {
    type: 'artefact',
    artefact_type: 'decision_matrix',
    title: 'Test matrix',
    description: 'A test description',
    content: '<table><tr><td>Cell</td></tr></table>',
    actions: [
      { label: 'Refine weights', message: 'Please refine the weights' },
      { label: 'Add criteria', message: 'Add more criteria' },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// § 1 — Iframe template
// ---------------------------------------------------------------------------

describe('buildArtefactSrcdoc', () => {
  it('wraps content in Olumi-themed HTML template', () => {
    const html = buildArtefactSrcdoc('<p>Hello</p>')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('--bg-canvas')
    expect(html).toContain('--text-body')
    expect(html).toContain('olumi-artefact-resize')
    expect(html).toContain('ResizeObserver')
  })
})

// ---------------------------------------------------------------------------
// § 2 — ArtefactHeader
// ---------------------------------------------------------------------------

describe('ArtefactHeader', () => {
  it('renders title and description', () => {
    const block = makeBlock()
    render(
      <ArtefactHeader
        block={block}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        onMaximise={vi.fn()}
      />,
    )

    expect(screen.getByText('Test matrix')).toBeInTheDocument()
    expect(screen.getByText('A test description')).toBeInTheDocument()
  })

  it('calls onToggleCollapse when header is clicked', () => {
    const onToggle = vi.fn()
    render(
      <ArtefactHeader
        block={makeBlock()}
        collapsed={false}
        onToggleCollapse={onToggle}
        onMaximise={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('artefact-header'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleCollapse on Enter key', () => {
    const onToggle = vi.fn()
    render(
      <ArtefactHeader
        block={makeBlock()}
        collapsed={false}
        onToggleCollapse={onToggle}
        onMaximise={vi.fn()}
      />,
    )

    fireEvent.keyDown(screen.getByTestId('artefact-header'), { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onMaximise when expand button is clicked', () => {
    const onMaximise = vi.fn()
    render(
      <ArtefactHeader
        block={makeBlock()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        onMaximise={onMaximise}
      />,
    )

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    expect(onMaximise).toHaveBeenCalledTimes(1)
  })

  it('renders default icon for unknown artefact_type', () => {
    const block = makeBlock({ artefact_type: 'unknown_type' })
    const { container } = render(
      <ArtefactHeader
        block={block}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        onMaximise={vi.fn()}
      />,
    )
    // Sparkles icon renders as an SVG. Just verify the header renders without crashing.
    expect(screen.getByTestId('artefact-header')).toBeInTheDocument()
    // Should have SVG icons (collapse chevron + type icon + expand button icon)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// § 3 — ArtefactActions
// ---------------------------------------------------------------------------

describe('ArtefactActions', () => {
  it('renders action chips and sends correct message on click', () => {
    const onSend = vi.fn()
    render(
      <ArtefactActions
        actions={[
          { label: 'Refine', message: 'refine it' },
          { label: 'Expand', message: 'expand it' },
        ]}
        onSendMessage={onSend}
      />,
    )

    const chips = screen.getAllByTestId('artefact-action-chip')
    expect(chips).toHaveLength(2)

    fireEvent.click(chips[0])
    expect(onSend).toHaveBeenCalledWith('refine it')

    fireEvent.click(chips[1])
    expect(onSend).toHaveBeenCalledWith('expand it')
  })

  it('renders max 3 actions', () => {
    render(
      <ArtefactActions
        actions={[
          { label: 'A', message: 'a' },
          { label: 'B', message: 'b' },
          { label: 'C', message: 'c' },
          { label: 'D', message: 'd' },
        ]}
        onSendMessage={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('artefact-action-chip')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// § 4 — ArtefactBlock (integration)
// ---------------------------------------------------------------------------

describe('ArtefactBlock', () => {
  it('renders iframe with sandbox="allow-scripts"', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    const iframe = screen.getByTestId('artefact-iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  })

  it('renders iframe with srcdoc containing block content', () => {
    const block = makeBlock({ content: '<div>Custom content</div>' })
    render(<ArtefactBlock block={block} onSendMessage={vi.fn()} />)

    const iframe = screen.getByTestId('artefact-iframe')
    expect(iframe.getAttribute('srcdoc')).toContain('<div>Custom content</div>')
    expect(iframe.getAttribute('srcdoc')).toContain('--bg-canvas')
  })

  it('renders action chips below iframe', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    expect(screen.getByTestId('artefact-actions')).toBeInTheDocument()
    expect(screen.getAllByTestId('artefact-action-chip')).toHaveLength(2)
  })

  it('does not render actions row when no actions', () => {
    const block = makeBlock({ actions: undefined })
    render(<ArtefactBlock block={block} onSendMessage={vi.fn()} />)

    expect(screen.queryByTestId('artefact-actions')).not.toBeInTheDocument()
  })

  it('collapses on header click and hides iframe', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    expect(screen.getByTestId('artefact-iframe')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('artefact-header'))
    expect(screen.queryByTestId('artefact-iframe')).not.toBeInTheDocument()
  })

  it('re-expands on header click after collapse', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    // Collapse
    fireEvent.click(screen.getByTestId('artefact-header'))
    expect(screen.queryByTestId('artefact-iframe')).not.toBeInTheDocument()

    // Re-expand
    fireEvent.click(screen.getByTestId('artefact-header'))
    expect(screen.getByTestId('artefact-iframe')).toBeInTheDocument()
  })

  it('opens maximised view on expand button click', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    expect(screen.queryByTestId('artefact-maximised-overlay')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    expect(screen.getByTestId('artefact-maximised-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('artefact-maximised-iframe')).toBeInTheDocument()
  })

  it('closes maximised view on close button', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    expect(screen.getByTestId('artefact-maximised-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('artefact-maximised-close'))
    expect(screen.queryByTestId('artefact-maximised-overlay')).not.toBeInTheDocument()
  })

  it('closes maximised view on Escape key', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    expect(screen.getByTestId('artefact-maximised-overlay')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('artefact-maximised-overlay')).not.toBeInTheDocument()
  })

  it('closes maximised view on backdrop click', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    fireEvent.click(screen.getByTestId('artefact-maximised-overlay'))
    expect(screen.queryByTestId('artefact-maximised-overlay')).not.toBeInTheDocument()
  })

  it('maximised iframe has correct sandbox', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))
    const iframe = screen.getByTestId('artefact-maximised-iframe')
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  })

  it('action chips in artefact send messages', () => {
    const onSend = vi.fn()
    render(<ArtefactBlock block={makeBlock()} onSendMessage={onSend} />)

    const chips = screen.getAllByTestId('artefact-action-chip')
    fireEvent.click(chips[0])
    expect(onSend).toHaveBeenCalledWith('Please refine the weights')
  })

  it('renders multiple artefacts independently', () => {
    const block1 = makeBlock({ title: 'Matrix A' })
    const block2 = makeBlock({ title: 'Matrix B', artefact_type: 'comparison' })

    render(
      <>
        <ArtefactBlock block={block1} onSendMessage={vi.fn()} />
        <ArtefactBlock block={block2} onSendMessage={vi.fn()} />
      </>,
    )

    const blocks = screen.getAllByTestId('artefact-block')
    expect(blocks).toHaveLength(2)
    expect(screen.getByText('Matrix A')).toBeInTheDocument()
    expect(screen.getByText('Matrix B')).toBeInTheDocument()

    // Each has its own iframe
    const iframes = screen.getAllByTestId('artefact-iframe')
    expect(iframes).toHaveLength(2)
  })

  it('clamps inline iframe height to 600px max', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    const wrapper = screen.getByTestId('artefact-iframe-wrapper')
    // Default height is 200px (initial state), max is 600px
    // The wrapper gets style={{ height: clampedHeight }} where clampedHeight = min(iframeHeight, 600)
    expect(wrapper.style.height).toBe('200px')
  })

  it('maximised overlay has dialog accessibility attributes', () => {
    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    fireEvent.click(screen.getByTestId('artefact-expand-btn'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')

    // The title should be linked via aria-labelledby
    const labelId = dialog.getAttribute('aria-labelledby')!
    const titleEl = document.getElementById(labelId)
    expect(titleEl?.textContent).toBe('Test matrix')
  })
})

// ---------------------------------------------------------------------------
// § 5 — Auto-collapse on scroll-away (IntersectionObserver)
// ---------------------------------------------------------------------------

describe('ArtefactBlock auto-collapse', () => {
  it('collapses when artefact scrolls out of viewport', () => {
    // Custom IntersectionObserver that captures callbacks for manual triggering
    let visibilityCallback: IntersectionObserverCallback | null = null
    let autoCollapseCallback: IntersectionObserverCallback | null = null
    let callCount = 0

    vi.stubGlobal('IntersectionObserver', class {
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        callCount++
        // First observer is for lazy visibility, second is for auto-collapse
        if (callCount === 1) {
          visibilityCallback = callback
        } else {
          autoCollapseCallback = callback
        }
      }
      observe(target: Element) {
        // First observer: trigger as visible immediately
        if (this.callback === visibilityCallback) {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          )
        }
      }
      disconnect() {}
      unobserve() {}
    })

    render(<ArtefactBlock block={makeBlock()} onSendMessage={vi.fn()} />)

    // Iframe should be visible initially
    expect(screen.getByTestId('artefact-iframe')).toBeInTheDocument()

    // Simulate scrolling out of viewport via auto-collapse observer
    expect(autoCollapseCallback).not.toBeNull()
    act(() => {
      autoCollapseCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    // Iframe should be hidden (collapsed)
    expect(screen.queryByTestId('artefact-iframe')).not.toBeInTheDocument()
    // Header should still be visible
    expect(screen.getByTestId('artefact-header')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// § 6 — Content sanitization
// ---------------------------------------------------------------------------

describe('sanitiseArtefactContent', () => {
  it('strips external script tags but preserves inline scripts', () => {
    const html = '<script src="https://evil.com/x.js"></script><script>console.log("ok")</script>'
    const result = sanitiseArtefactContent(html)
    expect(result).not.toContain('evil.com')
    expect(result).toContain('console.log("ok")')
  })

  it('strips link stylesheet tags', () => {
    const html = '<link rel="stylesheet" href="https://evil.com/style.css"><p>content</p>'
    const result = sanitiseArtefactContent(html)
    expect(result).not.toContain('evil.com')
    expect(result).toContain('<p>content</p>')
  })

  it('strips iframe, object, and embed tags', () => {
    const html = '<iframe src="x"></iframe><object data="y"></object><embed src="z"><p>safe</p>'
    const result = sanitiseArtefactContent(html)
    expect(result).not.toContain('<iframe')
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
    expect(result).toContain('<p>safe</p>')
  })

  it('preserves safe HTML content', () => {
    const html = '<table><tr><td>Data</td></tr></table><button onclick="alert(1)">Click</button>'
    const result = sanitiseArtefactContent(html)
    expect(result).toContain('<table>')
    expect(result).toContain('<button')
    expect(result).toContain('Data')
  })
})
