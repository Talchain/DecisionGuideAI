/**
 * ORDER-UI-NEXT (DL, 13 Nov): the first live reply on #/scenario (core v3 429fbfcb, Paul's brief, s_c46697ea769b) drew as one wall of text.
 * The fixture is that reply's `answer.answer` exactly as core served it (three parts: text, a citation, text with ten line breaks).
 * Drawn: paragraphs at blank lines, the "- " lines as one list, words verbatim and in order, the citation marker as before.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import parts from './fixtures/live-first-reply-parts.json'
import { Blocks, Words } from '../ViewChat'

type Said = Parameters<typeof Words>[0]['parts']
const said = parts as unknown as Said
const plain = (s: string) => s.replace(/\s+/g, ' ').trim()
const coreText = plain(said.map((p) => ('text' in p ? p.text : '')).join(''))

describe('a reply keeps core\'s paragraphs and lists (the live first reply)', () => {
  it('CATCH: the four "- " lines are one list of four items, each item core\'s words without the marker; paragraphs at blank lines', () => {
    const { container } = render(<Blocks parts={said} at="chat.0.answer.answer" />)
    const items = [...container.querySelectorAll('[data-reply-list] > li')].map((li) => plain(li.textContent ?? ''))
    const fromCore = (said[2] as { text: string }).text.split('\n').filter((l) => /^\s*- /.test(l)).map((l) => plain(l.replace(/^\s*- /, '')))
    expect(fromCore.length).toBe(4)
    expect(items).toEqual(fromCore)
    expect(container.querySelectorAll('[data-reply-list]').length).toBe(1)
    expect(container.querySelectorAll('[data-reply-para]').length).toBeGreaterThanOrEqual(4)
  })
  it('INVARIANCE: every word verbatim and in order (only the list markers drop); the citation is the same one superscript; part 0 keeps its data-view', () => {
    const { container } = render(<Blocks parts={said} at="chat.0.answer.answer" />)
    const drawn = plain([...container.querySelectorAll('[data-view]')].map((e) => e.textContent).join('\n'))
    expect(drawn).toBe(plain(coreText.replace(/(^|\s)- /g, '$1')))
    const sup = container.querySelectorAll('sup[data-view-cite]')
    expect([sup.length, sup[0]?.textContent, sup[0]?.getAttribute('title')]).toEqual([1, '1', (said[1] as { cite: string }).cite])
    expect(container.querySelector('[data-view="chat.0.answer.answer.0.text"]')?.textContent).toBe((said[0] as { text: string }).text)
  })
})
