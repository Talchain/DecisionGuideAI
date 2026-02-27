import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BaselineTargetRow } from '../BaselineTargetRow'

// Mock focusHelpers
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
  focusNodeById: vi.fn(),
}))

const baseOptions = [
  { id: 'opt-a', label: 'Option A' },
  { id: 'opt-b', label: 'Option B' },
]

describe('BaselineTargetRow', () => {
  it('renders "No target set" when goalThreshold is null', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={null}
      />
    )
    expect(screen.getByText('No target set')).toBeTruthy()
  })

  it('renders target value when goalThreshold is set', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={500}
        outcomeUnit="currency"
        outcomeUnitSymbol="$"
      />
    )
    expect(screen.getByText((content) => content.includes('$500'))).toBeTruthy()
  })

  it('renders target with percent unit', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={75}
        outcomeUnit="percent"
      />
    )
    expect(screen.getByText((content) => content.includes('75%'))).toBeTruthy()
  })

  it('renders baseline section via BaselineToggleCard', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        baselineLabel="Option A"
      />
    )
    expect(screen.getByTestId('baseline-toggle-card')).toBeTruthy()
    expect(screen.getByText((content) => content.includes('Baseline: Option A'))).toBeTruthy()
  })

  it('renders both unset state', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={null}
      />
    )
    expect(screen.getByText('No target set')).toBeTruthy()
    expect(screen.getByText('No baseline set')).toBeTruthy()
  })

  it('renders both set state', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        baselineLabel="Option B"
        goalThreshold={100}
      />
    )
    expect(screen.getByText((content) => content.includes('Baseline: Option B'))).toBeTruthy()
    expect(screen.getByText((content) => content.includes('100'))).toBeTruthy()
  })

  it('shows tooltip on info icon hover', () => {
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={null}
      />
    )
    const infoButton = screen.getByLabelText('About baseline and target')
    fireEvent.mouseEnter(infoButton.parentElement!)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    expect(screen.getByText((content) => content.includes('A baseline shows where you are now'))).toBeTruthy()
    fireEvent.mouseLeave(infoButton.parentElement!)
  })

  it('renders "Add" link when onEditTarget is provided and no target', () => {
    const onEditTarget = vi.fn()
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={null}
        onEditTarget={onEditTarget}
      />
    )
    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)
    expect(onEditTarget).toHaveBeenCalled()
  })

  it('renders "Edit" link when onEditTarget is provided and target set', () => {
    const onEditTarget = vi.fn()
    render(
      <BaselineTargetRow
        baselineOptions={baseOptions}
        goalThreshold={200}
        onEditTarget={onEditTarget}
      />
    )
    const editButton = screen.getByText('Edit')
    fireEvent.click(editButton)
    expect(onEditTarget).toHaveBeenCalled()
  })
})
