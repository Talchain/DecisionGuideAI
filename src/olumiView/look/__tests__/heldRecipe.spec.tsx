/** A held HoverButton is aria-disabled (not natively disabled, so its Tip works); the shared control recipes must carry the held look for that state too. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { controls } from '@/styles/controls'
import { HoverButton } from '../Hover'

afterEach(cleanup)
const classes = (el: HTMLElement): Set<string> => new Set(el.className.split(/\s+/).filter(Boolean))

describe('a held HoverButton with a shared control recipe', () => {
  it('controls.act: a held button is aria-disabled, not native, and carries the held look classes', () => {
    render(<HoverButton words="Waiting for Olumi" disabled data-testid="h" className={controls.act}>Go</HoverButton>)
    const btn = screen.getByTestId('h')
    expect([btn.getAttribute('aria-disabled'), btn.hasAttribute('disabled')]).toEqual(['true', false])
    const c = classes(btn)
    for (const held of ['aria-disabled:cursor-not-allowed', 'aria-disabled:border-panel-border', 'aria-disabled:bg-panel-border', 'aria-disabled:text-text-light', 'aria-disabled:hover:bg-panel-border']) {
      expect(c.has(held), held).toBe(true)
    }
  })

  it('every `disabled:` class in each shared recipe has an `aria-disabled:` twin', () => {
    for (const [name, recipe] of Object.entries({ act: controls.act, actColours: controls.actColours, editableField: controls.editableField, editableResting: controls.editableResting })) {
      const c = classes(Object.assign(document.createElement('i'), { className: recipe }))
      const missing = [...c].filter((t) => t.startsWith('disabled:') && !c.has(`aria-${t}`))
      expect(missing, name).toEqual([])
    }
  })
})
