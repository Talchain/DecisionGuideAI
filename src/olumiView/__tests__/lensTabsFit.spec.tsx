/**
 * Demo rehearsal on the served build (core 55c0c03f + V11 deec4c90, 10 Nov): at 1232 the Analysis tab's lens strip cut its second lens
 * ("Likely outcom") in the 282 px dock. The lenses share the strip equally and their words wrap whole inside each; none is kept to one line.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LensTabs } from '../port/LensTabs'

afterEach(cleanup)
const lenses = [{ id: 'goal', label: 'Chance of meeting the aim', title: '', i: 0 }, { id: 'outcome', label: 'Likely outcome', title: '', i: 1 }]

describe('the Analysis lens strip at 1232', () => {
  it('LT1 catch: the lenses share the strip in equal columns, and no lens is held to one line', () => {
    render(<LensTabs lenses={lenses as never} active="goal" onSelect={() => {}} panelId="p" />)
    expect(screen.getByTestId('port-lens-tabs').className).toMatch(/\bgrid\b.*\bauto-cols-fr\b/)
    for (const l of lenses) {
      const tab = screen.getByTestId(`port-lens-tab-${l.id}`)
      expect(tab.className).not.toMatch(/whitespace-nowrap|truncate/)
      expect(tab.textContent).toBe(l.label)
    }
  })
})
