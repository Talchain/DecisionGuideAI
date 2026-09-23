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

  it('a touch pointer gets a 44px target', () => {
    render(<PanelIconButton Icon={Pencil} label="Edit" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('[@media(pointer:coarse)]:w-11')
  })
})
