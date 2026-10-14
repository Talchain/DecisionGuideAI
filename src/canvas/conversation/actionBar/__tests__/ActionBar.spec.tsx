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
import { ACTION_BAR_COPY, ACTION_BAR_SLOTS, ActionBar } from '../ActionBar'
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

const MORE_RISKS = { ...MORE_OPTIONS, action_id: 'more_risks', label: 'More risks', offer_key: 'abababababababab' }
const FRAME_BRIEF = { ...MORE_OPTIONS, action_id: 'frame_brief', label: 'Frame brief', offer_key: 'acacacacacacacac' }
/** The row's controls, in DOM order, by test id (⋯ included). */
const rowOrder = () =>
  Array.from((screen.getByTestId('action-bar').firstElementChild as HTMLElement).querySelectorAll('button')).map((el) => el.getAttribute('data-testid'))

beforeEach(() => {
  dispatch = vi.fn()
  resetPressOfferClocks()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _isConversationBusy: () => false } as never)
  useActionBarStore.setState({ dismissed: [] })
})

describe('what is drawn', () => {
  // ⛔ EXPECTATION CHANGED (Paul, 14 Oct: six icon slots, '…' on the right): old = two pills + CEE's four standards
  // (narrow: one pill + three); new = six slots in both layouts, priority → enabled standard → bias → top of More →
  // disabled standard, and everything else in the menu.
  it.each([false, true])('SIX SLOTS (compact=%s): 2 priority + 4 standard + 3 more fill exactly six, in order; the rest are in the menu', (compact) => {
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [TEST_LINK, MORE_RISKS, FRAME_BRIEF] })} surface="chat" compact={compact} />)
    expect(screen.getByTestId('action-bar')).toHaveAttribute('data-compact', String(compact))
    expect(ACTION_BAR_SLOTS).toBe(6)
    expect(rowOrder()).toEqual([
      'action-bar-pill-set_target-press', 'action-bar-pill-more_options-press',
      'action-bar-icon-review', 'action-bar-icon-strengthen', 'action-bar-icon-pre_mortem', // enabled standards, CEE's order
      'action-bar-icon-test_link', // top of More, by CEE's rank
      'action-bar-more',
    ])
    // ⛔ The DISABLED standard sinks below the enabled More offer: it is in the menu, not the row. Nothing is lost.
    expect(screen.queryByTestId('action-bar-icon-what_changes')).toBeNull()
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')).sort())
      .toEqual(['action-bar-menu-frame_brief', 'action-bar-menu-more_risks', 'action-bar-menu-what_changes'])
  })

  it('⛔ CONTRAST: with room left after the enabled offers, the disabled standard takes the last slot', () => {
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [] })} surface="chat" compact={false} />)
    expect(rowOrder()).toEqual([
      'action-bar-pill-set_target-press', 'action-bar-pill-more_options-press',
      'action-bar-icon-review', 'action-bar-icon-strengthen', 'action-bar-icon-pre_mortem', 'action-bar-icon-what_changes',
    ])
    expect(screen.queryByTestId('action-bar-more')).toBeNull()
  })

  it('every control is named by its label and the reason it is offered (or what stops it)', () => {
    // ⛔ INPUT CHANGE (six slots, 14 Oct): no More offers, so the disabled standard is in the row.
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [] })} surface="chat" />)
    expect(screen.getByTestId('action-bar-icon-review')).toHaveAccessibleName('Review — Check what to confirm before relying on this analysis.')
    expect(screen.getByTestId('action-bar-icon-what_changes')).toHaveAccessibleName('What changes — Run the analysis first: there is no result to test yet.')
    expect(screen.getByTestId('action-bar-pill-set_target-press')).toHaveAccessibleName('Set target — The goal has no target, so no chance can be worked out.')
    // ⛔ EXPECTATION CHANGED (Paul, 14 Oct: "just icons there, no words"): old visible label 'Set target' → new icon only;
    // its name stays its aria-label (above) and tooltip.
    expect(screen.getByTestId('action-bar-pill-set_target-press')).toHaveTextContent('')
    expect(screen.getByTestId('action-bar-pill-set_target')).toHaveTextContent('')
  })

  it('the menu groups its rows, and each row says why it is offered (or what stops it)', () => {
    // ⛔ INPUT CHANGE (six slots, 14 Oct): the menu holds what the six slots leave, so More carries enough to overflow.
    const TEST_LINK_2 = { ...TEST_LINK, action_id: 'test_link_two', label: 'Test link two', offer_key: 'cdcdcdcdcdcdcdcd' }
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [TEST_LINK, MORE_RISKS, TEST_LINK_2] })} surface="chat" compact />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(within(screen.getByTestId('action-bar-menu-group-gap')).getByText(ACTION_BAR_COPY.groups.gap)).toBeInTheDocument()
    expect(within(screen.getByTestId('action-bar-menu-group-gap')).getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-menu-more_risks'])
    expect(within(screen.getByTestId('action-bar-menu-group-method')).getAllByRole('menuitem').map((el) => el.getAttribute('data-testid')))
      .toEqual(['action-bar-menu-what_changes', 'action-bar-menu-test_link_two'])
    expect(screen.queryByTestId('action-bar-menu-group-review')).toBeNull()
    expect(screen.getByTestId('action-bar-menu-test_link_two')).toHaveTextContent('Test link twoThis link moves the result the most.')
    expect(screen.getByTestId('action-bar-menu-what_changes')).toHaveTextContent('What changesRun the analysis first: there is no result to test yet.')
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

  it('renders the bound check row only when the bar carries one', () => {
    const withRow = bar({
      ...EXAMPLE_BAR,
      bias_risk: { v: 1, items: [{ claim_id: 'DSK-B-007', name: 'Narrow framing', why: 'These options can hide better routes.', action_id: MORE_OPTIONS.action_id, press_id: MORE_OPTIONS.press_id, offer_key: MORE_OPTIONS.offer_key }] },
    })
    const { unmount } = render(<ActionBar bar={withRow} surface="chat" />)
    expect(screen.getByTestId('bias-risk-row')).toBeInTheDocument()
    unmount()
    render(<ActionBar bar={bar()} surface="reasoning" />)
    expect(screen.queryByTestId('bias-risk-row')).toBeNull()
  })

  it('the host chooses the type tokens and nothing else: body-size labels on both (the Reasoning tab passes its own)', () => {
    // ⛔ INPUT CHANGE (icons only, 14 Oct): the only words left are the ⋯ menu's rows, so the token is read there
    // (six slots: the disabled standard is the example bar's one menu row).
    const label = () => screen.getByTestId('action-bar-menu-what_changes').querySelector('span > span')!
    const { unmount } = render(<ActionBar bar={bar()} surface="chat" />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(label().className).toContain('text-[13px]')
    unmount()
    render(<ActionBar bar={bar()} surface="reasoning" typeScale={REASONING_TYPE} />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    expect(label().className).toContain('text-xs')
  })

  it('ICONS ONLY, evenly spaced (Paul, 14 Oct): no visible word outside the ⋯ menu, one gap between every control', () => {
    render(<ActionBar bar={bar()} surface="chat" compact={false} />)
    const row = screen.getByTestId('action-bar').firstElementChild as HTMLElement
    expect(row.className).toContain('gap-3')
    // Every control in the row is named for a screen reader, and none shows a word.
    for (const control of Array.from(row.querySelectorAll('button'))) {
      expect(control.textContent).toBe('')
      expect(control.getAttribute('aria-label') ?? '').not.toBe('')
    }
    // ⛔ EXPECTATION CHANGED (Paul, 14 Oct: '…' pinned to the far right): old = ⋯ spaced like the rest (no ml-auto);
    // new = ⋯ is the row's last control, pushed to the right edge.
    expect((screen.getByTestId('action-bar-more').parentElement as HTMLElement).className).toContain('ml-auto')
    expect(rowOrder().at(-1)).toBe('action-bar-more')
    // ⛔ CONTRAST: the icons themselves are not pushed apart.
    expect(screen.getByTestId('action-bar-icon-review').className).not.toContain('ml-auto')
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
    // ⛔ INPUT CHANGE (six slots, 14 Oct): More's first offer takes the last slot, so Test link is ranked second.
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [MORE_RISKS, TEST_LINK] })} surface="chat" />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    fireEvent.click(screen.getByTestId('action-bar-menu-test_link'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chipOf(TEST_LINK))
    expect(screen.queryByTestId('action-bar-menu')).toBeNull()
  })

  it('⛔ a DISABLED offer sends nothing and says what stops it; ⛔ CONTRAST: its enabled neighbour sends', () => {
    // ⛔ INPUT CHANGE (six slots, 14 Oct): no More offers, so the disabled standard is in the row.
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [] })} surface="chat" compact={false} />)
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

