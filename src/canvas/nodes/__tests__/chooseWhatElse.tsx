/**
 * E4 test helper: a ghost door now opens the "What else…?" chooser, so a door's ask is door click → chip. This picks
 * the chip in the REAL chooser for whatever the door just opened, then unmounts it, so a spec may ask twice.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { expect } from 'vitest'
import { WhatElseChooser, useWhatElseStore, type WhatElseKind } from '../../components/WhatElseChooser'

export function chooseWhatElse(kind: WhatElseKind): void {
  const open = useWhatElseStore.getState().open
  expect(open, 'the door opened the "What else…?" chooser').not.toBeNull()
  const r = render(<WhatElseChooser open={open!} onClose={() => useWhatElseStore.getState().close()} />)
  fireEvent.click(screen.getByTestId(`what-else-${kind}`))
  r.unmount()
}
