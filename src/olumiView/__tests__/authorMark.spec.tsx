/**
 * Paul's acceptance step 1 (9 Nov): "every figure you wrote shows in your own words, marked as yours". The canvas card of a person's
 * figure says whose it is at rest, in core's words (cards[].author.text, core view/author.ts) with core's hover (author.title); Olumi's
 * own figures keep their ◆ alone. Bound by card id on the bakery golden (byte-equal to core f28da2b4's).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const v = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'bakery.view.json'), 'utf8')) as View
const cards = v.model!.cards
afterEach(cleanup)

describe('whose figure it is, on the card at rest', () => {
  const theirs = cards.filter((c) => c.figure !== null && c.author != null && c.author.by !== 'olumi')
  const olumis = cards.filter((c) => c.figure !== null && c.author?.by === 'olumi')
  it('precondition: the golden has both a person\'s figures and Olumi\'s', () => {
    expect(theirs.length).toBeGreaterThan(0)
    expect(olumis.length).toBeGreaterThan(0)
  })
  it('catch: each person\'s figure card draws core\'s author words verbatim, visible, with core\'s hover', () => {
    for (const c of theirs) {
      const el = render(<ViewCard card={c} />).container.querySelector<HTMLElement>(`[data-view="${c.id}.author.text"]`)
      expect(el?.textContent, c.id).toBe(c.author!.text)
      expect(el!.getAttribute('title')).toBe(c.author!.title)
      expect(el!.closest('.sr-only, .hidden'), c.id).toBeNull()
      cleanup()
    }
  })
  it('must not change: an Olumi figure draws no author line (its ◆ says it)', () => {
    for (const c of olumis) {
      expect(render(<ViewCard card={c} />).container.querySelector(`[data-view="${c.id}.author.text"]`), c.id).toBeNull()
      cleanup()
    }
  })
})
