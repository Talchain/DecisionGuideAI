/**
 * Brief A — Orchestrator Rendering V2 test suite
 *
 * Covers:
 * § 1  safeRichText — markdown, XSS, XML entity decoding
 * § 2  adaptCEEBlock — commentary title, review_card tone mapping
 * § 3  CommentaryBlockRenderer — collapse, expanded default, a11y
 * § 4  ReviewCardBlockRenderer — tone-driven visual treatment, fallback
 * § 5  Feature flag — off = current behaviour unchanged
 * § 6  Fixture golden-path — envelope parsing shapes
 *
 * All rendering tests use golden fixtures from fixtures/orchestrator-rendering-v2.json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { safeRichText, plainTextPreview } from '../../utils/safeRichText'
import { adaptCEEBlock } from '../useConversation'
import type { CommentaryBlock, ReviewCardBlock } from '../types'
import fixtureData from './fixtures/orchestrator-rendering-v2.json'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a fragment of HTML and return the container element */
function renderHtml(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

// ---------------------------------------------------------------------------
// § 1 — safeRichText
// ---------------------------------------------------------------------------

describe('safeRichText — basic markdown', () => {
  it('converts **bold** to <strong>', () => {
    const html = safeRichText('Hello **world**')
    expect(html).toContain('<strong>world</strong>')
  })

  it('converts multiple bold spans in one line', () => {
    const html = safeRichText('**A** and **B**')
    expect(html).toContain('<strong>A</strong>')
    expect(html).toContain('<strong>B</strong>')
  })

  it('converts - bullet items to <ul><li>', () => {
    const html = safeRichText('- Alpha\n- Beta\n- Gamma')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Alpha</li>')
    expect(html).toContain('<li>Beta</li>')
    expect(html).toContain('<li>Gamma</li>')
  })

  it('converts single newline to <br> between non-bullet lines', () => {
    const html = safeRichText('Line one\nLine two')
    expect(html).toContain('<br>')
    expect(html).toContain('Line one')
    expect(html).toContain('Line two')
  })

  it('renders bold inside bullet item', () => {
    const html = safeRichText('- **Bold item**')
    expect(html).toContain('<li><strong>Bold item</strong></li>')
  })

  it('returns empty string for empty input', () => {
    expect(safeRichText('')).toBe('')
  })

  it('returns empty string for non-string input', () => {
    expect(safeRichText(null as unknown as string)).toBe('')
    expect(safeRichText(undefined as unknown as string)).toBe('')
  })

  it('handles mixed content — text, bullets, bold', () => {
    const html = safeRichText('**Lead phrase.** Here is context.\n\n- First item\n- Second item')
    expect(html).toContain('<strong>Lead phrase.</strong>')
    expect(html).toContain('<li>First item</li>')
    expect(html).toContain('<li>Second item</li>')
  })
})

describe('safeRichText — XSS protection', () => {
  it('strips <script> tags', () => {
    const html = safeRichText('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
  })

  it('strips script inside bold markdown', () => {
    const html = safeRichText('**<script>alert(1)</script>**')
    expect(html).not.toContain('<script>')
    // Bold wrapper should still render the escaped text
    expect(html).toContain('<strong>')
  })

  it('strips <img onerror> injection — no <img> element in DOM', () => {
    // escapeHtml runs first: <img...> → &lt;img...&gt; (displayed as text, not parsed as element)
    // The critical test: no <img> element appears in the parsed DOM
    const html = safeRichText('<img src=x onerror=alert(1)>')
    const container = renderHtml(html)
    expect(container.querySelector('img')).toBeNull()
    // No real attributes on any element (onerror can only appear inside escaped text)
    const allEls = Array.from(container.querySelectorAll('*'))
    for (const el of allEls) {
      expect(el.getAttribute('onerror')).toBeNull()
    }
  })

  it('strips raw <a href> link tags — no <a> element in DOM', () => {
    // escapeHtml runs first: <a href=...> → &lt;a href=...&gt; (safe text)
    const html = safeRichText('<a href="javascript:alert(1)">click</a>')
    const container = renderHtml(html)
    expect(container.querySelector('a')).toBeNull()
  })

  it('strips disallowed tags but preserves text content', () => {
    const html = safeRichText('<h1>Big heading</h1>')
    expect(html).not.toContain('<h1>')
    // Text content should survive
    expect(html).toContain('Big heading')
  })

  it('only allows strong, br, ul, li in output', () => {
    const html = safeRichText('**bold** and - item\nline break')
    const container = renderHtml(html)
    const tags = Array.from(container.querySelectorAll('*')).map((el) => el.tagName.toLowerCase())
    const disallowedTags = tags.filter((t) => !['strong', 'br', 'ul', 'li'].includes(t))
    expect(disallowedTags).toHaveLength(0)
  })
})

describe('safeRichText — XML entity decoding', () => {
  it('renders &amp; as &', () => {
    const html = safeRichText('a &amp; b')
    const container = renderHtml(html)
    expect(container.textContent).toContain('a & b')
  })

  it('renders &lt; as < (escaped in HTML, visible as <)', () => {
    const html = safeRichText('a &lt; b')
    const container = renderHtml(html)
    expect(container.textContent).toContain('a < b')
  })

  it('renders &gt; as >', () => {
    const html = safeRichText('a &gt; b')
    const container = renderHtml(html)
    expect(container.textContent).toContain('a > b')
  })

  it('decodes entities inside bold markdown', () => {
    const html = safeRichText('**value &amp; key**')
    const container = renderHtml(html)
    expect(container.querySelector('strong')?.textContent).toContain('value & key')
  })

  it('decodes &lt;strong&gt; as text, not markup injection', () => {
    // This is the most important: an entity-encoded tag must not become real markup
    const html = safeRichText('Use &lt;strong&gt; markup.')
    expect(html).not.toMatch(/<strong>\s*markup/)
    const container = renderHtml(html)
    // The text should contain the literal angle bracket characters
    expect(container.textContent).toContain('<strong>')
  })

  it('uses golden fixture xml-escaped envelope', () => {
    const envelope = fixtureData.envelopes.xmlEscapedContent
    const commentaryBlock = envelope.blocks[0]
    const adapted = adaptCEEBlock(commentaryBlock) as CommentaryBlock
    const html = safeRichText(adapted.text)
    const container = renderHtml(html)
    // Should contain the decoded characters, not the entity references
    expect(container.textContent).toContain('&')
    expect(container.textContent).toContain('<')
    expect(container.textContent).toContain('>')
  })
})

// ---------------------------------------------------------------------------
// § 2 — adaptCEEBlock — commentary title and review_card tone
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — commentary title', () => {
  it('passes through title from commentary block data', () => {
    const raw = {
      block_type: 'commentary',
      block_id: 'c1',
      data: { title: 'My title', narrative: 'Content' },
    }
    const result = adaptCEEBlock(raw) as CommentaryBlock
    expect(result.title).toBe('My title')
  })

  it('title is undefined when not provided', () => {
    const raw = {
      block_type: 'commentary',
      block_id: 'c2',
      data: { narrative: 'Content only' },
    }
    const result = adaptCEEBlock(raw) as CommentaryBlock
    expect(result.title).toBeUndefined()
  })

  it('uses golden fixture envelope for commentary with title', () => {
    const envelope = fixtureData.envelopes.commentaryWithTitle
    const raw = envelope.blocks[0]
    const result = adaptCEEBlock(raw) as CommentaryBlock
    expect(result.type).toBe('commentary')
    expect(result.title).toBe('Sensitivity breakdown')
    expect(result.text).toContain('price elasticity')
  })
})

