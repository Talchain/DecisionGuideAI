/** The three-dot menu's Help on the V12 canvas (Paul's audit, 17 Nov): the top bar's two events open the two panels here too. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { HELP_EVENTS } from '../../../components/layout/TopBar'
import { LaneHelp } from '../LaneHelp'

afterEach(cleanup)

describe('Help on the V12 canvas', () => {
  it('"Keyboard shortcuts" opens the legend and "How influence works" the explainer; nothing shows before either is asked for', () => {
    render(<LaneHelp />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('lane-influence-explainer')).toBeNull()
    act(() => { window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_KEYBOARD_LEGEND)) })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => { window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER)) })
    expect(screen.getByTestId('lane-influence-explainer')).toBeInTheDocument()
  })

  it('the influence toast is on panel tokens, in plain words, with no code type, and sits fixed clear of the head band and the dock (v10 review item 1)', () => {
    render(<LaneHelp />)
    act(() => { window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER)) })
    const wrap = screen.getByTestId('lane-influence-explainer')
    const toast = screen.getByTestId('influence-explainer-panel')
    expect(wrap).toHaveClass('fixed')
    expect(wrap.style.top).not.toBe('')
    expect(wrap.style.right).not.toBe('')
    expect(toast).toHaveClass('bg-panel', 'border-panel-border', 'text-text-body')
    expect(toast.className).not.toMatch(/sky-|font-mono/)
    expect(toast.querySelector('.font-mono')).toBeNull()
    expect(toast).toHaveTextContent('Factors are the things that matter, links show what moves what')
    // contrast: no node/edge/weight jargon in the lane toast
    expect(toast.textContent).not.toMatch(/Nodes|Edges|Weights/)
  })
})
