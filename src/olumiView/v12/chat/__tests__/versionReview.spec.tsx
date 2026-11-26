import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { REVIEW_LABEL, ViewChat } from '../../../ViewChat'
import * as proposalAsk from '../proposalAsk'

const saved: View = JSON.parse(readFileSync('src/olumiView/golden/capacity-v3.view.json', 'utf8'))
const pending: View = JSON.parse(readFileSync('src/olumiView/golden/proposal.view.json', 'utf8'))
const first = saved.chat[0]!
const version = saved.version!
const changes = [
  { id: 'goal', top: true, text: 'Set the capacity goal.', detail: 'The threshold is per week, as stated in the brief.', family: 'aim', olumi: null },
  { id: 'demand', top: false, text: 'Add weekend demand.', detail: '', family: 'quantity', olumi: { glyph: '✦', title: 'Olumi estimated demand' } },
  { id: 'staff', top: false, text: 'Add the staffing constraint.', detail: '', family: 'limit', olumi: null },
]
const review = { changes, groups: null, turn: first.id }
const reviewed = (served: unknown = review, id = version.id) => ({ ...version, id, review: served as NonNullable<View['version']>['review'] })
const withReview = { ...saved, proposal: null, version: reviewed() }

function show(view: View = withReview) {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<ViewChat />)
}

function openList() {
  fireEvent.click(screen.getByTestId('view-chat-foot-version'))
  fireEvent.click(screen.getByTestId('view-version-review-toggle'))
  return screen.getByTestId('view-changes')
}

afterEach(() => {
  cleanup()
  proposalAsk.useProposalAsk.setState(proposalAsk.useProposalAsk.getInitialState())
  const ask = proposalAsk.useVersionAsk
  ask?.setState(ask.getInitialState())
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useUIStore.setState(useUIStore.getInitialState())
})

it('opens the saved version foot source and reads Core’s lines in order, with their detail and Olumi mark', () => {
  show()
  const foot = screen.getByTestId('view-chat-foot-version')
  const row = screen.getByTestId('view-version-review')
  expect(foot).toHaveAccessibleName(version.label)
  expect(foot.textContent).toBe('')
  expect(foot).toHaveAttribute('aria-expanded', 'false')
  expect(row).toHaveAttribute('data-open', 'false')
  expect(row.querySelector('[data-view="version.label"]')?.textContent).toBe(version.label)
  expect(screen.queryByTestId('view-changes')).toBeNull()

  fireEvent.click(foot)
  expect(foot).toHaveAttribute('aria-expanded', 'true')
  const toggle = within(row).getByTestId('view-version-review-toggle')
  expect(toggle).toHaveAccessibleName(REVIEW_LABEL)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(toggle)
  expect(row).toHaveAttribute('data-open', 'true')
  const list = within(row).getByTestId('view-changes')
  const lines = [...list.children]
  expect(lines).toHaveLength(changes.length)
  changes.forEach(({ text }, i) => {
    expect(lines[i]?.querySelector(`[data-view="version.review.changes.${i}.text"]`)?.textContent).toBe(text)
  })
  const detail = lines[0]!.querySelector('details')!
  const summary = detail.querySelector('summary')!
  const paragraph = detail.querySelector('[data-view="version.review.changes.0.detail"]')!
  expect(summary.textContent).toBe(changes[0]!.text)
  expect(summary.nextElementSibling).toBe(paragraph)
  expect(paragraph.textContent).toBe(changes[0]!.detail)
  expect(detail).not.toHaveAttribute('open')
  const mark = lines[1]!.querySelector('[data-view="version.review.changes.1.olumi.glyph"]')
  expect(mark?.textContent).toBe(changes[1]!.olumi!.glyph)
  expect(mark).toHaveAttribute('aria-label', changes[1]!.olumi!.title)
  expect(list.querySelectorAll('[data-view$=".olumi.glyph"]')).toHaveLength(1)
})

