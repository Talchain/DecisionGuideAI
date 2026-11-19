// fit3 (URL 3 audit item 9): the one-line proposal review gives core's heading room at the narrow dock (the reply lead keeps its 18 px line:
// S4 kept it; the lead's size waits on Paul's panel-width call). Width arithmetic only (no browser): a medium-weight sans face averages 0.52 em per character including spaces.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const HERE = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(HERE, p), 'utf8')
const EM = 0.52
const lines = (chars: number, size: number, width: number) => Math.ceil((chars * size * EM) / width)

describe('fit3: the proposal foot keeps core\'s count words on at most two lines at 317 px', () => {
  const HEADING = 'Olumi proposes 12 changes · new scenario'
  // closed row: mark 16 + gap 8, then Review (word 6 chars at 12 px + chevron 12 + gap 4 + px 16), approve 28, set aside 28, three 8 px gaps
  const room = (width: number, word: boolean) => width - 24 - (word ? 6 * 12 * EM + 12 + 4 + 16 : 28) - 28 - 28 - 24
  it.each([[317, 285], [347, 315]])('dock %i px (column %i): the heading wraps to 2 lines or fewer once Review drops its word', (_dock, col) => {
    expect(lines(HEADING.length, 12, room(col, false))).toBeLessThanOrEqual(2)
  })
  it('before: at 317 px the heading with the Review word took 3 lines', () => {
    expect(lines(HEADING.length, 12, room(285, true))).toBeGreaterThanOrEqual(3)
  })
  it('the word is its own span, hidden by a container query on the pinned box at 330 px and under, and the button keeps its accessible name through the heading press', () => {
    const tsx = read('ViewChat.tsx'), css = read('look/olumiLook.css')
    expect(tsx).toContain('<span className="ok-review-label">Review</span><FoldChevron open={open} />')
    expect(css).toMatch(/\.ok-pinned \{[^}]*container-type: inline-size;/)
    expect(css).toContain('@container (max-width: 330px) { .ok-pinned .ok-review-label { display: none; } }')
  })
})
