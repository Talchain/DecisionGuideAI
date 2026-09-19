/**
 * A ROW OF ACTS HAS ONE LAYOUT — and it wraps.
 *
 * ## The measurement
 *
 * `StrengthenTheReasoning` alone carried THREE act-row layouts:
 *
 *   :1096  flex flex-wrap items-center gap-1.5 mt-1   ← a CHIP row, not acts
 *   :1243  flex flex-wrap items-center gap-2   mt-2   ← the row's acts
 *   :1408  mt-1 flex items-center gap-3               ← the dispute form's acts
 *
 * Two of those are the same thing — a horizontal run of controls under a block
 * of text — at two gaps and two margins. **And the third cannot wrap**: no
 * `flex-wrap`, so at a narrowed dock its buttons overflow instead of moving to a
 * second line.
 *
 * ⭐ THAT MISSING CLASS IS THE WHOLE ARGUMENT for a component over a shared
 * string. A constant can be copied minus one class and nothing notices; a
 * component cannot. It is the same failure as the `quiet` tier shipping with
 * `min-h` and no `min-w` — a rule carried as characters loses a character.
 *
 * ⚠ THE CHIP ROW IS DELIBERATELY NOT ADOPTED. Chips are labels that happen to be
 * pressable; acts are things the reader DOES to this finding. One component for
 * both would need a `gap` prop, which is this same drift wearing a parameter.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

import { PanelActRow, ACT_ROW } from '../PanelActRow'

afterEach(() => cleanup())

const PANEL_DIR = path.resolve(__dirname, '..')

describe('the act row', () => {
  it('⛔ always wraps — the class whose absence caused this', () => {
    render(<PanelActRow testId="r"><button>a</button></PanelActRow>)
    const row = screen.getByTestId('r')
    expect(row.classList.contains('flex-wrap'), 'a dock the user narrows must not overflow').toBe(true)
    expect(row.classList.contains('flex')).toBe(true)
    expect(row.classList.contains('items-center')).toBe(true)
  })

  it('carries ONE gap, and the caller cannot change it', () => {
    render(<PanelActRow testId="r" className="mt-2"><button>a</button></PanelActRow>)
    const row = screen.getByTestId('r')
    expect(row.classList.contains('gap-2'), 'the gap is the grammar').toBe(true)
    // the caller's own class is for spacing ABOVE the row, which depends on
    // what precedes it and is genuinely theirs
    expect(row.classList.contains('mt-2')).toBe(true)
    for (const other of ['gap-1', 'gap-1.5', 'gap-3', 'gap-4']) {
      expect(row.classList.contains(other), `${other} is a second grammar`).toBe(false)
    }
  })

  it('renders its children, and needs no testid to work', () => {
    render(<PanelActRow><button>press me</button></PanelActRow>)
    expect(screen.getByText('press me')).toBeInTheDocument()
  })

  /**
   * ⭐ THE CENSUS — the arm that stops a fourth layout arriving. Every rule
   * above tests the component; none notices a call site that simply does not
   * use it, which is how three layouts accumulated in one file.
   */
  it('⛔ no section hand-rolls an act row beside the component', () => {
    // A hand-rolled act row: a flex row with a gap, holding controls, that is
    // NOT the chip row (gap-1.5) and NOT inside a file using the component.
    const HAND_ROLLED = /className="[^"]*\bflex\b[^"]*\bitems-center\b[^"]*\bgap-(?:2|3|4)\b[^"]*"/g
    const offenders: string[] = []
    let seen = 0
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'prototype') continue
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) walk(full)
        else if (/\.tsx$/.test(full) && !/\.(spec|test)\./.test(full)) {
          const code = fs
            .readFileSync(full, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\n]*/g, '')
          seen += 1
          if (!/<button|role="button"/.test(code)) continue
          const rows = code.match(HAND_ROLLED) ?? []
          if (rows.length === 0) continue
          if (code.includes('PanelActRow')) continue
          offenders.push(path.relative(PANEL_DIR, full))
        }
      }
    }
    walk(PANEL_DIR)

    expect(seen, 'PRECONDITION: the census reached no sources').toBeGreaterThan(20)
    // ⭐ ZERO, NOT A BASELINE. I wrote `<= 6` expecting stragglers, then ran the
    // census against the real tree before pushing: there are NONE. A slack
    // ceiling nobody has measured is a guard that agrees with itself, and this
    // panel has shipped that more than once.
    expect(offenders, 'a hand-rolled act row beside the component').toEqual([])
  })

  it('PRECONDITION: the shared constant is what the component renders', () => {
    render(<PanelActRow testId="r"><span /></PanelActRow>)
    for (const token of ACT_ROW.split(' ')) {
      expect(screen.getByTestId('r').classList.contains(token), `${token} missing`).toBe(true)
    }
  })
})
