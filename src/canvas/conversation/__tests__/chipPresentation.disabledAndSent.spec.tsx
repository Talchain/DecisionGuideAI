/**
 * ⭐ TWO PRESENTATION DEFECTS in the chat, both invisible to jsdom's layout, so
 * each is pinned on the exact rule that caused it. The browser witness on the
 * served build is the proof; these keep the cause from coming back.
 *
 * 1. A DISABLED CHIP LOOKED ENABLED. `.chip-stagger-in` ran its entrance with
 *    `animation-fill-mode: both`, so after the 250ms entrance the `to` keyframe
 *    (`opacity: 1`) stayed applied. An animation's value outranks every normal
 *    author declaration in the cascade, so `CHIP_CLASS`'s
 *    `disabled:opacity-40` never showed: every chip read as clickable while
 *    "Thinking…" and on a closed Run gate.
 *
 * 2. A CHIP-SENT MESSAGE SAT ON THE LEFT, the assistant's side. Its pill used
 *    `align-self: flex-end`, which does nothing in the BLOCK `div` that
 *    `ChatMessage` wraps every message in, and `display: inline-flex` made it
 *    an inline box that `margin-left: auto` cannot move either. The pill is
 *    kept (it shows the label the user clicked, `displayContent`, which a full
 *    bubble would replace with the canonical `content`), and is right-aligned.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

const chip: ActionChip = { id: 'c1', label: 'What would change this?', intent: 'primary', message: 'What would change this?' }

/** The declarations of one CSS rule, by exact selector, from a stylesheet's text. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)
  expect(at, `rule ${selector} present`).toBeGreaterThanOrEqual(0)
  return css.slice(at, css.indexOf('}', at))
}

describe('⭐ a disabled chip is not held at full opacity by its entrance animation', () => {
  it('the entrance fills BACKWARDS only, so the disabled opacity applies once it ends', () => {
    const { container } = render(<SuggestedChips chips={[chip]} onChipClick={vi.fn().mockResolvedValue(undefined)} isThinking />)
    const button = container.querySelector('button.chip-stagger-in')
    expect(button, 'the chip carries the entrance class').not.toBeNull()
    expect(button).toBeDisabled()
    const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n')
    const declaration = ruleBody(css, '.chip-stagger-in').match(/animation:\s*chipStaggerIn\b[^;]*;/)?.[0]
    expect(declaration, 'the entrance declaration').toBeDefined()
    // `forwards` and `both` hold the `to` keyframe's opacity: 1 over disabled:opacity-40.
    expect(declaration).not.toMatch(/\b(both|forwards)\b/)
    expect(declaration).toMatch(/\bbackwards;$/)
  })
})

describe('⭐ a chip-sent message sits on the user\'s side', () => {
  const css = readFileSync(resolve(__dirname, '../Conversation.module.css'), 'utf8')
  const body = ruleBody(css, '.chipActionIndicator')

  it('it is a block-level box pushed right, which works inside ChatMessage\'s block wrapper', () => {
    expect(body).toMatch(/margin-left:\s*auto/)
    expect(body).toMatch(/width:\s*fit-content/)
    expect(body).toMatch(/display:\s*flex;/)
  })

  it('CONTROL: no inline display, which `margin-left: auto` cannot move', () => {
    expect(body).not.toMatch(/display:\s*inline-?\w*;/)
  })
})
