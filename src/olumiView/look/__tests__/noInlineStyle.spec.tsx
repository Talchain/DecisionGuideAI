import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../olumiCore/team/api')>(),
  call: vi.fn(async () => { throw new Error('Unexpected Core call') }),
}))
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected fetch') })))
afterEach(() => vi.unstubAllGlobals())
import type { View } from '../../client'
import { ChatFloatHost, useChatFloat } from '../../port/ChatFloat'
import { SimpleFace } from '../../v12/SimpleFace'

const initialFloat = useChatFloat.getInitialState()

afterEach(() => {
  cleanup()
  useChatFloat.setState(initialFloat)
})

function expectOnlyCustomProperties(root: Element) {
  for (const element of [root, ...root.querySelectorAll('[style]')]) {
    const style = (element as HTMLElement | SVGElement).style
    for (const property of Array.from(style)) {
      expect(property, element.outerHTML).toMatch(/^--/)
    }
  }
}

it('uses only custom properties for the floating chat and a card face', () => {
  useChatFloat.setState({ floating: true, position: { x: 12, y: 24 }, height: 320 })
  render(<ChatFloatHost composer={<textarea aria-label="Message" />}><p>Conversation</p></ChatFloatHost>)
  const chat = screen.getByRole('dialog', { name: 'Olumi conversation' })
  expect(chat.style.getPropertyValue('--chat-float-x')).toBe('12px')
  expect(chat.style.getPropertyValue('--chat-float-height')).toBe('320px')
  expectOnlyCustomProperties(chat)

  const { model } = JSON.parse(readFileSync(resolve('src/olumiView/fixtures/core-38eebca9/european.view3.json'), 'utf8')) as View
  const card = model!.cards.find(({ id }) => id === 'customers')!
  const { container } = render(<SimpleFace card={card} model={model!} noted={false} />)
  expect(container.querySelector('[data-band-middle]')?.getAttribute('x1')).toMatch(/%$/)
  expectOnlyCustomProperties(container)
})
