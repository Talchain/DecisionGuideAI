import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { ChatFootRow } from '../ChatFootRow'
import { useViewStore } from '../../../store'
import { VIEW_NOTE_SLOT } from '../../../note'

afterEach(() => {
  cleanup()
  useViewStore.setState({ explanationTarget: null, explanationReturn: null })
})

it('opens one source upward, closes on a second press, Escape or outside press, and returns focus', () => {
  const { getByTestId } = render(<ChatFootRow sources={[
    { id: 'proposal', label: 'Olumi’s proposal', icon: 'olumi-mark', count: 1, content: <section>Proposal</section> },
    { id: 'asks', label: 'Olumi asks', icon: 'ask-about-this', count: 2, content: <section><input aria-label="Draft answer" defaultValue="Keep my words" /></section> },
  ]} />)
  const box = getByTestId('view-chat-pinned'), row = getByTestId('view-chat-foot-row')
  const proposal = getByTestId('view-chat-foot-proposal'), asks = getByTestId('view-chat-foot-asks')
  expect(box).toHaveAttribute('hidden')
  expect(box.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(box).toHaveClass('ok-pinned', 'overflow-y-auto')
  fireEvent.click(asks)
  expect(asks).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(proposal)
  expect(asks).toHaveAttribute('aria-expanded', 'false')
  expect(box.querySelector('[data-foot-source="asks"]')).toHaveAttribute('hidden')
  expect(box.querySelector('[data-foot-source="proposal"]')).not.toHaveAttribute('hidden')
  fireEvent.click(proposal)
  expect(box).toHaveAttribute('hidden')
  expect(proposal).toHaveFocus()
  fireEvent.click(asks)
  expect(box.querySelector('input')).toHaveValue('Keep my words')
  fireEvent.keyDown(box.querySelector('input')!, { key: 'Escape' })
  expect(box).toHaveAttribute('hidden')
  expect(asks).toHaveFocus()
  fireEvent.click(proposal)
  fireEvent.pointerDown(document.body)
  expect(box).toHaveAttribute('hidden')
  expect(proposal).toHaveFocus()
})

it('keeps the note slot mounted while closed, shows its chip on portal arrival, and opens that same slot', async () => {
  const { container, queryByTestId, getByTestId } = render(<ChatFootRow sources={[]} />)
  expect(queryByTestId('view-chat-foot-row')).toBeNull()
  const slot = container.querySelector<HTMLElement>(`[${VIEW_NOTE_SLOT}]`)!
  expect(slot).toBeInTheDocument()
  expect(slot).toHaveAttribute('hidden')
  const portal = render(createPortal(<section>The existing note</section>, slot))
  await waitFor(() => expect(getByTestId('view-chat-foot-note')).toHaveTextContent('Olumi’s note · 1'))
  expect(slot).not.toBeVisible()
  fireEvent.click(getByTestId('view-chat-foot-note'))
  expect(container.querySelector(`[${VIEW_NOTE_SLOT}]`)).toBe(slot)
  expect(slot).toBeVisible()
  expect(portal.getByText('The existing note')).toBeVisible()
  fireEvent.click(getByTestId('view-chat-foot-note'))
  expect(slot).not.toBeVisible()
  expect(slot).toHaveTextContent('The existing note')
  fireEvent.click(getByTestId('view-chat-foot-note'))
  portal.unmount()
  await waitFor(() => expect(queryByTestId('view-chat-foot-row')).toBeNull())
  expect(getByTestId('view-chat-pinned')).toHaveAttribute('hidden')
  expect(container.querySelector(`[${VIEW_NOTE_SLOT}]`)).toBe(slot)
})

it('draws no empty chips or row and follows a source removing itself', async () => {
  const source = { id: 'asks', label: 'Olumi asks', icon: 'ask-about-this' as const, count: 2, content: <section>Questions</section> }
  const { queryByTestId, getByTestId, rerender } = render(<ChatFootRow sources={[]} />)
  expect(queryByTestId('view-chat-foot-row')).toBeNull()
  rerender(<ChatFootRow sources={[source]} />)
  await waitFor(() => expect(getByTestId('view-chat-foot-asks')).toHaveTextContent('2'))
  fireEvent.click(getByTestId('view-chat-foot-asks'))
  rerender(<ChatFootRow sources={[{ ...source, content: null }]} />)
  await waitFor(() => expect(queryByTestId('view-chat-foot-row')).toBeNull())
  expect(getByTestId('view-chat-pinned')).toHaveAttribute('hidden')
})

it('shows readable labels and counts beside the icons in a horizontally scrolling row', () => {
  const { getByTestId } = render(<ChatFootRow sources={[
    { id: 'proposal', label: 'Olumi’s proposal', icon: 'olumi-mark', count: 1, content: <section>Proposal</section> },
    { id: 'asks', label: 'Olumi asks', icon: 'ask-about-this', count: 2, content: <section>Questions</section> },
    { id: 'kept', label: 'Kept ideas', icon: 'idea-keep', count: 3, content: <section>Ideas</section> },
    { id: 'intake', label: 'What you said', icon: 'file-read', count: 12, content: <section>Intake</section> },
  ]} />)
  expect(getByTestId('view-chat-foot-row')).toHaveClass('overflow-x-auto')
  for (const [id, label] of [
    ['proposal', 'Olumi’s proposal'], ['asks', 'Olumi asks · 2'], ['kept', 'Kept ideas · 3'], ['intake', 'What you said · 12'],
  ]) {
    const chip = getByTestId(`view-chat-foot-${id}`)
    expect(chip).toHaveTextContent(label)
    expect(chip).toHaveAccessibleName(label)
    expect(chip.querySelector('span')).toBeVisible()
    expect(chip.querySelector('.sr-only')).toBeNull()
  }
  expect(getByTestId('view-chat-foot-proposal')).not.toHaveTextContent('· 1')
})

const records = [
  { id: 'churn', title: 'Monthly churn', passages: [
    { id: 'assumption', title: 'Assumption', content: <p>Churn remains under two percent.</p> },
    { id: 'evidence', title: 'Evidence', content: <p>April renewal data</p> },
  ] },
  { id: 'budget', title: 'Budget', passages: [{ id: 'assumption', title: 'Assumption', content: <p>Budget reasoning</p> }] },
]

it('opens the selected record and keeps other records folded, or starts at the index without a selection', () => {
  const { getByTestId, getByText, queryByText, rerender } = render(<ChatFootRow sources={[]} explanations={{ scope: 'scenario/version/1', selected: 'churn', records }} />)
  const chip = getByTestId('view-chat-foot-explanations')
  fireEvent.click(chip)
  expect(getByText('April renewal data')).toBeVisible()
  expect(queryByText('Budget reasoning')).toBeNull()
  fireEvent.keyDown(getByTestId('model-explanations'), { key: 'Escape' })
  expect(chip).toHaveFocus()
  rerender(<ChatFootRow sources={[]} explanations={{ scope: 'scenario/version/1', selected: null, records }} />)
  fireEvent.click(chip)
  expect(getByText('Monthly churn')).toBeVisible()
  expect(queryByText('April renewal data')).toBeNull()
})

it('opens only the exact passage, rejects a different version and restores the triggering control on Escape', () => {
  const scope = 'scenario/version/1'
  const { getByTestId, getByText, queryByText, queryByTestId, rerender } = render(<ChatFootRow sources={[]} explanations={{ scope, selected: 'budget', records }} />)
  const link = { scope, record: 'churn', passage: 'evidence', origin: 'results', trigger: 'exact-trigger' } as const
  act(() => useViewStore.setState({ explanationTarget: link }))
  expect(getByText('April renewal data')).toBeVisible()
  expect(getByText('Evidence').closest('h4')).toHaveFocus()
  expect(queryByText('Churn remains under two percent.')).toBeNull()
  expect(queryByText('Budget reasoning')).toBeNull()
  fireEvent.keyDown(getByTestId('model-explanations'), { key: 'Escape' })
  expect(useViewStore.getState().explanationReturn).toBe(link.trigger)
  act(() => useViewStore.setState({ explanationTarget: link }))
  rerender(<ChatFootRow sources={[]} explanations={{ scope: 'scenario/version/2', selected: 'churn', records }} />)
  expect(queryByTestId('model-explanations')).toBeNull()
  expect(useViewStore.getState().explanationTarget).toBeNull()
})
