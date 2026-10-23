import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ValueSourceMark, VALUE_SOURCE_MARK_LABEL, type ValueSourceMarkKind } from '../valueSourceMark'
afterEach(cleanup)
// Vision spec §3 (23 Oct): Olumi's estimate is the Olumi brand mark, never a sparkle.
it.each([['olumi', 'svg[data-icon="olumi-ai"]'], ['brief', '.lucide-file-text'], ['you', '.lucide-user-check'], ['panel', '.lucide-users'], ['unknown', '.lucide-help-circle']] as const)('%s uses the product glyph and keeps its source route and aria', (kind, glyph) => {
  const onOpen = vi.fn()
  render(<ValueSourceMark mark={{ kind: kind as ValueSourceMarkKind, label: VALUE_SOURCE_MARK_LABEL[kind] }} testId="source" onOpenSource={onOpen} />)
  const button = screen.getByTestId('source')
  expect(button).toHaveAttribute('aria-label', VALUE_SOURCE_MARK_LABEL[kind])
  expect(button.querySelector(glyph)).not.toBeNull()
  expect(button.querySelector('.lucide-sparkles')).toBeNull()
  expect(button.querySelector('.lucide-user')).toBeNull()
  expect(button.querySelector('span[aria-hidden="true"]')).toBeNull()
  fireEvent.click(button); expect(onOpen).toHaveBeenCalledOnce()
})
