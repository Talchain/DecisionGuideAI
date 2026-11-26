import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChanceDots } from '../ChanceDots'

describe('ChanceDots', () => {
  it.each([[0, 0], [0.24, 2], [0.25, 3], [0.89, 9], [1, 10]])(
    'draws ten decorative dots for a chance of %s with %s filled',
    (chance, filled) => {
      const { container } = render(<ChanceDots chance={chance} />)
      const row = container.querySelector('[data-chance-dots]')!
      expect(row.getAttribute('aria-hidden')).toBe('true')
      expect(Array.from(row.children, (dot) => dot.getAttribute('data-chance-dot'))).toEqual([
        ...Array(filled).fill('filled'),
        ...Array(10 - filled).fill('empty'),
      ])
    },
  )

  it.each([undefined, null, NaN, Infinity, -0.1, 1.1])('draws nothing without a valid numeric chance (%s)', (chance) => {
    const { container } = render(<ChanceDots chance={chance} />)
    expect(container.childElementCount).toBe(0)
  })
})
