/**
 * Wave 1 + parity O — consolidated Actions menu (brief §4.7): ONE stable
 * catalogue of science-grounded methods + global utilities, persistent,
 * keyboard-complete with focus restore. Every coaching ask (methods, Edit
 * decision brief, Review all inputs) opens the Ask-Olumi drawer with a
 * prefilled EDITABLE draft — never an invisible auto-send. Rerun stays a
 * direct canonical run with honest outcome toasts (only the awaited V2 path
 * claims completion).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ActionsMenu } from '../ActionsMenu'
import { METHOD_CATALOGUE, GLOBAL_ACTIONS, REVIEW_BRIEF_ASK, RERUN_TOASTS } from '../actionsCatalogue'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
  type CanonicalRunOptions,
} from '../../../../canvas/analysis/canonicalRunRegistry'

beforeEach(() => {
  __resetCanonicalRunnerForTests()
  useAskOlumiStore.setState({
    isOpen: false,
    context: '',
    draft: '',
    label: '',
    targetId: null,
    parameters: undefined,
    source: 'chip',
  })
})

describe('Actions catalogue (brief §4.7 — one recognisable set)', () => {
  it('carries the seven methods and three global actions', () => {
    expect(METHOD_CATALOGUE.map((m) => m.title)).toEqual([
      'Reframe the problem',
      'Generate a materially different option',
      'Consider the opposite',
      'Apply the outside view',
      'Run a pre-mortem',
      'Explore trade-offs',
      'Review a possible bias',
    ])
    expect(GLOBAL_ACTIONS.map((a) => a.title)).toEqual([
      'Edit decision brief',
      'Review all inputs',
      'Rerun analysis',
    ])
  })
})

describe('ActionsMenu', () => {
  it('opens with the grouped catalogue and closes on Escape with focus restored', () => {
    render(<ActionsMenu />)
    const trigger = screen.getByRole('button', { name: /actions/i })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Run a pre-mortem')).toBeInTheDocument()
    expect(screen.getByText('Rerun analysis')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)
  })

  it('trigger reads as expanded while open (info border + header text)', () => {
    render(<ActionsMenu />)
    const trigger = screen.getByRole('button', { name: /actions/i })
    expect(trigger.className).toContain('border-panel-border')
    fireEvent.click(trigger)
    expect(trigger.className).toContain('border-info')
    expect(trigger.className).toContain('text-text-header')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(trigger.className).toContain('border-panel-border')
  })

  it('closes on Tab without trapping focus (Codex SF8: disclosure, not a focus trap)', () => {
    render(<ActionsMenu />)
    const trigger = screen.getByRole('button', { name: /actions/i })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Shift+Tab the same way', () => {
    render(<ActionsMenu />)
    const trigger = screen.getByRole('button', { name: /actions/i })
    fireEvent.click(trigger)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: true })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('a method opens the Ask-Olumi drawer with prompt draft, description context and method identity', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Run a pre-mortem'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    const preMortem = METHOD_CATALOGUE.find((m) => m.id === 'pre_mortem')!
    expect(drawer.draft).toBe(preMortem.prompt)
    expect(drawer.context).toBe(preMortem.description)
    expect(drawer.label).toBe(preMortem.title)
    expect(drawer.parameters).toMatchObject({ method_id: 'pre_mortem' })
    expect(drawer.source).toBe('chip')
  })

  it('methods route to the drawer even with no conversation registered (the drawer owns the honest disabled state)', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    const method = screen.getByText('Run a pre-mortem').closest('button')!
    expect(method).not.toBeDisabled()
    fireEvent.click(method)
    expect(useAskOlumiStore.getState().isOpen).toBe(true)
  })

  it('"Edit decision brief" opens the drawer with the shared review-brief ask', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Edit decision brief'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe(REVIEW_BRIEF_ASK.label)
    expect(drawer.context).toBe(REVIEW_BRIEF_ASK.context)
    expect(drawer.draft).toBe(REVIEW_BRIEF_ASK.draft)
  })

  it('"Review all inputs" opens the drawer with its inspection draft', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Review all inputs'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.label).toBe('Review all inputs')
    expect(drawer.draft).toBe('Walk me through all the current model inputs without changing anything.')
  })

  it('S5: arrow keys rove focus across menu items and outside click closes', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('"Rerun analysis" routes through the canonical runner (direct, no drawer)', async () => {
    const runner = vi.fn(async (_opts?: CanonicalRunOptions) => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('rerun via the fire-and-forget dispatch toasts a START (never claims completion)', async () => {
    registerCanonicalRunner(async () => ({ status: 'dispatched' as const }))
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    expect(await screen.findByText(RERUN_TOASTS.started)).toBeInTheDocument()
  })

  it('DELIBERATE PIN FLIP (Lane 3 review fold): the awaited V2 path toasts NOTHING — the freshness strip owns the completion announcement', async () => {
    // Post-SF2 the strip stays mounted through the run and fires the
    // byte-identical "rerun completed" toast on running→complete; a second
    // menu-owned toast for the same completion was a duplicate.
    registerCanonicalRunner(async () => ({ status: 'v2' as const }))
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    // Allow the outcome promise to settle, then assert no menu toast.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(RERUN_TOASTS.completed)).toBeNull()
    expect(screen.queryByText(RERUN_TOASTS.started)).toBeNull()
  })

  it('blocked rerun surfaces the blocking reason', async () => {
    registerCanonicalRunner(async () => ({ status: 'blocked' as const, reason: 'Add a goal first' }))
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    expect(await screen.findByText('Add a goal first')).toBeInTheDocument()
  })

  it('rerun with no registered host surfaces the unavailable reason', async () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    expect(
      await screen.findByText('Analysis is still loading. Try again in a moment.'),
    ).toBeInTheDocument()
  })
})