it('reads the saved list without any proposal or approval controls', () => {
  show()
  const list = openList()
  expect(list).toBeVisible()
  for (const id of ['view-approve', 'view-approve-ticked', 'view-set-aside', 'view-review-changes', 'view-next-step']) {
    expect(screen.queryByTestId(id)).toBeNull()
  }
  expect(list.querySelector('input[type="checkbox"]')).toBeNull()
  expect(document.querySelector('[data-testid^="view-change-tick-"], [data-testid^="view-change-group-"]')).toBeNull()
  expect(screen.getByTestId('view-version-review').querySelector('[data-testid="check-first"]')).toBeNull()
})

it('opens the list from the matching answered turn and ignores a stale chip or an absent turn', () => {
  useUIStore.setState({ activeOutputTab: 'results' })
  const view = { ...withReview, chat: [first, { ...first, id: first.id + 1 }] }
  const { container, unmount } = show(view)
  const chip = screen.getByTestId('view-chat-reply-review')
  expect(chip).toHaveAccessibleName(REVIEW_LABEL)
  expect(chip.closest('[data-view-turn]')).toHaveAttribute('data-view-turn', 'chat.0')
  expect(chip.previousElementSibling).toBe(container.querySelector('[data-view-turn="chat.0"] [data-testid="view-chat-answer"]'))
  fireEvent.click(chip)
  expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  expect(screen.getByTestId('view-chat-foot-version')).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId('view-changes')).toBeVisible()
  expect(proposalAsk.useVersionAsk.getState().id).toBeNull()

  unmount()
  useViewStore.setState({ view })
  expect(proposalAsk.askVersionReview(version.id)).toBe(true)
  show(view)
  expect(screen.getByTestId('view-changes')).toBeVisible()
  expect(proposalAsk.useVersionAsk.getState().id).toBeNull()

  act(() => useViewStore.setState({ view: { ...view, version: reviewed({ changes, groups: null }) } }))
  expect(screen.queryByTestId('view-chat-reply-review')).toBeNull()
  expect(screen.getByTestId('view-chat-foot-version')).toBeVisible()
  act(() => useViewStore.setState({ view: { ...view, chat: [{ ...first, answer: null }, view.chat[1]!] } }))
  expect(screen.queryByTestId('view-chat-reply-review')).toBeNull()

  const newer = { ...reviewed({ ...review, changes: [...changes].reverse() }, version.id + 1), label: 'version 2' }
  for (const replacement of [{ ...view, version: newer }, { ...view, proposal: pending.proposal }]) {
    act(() => {
      useViewStore.setState({ view })
      useUIStore.setState({ activeOutputTab: 'results' })
    })
    const staleChip = screen.getByTestId('view-chat-reply-review')
    const versionAsk = proposalAsk.useVersionAsk.getState()
    const heldAsk = proposalAsk.useProposalAsk.getState()
    const ui = useUIStore.getState()
    act(() => {
      useViewStore.setState({ view: replacement })
      expect(screen.getByTestId('view-chat-reply-review')).toBe(staleChip)
      staleChip.click()
      expect(proposalAsk.useVersionAsk.getState()).toBe(versionAsk)
      expect(proposalAsk.useProposalAsk.getState()).toBe(heldAsk)
      expect(useUIStore.getState()).toBe(ui)
    })
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(screen.queryByTestId('view-changes')).toBeNull()
    if (replacement.proposal === null) {
      expect(screen.getByTestId('view-chat-foot-version')).toHaveAccessibleName(newer.label)
      expect(screen.getByTestId('view-version-review')).toHaveAttribute('data-open', 'false')
    }
  }
})

it('gives a pending proposal the only review chip, row and controls', async () => {
  const proposal = pending.proposal!
  const proposalTurn = pending.chat.find((turn) => turn.id === proposal.id)!
  const view = { ...withReview, chat: [first, proposalTurn] }
  show(view)
  expect(screen.getByTestId('view-chat-foot-version')).toBeInTheDocument()
  expect(screen.getByTestId('view-chat-reply-review').closest('[data-view-turn]')).toHaveAttribute('data-view-turn', 'chat.0')

  act(() => useViewStore.setState({ view: { ...view, proposal } }))
  await waitFor(() => expect(screen.getByTestId('view-chat-foot-proposal')).toBeInTheDocument())
  expect(screen.queryByTestId('view-chat-foot-version')).toBeNull()
  expect(screen.queryByTestId('view-version-review')).toBeNull()
  const chip = screen.getByTestId('view-chat-reply-review')
  expect(chip.closest('[data-view-turn]')).toHaveAttribute('data-view-turn', 'chat.1')
  fireEvent.click(chip)
  await waitFor(() => expect(screen.getByTestId('view-chat-foot-proposal')).toHaveAttribute('aria-expanded', 'true'))
  expect(screen.getByTestId('view-proposal-row')).toBeVisible()
  expect(screen.getByTestId('view-changes')).toBeVisible()
  for (const id of ['view-approve', 'view-approve-ticked', 'view-set-aside', 'view-change-tick-0']) {
    expect(screen.getByTestId(id)).toBeVisible()
  }
})

