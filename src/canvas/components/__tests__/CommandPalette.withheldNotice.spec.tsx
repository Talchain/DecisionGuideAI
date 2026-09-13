/**
 * SEARCHING FOR A WITHHELD COMMAND MUST SAY WHY, NOT RETURN "No actions found".
 *
 * `CommandPalette` filters out every `add-*` command while
 * `canvasSemanticMutations` is `'disabled'`. Correct — running one would be a
 * control with no writer behind it. But the palette then answered a search for
 * "add" with its generic empty state, which is the lane's whole defect in
 * miniature: identical output for "this product cannot do that" and "this
 * search is broken".
 *
 * ⚠ NON-VACUITY. Every assertion below is preceded by a check that the palette
 * RENDERED — an "expected text is absent" assertion passes trivially against a
 * component that threw.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CommandPalette } from '../CommandPalette'
import { CANVAS_STRUCTURAL_EDIT_NOTICE } from '../../mutations/mutationAuthority'

vi.mock('@xyflow/react', () => ({ useReactFlow: () => ({ fitView: vi.fn() }) }))

const baseState: any = {
  addNode: vi.fn(), selectAll: vi.fn(), saveSnapshot: vi.fn(),
  applyLayout: vi.fn().mockResolvedValue(undefined), nodes: [], edges: [],
}
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector?: any) => (selector ? selector(baseState) : baseState)),
}))
vi.mock('../../layout/runLayoutWithProgress', () => ({
  runLayoutWithProgress: vi.fn().mockResolvedValue(true),
}))
vi.mock('../../hooks/useValidationFeedback', () => ({
  useValidationFeedback: () => ({ formatErrors: (e: any) => e, focusError: vi.fn() }),
}))
vi.mock('../../adapters/plot', () => ({
  plot: { validate: vi.fn(() => Promise.resolve({ valid: true, errors: [], violations: [] })) },
}))

const authorityValue = { current: 'disabled' as string }
vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: authorityValue.current }
    },
  }
})

function open() {
  render(<CommandPalette isOpen onClose={vi.fn()} />)
  // ⚠ POSITIVE CONTROL: the palette actually mounted.
  expect(screen.getByPlaceholderText('Search actions...')).toBeInTheDocument()
}
function type(q: string) {
  fireEvent.change(screen.getByPlaceholderText('Search actions...'), { target: { value: q } })
}
const notice = () => screen.queryByTestId('command-palette-withheld-notice')

describe('the palette says why an add command is missing', () => {
  beforeEach(() => { authorityValue.current = 'disabled'; vi.clearAllMocks() })
  afterEach(() => cleanup())

  it('searching "add" shows the reason instead of "No actions found"', () => {
    open()
    type('add')
    expect(notice()).toBeInTheDocument()
    expect(notice()!.textContent).toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
    expect(screen.queryByText('No actions found')).toBeNull()
  })

  it('searching a specific withheld command shows the reason', () => {
    open()
    type('Add Goal Node')
    expect(notice()).toBeInTheDocument()
  })

  it('the withheld commands are still NOT executable — the notice is not a button', () => {
    // The palette must not gain an actionable route to a writer that does not
    // exist. This is the assertion that REDs if someone "helpfully" re-enables
    // the add commands to make the notice unnecessary.
    open()
    type('add')
    expect(screen.queryByText('Add Goal Node')).toBeNull()
    expect(notice()!.tagName).not.toBe('BUTTON')
    expect(notice()).toHaveAttribute('role', 'note')
  })

  // ── opposite-direction twins ─────────────────────────────────────────────

  it('TWIN: a query matching a REAL command shows no notice', () => {
    open()
    type('Select All')
    expect(screen.getByText('Select All')).toBeInTheDocument()
    expect(notice()).toBeNull()
  })

  it('TWIN: a query matching NOTHING keeps the honest empty state', () => {
    // "No actions found" is correct here and must not be replaced by a reason
    // that does not apply — the opposite failure to the one being fixed.
    open()
    type('zzzznotacommand')
    expect(notice()).toBeNull()
    expect(screen.getByText('No actions found')).toBeInTheDocument()
  })

  it('TWIN: with the palette open and no query, the notice does not clutter the list', () => {
    open()
    expect(screen.getByText('Select All')).toBeInTheDocument()
    // Empty query matches everything, including the withheld set, so the
    // notice IS shown — but as one line at the foot, never six dead rows.
    expect(screen.queryByText('Add Goal Node')).toBeNull()
    expect(notice()).toBeInTheDocument()
  })

  it('TWIN: when the authority IS granted the commands return and the notice goes', () => {
    // Self-retiring: no second edit needed the day the writer exists.
    authorityValue.current = 'server_graph'
    open()
    type('add')
    expect(screen.getByText('Add Goal Node')).toBeInTheDocument()
    expect(notice()).toBeNull()
  })
})
