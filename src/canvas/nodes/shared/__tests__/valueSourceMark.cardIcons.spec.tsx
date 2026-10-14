import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ValueSourceMark, VALUE_SOURCE_MARK_LABEL, type ValueSourceMarkKind } from '../valueSourceMark'
afterEach(cleanup)
it.each([['olumi', 'sparkles'], ['brief', 'file-text'], ['you', 'user-check'], ['panel', 'users'], ['unknown', 'help-circle']] as const)('%s uses the product glyph and keeps its source route and aria', (kind, glyph) => {
  const onOpen = vi.fn()
  render(<ValueSourceMark mark={{ kind: kind as ValueSourceMarkKind, label: VALUE_SOURCE_MARK_LABEL[kind] }} testId="source" onOpenSource={onOpen} />)
  const button = screen.getByTestId('source')
  expect(button).toHaveAttribute('aria-label', VALUE_SOURCE_MARK_LABEL[kind])
  expect(button.querySelector(`.lucide-${glyph}`)).not.toBeNull()
  expect(button.querySelector('.lucide-user')).toBeNull()
  expect(button.querySelector('span[aria-hidden="true"]')).toBeNull()
  fireEvent.click(button); expect(onOpen).toHaveBeenCalledOnce()
})
