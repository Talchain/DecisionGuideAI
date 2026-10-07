/**
 * S-B slice 1 — the ONE action bar. Rows are bound by identity: the action id in
 * each control's test id, the exact chip a press sends, the exact words shown.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Pencil } from 'lucide-react'

import { useGuidanceStore } from '../../../stores/guidanceStore'
import { ASK_BUSY_NOTICE } from '../../askAi'
import { ACTION_BAR_COPY, ActionBar } from '../ActionBar'
import { REASONING_TYPE } from '../../../../components/results/analysisNew/sections/ReasoningActionBar'
import { parseActionBar, type ActionBarV1 } from '../actionBarContract'
import { useActionBarStore } from '../actionBarStore'
import { resetPressOfferClocks } from '../pressOffer'
import { EXAMPLE_BAR, MORE_OPTIONS, PRE_MORTEM, REVIEW, REVISION, SET_TARGET, TEST_LINK } from './actionBarContractExample'

vi.mock('../../revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))

const bar = (raw: unknown = EXAMPLE_BAR): ActionBarV1 => parseActionBar(raw)!
let dispatch: ReturnType<typeof vi.fn>

/** The chip a press of this offer must send: nothing more, nothing less. */
const chipOf = (offer: { press_id: string; label: string; user_line: string; offer_key: string }, revision: unknown = REVISION) => ({
  id: offer.press_id, label: offer.label, message: offer.user_line, parameters: { offer_key: offer.offer_key, revision }, source: 'chip',
})

beforeEach(() => {
  dispatch = vi.fn()
  resetPressOfferClocks()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _isConversationBusy: () => false } as never)
  useActionBarStore.setState({ dismissed: [] })
})

