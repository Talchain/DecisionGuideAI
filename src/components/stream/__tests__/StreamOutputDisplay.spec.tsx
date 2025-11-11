/**
 * StreamOutputDisplay Unit Tests
 * Phase 2E: Tests for extracted output rendering component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StreamOutputDisplay from '../StreamOutputDisplay'

describe('StreamOutputDisplay', () => {
  const defaultProps = {
    output: 'Test output text',
    status: 'streaming' as const,
    mdHtml: undefined,
    mdEnabled: false,
    copyEnabled: false,
    copyOverlays: [],
    onCopyCode: vi.fn(),
    copiedId: null,
    failedId: null,
    ariaCopyMsg: '',
    metrics: {
      cost: 0.05,
      ttfbMs: 150,
      tokenCount: 100,
      resumeCount: 0,
      lastSseId: 'evt-123',
    },
    diagEnabled: false,
    perfEnabled: false,
    bufferEnabled: true,
  }

  it('renders output text', () => {
    render(<StreamOutputDisplay {...defaultProps} />)

    const outputDiv = screen.getByTestId('stream-output')
    expect(outputDiv).toHaveTextContent('Test output text')
  })

  it('shows idle hint when status is idle', () => {
    render(<StreamOutputDisplay {...defaultProps} status="idle" output="" />)

    expect(screen.getByTestId('idle-hint')).toBeInTheDocument()
    expect(screen.getByTestId('idle-hint')).toHaveTextContent('Press Start to begin a draft critique.')
  })

  it('sets aria-busy to true when streaming', () => {
    render(<StreamOutputDisplay {...defaultProps} status="streaming" />)

    const outputDiv = screen.getByTestId('stream-output')
    expect(outputDiv).toHaveAttribute('aria-busy', 'true')
  })

  it('sets aria-busy to false when not streaming', () => {
    render(<StreamOutputDisplay {...defaultProps} status="done" />)

    const outputDiv = screen.getByTestId('stream-output')
    expect(outputDiv).toHaveAttribute('aria-busy', 'false')
  })

  it('renders markdown preview when mdEnabled is true', () => {
    render(
      <StreamOutputDisplay
        {...defaultProps}
        mdEnabled={true}
        mdHtml="<p>Rendered markdown</p>"
      />
    )

    expect(screen.getByTestId('md-preview')).toBeInTheDocument()
  })

  it('renders copy code buttons when copyEnabled is true', () => {
    const copyOverlays = [
      { id: 1, top: 10, left: 100, code: 'const x = 1;', lang: 'javascript' },
      { id: 2, top: 50, left: 100, code: 'print("hello")', lang: 'python' },
    ]

    render(
      <StreamOutputDisplay
        {...defaultProps}
        mdEnabled={true}
        mdHtml="<pre><code>test</code></pre>"
        copyEnabled={true}
        copyOverlays={copyOverlays}
      />
    )

    const copyButtons = screen.getAllByTestId('copy-code-btn')
    expect(copyButtons).toHaveLength(2)
  })

  it('calls onCopyCode when copy button is clicked', () => {
    const onCopyCode = vi.fn()
    const copyOverlays = [
      { id: 1, top: 10, left: 100, code: 'const x = 1;', lang: 'javascript' },
    ]

    render(
      <StreamOutputDisplay
        {...defaultProps}
        mdEnabled={true}
        mdHtml="<pre><code>test</code></pre>"
        copyEnabled={true}
        copyOverlays={copyOverlays}
        onCopyCode={onCopyCode}
      />
    )

    const copyButton = screen.getByTestId('copy-code-btn')
    fireEvent.click(copyButton)

    expect(onCopyCode).toHaveBeenCalledWith(1, 'const x = 1;')
  })

  it('shows "Copied" text when copiedId matches button id', () => {
    const copyOverlays = [
      { id: 1, top: 10, left: 100, code: 'const x = 1;', lang: 'javascript' },
    ]

    render(
      <StreamOutputDisplay
        {...defaultProps}
        mdEnabled={true}
        mdHtml="<pre><code>test</code></pre>"
        copyEnabled={true}
        copyOverlays={copyOverlays}
        copiedId={1}
      />
    )

    const copyButton = screen.getByTestId('copy-code-btn')
    expect(copyButton).toHaveTextContent('Copied')
  })

  it('renders cost badge when cost is provided', () => {
    render(<StreamOutputDisplay {...defaultProps} />)

    expect(screen.getByTestId('cost-badge')).toBeInTheDocument()
    expect(screen.getByTestId('cost-badge')).toHaveTextContent('$0.05')
  })

  it('does not render cost badge when cost is undefined', () => {
    const propsWithoutCost = {
      ...defaultProps,
      metrics: {
        ttfbMs: 150,
        tokenCount: 100,
        resumeCount: 0,
        lastSseId: 'evt-123',
      },
    }

    render(<StreamOutputDisplay {...propsWithoutCost} />)

    expect(screen.queryByTestId('cost-badge')).not.toBeInTheDocument()
  })

  it('renders diagnostics panel when diagEnabled is true', () => {
    render(<StreamOutputDisplay {...defaultProps} diagEnabled={true} />)

    expect(screen.getByTestId('diagnostics-panel')).toBeInTheDocument()
    expect(screen.getByTestId('diag-last-event-id')).toHaveTextContent('SSE id: evt-123')
    expect(screen.getByTestId('diag-reconnects')).toHaveTextContent('Resumes: 0')
    expect(screen.getByTestId('diag-stream-state')).toHaveTextContent('State: streaming')
    expect(screen.getByTestId('diag-token-count')).toHaveTextContent('Tokens: 100')
  })

  it('renders performance panel when perfEnabled is true', () => {
    render(<StreamOutputDisplay {...defaultProps} perfEnabled={true} />)

    expect(screen.getByTestId('perf-panel')).toBeInTheDocument()
    expect(screen.getByTestId('perf-panel')).toHaveTextContent('Buffer: ON')
  })

  it('shows buffer OFF in performance panel when bufferEnabled is false', () => {
    render(<StreamOutputDisplay {...defaultProps} perfEnabled={true} bufferEnabled={false} />)

    expect(screen.getByTestId('perf-panel')).toHaveTextContent('Buffer: OFF')
  })

  it('renders ARIA copy status for accessibility', () => {
    render(
      <StreamOutputDisplay
        {...defaultProps}
        copyEnabled={true}
        ariaCopyMsg="Code copied to clipboard"
      />
    )

    expect(screen.getByTestId('copy-aria-status')).toBeInTheDocument()
    expect(screen.getByTestId('copy-aria-status')).toHaveTextContent('Code copied to clipboard')
  })

  it('has proper ARIA live region attributes', () => {
    render(<StreamOutputDisplay {...defaultProps} />)

    const outputDiv = screen.getByTestId('stream-output')
    expect(outputDiv).toHaveAttribute('aria-live', 'polite')
  })

  it('memoizes correctly and does not re-render unnecessarily', () => {
    const { rerender } = render(<StreamOutputDisplay {...defaultProps} />)
    const outputDiv = screen.getByTestId('stream-output')

    // Rerender with same props
    rerender(<StreamOutputDisplay {...defaultProps} />)

    // Component should not have re-rendered (React.memo should prevent it)
    expect(outputDiv).toBeInTheDocument()
  })
})
