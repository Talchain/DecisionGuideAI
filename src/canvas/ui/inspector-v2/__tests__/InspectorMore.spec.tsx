import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InspectorShell } from '../InspectorShell'
import { InspectorMore, InspectorMoreItems, InspectorMoreProvider } from '../shared/InspectorMore'

vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

describe('InspectorMore', () => {
  it('mounts panel state once at its portal destination and keeps it while collapsed', () => {
    const initialise = vi.fn(() => 'original')
    function StatefulItem() {
      const [value, setValue] = useState(initialise)
      return <input aria-label="More draft" value={value} onChange={event => setValue(event.target.value)} />
    }

    render(
      <InspectorMoreProvider>
        <InspectorMoreItems><StatefulItem /></InspectorMoreItems>
        <InspectorMore><p>Shell detail</p></InspectorMore>
      </InspectorMoreProvider>,
    )
    const more = screen.getByTestId('inspector-more')
    const toggle = screen.getByTestId('inspector-more-toggle')
    const input = more.querySelector<HTMLInputElement>('input')!
    expect(initialise).toHaveBeenCalledTimes(1)
    expect(more.hidden).toBe(true)
    expect(toggle.getAttribute('aria-controls')).toBe(more.id)

    fireEvent.click(toggle)
    expect(more.hidden).toBe(false)
    fireEvent.change(input, { target: { value: 'kept draft' } })
    fireEvent.click(toggle)
    expect(more.hidden).toBe(true)
    fireEvent.click(toggle)
    expect(more.querySelector('input')).toBe(input)
    expect(input.value).toBe('kept draft')
    expect(initialise).toHaveBeenCalledTimes(1)
  })

  it('places all panel portals before shell items in a single More destination', () => {
    render(
      <InspectorMoreProvider>
        <InspectorMoreItems><p data-order="panel first">Panel first</p></InspectorMoreItems>
        <InspectorMoreItems><p data-order="panel second">Panel second</p></InspectorMoreItems>
        <InspectorMore><p data-order="shell">Shell</p></InspectorMore>
      </InspectorMoreProvider>,
    )
    const more = screen.getByTestId('inspector-more')
    expect(Array.from(more.querySelectorAll('[data-order]')).map(item => item.getAttribute('data-order')))
      .toEqual(['panel first', 'panel second', 'shell'])
  })

  it('keeps the no-provider fallback inline, including its fieldset ancestry', () => {
    const { container } = render(
      <fieldset disabled data-authority="disabled">
        <InspectorMoreItems><input aria-label="Legacy value" /></InspectorMoreItems>
      </fieldset>,
    )
    const input = screen.getByRole('textbox', { name: 'Legacy value' })
    expect(input.parentElement).toBe(container.firstElementChild)
    expect(input.closest('fieldset[disabled]')?.getAttribute('data-authority')).toBe('disabled')
    expect(screen.queryByTestId('inspector-more-toggle')).toBeNull()
  })
})

describe('InspectorShell anatomy header menu', () => {
  it('disarms an open menu when its available actions disappear', () => {
    const onClose = vi.fn()
    const props = {
      variant: 'anatomy' as const, label: 'A → B', typePill: 'Relationship',
      techMode: false, onTechToggleChange: vi.fn(), onClose,
    }
    const menuItem = <button type="button" role="menuitem">Back to the conversation</button>
    const { rerender } = render(
      <InspectorShell {...props} headerMenu={menuItem}><p>Primary</p></InspectorShell>,
    )
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByRole('menu')).toBeTruthy()

    rerender(<InspectorShell {...props}><p>Primary</p></InspectorShell>)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.keyDown(screen.getByRole('region', { name: 'Inspector panel' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<InspectorShell {...props} headerMenu={menuItem}><p>Primary</p></InspectorShell>)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByTestId('inspector-header-menu').getAttribute('aria-expanded')).toBe('false')
  })

  it('closes with Escape or an outside click and keeps the inspector open', () => {
    const onClose = vi.fn()
    const dragHandlers = {
      onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(), isDragging: false,
    }
    render(
      <InspectorShell
        variant="anatomy"
        label="A → B"
        typePill="Relationship"
        techMode={false}
        onTechToggleChange={vi.fn()}
        onClose={onClose}
        dragHandlers={dragHandlers}
        headerMenu={<button type="button" role="menuitem">Back to the conversation</button>}
      >
        <p>Primary content</p>
      </InspectorShell>,
    )
    const toggle = screen.getByTestId('inspector-header-menu')
    fireEvent.pointerDown(toggle)
    fireEvent.pointerUp(toggle)
    expect(dragHandlers.onPointerDown).not.toHaveBeenCalled()
    expect(dragHandlers.onPointerUp).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})