describe('what is drawn', () => {
  it('WIDE: two pills, CEE’s four icons in CEE’s order, and the rest in the menu', () => {
    render(<ActionBar bar={bar()} surface="chat" compact={false} />)
    const root = screen.getByTestId('action-bar')
    expect(root).toHaveAttribute('data-compact', 'false')
    expect(within(root).getAllByTestId(/^action-bar-pill-[a-z_]+$/).map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-pill-set_target', 'action-bar-pill-more_options'])
    expect(within(root).getAllByTestId(/^action-bar-icon-/).map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-icon-review', 'action-bar-icon-what_changes', 'action-bar-icon-strengthen', 'action-bar-icon-pre_mortem'])
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(within(screen.getByTestId('action-bar-menu')).getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-menu-test_link'])
  })

  it('NARROW: one pill and three icons; the second pill and the fourth icon are in the menu, nothing is lost', () => {
    render(<ActionBar bar={bar()} surface="reasoning" compact />)
    expect(screen.getByTestId('action-bar')).toHaveAttribute('data-compact', 'true')
    expect(screen.getAllByTestId(/^action-bar-pill-[a-z_]+$/)).toHaveLength(1)
    expect(screen.getByTestId('action-bar-pill-set_target')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^action-bar-icon-/).map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-icon-review', 'action-bar-icon-what_changes', 'action-bar-icon-strengthen'])
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')).sort())
      .toEqual(['action-bar-menu-more_options', 'action-bar-menu-pre_mortem', 'action-bar-menu-test_link'])
  })

  it('every control is named by its label and the reason it is offered (or what stops it)', () => {
    render(<ActionBar bar={bar()} surface="chat" />)
    expect(screen.getByTestId('action-bar-icon-review')).toHaveAccessibleName('Review — Check what to confirm before relying on this analysis.')
    expect(screen.getByTestId('action-bar-icon-what_changes')).toHaveAccessibleName('What changes — Run the analysis first: there is no result to test yet.')
    expect(screen.getByTestId('action-bar-pill-set_target-press')).toHaveAccessibleName('Set target — The goal has no target, so no chance can be worked out.')
    expect(screen.getByTestId('action-bar-pill-set_target-press')).toHaveTextContent('Set target')
  })

  it('the menu groups its rows, and each row says why it is offered', () => {
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [TEST_LINK, { ...MORE_OPTIONS, action_id: 'more_risks', label: 'More risks', offer_key: 'abababababababab' }] })} surface="chat" compact />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(within(screen.getByTestId('action-bar-menu-group-gap')).getByText(ACTION_BAR_COPY.groups.gap)).toBeInTheDocument()
    expect(within(screen.getByTestId('action-bar-menu-group-gap')).getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-menu-more_options', 'action-bar-menu-more_risks'])
    expect(within(screen.getByTestId('action-bar-menu-group-method')).getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-menu-pre_mortem', 'action-bar-menu-test_link'])
    expect(screen.queryByTestId('action-bar-menu-group-review')).toBeNull()
    expect(screen.getByTestId('action-bar-menu-test_link')).toHaveTextContent('Test linkThis link moves the result the most.')
  })

  it('an icon name this build does not hold still shows the offer, under its label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, standard: [{ ...REVIEW, icon: 'NotAnIconYet' }] })} surface="chat" />)
    expect(screen.getByTestId('action-bar-icon-review')).toHaveAccessibleName(/^Review — /)
    expect(warn).toHaveBeenCalledWith('[action_bar] unknown icon', 'NotAnIconYet')
    warn.mockRestore()
  })

  it('before its width is known, the bar takes the narrow layout (nothing can overflow)', () => {
    render(<ActionBar bar={bar()} surface="chat" />)
    expect(screen.getByTestId('action-bar')).toHaveAttribute('data-compact', 'true')
  })

  it('a bar with nothing on it draws nothing', () => {
    const { container } = render(<ActionBar bar={bar({ ...EXAMPLE_BAR, priority: [], standard: [], more: [] })} surface="chat" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('the host chooses the type tokens and nothing else: body-size labels on both (the Reasoning tab passes its own)', () => {
    const { unmount } = render(<ActionBar bar={bar()} surface="chat" />)
    expect(screen.getByTestId('action-bar-pill-set_target-press').className).toContain('text-[13px]')
    unmount()
    render(<ActionBar bar={bar()} surface="reasoning" typeScale={REASONING_TYPE} />)
    expect(screen.getByTestId('action-bar-pill-set_target-press').className).toContain('text-xs')
  })
})

describe('one press, one chip turn', () => {
  it.each([
    ['an icon', 'action-bar-icon-review', REVIEW],
    ['a pill', 'action-bar-pill-set_target-press', SET_TARGET],
  ] as const)('%s sends its own press id, its user line and the identity it was offered for', (_name, testId, offer) => {
    render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByTestId(testId))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chipOf(offer))
  })

  it('a menu row sends the same way, and the menu closes', () => {
    render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    fireEvent.click(screen.getByTestId('action-bar-menu-test_link'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chipOf(TEST_LINK))
    expect(screen.queryByTestId('action-bar-menu')).toBeNull()
  })

  it('⛔ a DISABLED offer sends nothing and says what stops it; ⛔ CONTRAST: its enabled neighbour sends', () => {
    render(<ActionBar bar={bar()} surface="chat" compact={false} />)
    const disabled = screen.getByTestId('action-bar-icon-what_changes')
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    expect(disabled).not.toBeDisabled() // focusable, so keyboard and touch can reach the reason
    fireEvent.click(disabled)
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent('What changes: Run the analysis first: there is no result to test yet.')
    fireEvent.click(screen.getByTestId('action-bar-icon-pre_mortem'))
    expect(dispatch).toHaveBeenCalledWith(chipOf(PRE_MORTEM))
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent('')
  })

  it('a second press of the same offer inside half a second sends nothing more', () => {
    render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByTestId('action-bar-icon-review'))
    fireEvent.click(screen.getByTestId('action-bar-icon-review'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('action-bar-icon-strengthen'))
    expect(dispatch).toHaveBeenCalledTimes(2) // another offer is never dropped by the first one's clock
  })

  it('while Olumi is answering, a press sends nothing and says so', () => {
    useGuidanceStore.setState({ _isConversationBusy: () => true } as never)
    const toasts: unknown[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent).detail)
    window.addEventListener('topbar:show-toast', onToast)
    render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByTestId('action-bar-icon-review'))
    window.removeEventListener('topbar:show-toast', onToast)
    expect(dispatch).not.toHaveBeenCalled()
    expect(toasts).toEqual([{ message: ASK_BUSY_NOTICE, level: 'warning' }])
  })

  it('with no conversation mounted, a press is never dead: it says where to go', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    render(<ActionBar bar={bar()} surface="reasoning" />)
    fireEvent.click(screen.getByTestId('action-bar-icon-review'))
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent(ACTION_BAR_COPY.noConversation)
  })
})

describe('hiding a pill', () => {
  it('a hidden pill leaves the pills, stays in the menu, and is remembered by its offer key', () => {
    render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByRole('button', { name: ACTION_BAR_COPY.hide('Set target') }))
    expect(screen.queryByTestId('action-bar-pill-set_target')).toBeNull()
    expect(screen.getByTestId('action-bar-pill-more_options')).toBeInTheDocument()
    expect(useActionBarStore.getState().dismissed).toEqual([SET_TARGET.offer_key])
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('action-bar-more'))
    fireEvent.click(screen.getByTestId('action-bar-menu-set_target'))
    expect(dispatch).toHaveBeenCalledWith(chipOf(SET_TARGET))
  })

  it('the same action offered for a NEW state (a new offer key) is shown again', () => {
    useActionBarStore.setState({ dismissed: [SET_TARGET.offer_key] })
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, priority: [{ ...SET_TARGET, offer_key: '1111111111111111' }] })} surface="chat" />)
    expect(screen.getByTestId('action-bar-pill-set_target')).toBeInTheDocument()
  })
})

