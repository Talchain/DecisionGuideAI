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

/** What the one Tip says for an element: nothing at the instant the pointer arrives, then its words once the 150 ms delay has run. */
export const hoverWords = async (el: HTMLElement): Promise<string | null> => {
  fireEvent.pointerEnter(el)
  expect(open(), 'not at the instant of arrival').toBeNull()
  const tip = await waitFor(() => { const t = open(); if (t === null) throw new Error('no tip yet'); return t })
  const words = tip.textContent
  fireEvent.pointerLeave(el)
  return words
}
