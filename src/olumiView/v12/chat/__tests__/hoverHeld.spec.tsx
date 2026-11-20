/**
 * A held labelled button (HoverButton): `aria-disabled`, not natively disabled, so it still takes focus and its reason shows on the one Tip;
 * a press does nothing. Contrast: a live one presses.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HoverButton } from '../Hover'
import { tipOnFocus } from '../../../__tests__/tipHelpers'

afterEach(cleanup)

describe('HoverButton held', () => {
  it('focus shows the reason, a press does nothing, and the button is aria-disabled (never natively disabled)', async () => {
    const onClick = vi.fn()
    render(<HoverButton words="An invented reason" type="button" disabled onClick={onClick} data-testid="b">x</HoverButton>)
    const b = screen.getByTestId('b')
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(b).not.toBeDisabled()
    expect(await tipOnFocus(b)).toBe('An invented reason')
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })
  it('contrast: a live one carries no aria-disabled and presses', () => {
    const onClick = vi.fn()
    render(<HoverButton words="w" type="button" onClick={onClick} data-testid="b">x</HoverButton>)
    expect(screen.getByTestId('b')).not.toHaveAttribute('aria-disabled')
    fireEvent.click(screen.getByTestId('b'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