it('omits the saved review for absent, null, empty, and v2-shaped versions', () => {
  show()
  expect(screen.getByTestId('view-chat-foot-version')).toBeInTheDocument()
  const unsupported = [
    { ...saved, version },
    { ...saved, version: reviewed(null) },
    { ...saved, version: reviewed({ ...review, changes: [] }) },
    { ...saved, version: reviewed({ ...review, changes: {} }) },
    { ...saved, version: null },
    { ...saved, schema: 'olumi.view/2', version },
    { ...saved, schema: 'olumi.view/2', version: reviewed() },
  ]
  for (const view of unsupported) {
    act(() => useViewStore.setState({ view: view as View }))
    expect(screen.queryByTestId('view-chat-foot-version')).toBeNull()
    expect(screen.queryByTestId('view-version-review')).toBeNull()
    expect(screen.queryByTestId('view-chat-reply-review')).toBeNull()
  }
})

it('folds over twelve saved changes under Core’s headings in their served order without checkboxes', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ ...changes[2]!, id: `staff-${i}`, text: `Add staffing constraint ${i}.` }))
  const groups = [
    { heading: 'Staffing on weekdays', lines: [6, 0, 3, 1, 5, 2, 4] },
    { heading: 'Staffing at weekends', lines: [7, 8, 9, 10, 11, 12] },
  ]
  show({ ...saved, proposal: null, version: reviewed({ changes: many, groups }) })
  expect(screen.queryByTestId('view-chat-reply-review')).toBeNull()
  const list = openList()
  const folds = [...list.querySelectorAll('details')]
  expect(folds).toHaveLength(groups.length)
  groups.forEach(({ heading, lines }, i) => {
    const fold = folds[i]!
    expect(fold).not.toHaveAttribute('open')
    expect(fold.querySelector(`summary[data-view="version.review.groups.${i}.heading"]`)?.textContent).toBe(heading)
    expect([...fold.querySelectorAll('[data-change]')].map((line) => line.textContent)).toEqual(lines.map((j) => many[j]!.text))
  })
  expect(list.querySelector('input[type="checkbox"]')).toBeNull()
  expect(list.querySelector('[data-testid^="view-change-tick-"], [data-testid^="view-change-group-"]')).toBeNull()
})

it('names the open saved list by Core\'s version label', () => {
  show()
  const list = openList()
  expect(list).toHaveAccessibleName(version.label)
  const label = document.getElementById(list.getAttribute('aria-labelledby') ?? '')
  expect(label).toHaveAttribute('data-view', 'version.label')
})

it('clears a saved-version request that the shown version can no longer serve, and does not replay it', async () => {
  const { container } = show(withReview)
  const newer = reviewed(review, version.id + 1)
  act(() => {
    expect(proposalAsk.askVersionReview(version.id)).toBe(true)
    useViewStore.setState({ view: { ...withReview, version: newer } })
  })
  expect(proposalAsk.useVersionAsk.getState().id).toBeNull()
  expect(screen.queryByTestId('view-changes')).toBeNull()

  act(() => useViewStore.setState({ view: withReview }))
  await waitFor(() => expect(screen.getByTestId('view-chat-foot-version')).toBeInTheDocument())
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  expect(proposalAsk.useVersionAsk.getState().id).toBeNull()
  expect(screen.queryByTestId('view-changes')).toBeNull()
  expect(container.querySelector('[data-testid="view-version-review"][data-open="true"]')).toBeNull()
})
