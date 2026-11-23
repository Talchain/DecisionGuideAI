import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { openLaneForm } from '../structuralEdits'
import { BASE, install, SID, uninstall } from './harness'

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  install()
})

afterEach(() => {
  cleanup()
  useLaneInspector.setState({ current: null, drafts: {}, peek: null })
  uninstall()
  vi.unstubAllEnvs()
})

function mount() {
  render(
    <ToastProvider>
      <button type="button" onClick={(event) => openLaneForm(
        { kind: 'rename', sid: SID, base: BASE, record: 'starting_customers', current: 'Customers' },
        undefined, undefined, event.currentTarget,
      )}>Rename card</button>
      <LaneEditingLayer />
    </ToastProvider>,
  )
  const opener = screen.getByRole('button', { name: 'Rename card' })
  const open = () => {
    fireEvent.click(opener)
    return screen.getByRole('dialog', { name: 'Rename' })
  }
  return { opener, open }
}

describe('lane edit form focus', () => {
  it('focuses the first field on open', () => {
    const { open } = mount()
    expect(within(open()).getByRole('textbox')).toHaveFocus()
  })

  it('wraps Tab and Shift+Tab inside the form', () => {
    const { open } = mount()
    const dialog = within(open())
    const first = dialog.getByRole('textbox')
    const last = dialog.getByRole('button', { name: 'Cancel' })
    last.focus()
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false)
    expect(first).toHaveFocus()
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(last).toHaveFocus()
  })

  it('closes on Escape from the field', () => {
    const { open } = mount()
    const dialog = open()
    fireEvent.keyDown(within(dialog).getByRole('textbox'), { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
  })

  it('returns focus to the opener after Escape, Cancel and Save', async () => {
    const { opener, open } = mount()
    const escaped = open()
    fireEvent.keyDown(within(escaped).getByRole('textbox'), { key: 'Escape' })
    expect(opener).toHaveFocus()

    const cancelled = open()
    fireEvent.click(within(cancelled).getByRole('button', { name: 'Cancel' }))
    expect(cancelled).not.toBeInTheDocument()
    expect(opener).toHaveFocus()

    const saved = open()
    fireEvent.change(within(saved).getByRole('textbox'), { target: { value: 'Starting customers' } })
    fireEvent.click(within(saved).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saved).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })
})
