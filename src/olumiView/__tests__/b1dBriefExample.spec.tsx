/**
 * DL 10 Nov (new-scenario welcome shot, fault 4): the brief box's example text was cut mid-sentence ("... next quarter? We need") at 1232 x 704.
 * The example is drawn whole, its words unchanged: the box has room for it to wrap until something is typed. jsdom has no layout, so the row is
 * the box's rows (the textarea wraps its placeholder), bound to the exact placeholder words.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { BRIEF_EXAMPLE, ViewComposer } from '../ViewChat'
import { useViewStore } from '../store'

afterEach(() => { cleanup(); useViewStore.setState({ view: null, sid: null, uuid: null, at: null }) })
const earlier: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hiring.view3.json'), 'utf8'))

describe('4. the brief\'s example is shown whole', () => {
  it('a blank scenario\'s brief box has room for the wrapped example (3 rows, not 1)', () => {
    useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
    const box = () => document.querySelector<HTMLTextAreaElement>('#view-chat-text')!
    render(<ViewComposer />)
    expect(box().getAttribute('placeholder')).toBe(BRIEF_EXAMPLE)
    expect(box().rows).toBe(3)
  })
  it('CONTRAST: a scenario with a model keeps its one-row message box', () => {
    useViewStore.setState({ uuid: 'u', sid: 's', view: earlier, error: null, status: 'ready' })
    render(<ViewComposer />)
    expect(document.querySelector<HTMLTextAreaElement>('#view-chat-text')!.rows).toBe(1)
  })
})
