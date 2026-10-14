/**
 * The panel's one icon-only control: the label is the accessible name, an AI
 * act always carries the Olumi AI icon (never Lucide `Sparkles`, which is the
 * AI-ESTIMATE provenance glyph), and a non-AI act never carries it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Pencil } from 'lucide-react'
import { PanelIconButton } from '../PanelIconButton'
import { icon } from '../panelSurfaces'

afterEach(cleanup)

describe('PanelIconButton', () => {
  it('an AI act renders the Olumi AI icon, named by its label, and fires once', () => {
    const onClick = vi.fn()
    render(<PanelIconButton ai label="Ask Olumi about this assumption" onClick={onClick} testId="ask" />)
    const btn = screen.getByRole('button', { name: 'Ask Olumi about this assumption' })
    expect(btn.querySelector('[data-icon="olumi-ai"]')).not.toBeNull()
    expect(btn.querySelector('.lucide-sparkles')).toBeNull()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('⛔ CONTRAST: a non-AI act never carries the AI icon', () => {
    render(<PanelIconButton Icon={Pencil} label="Edit this value" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Edit this value' })
    expect(btn.querySelector('[data-icon="olumi-ai"]')).toBeNull()
    expect(btn.querySelector('svg')).not.toBeNull()
  })

  // Paul 14 Oct 2026: PoC is desktop-only; touch sizing not required.
  it('is sized for a mouse: the 24px floor in both dimensions, no coarse-pointer enlargement', () => {
    render(<PanelIconButton Icon={Pencil} label="Edit" onClick={() => {}} />)
    const cls = screen.getByRole('button', { name: 'Edit' }).className
    expect(cls).toContain('w-6')
    expect(cls).toContain('h-6')
    expect(cls).toContain('min-w-[24px]')
    expect(cls).toContain('min-h-[24px]')
    expect(cls).not.toContain('pointer:coarse')
  })

  it('the glyphs sit at row scale: Lucide at icon(row), the Olumi mark one step down at icon(inline)', () => {
    render(
      <>
        <PanelIconButton Icon={Pencil} label="Edit" onClick={() => {}} />
        <PanelIconButton ai label="Ask Olumi" onClick={() => {}} />
      </>,
    )
    const pencil = screen.getByRole('button', { name: 'Edit' }).querySelector('svg')
    const mark = screen.getByRole('button', { name: 'Ask Olumi' }).querySelector('[data-icon="olumi-ai"]')
    expect(pencil?.getAttribute('class')).toContain(icon('row'))
    expect(mark?.getAttribute('class')).toContain(icon('inline'))
  })
})