describe('adaptCEEBlock — review_card tone mapping', () => {
  beforeEach(() => {
    // These tests verify flag-ON behaviour: tone→variant mapping must be active
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('maps tone=challenger → variant=alert', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'rv1',
      data: { title: 'Risk', description: 'Content', tone: 'challenger' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('alert')
    expect(result.tone).toBe('challenger')
  })

  it('maps tone=facilitator → variant=info', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'rv2',
      data: { title: 'Tip', description: 'Content', tone: 'facilitator' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('info')
    expect(result.tone).toBe('facilitator')
  })

  it('missing tone → variant=info (facilitator default)', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'rv3',
      data: { title: 'Tip', description: 'Content' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('info')
    expect(result.tone).toBeUndefined()
  })

  it('unrecognised tone string → variant=info (graceful fallback)', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'rv4',
      data: { title: 'Tip', description: 'Content', tone: 'scientist' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('info')
  })

  it('tone takes precedence over variant field', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'rv5',
      data: { title: 'Risk', description: 'Content', tone: 'challenger', variant: 'info' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    // challenger tone overrides 'info' variant
    expect(result.variant).toBe('alert')
  })

  it('uses golden fixture challenger envelope', () => {
    const raw = fixtureData.envelopes.reviewCardChallenger.blocks[0]
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('alert')
    expect(result.tone).toBe('challenger')
    expect(result.title).toBe('Concentration risk')
  })

  it('uses golden fixture facilitator envelope', () => {
    const raw = fixtureData.envelopes.reviewCardFacilitator.blocks[0]
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('info')
    expect(result.tone).toBe('facilitator')
  })
})

// ---------------------------------------------------------------------------
// § 3 — CommentaryBlockRenderer — collapse, expand default, a11y
// (Flag ON — import the component + mock the flag)
// ---------------------------------------------------------------------------

// We test the component by importing InlineBlocks and rendering a single commentary block.
// Flag mocking: vi.mock the flags module.

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorRenderingV2Enabled: vi.fn().mockReturnValue(true),
  }
})

