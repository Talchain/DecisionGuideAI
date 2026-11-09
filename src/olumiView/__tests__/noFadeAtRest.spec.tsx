/**
 * Nothing faded at rest (Paul's visual gate, 8 Nov): a control that cannot act yet is drawn solid in light ink (filled ones on the border
 * tint), never at reduced opacity. Ported from noA 212399d0 onto V11. Named failure: the 1232 audit on noA 15120b08 found "Approve ticked · 0"
 * at 40% on Paul's board. Bound to the real composer button, to the lane's chip classes, and to each lane file noA cleared.
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
const DISABLED_FADE = /disabled:opacity-\d+/
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'pricing.view.json'), 'utf8')) as View
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useViewChat.setState({ text: '', busy: false, said: null }) })

describe('a control that cannot act yet is solid, not faded', () => {
  it('NF1 the composer\'s Send, empty box: disabled and no opacity token', () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view, error: null, status: 'ready' })
    useViewChat.setState({ text: '', busy: false, said: null })
    const btn = render(<ViewComposer />).container.querySelector<HTMLButtonElement>('[data-testid="view-composer-send"]')!
    expect(btn.disabled).toBe(true)
    expect(btn.className).not.toMatch(FADE)
  })
  it('NF2 the lane\'s chips (Approve, Approve ticked, Set aside): no opacity token; the primary one solid on the border tint', () => {
    expect(VIEW_CHIP_CLASS).not.toMatch(FADE)
    expect(VIEW_CHIP_PRIMARY_CLASS).not.toMatch(FADE)
    expect(VIEW_CHIP_CLASS.split(/\s+/)).toContain('disabled:text-text-light')
    expect(VIEW_CHIP_PRIMARY_CLASS.split(/\s+/)).toEqual(expect.arrayContaining(['disabled:bg-border', 'disabled:text-text-light']))
  })
  // Contrast: the legacy chat chips these derive from keep their own recipe (not this lane's), so the probe sees the token where it is.
  it('NF3 contrast: the probe sees the fade where it still is (the legacy chip recipe the lane derives from)', async () => {
    const { CHIP_CLASS } = await import('../../v5/blocks/chipClass')
    expect(CHIP_CLASS).toMatch(DISABLED_FADE)
  })
  it.each([
    'src/olumiView/AddFigure.tsx', 'src/olumiView/DraftingBoard.tsx', 'src/olumiView/FigureEdit.tsx', 'src/olumiView/Rename.tsx',
    'src/olumiView/ViewChat.tsx', 'src/olumiView/ViewFigureFirst.tsx', 'src/olumiView/ViewPreMortemKey.tsx', 'src/olumiView/ViewWhatIfKey.tsx',
    'src/olumiCore/team/TeamTab.tsx', 'src/olumiCore/team/ViewsPanel.tsx', 'src/olumiCore/team/ui.ts',
  ])('NF4 %s draws no disabled control faded', (f) => {
    expect(readFileSync(path.resolve(f), 'utf8')).not.toMatch(DISABLED_FADE)
  })
})
