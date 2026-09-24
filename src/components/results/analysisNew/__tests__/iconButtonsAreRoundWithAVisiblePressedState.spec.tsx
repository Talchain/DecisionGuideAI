/**
 * ⭐ V2 FIDELITY GAP 12 — icon buttons are circles, and "pressed" is visible.
 *
 * Staging drew 28px rounded squares whose hover AND pressed state was
 * `bg-panel-hover`, measured at 1.038:1 against `bg-panel`: a selected method
 * in the strip was indistinguishable from an unselected one. The prototype:
 * `.iconbtn{border-radius:99px}`, hover draws an outline, `.active` is
 * `color:var(--info);border-color:var(--info)`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Search } from 'lucide-react'
import { PanelIconButton } from '../PanelIconButton'

afterEach(cleanup)
const classesOf = (el: HTMLElement) => el.className.split(/\s+/)

describe('PanelIconButton', () => {
  it('is a circle with no fill on hover', () => {
    render(<PanelIconButton label="Find" Icon={Search} onClick={() => {}} testId="b" />)
    const b = screen.getByTestId('b')
    expect(classesOf(b)).toContain('rounded-full')
    expect(classesOf(b)).not.toContain('rounded-md')
    expect(b.className).not.toMatch(/(^|\s)hover:bg-panel-hover(\s|$)/)
    expect(classesOf(b)).toContain('hover:ring-1')
  })

  it('pressed is an info ring and info colour, never the invisible tint', () => {
    render(<PanelIconButton label="Find" Icon={Search} onClick={() => {}} pressed testId="b" />)
    const b = screen.getByTestId('b')
    expect(b).toHaveAttribute('aria-pressed', 'true')
    expect(classesOf(b)).toEqual(expect.arrayContaining(['text-info', 'ring-1', 'ring-info']))
    expect(classesOf(b)).not.toContain('bg-panel-hover')
  })

  it('CONTRAST: not pressed ⇒ no ring at rest', () => {
    render(<PanelIconButton label="Find" Icon={Search} onClick={() => {}} pressed={false} testId="b" />)
    const b = screen.getByTestId('b')
    expect(classesOf(b)).not.toContain('ring-info')
    expect(classesOf(b)).toContain('text-text-light')
  })
})
