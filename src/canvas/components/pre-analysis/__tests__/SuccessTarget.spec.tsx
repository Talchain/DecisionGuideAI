import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SuccessTarget } from '../SuccessTarget'
import type { Node } from '@xyflow/react'

const makeGoalNode = (id = 'g1', label = 'Revenue'): Node => ({
  id,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label },
})

describe('SuccessTarget — edit input raw-vs-normalised', () => {
  it('shows raw value in edit input when goalThresholdRaw is present', () => {
    const onChange = vi.fn()
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={onChange}
        onThresholdEdit={vi.fn()}
      />,
    )

    // Click edit to expand inline editor
    fireEvent.click(screen.getByTitle('Edit target'))

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(200)
  })

  it('shows normalised value in edit input when goalThresholdRaw is absent', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.65}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        onThresholdChange={vi.fn()}
        onThresholdEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTitle('Edit target'))

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(0.65)
  })

  it('converts raw user input back to normalised via onThresholdChange', () => {
    const onChange = vi.fn()
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={onChange}
        onThresholdEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTitle('Edit target'))

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '300' } })

    // rawToNormFactor = 0.2 / 200 = 0.001 → 300 * 0.001 = 0.3
    expect(onChange).toHaveBeenCalledWith(0.3)
  })

  it('typing updates input value (local draft, not snapping back to raw)', () => {
    const onChange = vi.fn()
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={onChange}
        onThresholdEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTitle('Edit target'))

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '300' } })

    // Input should show the user's typed value, not snap back to 200
    expect(input).toHaveValue(300)
  })

  it('displays raw + unit in formatted value when both are provided', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={vi.fn()}
      />,
    )

    expect(screen.getByText('200 customers')).toBeInTheDocument()
  })

  it('confirmed state shows raw + unit in compact line', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={true}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={vi.fn()}
      />,
    )

    expect(screen.getByText('200 customers')).toBeInTheDocument()
  })

  it('confirmed state edit input initialises with raw value', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={true}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={vi.fn()}
        onThresholdEdit={vi.fn()}
      />,
    )

    // Expand confirmed state to show edit input
    fireEvent.click(screen.getByRole('button'))

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(200)
  })

  // Task 2: currency symbol prefix tests
  it('prefixes £ symbol before number (£30,000 not 30,000 £)', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.3}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={30000}
        goalThresholdUnit="£"
        onThresholdChange={vi.fn()}
      />,
    )
    expect(screen.getByText('£30,000')).toBeInTheDocument()
  })

  it('prefixes $ symbol before number', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.3}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={50000}
        goalThresholdUnit="$"
        onThresholdChange={vi.fn()}
      />,
    )
    expect(screen.getByText('$50,000')).toBeInTheDocument()
  })

  it('appends non-currency unit after number (30,000 customers)', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.3}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={30000}
        goalThresholdUnit="customers"
        onThresholdChange={vi.fn()}
      />,
    )
    expect(screen.getByText('30,000 customers')).toBeInTheDocument()
  })

  it('appends % after number', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.5}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={50}
        goalThresholdUnit="%"
        onThresholdChange={vi.fn()}
      />,
    )
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it('shows edit label with unit when goalThresholdUnit is provided', () => {
    render(
      <SuccessTarget
        goalNode={makeGoalNode()}
        successThreshold={0.2}
        isThresholdAutoDerived={false}
        isThresholdConfirmed={false}
        goalThresholdRaw={200}
        goalThresholdUnit="customers"
        onThresholdChange={vi.fn()}
        onThresholdEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTitle('Edit target'))

    expect(screen.getByText('Target value (customers)')).toBeInTheDocument()
  })
})