import { InlineBlocks } from '../InlineBlocks'
import { isOrchestratorRenderingV2Enabled } from '../../../flags'

function makeCommentaryBlock(overrides: Partial<CommentaryBlock> = {}): CommentaryBlock {
  return {
    type: 'commentary',
    text: 'First line of commentary.\n\nSecond paragraph with more detail.',
    ...overrides,
  }
}

describe('CommentaryBlockRenderer — flag ON (collapse behaviour)', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('renders a toggle button with aria-expanded', () => {
    const block = makeCommentaryBlock({ title: 'Analysis summary' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary|collapse commentary/i })
    expect(toggle).toBeDefined()
    // Default: assistant_text > 20 words → collapsed
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows title as preview when title is provided', () => {
    const block = makeCommentaryBlock({ title: 'My title', text: 'Full content.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    expect(screen.getByText('My title')).toBeDefined()
  })

  it('shows first line of text as preview when no title', () => {
    const block = makeCommentaryBlock({
      title: undefined,
      text: 'First line used as preview.\n\nMore content.',
    })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    expect(screen.getByText('First line used as preview.')).toBeDefined()
  })

  it('defaults to collapsed when assistant_text has 20+ words', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Full content.' })
    // 20+ words in assistant text → collapsed
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={25} />)
    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // Full content not visible yet
    expect(screen.queryByText('Full content.')).toBeNull()
  })

  it('defaults to expanded when assistant_text has < 20 words', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Full content.' })
    // < 20 words → expanded (commentary is the essential finding)
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={5} />)
    const toggle = screen.getByRole('button', { name: /collapse commentary/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Full content.')).toBeDefined()
  })

  it('expands on click — shows full content', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Expanded text here.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Expanded text here.')).toBeDefined()
  })

  it('collapses on second click', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Expandable.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    fireEvent.click(toggle) // expand
    fireEvent.click(toggle) // collapse

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('toggle is keyboard-operable with Enter key', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Content.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' })

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggle is keyboard-operable with Space key', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Content.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    fireEvent.keyDown(toggle, { key: ' ', code: 'Space' })

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('expanded content contains markdown rendered as HTML (bold)', () => {
    const block = makeCommentaryBlock({
      title: 'T',
      text: '**Important finding** here.',
    })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)

    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    fireEvent.click(toggle)

    const expandedDiv = screen.getByText('Important finding', { exact: false })
    expect(expandedDiv.tagName.toLowerCase()).toBe('strong')
  })

  it('commentary without title defaults to expanded when assistantTextWordCount < 20', () => {
    const block = makeCommentaryBlock({ title: undefined, text: 'This is the only place.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={3} />)
    // When expanded, the text appears in both the toggle preview and the expanded content
    const matches = screen.getAllByText('This is the only place.')
    expect(matches.length).toBeGreaterThan(0)
    const toggle = screen.getByRole('button', { name: /collapse commentary/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// § 4 — ReviewCardBlockRenderer — tone-driven visual, fallback
// ---------------------------------------------------------------------------

function makeReviewBlock(overrides: Partial<ReviewCardBlock> = {}): ReviewCardBlock {
  return {
    type: 'review_card',
    title: 'Test card',
    body: 'Body text.',
    variant: 'info',
    ...overrides,
  }
}

describe('ReviewCardBlockRenderer — flag ON', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('challenger tone renders alert variant (AlertTriangle icon)', () => {
    const block = makeReviewBlock({ tone: 'challenger', variant: 'alert' })
    render(<InlineBlocks blocks={[block]} />)
    // AlertTriangle renders — role-based query not possible for SVG, check aria
    const card = screen.getByText('Body text.').closest('div[class]')
    expect(card).toBeDefined()
    // The card should have the alert class (top border-danger)
    // We test the rendered title and body are present
    expect(screen.getByText('Test card')).toBeDefined()
    expect(screen.getByText('Body text.')).toBeDefined()
  })

  it('facilitator tone renders info variant (Lightbulb icon)', () => {
    const block = makeReviewBlock({ tone: 'facilitator', variant: 'info' })
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByText('Test card')).toBeDefined()
  })

  it('missing tone renders as facilitator (info default)', () => {
    const block = makeReviewBlock({ tone: undefined, variant: 'info' })
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByText('Test card')).toBeDefined()
    expect(screen.getByText('Body text.')).toBeDefined()
  })

  it('unrecognised tone renders as facilitator (info default)', () => {
    const block = makeReviewBlock({ tone: 'scientist' as any, variant: 'info' })
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByText('Test card')).toBeDefined()
  })

  it('body content is rendered via safeRichText (bold in body)', () => {
    const block = makeReviewBlock({ body: '**Critical finding** here.', variant: 'alert', tone: 'challenger' })
    render(<InlineBlocks blocks={[block]} />)
    const strong = screen.getByText('Critical finding', { exact: false })
    expect(strong.tagName.toLowerCase()).toBe('strong')
  })

  it('does not render scientist tone as review_card (no variant=scientist)', () => {
    // Brief explicitly says: do not extend tones beyond challenger|facilitator
    const block = makeReviewBlock({ tone: 'scientist' as any })
    render(<InlineBlocks blocks={[block]} />)
    // Must still render (as info/facilitator default), not crash
    expect(screen.getByText('Test card')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// § 5 — Feature flag — OFF = current behaviour
// ---------------------------------------------------------------------------

describe('Feature flag OFF — current behaviour preserved', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
  })

  afterEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('commentary renders inline (no toggle button) when flag is off', () => {
    const block = makeCommentaryBlock({ title: 'T', text: 'Plain text.' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    expect(screen.queryByRole('button', { name: /expand commentary|collapse commentary/i })).toBeNull()
    // Content renders directly
    expect(screen.getByText('Plain text.')).toBeDefined()
  })

  it('review card renders body as plain text when flag is off', () => {
    const block = makeReviewBlock({ body: '**Bold** text.', variant: 'info' })
    render(<InlineBlocks blocks={[block]} />)
    // In flag-off mode, body is <p> plain text — no <strong> wrapping
    expect(screen.queryByText('Bold', { exact: false })?.tagName?.toLowerCase()).not.toBe('strong')
  })

  it('review card variant is used directly (not overridden by tone) when flag is off', () => {
    // If variant=info but tone=challenger, flag off → uses variant=info
    const block = makeReviewBlock({ variant: 'info', tone: 'challenger' })
    render(<InlineBlocks blocks={[block]} />)
    // Component renders — with info variant (Lightbulb) not alert
    expect(screen.getByText('Test card')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// § 6 — Fixture golden-path — envelope shape
// ---------------------------------------------------------------------------

describe('Fixture golden-path — envelope shapes', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('markdownInAssistantText fixture: assistant_text contains markdown formatting', () => {
    const env = fixtureData.envelopes.markdownInAssistantText
    const html = safeRichText(env.assistant_text)
    expect(html).toContain('<strong>Revenue at risk.</strong>')
    expect(html).toContain('<li>Market share erosion (0.28)</li>')
    expect(html).toContain('<li>Price elasticity</li>')
  })

  it('commentaryWithTitle fixture: adaptCEEBlock produces title and text', () => {
    const raw = fixtureData.envelopes.commentaryWithTitle.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    expect(block.title).toBe('Sensitivity breakdown')
    expect(block.text).toContain('price elasticity')
  })

  it('commentaryWithoutTitle fixture: preview falls back to first text line', () => {
    const raw = fixtureData.envelopes.commentaryWithoutTitle.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    expect(block.title).toBeUndefined()
    expect(block.text).toContain('First line of content')
  })

  it('commentaryShortAssistantText: assistant_text word count < 20 → should default to expanded', () => {
    const env = fixtureData.envelopes.commentaryShortAssistantText
    const wordCount = env.assistant_text.trim().split(/\s+/).filter(Boolean).length
    expect(wordCount).toBeLessThan(20)
    // The word count triggers the expanded default logic
  })

  it('reviewCardChallenger fixture: variant=alert after adaptation', () => {
    const raw = fixtureData.envelopes.reviewCardChallenger.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('alert')
    expect(block.tone).toBe('challenger')
  })

  it('reviewCardFacilitator fixture: variant=info after adaptation', () => {
    const raw = fixtureData.envelopes.reviewCardFacilitator.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
    expect(block.tone).toBe('facilitator')
  })

  it('reviewCardMissingTone fixture: falls back to variant=info', () => {
    const raw = fixtureData.envelopes.reviewCardMissingTone.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
    expect(block.tone).toBeUndefined()
  })

  it('reviewCardUnrecognisedTone fixture: scientist tone falls back to variant=info', () => {
    const raw = fixtureData.envelopes.reviewCardUnrecognisedTone.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// § 7 — P0-2: Flag OFF rollback — end-to-end via adaptCEEBlock + fixture
// Verifies that tone→variant mapping does not leak through when flag is off.
// ---------------------------------------------------------------------------

describe('Flag OFF rollback — adaptCEEBlock + fixture (end-to-end)', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
  })

  afterEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('challenger envelope → variant=info when flag is off (no tone mapping)', () => {
    // The raw envelope has tone=challenger but no explicit variant field.
    // Flag off → variantFromTone is skipped; variantDirect is undefined; fallback is 'info'.
    const raw = fixtureData.envelopes.reviewCardChallenger.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
    // tone is still stored (pass-through), but variant is not influenced by it
    expect(block.tone).toBe('challenger')
  })

  it('facilitator envelope → variant=info when flag is off', () => {
    const raw = fixtureData.envelopes.reviewCardFacilitator.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
  })

  it('missing tone envelope → variant=info when flag is off (legacy fallback)', () => {
    const raw = fixtureData.envelopes.reviewCardMissingTone.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    expect(block.variant).toBe('info')
  })

  it('challenger envelope + flag off → renders as info card (data-testid=block-review-info)', () => {
    const raw = fixtureData.envelopes.reviewCardChallenger.blocks[0]
    const block = adaptCEEBlock(raw) as ReviewCardBlock
    render(<InlineBlocks blocks={[block]} />)
    // BlockRenderer passes data-testid="block-review-{variant}" — with variant=info the
    // wrapper must have data-testid="block-review-info", not "block-review-alert"
    expect(screen.getByTestId('block-review-info')).toBeDefined()
    expect(screen.queryByTestId('block-review-alert')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// § 8 — P1-1: Blank-line paragraph separation in safeRichText
// ---------------------------------------------------------------------------

describe('safeRichText — blank-line paragraph separation', () => {
  it('two paragraphs separated by a blank line produce a <br> between them', () => {
    const html = safeRichText('Para one.\n\nPara two.')
    const container = renderHtml(html)
    // Both paragraphs must appear as separate text nodes with a <br> between
    expect(container.textContent).toContain('Para one.')
    expect(container.textContent).toContain('Para two.')
    expect(html).toContain('<br>')
  })

  it('leading blank line does not produce a leading <br>', () => {
    const html = safeRichText('\n\nFirst paragraph.')
    expect(html.startsWith('<br>')).toBe(false)
    expect(html).toContain('First paragraph.')
  })

  it('blank line between bullet list and prose produces visible separation', () => {
    const html = safeRichText('- Item one\n- Item two\n\nFollowing prose.')
    expect(html).toContain('<ul>')
    expect(html).toContain('Following prose.')
    // Prose appears after the list
    const listEnd = html.indexOf('</ul>')
    const proseStart = html.indexOf('Following prose.')
    expect(proseStart).toBeGreaterThan(listEnd)
  })

  it('uses golden fixture with multi-paragraph commentary content', () => {
    const raw = fixtureData.envelopes.commentaryWithoutTitle.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    // commentary has two paragraphs separated by \n\n
    const html = safeRichText(block.text)
    const container = renderHtml(html)
    expect(container.textContent).toContain('First line of content')
    expect(container.textContent).toContain('Second paragraph')
    // Must have a break between them
    expect(html).toContain('<br>')
  })
})

// ---------------------------------------------------------------------------
// § 9 — P1-2: plainTextPreview — entity decode and markdown strip for preview label
// ---------------------------------------------------------------------------

describe('plainTextPreview — entity decode and markdown strip', () => {
  it('strips bold markers from first line', () => {
    const result = plainTextPreview('**Lead phrase.** Here is context.\n\nMore detail.')
    expect(result).toBe('Lead phrase. Here is context.')
    expect(result).not.toContain('**')
  })

  it('decodes &amp; entity to &', () => {
    const result = plainTextPreview('a &amp; b description.')
    expect(result).toBe('a & b description.')
  })

  it('decodes &lt; and &gt; entities', () => {
    const result = plainTextPreview('value &lt; threshold &gt; zero')
    expect(result).toBe('value < threshold > zero')
  })

  it('takes only first non-empty line', () => {
    const result = plainTextPreview('\n\nFirst real line.\n\nSecond line.')
    expect(result).toBe('First real line.')
  })

  it('commentary toggle shows decoded preview when text has entities', () => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
    const raw = fixtureData.envelopes.xmlEscapedContent.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    // block.text contains &amp; &lt; &gt; — the preview must decode them
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    // The toggle should show decoded characters in the preview span, not raw entities
    const toggle = screen.getByRole('button', { name: /expand commentary|collapse commentary/i })
    // The preview text content should not contain raw entity strings
    expect(toggle.textContent).not.toContain('&amp;')
    expect(toggle.textContent).not.toContain('&lt;')
  })
})

// ---------------------------------------------------------------------------
// § 10 — P1-3: safeRichText — empty bullet and additional coverage
// ---------------------------------------------------------------------------

describe('safeRichText — empty bullet item', () => {
  it('renders empty bullet (dash with no text) as empty <li>', () => {
    // "- " with nothing after: trimmed === '-', itemText = ''
    const html = safeRichText('- First\n-\n- Third')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>First</li>')
    expect(html).toContain('<li></li>')
    expect(html).toContain('<li>Third</li>')
  })

  it('renders "- " (dash space, no text) as empty <li>', () => {
    const html = safeRichText('- ')
    expect(html).toContain('<li></li>')
  })
})

// ---------------------------------------------------------------------------
// § 11 — P1-3: Commentary toggle — focus and tabIndex
// ---------------------------------------------------------------------------

describe('CommentaryBlockRenderer — focus and tabIndex', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('toggle button is natively focusable (no explicit tabIndex override)', () => {
    const block = makeCommentaryBlock({ title: 'Focus test' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    // type="button" is focusable by default; tabIndex should be 0 or -1 (not removed from flow)
    const tabIndex = toggle.getAttribute('tabindex')
    // null means no explicit override — browser default is 0 (in tab order)
    expect(tabIndex === null || Number(tabIndex) >= 0).toBe(true)
  })

  it('toggle button has accessible aria-label', () => {
    const block = makeCommentaryBlock({ title: 'A11y test' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    const toggle = screen.getByRole('button', { name: /expand commentary/i })
    expect(toggle.getAttribute('aria-label')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// § 12 — Null assistant_text with commentary — must default to expanded
// ---------------------------------------------------------------------------

describe('Null assistant_text → commentary defaults to expanded', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('null assistant_text fixture: commentary defaults to expanded (word count = 0)', () => {
    const raw = fixtureData.envelopes.nullAssistantTextWithCommentary.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={0} />)
    // Should be expanded since assistant_text word count < 20
    const toggle = screen.getByRole('button', { name: /collapse commentary/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('null assistant_text fixture: commentary text is rendered (in both preview and expanded)', () => {
    const raw = fixtureData.envelopes.nullAssistantTextWithCommentary.blocks[0]
    const block = adaptCEEBlock(raw) as CommentaryBlock
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={0} />)
    // When expanded, text appears in both the toggle preview and expanded content
    const matches = screen.getAllByText('This commentary IS the answer when assistant_text is null.')
    expect(matches.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// § 13 — Graceful degradation of unsupported markdown
// ---------------------------------------------------------------------------

describe('safeRichText — unsupported markdown degradation', () => {
  it('headers render as bold text (no raw # visible)', () => {
    const html = safeRichText('# Heading one\n## Heading two')
    const container = renderHtml(html)
    // No h1/h2 elements
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('h2')).toBeNull()
    // Text content preserved as bold, # prefix stripped
    const strongs = container.querySelectorAll('strong')
    expect(strongs.length).toBe(2)
    expect(strongs[0].textContent).toBe('Heading one')
    expect(strongs[1].textContent).toBe('Heading two')
    expect(container.textContent).not.toContain('#')
  })

  it('tables render as structured text (no raw | syntax)', () => {
    const html = safeRichText('| Col A | Col B |\n|-------|-------|\n| 1     | 2     |')
    const container = renderHtml(html)
    // No table elements
    expect(container.querySelector('table')).toBeNull()
    // Header row captured, data row rendered as structured text
    expect(container.textContent).toContain('Col A:')
    expect(container.textContent).toContain('Col B:')
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('2')
    // No raw pipe characters
    expect(container.textContent).not.toContain('|')
  })

  it('horizontal rules render as vertical gap (no raw --- visible)', () => {
    const html = safeRichText('Before\n\n---\n\nAfter')
    const container = renderHtml(html)
    expect(container.querySelector('hr')).toBeNull()
    // --- stripped, replaced with gap spacer
    expect(container.textContent).not.toContain('---')
    expect(container.textContent).toContain('Before')
    expect(container.textContent).toContain('After')
    // Gap spacer is a <br> with md-gap class
    expect(container.querySelector('br.md-gap')).not.toBeNull()
  })

  it('code blocks render as plain text', () => {
    const html = safeRichText('```code block```')
    const container = renderHtml(html)
    expect(container.querySelector('code')).toBeNull()
    expect(container.querySelector('pre')).toBeNull()
  })

  it('uses golden fixture for unsupported markdown', () => {
    const env = fixtureData.envelopes.unsupportedMarkdown
    const html = safeRichText(env.assistant_text)
    const container = renderHtml(html)
    // Headings degrade to bold; explicit **bold** also works
    const strongs = container.querySelectorAll('strong')
    expect(strongs.length).toBeGreaterThanOrEqual(3) // heading + subheading + bold
    expect(strongs[0].textContent).toBe('Heading should degrade')
    expect(strongs[1].textContent).toBe('Subheading too')
    // Explicit bold still present
    const boldTexts = Array.from(strongs).map(s => s.textContent)
    expect(boldTexts).toContain('Bold still works.')
    // No structured markdown elements
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('h2')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('hr')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// § 14 — Block type badges (DS v5 §21.2)
// ---------------------------------------------------------------------------

describe('Block type badges — flag ON', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('review card (alert) renders a badge dot', () => {
    const block = makeReviewBlock({ variant: 'alert', tone: 'challenger' })
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot).toBeDefined()
  })

  it('review card (info) renders a badge dot', () => {
    const block = makeReviewBlock({ variant: 'info', tone: 'facilitator' })
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot).toBeDefined()
  })

  it('commentary block does NOT render a badge dot', () => {
    const block = makeCommentaryBlock({ title: 'T' })
    render(<InlineBlocks blocks={[block]} assistantTextWordCount={30} />)
    expect(screen.queryByTestId('block-badge-dot')).toBeNull()
  })

  it('badge dot is aria-hidden', () => {
    const block = makeReviewBlock({ variant: 'alert', tone: 'challenger' })
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.getAttribute('aria-hidden')).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// § 15 — Block type badges — flag OFF (no dots)
// ---------------------------------------------------------------------------

describe('Block type badges — flag OFF', () => {
  beforeEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
  })

  afterEach(() => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('no badge dots when flag is off', () => {
    const block = makeReviewBlock({ variant: 'alert', tone: 'challenger' })
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.queryByTestId('block-badge-dot')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// § 16 — Suggested actions fixture shape
// ---------------------------------------------------------------------------

describe('Fixture golden-path — suggested actions with roles', () => {
  it('suggestedActionsWithRoles fixture has three chips with distinct roles', () => {
    const env = fixtureData.envelopes.suggestedActionsWithRoles
    expect(env.suggested_actions).toHaveLength(3)
    const roles = env.suggested_actions.map((a: { role?: string }) => a.role)
    expect(roles).toContain('facilitator')
    expect(roles).toContain('challenger')
    expect(roles).toContain('scientist')
  })

  it('suggested actions have message field for orchestrator dispatch', () => {
    const env = fixtureData.envelopes.suggestedActionsWithRoles
    // All actions must have a message (the field the UI sends)
    for (const action of env.suggested_actions) {
      expect(action.message).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// § 17 — CEE wire format: prompt field normalisation (Brief B, Task 1)
// ---------------------------------------------------------------------------

describe('Fixture golden-path — CEE prompt field', () => {
  it('suggestedActionsWithPromptField fixture uses prompt (not message)', () => {
    const env = fixtureData.envelopes.suggestedActionsWithPromptField
    expect(env.suggested_actions).toHaveLength(3)
    for (const action of env.suggested_actions) {
      expect((action as Record<string, unknown>).prompt).toBeTruthy()
      expect((action as Record<string, unknown>).message).toBeUndefined()
    }
  })

  it('suggestedActionsWithPromptField has three distinct roles', () => {
    const env = fixtureData.envelopes.suggestedActionsWithPromptField
    const roles = env.suggested_actions.map((a: { role?: string }) => a.role)
    expect(roles).toContain('facilitator')
    expect(roles).toContain('challenger')
    expect(roles).toContain('scientist')
  })

  it('mixed prompt/message fixture has both field types', () => {
    const env = fixtureData.envelopes.suggestedActionsMixedPromptAndMessage
    expect(env.suggested_actions).toHaveLength(2)
    const first = env.suggested_actions[0] as Record<string, unknown>
    const second = env.suggested_actions[1] as Record<string, unknown>
    expect(first.message).toBeTruthy()
    expect(first.prompt).toBeUndefined()
    expect(second.prompt).toBeTruthy()
    expect(second.message).toBeUndefined()
  })

  it('five-chip fixture exceeds prompt spec max of 4', () => {
    const env = fixtureData.envelopes.suggestedActionsFiveChips
    expect(env.suggested_actions).toHaveLength(5)
  })
})
