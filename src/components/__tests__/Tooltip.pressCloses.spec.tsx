/**
 * S4 pop-up lane (20 Nov): a tip stood open after its control was pressed, over the menu or drawer the press had just opened (two pop-ups for one control).
 * The ONE shared Tooltip now closes on the press, in both of its forms (the wrapper `div` and `asChild`), by mouse or keyboard (a click). It still opens on
 * focus, and a control that is only focused keeps its tip.
 */
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import Tooltip from '../Tooltip'

afterEach(cleanup)

function Bar({ asChild }: { asChild: boolean }): JSX.Element {
  const [open, setOpen] = useState(false)
  const button = <button type="button" aria-label="Version history" aria-expanded={open} onClick={() => setOpen((o) => !o)}>history</button>
  return <div><Tooltip content="Version history" asChild={asChild}>{button}</Tooltip>{open ? <aside role="dialog" /> : null}</div>
}

for (const asChild of [false, true]) {
  describe(`the ${asChild ? 'asChild' : 'wrapper'} form`, () => {
    it('focus shows the tip; pressing the control closes it as the drawer opens, so one pop-up is open, not two', async () => {
      render(<Bar asChild={asChild} />)
      const b = screen.getByRole('button', { name: 'Version history' })
      await act(async () => { b.focus() })
      expect(screen.queryByRole('tooltip'), 'precondition: focus shows the tip').not.toBeNull()
      await act(async () => { fireEvent.click(b) })
      expect(screen.queryByRole('dialog'), 'the press opened the drawer').not.toBeNull()
      expect(screen.queryByRole('tooltip'), 'and the tip is gone').toBeNull()
    })
    it('CONTRAST: with no press the tip stays up while the control keeps focus', async () => {
      render(<Bar asChild={asChild} />)
      const b = screen.getByRole('button', { name: 'Version history' })
      await act(async () => { b.focus() })
      expect(screen.queryByRole('tooltip')).not.toBeNull()
    })
  })
}