describe('the priority action (Paul, 14 Oct: icon-only, no hide control)', () => {
  // ⛔ EXPECTATION CHANGED (Paul, 14 Oct): old = an icon in a ring with a × "Hide ‘Set target’ for now" button;
  // new = the same icon button as every other control, and no hide button (`ACTION_BAR_COPY.hide` removed).
  it('is one icon button like the rest: no visible label, its label is its aria-label, and there is no hide button', () => {
    render(<ActionBar bar={bar()} surface="chat" compact={false} />)
    const pill = screen.getByTestId('action-bar-pill-set_target')
    const press = screen.getByTestId('action-bar-pill-set_target-press')
    expect(within(pill).getAllByRole('button')).toEqual([press])
    expect(press).toHaveAttribute('aria-label', 'Set target — The goal has no target, so no chance can be worked out.')
    expect(press.textContent).toBe('')
    expect(pill.textContent).toBe('')
    expect(screen.queryByText(/Set target/)).toBeNull()
    expect(press.className).toBe(screen.getByTestId('action-bar-icon-review').className) // drawn as its neighbours are
    expect(screen.queryByTestId('action-bar-pill-set_target-hide')).toBeNull()
    expect(screen.queryAllByRole('button', { name: /^Hide\b/ })).toHaveLength(0)
    expect(ACTION_BAR_COPY).not.toHaveProperty('hide')
    // ⛔ CONTRAST: the press itself still sends its own chip.
    fireEvent.click(press)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chipOf(SET_TARGET))
  })

  it('an offer key already held as hidden leaves the pills but stays in the menu, so nothing is lost', () => {
    // ⛔ INPUT CHANGE: the key is seeded in the store (the hide button that wrote it is gone).
    useActionBarStore.setState({ dismissed: [SET_TARGET.offer_key] })
    render(<ActionBar bar={bar()} surface="chat" />)
    expect(screen.queryByTestId('action-bar-pill-set_target')).toBeNull()
    expect(screen.getByTestId('action-bar-pill-more_options')).toBeInTheDocument()
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
    // ⛔ INPUT CHANGE (six slots, 14 Oct): two More offers, so the menu has more than one row to rove.
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, more: [TEST_LINK, MORE_RISKS] })} surface="chat" compact />)
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
    render(<ActionBar bar={bar()} surface="reasoning" hostMenu={[{ id: 'workflow', label: 'Model and workflow', items: [{ id: 'edit_brief', label: 'Edit brief', Icon: Pencil, onSelect }] }]} />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    const rows = screen.getAllByRole('menuitem')
    expect(rows[rows.length - 1]).toHaveAttribute('data-testid', 'action-bar-menu-host-edit_brief')
    expect(within(screen.getByTestId('action-bar-menu-group-host-workflow')).getByText('Model and workflow')).toBeInTheDocument()
    fireEvent.click(rows[rows.length - 1]!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a bar with no menu rows of its own still opens the host’s controls', () => {
    render(<ActionBar bar={bar({ ...EXAMPLE_BAR, priority: [], more: [] })} surface="reasoning" compact={false} hostMenu={[{ id: 'workflow', label: 'Model and workflow', items: [{ id: 'edit_brief', label: 'Edit brief', Icon: Pencil, onSelect: () => {} }] }]} />)
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
    // ⛔ EXPECTATION CHANGED (six slots, 14 Oct): old = every priority a pill and every standard an icon; new = each
    // offer is in the row OR the menu, exactly once, and the row holds six slots (bias icons included).
    const rowControl = (o: ActionBarV1['standard'][number]) =>
      screen.queryByTestId(`action-bar-pill-${o.action_id}-press`) ?? screen.queryByTestId(`action-bar-icon-${o.action_id}`)
    const all = [...b.priority, ...b.standard, ...b.more]
    const biasCount = b.bias_risk?.items.length ?? 0
    expect(rowOrder().filter((id) => id !== 'action-bar-more')).toHaveLength(Math.min(ACTION_BAR_SLOTS, all.length + biasCount))
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
    let inRow = 0
    for (const o of all) {
      const el = rowControl(o)
      if (el) {
        inRow += 1
        expect(el).toHaveAccessibleName(reason(o))
        fireEvent.click(screen.getByTestId('action-bar-more'))
        expect(screen.queryByTestId(`action-bar-menu-${o.action_id}`), `${o.action_id} is drawn once`).toBeNull()
        fireEvent.click(screen.getByTestId('action-bar-more'))
        pressed(el, o)
        continue
      }
      fireEvent.click(screen.getByTestId('action-bar-more'))
      const row = screen.getByTestId(`action-bar-menu-${o.action_id}`)
      expect(row).toHaveTextContent(`${o.label}${o.enabled ? o.why_now : o.disabled_reason}`)
      pressed(row, o)
    }
    expect(inRow, 'POSITIVE CONTROL: offers are drawn in the row').toBeGreaterThanOrEqual(3)
    expect(b.priority.length + b.standard.length + b.more.length, 'POSITIVE CONTROL: the capture holds offers').toBeGreaterThanOrEqual(5)
    expect(sent, 'POSITIVE CONTROL: at least one press was sent').toBeGreaterThanOrEqual(2)
  })

  // ⛔ EXPECTATION CHANGED (six slots, 14 Oct): old = the three disabled standards were row icons; new = they sink below
  // CEE's enabled More offers into the menu, still saying what they need.
  it('before a Run, the row is the priority, the pre-mortem and the top of More; the three Run-dependent actions are in the menu and say what they need', () => {
    const b = captured('pre-run')
    render(<ActionBar bar={b} surface="reasoning" compact={false} />)
    expect(rowOrder()).toEqual([
      'action-bar-pill-set_goal-press', 'action-bar-icon-pre_mortem',
      'action-bar-icon-more_risks', 'action-bar-icon-more_options', 'action-bar-icon-frame_brief', 'action-bar-icon-bias_check',
      'action-bar-more',
    ])
    fireEvent.click(screen.getByTestId('action-bar-more'))
    for (const id of ['review', 'what_changes', 'strengthen']) expect(screen.getByTestId(`action-bar-menu-${id}`)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByTestId('action-bar-menu-review'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent('Review: Needs a current analysis.')
    fireEvent.click(screen.getByTestId('action-bar-icon-pre_mortem'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-next-pre-mortem', parameters: { offer_key: b.standard[3]!.offer_key, revision: b.revision } }))
  })
})

describe('several host groups', () => {
  it('each group keeps its own label, in the host’s order, after CEE’s rows; an empty group is not drawn', () => {
    const noop = () => {}
    render(<ActionBar bar={bar()} surface="reasoning" compact={false} hostMenu={[
      { id: 'methods', label: 'Reasoning methods', items: [{ id: 'reframe_problem', label: 'Reframe the problem', Icon: Pencil, onSelect: noop }] },
      { id: 'empty', label: 'Nothing here', items: [] },
      { id: 'workflow', label: 'Model and workflow', items: [{ id: 'edit_brief', label: 'Edit brief', Icon: Pencil, onSelect: noop }] },
    ]} />)
    fireEvent.click(screen.getByTestId('action-bar-more'))
    const rows = screen.getAllByRole('menuitem').map((el) => el.getAttribute('data-testid'))
    expect(rows.slice(-2)).toEqual(['action-bar-menu-host-reframe_problem', 'action-bar-menu-host-edit_brief'])
    expect(within(screen.getByTestId('action-bar-menu-group-host-methods')).getByText('Reasoning methods')).toBeInTheDocument()
    expect(screen.queryByTestId('action-bar-menu-group-host-empty')).toBeNull()
  })
})
