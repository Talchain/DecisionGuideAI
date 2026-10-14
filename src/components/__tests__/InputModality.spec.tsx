import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InputModality } from '../InputModality'

const modality = () => document.documentElement.getAttribute('data-input-modality')

beforeEach(() => document.documentElement.removeAttribute('data-input-modality'))
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-input-modality')
})

describe('InputModality at the app root', () => {
  it('Tab switches to keyboard and a pointerdown switches back to pointer before focus', () => {
    render(<InputModality />)
    expect(modality()).toBe('pointer')
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(modality()).toBe('keyboard')
    fireEvent.pointerDown(document)
    expect(modality()).toBe('pointer')
  })

  it.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Spacebar'])(
    '%s records keyboard navigation', key => {
      render(<InputModality />)
      fireEvent.keyDown(document, { key })
      expect(modality()).toBe('keyboard')
    },
  )

  it.each(['mousedown', 'touchstart'])('%s records pointer input after keyboard navigation', event => {
    render(<InputModality />)
    fireEvent.keyDown(document, { key: 'Tab' })
    document.dispatchEvent(new Event(event, { bubbles: true }))
    expect(modality()).toBe('pointer')
  })

  it('typing in a pointer-focused field does not create a keyboard ring', () => {
    render(<><InputModality /><input aria-label="Test field" /></>)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'a' })
    expect(modality()).toBe('pointer')
  })

  it('captures modality even when a control stops propagation', () => {
    render(<><InputModality /><input aria-label="Test field" onKeyDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} /></>)
    const field = screen.getByRole('textbox')
    fireEvent.keyDown(field, { key: 'Tab' })
    expect(modality()).toBe('keyboard')
    fireEvent.pointerDown(field)
    expect(modality()).toBe('pointer')
  })

  it('unmount removes the listeners and restores the prior root attribute', () => {
    document.documentElement.setAttribute('data-input-modality', 'keyboard')
    const { unmount } = render(<InputModality />)
    unmount()
    fireEvent.pointerDown(document)
    expect(modality()).toBe('keyboard')
    document.documentElement.removeAttribute('data-input-modality')
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(modality()).toBeNull()
  })
})
