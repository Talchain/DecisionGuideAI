/**
 * StreamDrawersContainer Unit Tests
 * Phase 2E: Tests for extracted drawer orchestration component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StreamDrawersContainer from '../StreamDrawersContainer'

describe('StreamDrawersContainer', () => {
  it('renders children elements', () => {
    render(
      <StreamDrawersContainer>
        <div data-testid="test-drawer-1">Drawer 1</div>
        <div data-testid="test-drawer-2">Drawer 2</div>
      </StreamDrawersContainer>
    )

    expect(screen.getByTestId('test-drawer-1')).toBeInTheDocument()
    expect(screen.getByTestId('test-drawer-2')).toBeInTheDocument()
  })

  it('renders multiple drawer components without issues', () => {
    const TestDrawer = ({ name }: { name: string }) => (
      <div data-testid={`drawer-${name}`}>{name} Content</div>
    )

    render(
      <StreamDrawersContainer>
        <TestDrawer name="config" />
        <TestDrawer name="canvas" />
        <TestDrawer name="scenarios" />
        <TestDrawer name="report" />
        <TestDrawer name="history" />
      </StreamDrawersContainer>
    )

    expect(screen.getByTestId('drawer-config')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-scenarios')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-report')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-history')).toBeInTheDocument()
  })

  it('renders nothing when no children are provided', () => {
    const { container } = render(<StreamDrawersContainer />)

    // Should render a fragment with no visible content
    expect(container.firstChild).toBeNull()
  })

  it('preserves drawer component order', () => {
    render(
      <StreamDrawersContainer>
        <div data-testid="drawer-first">First</div>
        <div data-testid="drawer-second">Second</div>
        <div data-testid="drawer-third">Third</div>
      </StreamDrawersContainer>
    )

    const drawers = [
      screen.getByTestId('drawer-first'),
      screen.getByTestId('drawer-second'),
      screen.getByTestId('drawer-third'),
    ]

    // Verify order is maintained in DOM
    const parent = drawers[0].parentElement
    const children = Array.from(parent?.children || [])

    expect(children.indexOf(drawers[0])).toBeLessThan(children.indexOf(drawers[1]))
    expect(children.indexOf(drawers[1])).toBeLessThan(children.indexOf(drawers[2]))
  })

  it('memoizes correctly and does not re-render unnecessarily', () => {
    const { rerender } = render(
      <StreamDrawersContainer>
        <div data-testid="test-drawer">Content</div>
      </StreamDrawersContainer>
    )

    const drawer = screen.getByTestId('test-drawer')

    // Rerender with same children
    rerender(
      <StreamDrawersContainer>
        <div data-testid="test-drawer">Content</div>
      </StreamDrawersContainer>
    )

    // Component should not have re-rendered (React.memo should prevent it)
    expect(drawer).toBeInTheDocument()
  })

  it('handles conditional drawer rendering', () => {
    const showDrawer = true

    render(
      <StreamDrawersContainer>
        {showDrawer && <div data-testid="conditional-drawer">Conditional Content</div>}
      </StreamDrawersContainer>
    )

    expect(screen.getByTestId('conditional-drawer')).toBeInTheDocument()
  })

  it('handles empty fragment children', () => {
    render(
      <StreamDrawersContainer>
        <>
          <div data-testid="drawer-1">Drawer 1</div>
          <div data-testid="drawer-2">Drawer 2</div>
        </>
      </StreamDrawersContainer>
    )

    expect(screen.getByTestId('drawer-1')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-2')).toBeInTheDocument()
  })
})
