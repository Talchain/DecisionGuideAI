/**
 * S4 lane topbar (19 Nov): More options needed TWO Escapes (4 of 4 runs). Its button sits in the shared Tooltip, which showed on the press's focus and
 * dismissed on Escape with floating-ui's default: stopPropagation at `document`, so the press never reached the one shared Escape rule's last listener
 * at `window` (v12/edit/escapeLayers.ts). The tooltip still closes on Escape; the press now goes on.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import Tooltip from '../Tooltip'
import { useEscapeLayer } from '../../olumiView/v12/edit/escapeLayers'

afterEach(cleanup)

/** The shape of the top bar's More options: a button in a Tooltip that opens a menu registered as an Escape layer. */
function Kebab({ withTooltip }: { withTooltip: boolean }): JSX.Element {
  const [open, setOpen] = useState(false)
  useEscapeLayer(open, () => setOpen(false))
  const button = <button type="button" aria-label="More options" aria-expanded={open} onClick={() => setOpen((o) => !o)}>more</button>
  return <div>{withTooltip ? <Tooltip content="More options">{button}</Tooltip> : button}{open ? <div role="menu" /> : null}</div>
}

describe('one Escape closes a menu whose button shows a tooltip', () => {
  it('press the button (focus keeps its tooltip up), one Escape: the menu is closed AND the tooltip is gone', async () => {
    render(<Kebab withTooltip />)
    const b = screen.getByRole('button', { name: 'More options' })
    await act(async () => { b.focus(); fireEvent.click(b) })
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('tooltip'), 'the tooltip is showing on focus').not.toBeNull()
    await act(async () => { fireEvent.keyDown(b, { key: 'Escape' }) })
    expect(screen.queryByRole('menu'), 'one press closes the menu').toBeNull()
    expect(screen.queryByRole('tooltip'), 'and the tooltip closes by the same press').toBeNull()
  })
  it('CONTRAST: the same menu with no tooltip closes on one press as well (the layer rule itself was never at fault)', async () => {
    render(<Kebab withTooltip={false} />)
    const b = screen.getByRole('button', { name: 'More options' })
    await act(async () => { b.focus(); fireEvent.click(b) })
    await act(async () => { fireEvent.keyDown(b, { key: 'Escape' }) })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
