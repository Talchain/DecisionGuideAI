/** Test helpers for the one Tip (look/Tip.tsx): what an element says on hover, and what it says on REAL keyboard focus. Native `title` is never the hover. */
import { act, fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

const open = (): HTMLElement | null => document.querySelector<HTMLElement>('[role="tooltip"]')

/** The Tip's words after the pointer rests on `el` (its 150 ms delay is waited for); leaving closes it. */
export const tipOf = async (el: HTMLElement): Promise<string> => {
  fireEvent.pointerEnter(el)
  await waitFor(() => expect(open()).not.toBeNull())
  const words = open()!.textContent ?? ''
  fireEvent.pointerLeave(el)
  return words
}

/** The Tip's words after `el` takes real keyboard focus; blurring closes it. */
export const tipOnFocus = async (el: HTMLElement): Promise<string> => {
  act(() => { el.focus() })
  expect(document.activeElement, 'the element itself is the keyboard stop').toBe(el)
  await waitFor(() => expect(open()).not.toBeNull())
  const words = open()!.textContent ?? ''
  act(() => { el.blur() })
  return words
}
