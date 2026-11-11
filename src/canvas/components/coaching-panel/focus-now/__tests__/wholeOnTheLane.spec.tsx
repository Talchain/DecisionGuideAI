/**
 * X1 (Paul's "do now", 11 Nov): on the olumi-core lane a closed row draws its whole title (`whole`, passed by the lane's FocusNow and
 * Strengthen); everywhere else the previous product's one-line clamp at rest is unchanged. The lane's own mount is pinned in
 * olumiView/__tests__/doNowItems.spec.tsx on a served View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FocusRowCard } from '../FocusRowCard'
import type { FocusRow } from '../focusTypes'

afterEach(cleanup)
const row: FocusRow = { id: 'r', ownership: 'server_sourced', source: 'coaching_signal', primary: 'a long title that the previous product clamps to one line at rest' }
const title = () => screen.getByRole('button').querySelector<HTMLElement>('span[id]')!

describe('a closed focus row\'s title', () => {
  it('without `whole` (off the lane): clamped to one line at rest, as before', () => {
    render(<FocusRowCard row={row} isOpen={false} onToggle={() => {}} />)
    expect([title().style.webkitLineClamp, title().style.overflow]).toEqual(['1', 'hidden'])
  })
  it('with `whole` (the lane): drawn whole at rest, the same words', () => {
    render(<FocusRowCard row={row} isOpen={false} onToggle={() => {}} whole />)
    expect([title().textContent, title().style.webkitLineClamp, title().style.overflow]).toEqual([row.primary, '', ''])
  })
})
