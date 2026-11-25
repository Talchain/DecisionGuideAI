import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { ChatFootRow } from '../ChatFootRow'
import { VIEW_NOTE_SLOT } from '../../../note'

afterEach(cleanup)

const proposalSource = { id: 'proposal', label: 'Olumi’s proposal', icon: 'olumi-mark' as const, count: 1, content: <section>Proposal</section> }

it('stays closed at rest with no ask, then opens a present source when asked', () => {
  const { getByTestId, rerender } = render(<ChatFootRow sources={[proposalSource]} ask={null} />)
  const chip = getByTestId('view-chat-foot-proposal')
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  expect(getByTestId('view-chat-pinned')).toHaveAttribute('hidden')
  rerender(<ChatFootRow sources={[proposalSource]} ask={{ source: proposalSource.id, n: 1 }} />)
  expect(chip).toHaveAttribute('aria-expanded', 'true')
})

it('opens the requested source when its content arrives after the ask', async () => {
  const ask = { source: proposalSource.id, n: 1 }
  const { getByTestId, queryByTestId, rerender } = render(<ChatFootRow sources={[{ ...proposalSource, content: null }]} ask={ask} />)
  expect(queryByTestId('view-chat-foot-proposal')).toBeNull()
  rerender(<ChatFootRow sources={[proposalSource]} ask={ask} />)
  await waitFor(() => expect(getByTestId('view-chat-foot-proposal')).toHaveAttribute('aria-expanded', 'true'))
})

it.each(['chip', 'Escape', 'outside press'])('stays closed after %s until the ask number changes', (dismiss) => {
  const { getByTestId, rerender } = render(<ChatFootRow sources={[proposalSource]} ask={{ source: proposalSource.id, n: 1 }} />)
  const chip = getByTestId('view-chat-foot-proposal')
  expect(chip).toHaveAttribute('aria-expanded', 'true')
  if (dismiss === 'chip') fireEvent.click(chip)
  else if (dismiss === 'Escape') fireEvent.keyDown(chip, { key: 'Escape' })
  else fireEvent.pointerDown(document.body)
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  rerender(<ChatFootRow sources={[proposalSource]} ask={{ source: proposalSource.id, n: 1 }} />)
  expect(chip).toHaveAttribute('aria-expanded', 'false')
  rerender(<ChatFootRow sources={[proposalSource]} ask={{ source: proposalSource.id, n: 2 }} />)
  expect(chip).toHaveAttribute('aria-expanded', 'true')
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
  await waitFor(() => expect(getByTestId('view-chat-foot-note')).toHaveAccessibleName('Olumi’s note · 1'))
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
  await waitFor(() => expect(getByTestId('view-chat-foot-asks')).toHaveAccessibleName('Olumi asks · 2'))
  fireEvent.click(getByTestId('view-chat-foot-asks'))
  rerender(<ChatFootRow sources={[{ ...source, content: null }]} />)
  await waitFor(() => expect(queryByTestId('view-chat-foot-row')).toBeNull())
  expect(getByTestId('view-chat-pinned')).toHaveAttribute('hidden')
})

it('shows only icons and counts in a horizontally scrolling row and keeps each accessible name', () => {
  const { getByTestId } = render(<ChatFootRow sources={[
    { id: 'proposal', label: 'Olumi’s proposal', icon: 'olumi-mark', count: 1, content: <section>Proposal</section> },
    { id: 'asks', label: 'Olumi asks', icon: 'ask-about-this', count: 2, content: <section>Questions</section> },
    { id: 'kept', label: 'Kept ideas', icon: 'idea-keep', count: 3, content: <section>Ideas</section> },
    { id: 'intake', label: 'What you said', icon: 'file-read', count: 12, content: <section>Intake</section> },
  ]} />)
  expect(getByTestId('view-chat-foot-row')).toHaveClass('overflow-x-auto')
  for (const [id, label, count] of [
    ['proposal', 'Olumi’s proposal', ''], ['asks', 'Olumi asks · 2', '2'], ['kept', 'Kept ideas · 3', '3'], ['intake', 'What you said · 12', '12'],
  ]) {
    const chip = getByTestId(`view-chat-foot-${id}`)
    expect(chip.textContent).toBe(count)
    expect(chip).toHaveAccessibleName(label)
    expect(chip.querySelector('span')).toBeVisible()
    expect(chip.querySelector('.sr-only')).toBeNull()
  }
  expect(getByTestId('view-chat-foot-proposal')).not.toHaveTextContent('· 1')
})

it('keeps the trailing control reachable when there are no chips', () => {
  const label = 'Go to the latest message'
  const { getByTestId, getByRole } = render(<ChatFootRow sources={[]} trailing={<button type="button" aria-label={label} />} />)
  const row = getByTestId('view-chat-foot-row')
  const latest = getByRole('button', { name: label })
  expect(row).toBeVisible()
  expect(row).toContainElement(getByTestId('view-chat-latest-row'))
  expect(getByTestId('view-chat-latest-row')).toContainElement(latest)
  latest.focus()
  expect(latest).toHaveFocus()
})