describe('keyboard and the host’s own controls', () => {
  it('opening the menu focuses its first row; arrows rove; Escape closes and returns focus to ⋯', () => {
    render(<ActionBar bar={bar()} surface="chat" compact />)
    const more = screen.getByTestId('action-bar-more')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    const rows = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1])
    fireEvent.keyDown(document, { key: 'End' })
    expect(document.activeElement).toBe(rows[rows.length - 1])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('action-bar-menu')).toBeNull()
    expect(document.activeElement).toBe(more)
  })

  it('a press outside closes the menu', () => {
    render(<div><ActionBar bar={bar()} surface="chat" /><p data-testid="outside">x</p></div>)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    act(() => { fireEvent.mouseDown(screen.getByTestId('outside')) })
    expect(screen.queryByTestId('action-bar-menu')).toBeNull()
  })

  it('the host’s controls are listed last, under their own label, and are the host’s to run', () => {
    const onSelect = vi.fn()
    render(<ActionBar bar={bar()} surface="reasoning" hostMenu={{ label: 'Model and workflow', items: [{ id: 'edit_brief', label: 'Edit brief', Icon: Pencil, onSelect }] }} />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    const rows = screen.getAllByRole('menuitem')
    expect(rows[rows.length - 1]).toHaveAttribute('data-testid', 'action-bar-menu-host-edit_brief')
    expect(within(screen.getByTestId('action-bar-menu-group-host')).getByText('Model and workflow')).toBeInTheDocument()
    fireEvent.click(rows[rows.length - 1]!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a bar with no menu rows of its own still opens the host’s controls', () => {
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, priority: [], more: [] })} surface="reasoning" compact={false} hostMenu={{ label: 'Model and workflow', items: [{ id: 'edit_brief', label: 'Edit brief', Icon: Pencil, onSelect: () => {} }] }} />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid'))).toEqual(['action-bar-menu-host-edit_brief'])
  })
})

/**
 * ⭐ BOUND TO THE WIRE: the bars CEE captured from its routes (see `actionBarContract.spec.ts` for their provenance and
 * digests). Every offer CEE sent has exactly ONE control, named as CEE named it, and a press sends CEE's own press id.
 */
describe('the bars CEE captured, drawn and pressed', () => {
  const captured = (name: string): ActionBarV1 =>
    parseActionBar(JSON.parse(readFileSync(join(__dirname, 'fixtures', `action-bar-v1-${name}.json`), 'utf8')))!

  it.each(['pre-run', 'withheld-run', 'licensed-run'])('%s', (name) => {
    const b = captured(name)
    render(<ActionBar bar={b} surface="chat" compact={false} />)
    const reason = (o: ActionBarV1['standard'][number]) => `${o.label} — ${o.enabled ? o.why_now : o.disabled_reason}`
    let sent = 0
    const pressed = (el: HTMLElement, o: ActionBarV1['standard'][number]) => {
      fireEvent.click(el)
      if (o.enabled) {
        sent += 1
        expect(dispatch).toHaveBeenLastCalledWith(chipOf(o, b.revision))
      } else {
        expect(el).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByTestId('action-bar-notice')).toHaveTextContent(`${o.label}: ${o.disabled_reason}`)
      }
      expect(dispatch).toHaveBeenCalledTimes(sent)
    }
    expect(screen.queryAllByTestId(/^action-bar-pill-[a-z_]+$/)).toHaveLength(b.priority.length)
    for (const o of b.priority) {
      const el = screen.getByTestId(`action-bar-pill-${o.action_id}-press`)
      expect(el).toHaveAccessibleName(reason(o))
      pressed(el, o)
    }
    expect(screen.queryAllByTestId(/^action-bar-icon-/).map((el) => el.getAttribute('data-testid'))).toEqual(b.standard.map((o) => `action-bar-icon-${o.action_id}`))
    for (const o of b.standard) {
      const el = screen.getByTestId(`action-bar-icon-${o.action_id}`)
      expect(el).toHaveAccessibleName(reason(o))
      pressed(el, o)
    }
    for (const o of b.more) {
      fireEvent.click(screen.getByTestId('action-bar-more'))
      const row = screen.getByTestId(`action-bar-menu-${o.action_id}`)
      expect(row).toHaveTextContent(`${o.label}${o.enabled ? o.why_now : o.disabled_reason}`)
      pressed(row, o)
    }
    expect(b.priority.length + b.standard.length + b.more.length, 'POSITIVE CONTROL: the capture holds offers').toBeGreaterThanOrEqual(5)
    expect(sent, 'POSITIVE CONTROL: at least one press was sent').toBeGreaterThanOrEqual(2)
  })

  it('before a Run, the three Run-dependent icons say what they need and the pre-mortem still runs', () => {
    const b = captured('pre-run')
    render(<ActionBar bar={b} surface="reasoning" compact={false} />)
    for (const id of ['review', 'what_changes', 'strengthen']) expect(screen.getByTestId(`action-bar-icon-${id}`)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByTestId('action-bar-icon-review'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent('Review: Needs a current analysis.')
    fireEvent.click(screen.getByTestId('action-bar-icon-pre_mortem'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-next-pre-mortem', parameters: { offer_key: b.standard[3]!.offer_key, revision: b.revision } }))
  })
})
