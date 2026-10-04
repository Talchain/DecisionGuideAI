import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailToggleContext } from '../../../canvas/components/model-tab/DetailToggleContext'
import { ScienceQuantity, scienceBand, scienceQuantityText } from '../ScienceQuantity'

describe('ScienceQuantity', () => {
  it('uses the existing strength bands and describes a same-band comparison honestly', () => {
    expect(scienceBand('strength', 0.45)).toBe('Strong')
    expect(scienceQuantityText('strength', 0.45, false, false)).toBe('Strong')
    expect(`${scienceBand('strength', 0.45)}, slightly stronger`).toBe('Strong, slightly stronger')
  })

  it('reveals the exact value only in advanced mode or after disclosure', () => {
    render(<ScienceQuantity kind="strength" value={0.45} />)
    expect(screen.getByTestId('science-quantity')).toHaveTextContent('Strong')
    expect(screen.getByTestId('science-quantity')).not.toHaveTextContent('0.45')
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByTestId('science-quantity')).toHaveTextContent('0.45')
  })

  it('uses the existing advanced-view source of truth', () => {
    render(<DetailToggleContext.Provider value={{ showDetail: true }}><ScienceQuantity kind="strength" value={0.45} /></DetailToggleContext.Provider>)
    expect(screen.getByTestId('science-quantity')).toHaveTextContent('0.45')
    expect(screen.queryByRole('button', { name: 'Show details' })).toBeNull()
  })
})
