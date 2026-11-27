/**
 * Paul, 17 Nov: one key, opened from the left foot menu ("Shouldn't we just improve the key that's in the left-hand bottom menu?"), and that menu
 * vertical ("that left-hand bottom menu should be vertical, not horizontal"). The always-on bottom-right key pill is gone; its lines and marks
 * are drawn inside "How to read this", where each card kind is drawn with its own marker (a limit's outlined square, the aim's diamond).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ViewLegend } from '../ViewLegend'
import { useEscapeLayer } from '../v12/edit/escapeLayers'
import { useViewStore } from '../store'
import type { View } from '../client'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const src = (f: string) => readFileSync(path.resolve(f), 'utf8')

afterEach(() => { cleanup(); useViewStore.setState({ sid: null, view: null, status: 'none' } as never) })

describe('one key, in the left foot menu', () => {
  it('closes only the newest surface, then closes the key on the next Escape', () => {
    useViewStore.setState({ sid: view.id, view, status: 'ready' } as never)
    function Surfaces() {
      const [legend, setLegend] = useState(true)
      const [newer, setNewer] = useState(false)
      useEscapeLayer(newer, () => setNewer(false))
      return <>
        <ViewLegend open={legend} onOpenChange={setLegend} />
        <button onClick={() => setNewer(true)}>Open another surface</button>
        {newer && <div data-testid="newer-surface" />}
      </>
    }
    render(<Surfaces />)
    fireEvent.click(screen.getByRole('button', { name: 'Open another surface' }))
    expect(screen.getByTestId('newer-surface')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('newer-surface')).toBeNull()
    expect(screen.getByTestId('view-legend')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('view-legend')).toBeNull()
  })

  it('OK1 the canvas mounts no always-on key pill (its rule is gone from ViewCanvas); CONTRAST: the one key draws the lines and marks it showed', () => {
    expect(src('src/olumiView/ViewCanvas.tsx')).not.toMatch(/<KeyPill\b/)
    useViewStore.setState({ sid: view.id, view, status: 'ready' } as never)
    render(<ViewLegend open onOpenChange={() => {}} />)
    const legend = screen.getByTestId('view-legend')
    expect(legend.querySelector('[data-testid="view-key-lines"] [data-key-item="olumi-mark"]')).not.toBeNull()
    expect(legend.querySelector('[data-testid="view-key-lines"] [data-key-item="person-mark"]')).not.toBeNull()
  })
  it('OK2 each card kind in core\'s key is drawn with its own marker: the limit\'s outlined square (constraint), the aim\'s diamond (goal); core\'s words stay the label', () => {
    useViewStore.setState({ sid: view.id, view, status: 'ready' } as never)
    render(<ViewLegend open onOpenChange={() => {}} />)
    const row = (id: string) => screen.getByTestId('view-legend').querySelector<HTMLElement>(`[data-view-key="${view.model!.key.findIndex((k) => k.id === id)}"]`)!
    expect([row('limit').querySelector('[data-key-mark]')?.getAttribute('data-key-mark'), row('limit').textContent]).toEqual(['constraint', view.model!.key.find((k) => k.id === 'limit')!.text])
    expect(row('aim').querySelector('[data-key-mark]')?.getAttribute('data-key-mark')).toBe('goal')
    // CONTRAST: an item that names no card kind keeps core's own glyph.
    expect(row('olumi').querySelector('[data-key-mark]')).toBeNull()
    expect(row('olumi').textContent).toContain(view.model!.key.find((k) => k.id === 'olumi')!.glyph)
  })
  it('OK3 the zoom controls stand as a column (the group flows down), not the 9 Nov row', () => {
    const css = src('src/components/layout/CanvasFloatingToolbar.module.css')
    const rule = css.slice(css.lastIndexOf('.viewportControls .group {'))
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/flex-direction:\s*column/)
  })
})
