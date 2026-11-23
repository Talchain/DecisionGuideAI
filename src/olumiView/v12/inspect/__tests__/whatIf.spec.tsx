/** V12 what-if bar (Discard, Keep it), the "Not saved" tag, and the inspector's hand-off of a figure to the what-if form. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ViewWhatIfKey } from '../../../ViewWhatIfKey'
import { useViewLens } from '../../../lens'
import { useWhatIf } from '../../../whatif'
import { useViewStore } from '../../../store'
import { SID, install, uninstall, type Stub } from '../../edit/__tests__/harness'
import { NotSavedTag } from '../NotSaved'
import { openWhatIf, useWhatIfFocus } from '../whatIfFocus'

let stub: Stub
beforeEach(() => { stub = install(); useViewLens.setState({ lens: 'what_if' }) })
afterEach(() => { cleanup(); uninstall(); useViewLens.setState({ lens: 'full' }); useWhatIf.setState({ shown: null }); useWhatIfFocus.setState({ id: null }) })
const tried = (quantity = 'starting_customers', typed = '300') => {
  const base = useViewStore.getState().view!.model!.edit_base!
  useWhatIf.setState({ shown: { sid: SID, base, quantity, typed, variant: { hypothetical: true, edits: [{ quantity, label: 'q', words: 'core words' }], blocked: null, stopped: null, moved: true, why_not: null, rows: [], most_likely: null } } })
}

describe('what-if tray actions', () => {
  it('says What if, Proposed, Discard and Keep it; Keep it is disabled with "Try a value first" until a value is tried', () => {
    render(<ViewWhatIfKey />)
    const bar = screen.getByTestId('view-whatif-bar')
    expect(screen.getByTestId('view-whatif-key')).toContainElement(bar)
    expect(bar).toHaveAccessibleName('What if')
    expect(screen.getByTestId('view-whatif-bar-proposed')).toHaveTextContent('Proposed')
    expect(screen.getByTestId('view-whatif-bar-discard')).toBeInTheDocument()
    const keep = screen.getByTestId('view-whatif-bar-keep')
    expect(keep).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('view-whatif-bar-reason')).toHaveTextContent('Try a value first')
    fireEvent.click(keep)
    expect(stub.posts()).toHaveLength(0)
  })
  it('once a value is tried, Keep it saves that value through the edit route, and the tried value is dropped', async () => {
    tried('starting_customers', '300')
    render(<ViewWhatIfKey />)
    const keep = screen.getByTestId('view-whatif-bar-keep')
    expect(keep).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByTestId('view-whatif-bar-reason')).toBeNull()
    fireEvent.click(keep)
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/edit`)
    expect(stub.posts()[0]!.body).toMatchObject({ quantity: 'starting_customers', typed: '300' })
    await waitFor(() => expect(useWhatIf.getState().shown).toBeNull())
  })
  it('Discard drops the tried value and saves nothing', () => {
    tried()
    render(<ViewWhatIfKey />)
    fireEvent.click(screen.getByTestId('view-whatif-bar-discard'))
    expect(useWhatIf.getState().shown).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
})

describe('"Not saved" tag', () => {
  it('is on the figure tried while the lens is on, and on no other figure', () => {
    tried('starting_customers')
    render(<><NotSavedTag id="starting_customers" /><NotSavedTag id="customer_target" /></>)
    expect(screen.getByTestId('what-if-not-saved-starting_customers')).toHaveTextContent('Not saved')
    expect(screen.queryByTestId('what-if-not-saved-customer_target')).toBeNull()
  })
  it('is gone when the lens is off', () => {
    tried('starting_customers'); useViewLens.setState({ lens: 'full' })
    render(<NotSavedTag id="starting_customers" />)
    expect(screen.queryByTestId('what-if-not-saved-starting_customers')).toBeNull()
  })
})

describe('What if from the inspector', () => {
  it('opens the form on that figure', async () => {
    useViewLens.setState({ lens: 'full' })
    render(<ViewWhatIfKey />)
    expect(screen.queryByTestId('view-whatif-key')).toBeNull()
    act(() => openWhatIf('customer_target'))
    const select = await screen.findByTestId('view-whatif-key-factor') as HTMLSelectElement
    expect(select.value).toBe('customer_target')
    expect(useWhatIfFocus.getState().id).toBeNull()
  })
})
