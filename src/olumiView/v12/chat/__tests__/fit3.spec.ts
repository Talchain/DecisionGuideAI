// fit3 (URL 3 audit item 9): the panel's large reply line is drawn one step down the type scale (18 -> 12 px medium), and the one-line proposal review gives
// core's heading room at the narrow dock. Width arithmetic only (no browser): a medium-weight sans face averages 0.52 em per character including spaces.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { typography } from '../../../../styles/typography'

const HERE = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(HERE, p), 'utf8')
const EM = 0.52
const SIZE: Record<string, number> = { 'text-lg': 18, 'text-xs': 12 }
const px = (c: string) => SIZE[c.split(' ')[0]!] ?? NaN
const lines = (chars: number, size: number, width: number) => Math.ceil((chars * size * EM) / width)
const CHARS = (words: number) => Math.round(words * 6.4)

describe('fit3: the large reply line is one step down the panel scale (18 -> 12 medium; calmPanel spec 6 forbids a 14 px panel class)', () => {
  it('draws it at the 12 px medium heading token, not the 18 px headline, in both places a lead is drawn', () => {
    expect(px(typography.viewPanelHeadline)).toBe(18)
    expect(px(typography.viewPanelHeading)).toBe(12)
    expect(read('v12/chat/ReplyLead.tsx')).toContain('${typography.viewPanelHeading} text-text-header')
    expect(read('v12/chat/ReplyLead.tsx')).not.toContain('viewPanelHeadline')
    expect(read('ViewChat.tsx')).toContain('bigLead && gi === o ? `m-0 ${typography.viewPanelHeading} text-text-header`')
  })
  it.each([[14], [20]])('a %i-word headline: at most 3 lines at 1232 (347 px dock, 315 px column), was more', (words) => {
    const after = lines(CHARS(words), 12, 315), before = lines(CHARS(words), 18, 315)
    expect(after).toBeLessThanOrEqual(3)
    expect(after).toBeLessThanOrEqual(before)
  })
  it('the 20-word headline at 317 px (285 px column): 18 px took 4+ lines, 12 px takes fewer', () => {
    expect(lines(CHARS(20), 18, 285)).toBeGreaterThanOrEqual(4)
    expect(lines(CHARS(20), 12, 285)).toBeLessThan(lines(CHARS(20), 18, 285))
  })
})

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
