/**
 * BaselineToggleCard Component Tests (V9.2)
 *
 * Tests for the inline baseline toggle row.
 * Layout: ● "No baseline set" · [Set] | ● "Baseline: {name}" · [Change]
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BaselineToggleCard } from '../BaselineToggleCard'

describe('BaselineToggleCard', () => {
  describe('visibility', () => {
    it('renders when show is true', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByTestId('baseline-toggle-card')).toBeInTheDocument()
    })

    it('does not render when show is false', () => {
      render(<BaselineToggleCard show={false} />)

      expect(screen.queryByTestId('baseline-toggle-card')).not.toBeInTheDocument()
    })
  })

  describe('no baseline state', () => {
    it('displays "No baseline set" message', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByText('No baseline set')).toBeInTheDocument()
    })

    it('shows "Set" button', () => {
      render(<BaselineToggleCard show={true} />)

      expect(
        screen.getByRole('button', { name: /^Set$/i })
      ).toBeInTheDocument()
    })

    it('V12.5: helper text removed (self-explanatory "Set" link)', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.queryByText(/Baseline helps interpret/)).not.toBeInTheDocument()
    })
  })

  describe('baseline set state', () => {
    it('shows baseline label when set', () => {
      render(
        <BaselineToggleCard
          show={true}
          baselineLabel="Status Quo"
          options={[{ id: 'sq', label: 'Status Quo' }]}
        />
      )

      expect(screen.getByText(/Baseline: Status Quo/)).toBeInTheDocument()
    })

    it('shows "Change" button when baseline is set', () => {
      render(
        <BaselineToggleCard
          show={true}
          baselineLabel="Status Quo"
          options={[{ id: 'sq', label: 'Status Quo' }]}
        />
      )

      expect(
        screen.getByRole('button', { name: /Change/i })
      ).toBeInTheDocument()
    })

    it('does not show helper text when baseline is set', () => {
      render(
        <BaselineToggleCard
          show={true}
          baselineLabel="Status Quo"
          options={[{ id: 'sq', label: 'Status Quo' }]}
        />
      )

      expect(screen.queryByText(/Baseline helps interpret/)).not.toBeInTheDocument()
    })
  })

  describe('selecting baseline', () => {
    it('shows dropdown when "Set" is clicked', () => {
      render(
        <BaselineToggleCard
          show={true}
          options={[
            { id: 'opt-1', label: 'Option A' },
            { id: 'opt-2', label: 'Option B' },
          ]}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /^Set$/i }))

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('calls onSetBaseline when option is selected and confirmed', () => {
      const onSetBaseline = vi.fn()

      render(
        <BaselineToggleCard
          show={true}
          onSetBaseline={onSetBaseline}
          options={[
            { id: 'opt-1', label: 'Option A' },
            { id: 'opt-2', label: 'Option B' },
          ]}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { name: /^Set$/i }))

      // Select an option
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'opt-1' } })

      // Click "Set" button in the dropdown row
      const setButtons = screen.getAllByRole('button', { name: /^Set$/i })
      fireEvent.click(setButtons[setButtons.length - 1])

      expect(onSetBaseline).toHaveBeenCalledWith('opt-1')
    })

    it('hides dropdown when "Cancel" is clicked', () => {
      render(
        <BaselineToggleCard
          show={true}
          options={[{ id: 'opt-1', label: 'Option A' }]}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /^Set$/i }))
      expect(screen.getByRole('combobox')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
  })

  describe('running state', () => {
    it('disables "Set" button when isRunning is true', () => {
      render(<BaselineToggleCard show={true} isRunning={true} />)

      expect(screen.getByRole('button', { name: /^Set$/i })).toBeDisabled()
    })
  })
})
