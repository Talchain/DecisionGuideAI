/**
 * Wave 1 — consolidated Actions menu (brief §4.7): ONE stable catalogue of
 * science-grounded methods + global utilities, persistent, contextual AI
 * sessions via dispatchAction (conversation-typed — chip_metadata drops on
 * every other turn type), canonical rerun, keyboard-complete with focus
 * restore (fixes the HeroActionsMenu gap).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ActionsMenu } from '../ActionsMenu'
import { METHOD_CATALOGUE, GLOBAL_ACTIONS } from '../actionsCatalogue'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
} from '../../../../canvas/analysis/canonicalRunRegistry'

beforeEach(() => {
  __resetCanonicalRunnerForTests()
  useGuidanceStore.setState({ _dispatchAction: null } as never)
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

  it('a method opens a contextual session: dispatchAction with method identity in parameters', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Run a pre-mortem'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    const call = dispatch.mock.calls[0][0]
    expect(call.parameters).toMatchObject({ method_id: 'pre_mortem' })
    expect(typeof call.message).toBe('string')
    expect(call.message.length).toBeGreaterThan(0)
  })

  it('methods are disabled with honest hint when no chat can receive them (never dead controls)', () => {
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    const method = screen.getByText('Run a pre-mortem').closest('button')!
    expect(method).toBeDisabled()
  })

  it('"Rerun analysis" routes through the canonical runner', async () => {
    const runner = vi.fn(async (_opts?: import('../../../../canvas/analysis/canonicalRunRegistry').CanonicalRunOptions) => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    render(<ActionsMenu />)
    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByText('Rerun analysis'))
    await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
  })
})
