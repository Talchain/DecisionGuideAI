/**
 * DS bricks — the laws each component encodes, pinned.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '../Button'
import { Pill } from '../Pill'
import { Skeleton } from '../Skeleton'

describe('Button — the DS single-treatment button', () => {
  it('primary is the person\'s green action with an ink label, pill radius (Paul 17 Nov: no black buttons; blue means Olumi)', () => {
    render(<Button>Analyse first pass</Button>)
    const b = screen.getByRole('button', { name: 'Analyse first pass' })
    expect(b.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-success', 'text-text-header', 'hover:bg-success-hover', 'rounded-full']))
    expect(b.className).not.toMatch(/(^|\s)bg-(primary|info)(\s|$)|text-text-on-color/)
  })

  it('defaults type="button" — a Button inside a form must not submit it by accident', () => {
    render(<Button>Open</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('danger is OUTLINED, never filled (destructive confirm belongs to the dialog)', () => {
    render(<Button variant="danger">Remove node</Button>)
    const b = screen.getByRole('button')
    expect(b.className).toContain('bg-transparent')
    expect(b.className).not.toContain('bg-danger')
  })

  it('a disabled primary is one solid neutral with a light label, never faded; outlined variants keep the opacity treatment', () => {
    render(<Button disabled>Analyse</Button>)
    const b = screen.getByRole('button')
    expect(b).toBeDisabled()
    expect(b.className.split(/\s+/)).toEqual(expect.arrayContaining(['disabled:bg-panel-border', 'disabled:text-text-light']))
    expect(b.className).not.toMatch(/(^|\s)disabled:opacity-/)
    render(<Button variant="secondary" disabled>Later</Button>)
    expect(screen.getByRole('button', { name: 'Later' }).className).toContain('disabled:opacity-40')
  })
})

describe('Pill — outlined only, ink text (DS law)', () => {
  it('is always bg-transparent with text-text-body, colour only on the border', () => {
    render(<Pill tone="success" dot>Stable ranking</Pill>)
    const p = screen.getByText('Stable ranking')
    expect(p.className).toContain('bg-transparent')
    expect(p.className).toContain('text-text-body')
    expect(p.className).toContain('border-success/40')
    // The law the component exists to encode: no filled tone background.
    expect(p.className).not.toMatch(/bg-(success|warning|danger|info)\b/)
  })

  it('neutral never renders a dot even when asked', () => {
    const { container } = render(<Pill dot>Stakes not set</Pill>)
    expect(container.querySelectorAll('span span')).toHaveLength(0)
  })
})

describe('Skeleton', () => {
  it('is decorative by default, a labelled status region when named', () => {
    const { rerender, container } = render(<Skeleton className="h-4 w-40" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    rerender(<Skeleton className="h-4 w-40" label="Loading analysis" />)
    expect(screen.getByRole('status', { name: 'Loading analysis' })).toBeInTheDocument()
  })

  it('shimmer is motion-safe gated (prefers-reduced-motion honoured by class contract)', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstElementChild?.className).toContain('motion-safe:animate-pulse')
  })
})
