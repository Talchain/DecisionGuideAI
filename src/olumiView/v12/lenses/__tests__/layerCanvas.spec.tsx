import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { LayerCanvasStyle } from '../LayerCanvasStyle'
import { optionLayerId } from '../layers'
import { useLayer } from '../store'

const golden = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
afterEach(() => { cleanup(); useLayer.setState({ layer: 'full', sid: null }); useViewStore.setState({ view: null }) })
const css = () => document.querySelector('[data-testid="v12-layers-style"]')?.textContent ?? null

describe('layers on the canvas', () => {
  it('the full model draws nothing; an option focus sets back the cards off its path and keeps the ones on it', () => {
    useViewStore.setState({ view: golden() })
    const { rerender } = render(<LayerCanvasStyle />)
    expect(css()).toBeNull()
    useLayer.setState({ layer: optionLayerId('broader_entry') })
    rerender(<LayerCanvasStyle />)
    expect(css()).toContain('[data-id="single_country_test"]{opacity')
    expect(css()).not.toContain('[data-id="broader_entry"]{opacity')
    expect(css()).not.toContain('[data-id="churn_rate"]{opacity')
  })

  it('Evidence quality tags each figure with its basis and sets nothing back; Olumi\'s assumed figure is in the info colour', () => {
    useViewStore.setState({ view: golden() })
    useLayer.setState({ layer: 'evidence' })
    render(<LayerCanvasStyle />)
    const c = css()!
    expect(c).not.toContain('opacity')
    expect(c).toMatch(/data-id="existing_market_acquisitions"\][^{]*::after\{content:"No attached evidence \(Olumi's\)".*var\(--o-info\)/)
    expect(c).toMatch(/data-id="starting_customers"\][^{]*::after\{content:"No attached evidence"/)
    // Codex 006d #1: the note is on a row inside its card, which the card measures (so the layout leaves room); never below the card.
    expect(c).toMatch(/data-id="starting_customers"\] \[role='group'\][^{]*\{padding-bottom:22px!important/)
    expect(c).not.toMatch(/top:100%/)
  })
})
