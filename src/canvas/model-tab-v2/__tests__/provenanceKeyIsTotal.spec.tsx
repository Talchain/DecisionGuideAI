/**
 * ⭐ THE KEY MUST DESCRIBE EVERY MARK THE ROW CAN RENDER.
 *
 * A legend that omits a kind is worse than no legend: the reader learns the
 * code is complete and then meets a glyph it does not explain. So this asserts
 * the key is TOTAL over `ValueProvenanceKind` — derived from the register, not
 * from a list typed here (trap 12: a hand-maintained mirror drifts silently and
 * the drift reads as green).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ValueProvenanceKey } from '../ValueProvenanceKey'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from '../../domain/valueProvenance'

const ALL_KINDS = Object.keys(VALUE_PROVENANCE_LABEL) as ValueProvenanceKind[]

describe('the provenance key', () => {
  it('is closed until asked for, and opens as a dialog', () => {
    render(<ValueProvenanceKey />)
    expect(screen.queryByTestId('model-tab-v2-provenance-key')).toBeNull()
    const toggle = screen.getByTestId('model-tab-v2-provenance-key-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(screen.getByTestId('model-tab-v2-provenance-key')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  /**
   * ⚠⚠ TOTAL, AND DERIVED. `ALL_KINDS` comes from the register the row renders
   * from, so adding a kind without keying it REDs here rather than shipping an
   * unexplained glyph. The control below proves the query can fail.
   */
  it('explains every provenance kind the row can render', () => {
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const key = screen.getByTestId('model-tab-v2-provenance-key')

    const keyed = [...key.querySelectorAll('[data-provenance-kind]')].map(e =>
      e.getAttribute('data-provenance-kind'),
    )
    expect(ALL_KINDS.length).toBeGreaterThan(0) // the register is not empty
    expect([...keyed].sort()).toEqual([...ALL_KINDS].sort())

    // Each is named in the SAME words the mark's accessible name uses.
    for (const kind of ALL_KINDS) {
      expect(key).toHaveTextContent(VALUE_PROVENANCE_LABEL[kind])
    }
  })

  /** The probe's control: a kind that does not exist is NOT keyed. */
  it('the query can tell a keyed kind from an unkeyed one', () => {
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const key = screen.getByTestId('model-tab-v2-provenance-key')
    expect(key.querySelector('[data-provenance-kind="zz-not-a-kind"]')).toBeNull()
    expect(key.querySelector('[data-provenance-kind="ai"]')).not.toBeNull()
  })

  /**
   * ⚠ THE ⚠ IS NOT A PROVENANCE CLAIM. `vocabulary.ts` is explicit that a
   * surface rendering it as a whose-value-is-this badge is reading it wrong, so
   * the key must say what it IS and must not list it among the kinds.
   */
  it('keeps the ⚠ out of the provenance vocabulary', () => {
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const key = screen.getByTestId('model-tab-v2-provenance-key')
    expect(key).toHaveTextContent('still needs checking')
    expect(key.querySelectorAll('[data-provenance-kind]').length).toBe(ALL_KINDS.length)
  })
})
