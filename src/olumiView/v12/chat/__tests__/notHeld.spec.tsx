/**
 * Core 14c9f3b6's `chat[].not_held` (the only source of the "Not in your model" line): one quiet line with core's heading and the count; the items sit
 * inside the reply facts' disclosure in core's words; a writer is named only when it is not the viewer; nothing is drawn without items.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat } from '../../../ViewChat'

type NotHeld = NonNullable<View['chat'][number]['not_held']>
const base = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mount = (nh: NotHeld | undefined) => {
  const view = base()
  const last = view.chat[view.chat.length - 1]!
  if (nh === undefined) delete last.not_held; else last.not_held = nh
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  const c = render(<ViewChat />).container
  return { c, view, latest: q(c, 'view-chat-latest')! }
}
const open = (latest: HTMLElement) => act(async () => { fireEvent.click(q(latest, 'view-reply-rests')!) })
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null }) })

const HELD = (writers: Array<string | null>, more = 0): NotHeld => ({ heading: 'Not in your model', shown: writers.map((w, i) => ({ text: `figure ${i}`, writer: w })), more })

describe('not_held', () => {
  it('the line shows core\'s heading and the count (shown + more) ; the items are not drawn at rest', () => {
    const { latest } = mount(HELD([null, null], 3))
    const line = q(latest, 'view-not-held')!
    expect(line).toHaveTextContent('Not in your model 5')
    expect(q(line, 'view-not-held-count')).toHaveTextContent('5')
    expect(q(latest, 'view-not-held-items')).toBeNull()
  })

  it('the items and the remainder sit inside the disclosure, one line each', async () => {
    const { latest } = mount(HELD([null, null], 3))
    await open(latest)
    const body = q(latest, 'view-reply-rests-body')!
    const items = q(body, 'view-not-held-items')!
    expect([...items.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['figure 0', 'figure 1', '+3'])
    expect(body.contains(q(latest, 'view-not-held'))).toBe(false)
  })

  it('the writer is hidden when it is the viewer and shown when it differs', async () => {
    const { latest, view } = mount(HELD([base().you, 'Zed', null]))
    expect(view.you).toBe('Ana')
    await open(latest)
    const rows = [...q(latest, 'view-not-held-items')!.querySelectorAll('li')]
    expect(rows.map((li) => li.textContent)).toEqual(['figure 0', 'figure 1 Zed', 'figure 2'])
    expect(rows.filter((li) => q(li, 'view-not-held-writer') !== null)).toHaveLength(1)
  })

  it('nothing is drawn when not_held is absent or has no items', () => {
    for (const nh of [undefined, HELD([], 0)]) {
      const { latest } = mount(nh)
      expect(q(latest, 'view-not-held')).toBeNull()
      expect(q(latest, 'view-not-held-items')).toBeNull()
      cleanup()
    }
  })
})
