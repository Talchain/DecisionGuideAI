import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelShell } from '../../../src/canvas/panels/_shared/PanelShell'

describe('PanelShell', () => {
  it('renders with required props', () => {
    render(
      <PanelShell title="Test Panel" onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.getByRole('complementary', { name: 'Test Panel' })).toBeInTheDocument()
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('renders close button and calls onClose', () => {
    const onClose = vi.fn()
    render(
      <PanelShell title="Test Panel" onClose={onClose}>
        <div>Panel content</div>
      </PanelShell>
    )

    const closeButton = screen.getByRole('button', { name: /close panel/i })
    expect(closeButton).toBeInTheDocument()

    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders without close button when onClose not provided', () => {
    render(
      <PanelShell title="Test Panel">
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.queryByRole('button', { name: /close panel/i })).not.toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    const TestIcon = () => <div data-testid="test-icon">Icon</div>
    render(
      <PanelShell title="Test Panel" icon={<TestIcon />} onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('renders chips when provided', () => {
    render(
      <PanelShell
        title="Test Panel"
        chips={<span data-testid="status-chip">Active</span>}
        onClose={() => {}}
      >
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.getByTestId('status-chip')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders tabs when provided', () => {
    const tabs = (
      <div data-testid="panel-tabs">
        <button>Tab 1</button>
        <button>Tab 2</button>
      </div>
    )
    render(
      <PanelShell title="Test Panel" tabs={tabs} onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.getByTestId('panel-tabs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tab 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tab 2' })).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    const footer = (
      <div data-testid="panel-footer">
        <button>Footer Action</button>
      </div>
    )
    render(
      <PanelShell title="Test Panel" footer={footer} onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.getByTestId('panel-footer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Footer Action' })).toBeInTheDocument()
  })

  it('does not render footer when not provided', () => {
    render(
      <PanelShell title="Test Panel" onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    expect(screen.queryByTestId('panel-footer')).not.toBeInTheDocument()
  })

  it('uses default width of 420px', () => {
    render(
      <PanelShell title="Test Panel" onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    const panel = screen.getByRole('complementary')
    expect(panel).toHaveClass('w-full', 'sm:w-[420px]')
  })

  it('uses custom width when provided', () => {
    render(
      <PanelShell title="Test Panel" width="480px" onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    const panel = screen.getByRole('complementary')
    expect(panel).toHaveClass('w-full', 'sm:w-[480px]')
  })

  it('has correct accessibility attributes', () => {
    render(
      <PanelShell title="Test Panel" onClose={() => {}}>
        <div>Panel content</div>
      </PanelShell>
    )

    const panel = screen.getByRole('complementary')
    expect(panel).toHaveAttribute('aria-label', 'Test Panel')
  })

  it('renders all sections together', () => {
    const TestIcon = () => <div data-testid="icon">Icon</div>
    const tabs = <div data-testid="tabs">Tabs</div>
    const footer = <div data-testid="footer">Footer</div>
    const chips = <div data-testid="chips">Chips</div>

    render(
      <PanelShell
        title="Complete Panel"
        icon={<TestIcon />}
        chips={chips}
        tabs={tabs}
        footer={footer}
        onClose={() => {}}
        width="480px"
      >
        <div>Main content</div>
      </PanelShell>
    )

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByText('Complete Panel')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByTestId('chips')).toBeInTheDocument()
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close panel/i })).toBeInTheDocument()
  })
})
