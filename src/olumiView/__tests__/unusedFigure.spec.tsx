/**
 * Core's honesty line (card.unused, candidate 2a283a4f, DL 8 Nov): a figure Olumi's analysis does not use yet says so, once, on its
 * card, in core's words, and stays editable. Core's own golden s_ce285b3617bb (re-read from 2a283a4f) carries one.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 's_ce285b3617bb.view.json'), 'utf8')) as View
afterEach(cleanup)

describe('a figure the analysis does not use yet', () => {
  it('says core\'s line once, under the figure, at its path; the figure keeps its edit', () => {
    const card = view.model!.cards.find((c) => c.unused != null && c.unused !== '')!
    expect(card.figure).not.toBeNull()
    const { container } = render(<ViewCard card={card} />)
    const said = container.querySelectorAll(`[data-view="${card.id}.unused"]`)
    expect(said).toHaveLength(1)
    expect(said[0]!.textContent).toBe(card.unused)
    const fig = container.querySelector(`[data-view="${card.id}.figure.text"], [data-view-values="${card.id}"]`)!
    expect(fig.compareDocumentPosition(said[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(said[0]!.className).not.toMatch(/line-clamp|truncate|opacity/)
    if (card.figure!.edit) expect(container.querySelector('[data-figure-edit-wrap]')).not.toBeNull()
  })

  it('contrast: a figure core does not mark draws no such line', () => {
    const card = view.model!.cards.find((c) => c.figure !== null && (c.unused ?? null) === null)!
    const { container } = render(<ViewCard card={card} />)
    expect(container.querySelectorAll('[data-testid="view-card-unused"]')).toHaveLength(0)
  })
})
