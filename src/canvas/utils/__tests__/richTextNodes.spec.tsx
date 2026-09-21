/**
 * richTextNodes — the dialect as React elements, with NO innerHTML.
 *
 * Bound to the two things that make this module worth having:
 *   · it renders the SAME marks `safeRichText` does (it is a converter over
 *     that function's output, not a second parser);
 *   · it creates NO live nodes from producer markup, and it never silently
 *     drops producer words.
 *
 * Every injection case asserts BOTH halves — the characters SURVIVE as text
 * AND no element was created. Either half alone passes against a wrong
 * implementation: text-only would pass one that also injected a node, and
 * absence-only would pass one that deleted the user's words.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { richTextNodes } from '../richTextNodes'
import { isSafeLinkUrl } from '../safeRichText'

function renderText(text: string): HTMLElement {
  render(<div data-testid="host">{richTextNodes(text)}</div>)
  return screen.getByTestId('host')
}

describe('richTextNodes — marks become elements', () => {
  it('renders **bold** as a real <strong> element', () => {
    const host = renderText('the **decisive** factor')
    expect(host.querySelector('strong')?.textContent).toBe('decisive')
    expect(host.textContent).toBe('the decisive factor')
  })

  it('renders *italic* as a real <em> element', () => {
    const host = renderText('an *urgent* call')
    expect(host.querySelector('em')?.textContent).toBe('urgent')
  })

  it('renders a bullet list as a <ul> with one <li> per item', () => {
    const host = renderText('- hiring freeze\n- price rise')
    const items = Array.from(host.querySelectorAll('li')).map((li) => li.textContent)
    expect(items).toEqual(['hiring freeze', 'price rise'])
  })

  it('renders an http link as an anchor carrying its href', () => {
    const host = renderText('see [the model](https://example.com/x)')
    const a = host.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://example.com/x')
    expect(a?.textContent).toBe('the model')
    expect(a?.getAttribute('rel')).toContain('noopener')
  })
})

describe('richTextNodes — the no-change pin', () => {
  it('returns unmarked prose unchanged, creating no elements', () => {
    const plain = 'One assumption worth checking: add a new-customer factor.'
    const host = renderText(plain)
    expect(host.textContent).toBe(plain)
    expect(host.children).toHaveLength(0)
  })

  it('leaves a snake_case field name intact', () => {
    const host = renderText('check goal_threshold_unit now')
    expect(host.textContent).toContain('goal_threshold_unit')
    expect(host.querySelector('em')).toBeNull()
  })

  it('returns the empty string for empty input', () => {
    expect(richTextNodes('')).toBe('')
  })
})

describe('richTextNodes — producer markup can never become live markup', () => {
  it.each([
    ['<script>alert(1)</script>', 'script'],
    ['<img src=x onerror=alert(1)>', 'img'],
    ['<iframe src="evil"></iframe>', 'iframe'],
  ])('renders %s as visible text and creates no <%s>', (payload, tag) => {
    const host = renderText(payload)
    expect(host.textContent).toContain(payload.slice(0, 6))
    expect(host.querySelector(tag)).toBeNull()
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,PHN2Zz4=',
    'vbscript:msgbox',
    '//evil.com',
  ])('refuses %s as an anchor while KEEPING the link text', (url) => {
    const host = renderText(`[click me](${url})`)
    expect(host.querySelector('a')).toBeNull()
    expect(host.textContent).toContain('click me')
  })

  it('positive control — a safe scheme DOES become an anchor', () => {
    // Without this, the four refusals above would pass against an
    // implementation that never rendered an anchor at all.
    const host = renderText('[ok](https://example.com)')
    expect(host.querySelector('a')).not.toBeNull()
  })
})

describe('the link gate is ONE predicate, shared with safeRichText', () => {
  it('accepts exactly http, https and mailto', () => {
    expect(isSafeLinkUrl('https://a.example')).toBe(true)
    expect(isSafeLinkUrl('http://a.example')).toBe(true)
    expect(isSafeLinkUrl('mailto:a@b.example')).toBe(true)
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeLinkUrl('//evil.com')).toBe(false)
  })
})
