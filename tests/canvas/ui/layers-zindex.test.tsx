import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerProvider, useModal, Z_INDEX } from '../../../src/ui/LayerProvider'

describe('LayerProvider', () => {
  it('modal has correct z-index', () => {
    function Test() {
      const { show } = useModal()
      return <button onClick={() => show('m1', <div>Content</div>)}>Open</button>
    }
    
    render(<LayerProvider><Test /></LayerProvider>)
    fireEvent.click(screen.getByText('Open'))
    
    const modal = screen.getByRole('presentation')
    expect(modal).toHaveStyle({ zIndex: Z_INDEX.MODAL.toString() })
  })

  it('new modal closes previous', () => {
    function Test() {
      const { show } = useModal()
      return (
        <>
          <button onClick={() => show('m1', <div data-testid="m1">M1</div>)}>M1</button>
          <button onClick={() => show('m2', <div data-testid="m2">M2</div>)}>M2</button>
        </>
      )
    }
    
    render(<LayerProvider><Test /></LayerProvider>)
    fireEvent.click(screen.getByText('M1'))
    expect(screen.getByTestId('m1')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('M2'))
    expect(screen.queryByTestId('m1')).not.toBeInTheDocument()
    expect(screen.getByTestId('m2')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    function Test() {
      const { show } = useModal()
      return <button onClick={() => show('m1', <div data-testid="content">C</div>)}>Open</button>
    }
    
    render(<LayerProvider><Test /></LayerProvider>)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('content')).toBeInTheDocument()
    
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })
})
