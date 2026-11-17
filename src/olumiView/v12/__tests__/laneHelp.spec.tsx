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
})
