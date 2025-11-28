import { describe, it, expect } from 'vitest'
import { renderMarkdownSafe } from '../markdown'

// These tests focus on security and basic semantics of renderMarkdownSafe,
// which is used by the streaming stack to generate mdHtml for StreamOutputDisplay.

describe('renderMarkdownSafe', () => {
  it('returns empty string for empty or whitespace-only input', () => {
    expect(renderMarkdownSafe('')).toBe('')
    expect(renderMarkdownSafe('   ')).toBe('')
  })

  it('renders basic inline markdown (bold, italic, code, links)', () => {
    const src = '**bold** *italic* `code` [link](https://example.com)'
    const html = renderMarkdownSafe(src)

    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">link</a>')
  })

  it('renders headings, lists, and paragraphs', () => {
    const src = [
      '# H1',
      '## H2',
      '### H3',
      '- item 1',
      '- item 2',
      '',
      'Paragraph line 1',
      'Paragraph line 2',
    ].join('\n')

    const html = renderMarkdownSafe(src)

    expect(html).toContain('<h1>H1</h1>')
    expect(html).toContain('<h2>H2</h2>')
    expect(html).toContain('<h3>H3</h3>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item 1</li>')
    expect(html).toContain('<li>item 2</li>')
    expect(html).toContain('<p>Paragraph line 1<br>Paragraph line 2</p>')
  })

  it('renders fenced code blocks with language class and no raw HTML execution', () => {
    const src = [
      '```js',
      'console.log("hello")',
      '```',
    ].join('\n')

    const html = renderMarkdownSafe(src)

    // Should render a <pre><code class="language-js"> block
    expect(html).toContain('<pre class="md-code')
    expect(html).toContain('<code class="language-js">console.log("hello")</code>')
    // The raw backticks should not appear
    expect(html).not.toContain('```')
  })

  it('escapes raw HTML tags so they cannot execute', () => {
    const src = '<script>alert("xss")</script><div onclick="doBad()">hi</div>'
    const html = renderMarkdownSafe(src)

    // Raw tags should be escaped, never rendered as real elements
    expect(html).not.toContain('<script')
    expect(html).not.toContain('</script>')
    expect(html).not.toContain('<div onclick')
    // Escaped forms should appear instead
    expect(html).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;')
    expect(html).toContain('&lt;div onclick="doBad()"&gt;hi&lt;/div&gt;')
  })

  it('sanitizes unsafe link protocols by replacing with #', () => {
    const src = [
      '[js](javascript:alert("xss"))',
      '[data](data:text/html,<script>alert("xss")</script>)',
      '[vb](vbscript:alert("xss"))',
    ].join('\n')

    const html = renderMarkdownSafe(src)

    // No dangerous protocols should appear
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:')
    expect(html).not.toContain('vbscript:')

    // Links should still render but point to #
    expect(html).toContain('<a href="#" rel="noopener noreferrer">js</a>')
    expect(html).toContain('<a href="#" rel="noopener noreferrer">data</a>')
    expect(html).toContain('<a href="#" rel="noopener noreferrer">vb</a>')
  })

  it('handles very long input without throwing', () => {
    const long = 'a'.repeat(50_000)
    const html = renderMarkdownSafe(long)
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('a')
  })
})
