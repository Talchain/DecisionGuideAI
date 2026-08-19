/**
 * MessageBubble — the user's OWN words: what formatting survives, and what
 * must never become markup.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A lane was briefed to ADD light formatting (bold / italic / bullets /
 * numbered lists / line breaks) to user messages, on the stated premise that
 * the user bubble rendered raw text. That premise was refuted at this tip:
 * the user bubble and the assistant bubble share ONE body path
 * (`safeRichText` → `dangerouslySetInnerHTML`, MessageBubble.tsx), so four of
 * those five already render. Nothing pinned that, which is how it came to be
 * described as missing.
 *
 * These tests are therefore CHARACTERISATION PINS, not the guard of a new
 * feature — no behaviour is changed by the commit that introduces them. They
 * make the current contract fail loud in BOTH directions:
 *
 *   · supported subset  — bold, bullets, numbered lists, line breaks render as
 *     the corresponding ELEMENT inside the user's own bubble;
 *   · literal subset    — italic (`*x*` / `_x_`) is DELIBERATELY unsupported
 *     (`safeRichText`'s documented allowlist contract, 2d88c8cf, which removed
 *     DOMPurify + `marked` on purpose). Pinned so that re-adding it is a
 *     deliberate contract change with a failing test to answer, not a silent
 *     drift;
 *   · injection         — `<script>`, `<b>`, `<img onerror>` render as VISIBLE
 *     TEXT and create NO corresponding element node.
 *
 * The injection cases assert BOTH halves: textContent shows the literal
 * characters AND `querySelector` finds no element. Asserting only the text
 * would pass against an implementation that also injected a live node, and
 * asserting only the absence would pass against one that silently dropped the
 * user's words.
 *
 * Assertions bind by identity — `message-user` → `message-body-text` — never
 * by a substring another node in the tree could satisfy.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

/** Render a user message and return its body element, bound by test id. */
function renderUserBody(content: string): HTMLElement {
  const message: ConversationMessage = {
    id: 'msg-user-fmt',
    role: 'user',
    content,
    timestamp: new Date(),
  }
  render(<MessageBubble message={message} onChipClick={vi.fn()} />)
  // Bind to the USER bubble specifically, then to its body within.
  const bubble = screen.getByTestId('message-user')
  const body = bubble.querySelector('[data-testid="message-body-text"]')
  expect(body, 'user bubble must render a body element').not.toBeNull()
  return body as HTMLElement
}

describe("MessageBubble — the user's own words", () => {
  describe('supported formatting renders as elements', () => {
    it('renders **bold** as a <strong> element carrying the bold text', () => {
      const body = renderUserBody('the **decisive** factor')
      const strong = body.querySelector('strong')
      expect(strong).not.toBeNull()
      expect(strong?.textContent).toBe('decisive')
    })

    it('renders "- " bullets as a <ul> with one <li> per item', () => {
      const body = renderUserBody('- hiring freeze\n- price rise')
      const ul = body.querySelector('ul')
      expect(ul).not.toBeNull()
      const items = Array.from(ul!.querySelectorAll('li')).map((li) => li.textContent)
      expect(items).toEqual(['hiring freeze', 'price rise'])
    })

    it('renders "* " bullets as a <ul> — the form pasted briefs most often use', () => {
      const body = renderUserBody('* hiring freeze\n* price rise')
      const ul = body.querySelector('ul')
      expect(ul).not.toBeNull()
      expect(ul!.querySelectorAll('li')).toHaveLength(2)
    })

    it('renders "1. " numbered items as an <ol> with one <li> per item', () => {
      const body = renderUserBody('1. frame it\n2. decide it')
      const ol = body.querySelector('ol')
      expect(ol).not.toBeNull()
      const items = Array.from(ol!.querySelectorAll('li')).map((li) => li.textContent)
      expect(items).toEqual(['frame it', 'decide it'])
      // Bound by element type: a <ul> here would mean bullets, not numbering.
      expect(body.querySelector('ul')).toBeNull()
    })

    it('renders a single newline as a <br> element, not a collapsed space', () => {
      const body = renderUserBody('first line\nsecond line')
      expect(body.querySelectorAll('br').length).toBeGreaterThanOrEqual(1)
    })

    it('separates blank-line paragraphs with a gap spacer', () => {
      const body = renderUserBody('opening para\n\nsecond para')
      expect(body.querySelector('br.md-gap')).not.toBeNull()
    })
  })

  describe('deliberately unsupported syntax stays literal', () => {
    // Pins safeRichText's documented allowlist. If italic is ever added this
    // test MUST be updated deliberately — that is the point of pinning it.
    it('leaves *italic* as literal text and creates no <em>', () => {
      const body = renderUserBody('an *urgent* decision')
      expect(body.textContent).toContain('*urgent*')
      expect(body.querySelector('em')).toBeNull()
      expect(body.querySelector('i')).toBeNull()
    })

    it('leaves _italic_ as literal text and creates no <em>', () => {
      const body = renderUserBody('an _urgent_ decision')
      expect(body.textContent).toContain('_urgent_')
      expect(body.querySelector('em')).toBeNull()
    })

    it('leaves backtick code as literal text and creates no <code>', () => {
      const body = renderUserBody('run `deploy` now')
      expect(body.textContent).toContain('`deploy`')
      expect(body.querySelector('code')).toBeNull()
    })

    it('leaves an unbalanced asterisk as literal text', () => {
      const body = renderUserBody('margin * 2 and ** more')
      expect(body.textContent).toContain('*')
      expect(body.querySelector('strong')).toBeNull()
      expect(body.querySelector('em')).toBeNull()
    })
  })

  describe('user-supplied markup can never become markup', () => {
    it('renders <script> as visible text and creates NO script element', () => {
      const body = renderUserBody('<script>alert(1)</script>')
      expect(body.textContent).toContain('<script>')
      expect(body.textContent).toContain('</script>')
      expect(body.querySelector('script')).toBeNull()
    })

    it('renders <b>x</b> as visible text and creates NO b element', () => {
      const body = renderUserBody('<b>x</b>')
      expect(body.textContent).toContain('<b>x</b>')
      expect(body.querySelector('b')).toBeNull()
    })

    it('renders an <img onerror> payload as visible text and creates NO img element', () => {
      const body = renderUserBody('<img src=x onerror=alert(1)>')
      expect(body.textContent).toContain('<img')
      expect(body.querySelector('img')).toBeNull()
    })

    it('renders a bare ampersand as a single literal & character', () => {
      const body = renderUserBody('Tom & Jerry')
      expect(body.textContent).toContain('Tom & Jerry')
    })
  })
})
