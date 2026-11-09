/**
 * Nothing faded at rest (Paul's visual gate, 8 Nov): a control that cannot act yet is drawn solid in light ink (filled ones on the
 * border tint), never at reduced opacity. Named failures: the 1232 audit on 15120b08 found the composer's Send at 35% and
 * "Approve ticked · 0" at 40% on Paul's board. Bound to the real composer button and to the lane's chip classes it uses.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewComposer, useViewChat } from '../ViewChat'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../../v5/blocks/chipClass'

const FADE = /(^|\s)(disabled:)?opacity-\d+(\s|$)/
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'pricing.view.json'), 'utf8')) as View
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useViewChat.setState({ text: '', busy: false, said: null }) })

describe('a control that cannot act yet is solid, not faded', () => {
  it('the composer\'s Send, empty box: disabled, no opacity token, light ink on the border tint', () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view, error: null, status: 'ready' })
    useViewChat.setState({ text: '', busy: false, said: null })
    const btn = render(<ViewComposer />).container.querySelector<HTMLButtonElement>('[data-testid="view-composer-send"]')!
    expect(btn.disabled).toBe(true)
    expect(btn.className).not.toMatch(FADE)
    expect(btn.className.split(/\s+/)).toEqual(expect.arrayContaining(['disabled:bg-border', 'disabled:text-text-light']))
  })
  it('the lane\'s chips (Approve, Approve ticked, Set aside): no opacity token; the primary one solid on the border tint', () => {
    expect(VIEW_CHIP_CLASS).not.toMatch(FADE)
    expect(VIEW_CHIP_PRIMARY_CLASS).not.toMatch(FADE)
    expect(VIEW_CHIP_CLASS.split(/\s+/)).toContain('disabled:text-text-light')
    expect(VIEW_CHIP_PRIMARY_CLASS.split(/\s+/)).toEqual(expect.arrayContaining(['disabled:bg-border', 'disabled:text-text-light']))
  })
})
