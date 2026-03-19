/**
 * SafeRichText — restricted markdown-to-HTML converter
 *
 * Supports ONLY the subset used by the orchestrator:
 *   - Bold:    **text** → <strong>text</strong>
 *   - Bullets: - item  → <ul><li>item</li></ul>
 *   - Line breaks: single newline → <br>
 *
 * XSS safety:
 *   - Allowlist: <strong>, <br>, <ul>, <li> only
 *   - All other HTML is escaped before processing
 *   - No raw HTML passthrough
 *
 * XML entity decode:
 *   - The orchestrator escapes &amp; &lt; &gt; in content.
 *   - These are decoded to & < > before rendering so the
 *     text reads correctly to the user.
 *
 * Does NOT use a full markdown engine. The tiny supported subset
 * does not warrant the weight and attack surface of one.
 */

/** Allowlisted HTML tag names. Nothing else may appear in the output. */
const ALLOWED_TAGS = new Set(['strong', 'br', 'ul', 'li'])

/**
 * Escape HTML special characters to prevent raw HTML injection.
 * Applied to content before markdown transforms so user-supplied
 * angle-brackets cannot introduce markup.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Decode XML/HTML entities produced by the orchestrator.
 * Only decodes the four entities the orchestrator is known to emit.
 * Applied BEFORE HTML escaping so these decode correctly.
 */
export function decodeOrchestratorEntities(str: string): string {
  // Single-pass decode: the four entities are distinct, no substitution can
  // produce input for another, so no placeholder round-trip is needed.
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

/**
 * Strip any disallowed HTML tags from the output.
 * Belt-and-braces guard after the regex transforms.
 * Strips both opening and closing tags not in the allowlist.
 */
function stripDisallowedTags(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    if (ALLOWED_TAGS.has(tagName.toLowerCase())) return match
    return ''
  })
}

/**
 * Convert a single non-bullet line to HTML.
 * Applies bold transform then emits as-is (no wrapper element).
 */
function convertInline(text: string): string {
  // Bold: **text** → <strong>text</strong>
  // Non-greedy to handle multiple bold spans per line.
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Convert a markdown string to a safe HTML string.
 *
 * Algorithm:
 * 1. Decode orchestrator XML entities (→ real characters)
 * 2. Escape all HTML (→ safe text content)
 * 3. Process bullet groups (lines starting with "- ")
 * 4. Join remaining lines with <br> for single-newline line breaks
 * 5. Apply bold transforms within text
 * 6. Strip any residual disallowed tags (belt-and-braces)
 */
export function safeRichText(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return ''

  // Step 1 + 2: decode entities then re-escape so angle brackets don't inject HTML
  const decoded = decodeOrchestratorEntities(markdown)
  const escaped = escapeHtml(decoded)

  // Split into lines for processing
  const rawLines = escaped.split('\n')

  const outputParts: string[] = []
  let bulletGroup: string[] = []

  function flushBullets() {
    if (bulletGroup.length === 0) return
    outputParts.push('<ul>' + bulletGroup.map((item) => `<li>${convertInline(item)}</li>`).join('') + '</ul>')
    bulletGroup = []
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('- ') || trimmed === '-') {
      // Bullet item — strip the leading "- " prefix
      const itemText = trimmed.startsWith('- ') ? trimmed.slice(2) : ''
      bulletGroup.push(itemText)
    } else {
      // Non-bullet line — flush any pending bullet group first
      flushBullets()

      if (trimmed === '') {
        // Empty line: separator between paragraphs — emit nothing (blank line)
        outputParts.push('')
      } else {
        outputParts.push(convertInline(trimmed))
      }
    }
  }

  // Flush any trailing bullet group
  flushBullets()

  // Join parts:
  // - Any two adjacent non-empty parts → one <br> between them
  // - Empty strings (blank lines) → skipped; the <br> is emitted when the next
  //   non-empty part is appended, so multiple consecutive blank lines still
  //   produce exactly one <br> separator
  // - <ul>…</ul> blocks → no leading <br> (block element handles its own spacing)
  let result = ''
  for (const part of outputParts) {
    if (part === '') continue  // blank lines: separator emitted by next non-empty part

    if (part.startsWith('<ul>')) {
      result += part
    } else {
      if (result !== '') result += '<br>'
      result += part
    }
  }

  // Belt-and-braces: strip any disallowed tags (should never trigger, but guards future changes)
  return stripDisallowedTags(result)
}

/**
 * @deprecated Use safeRichText instead.
 * Kept for gradual migration — delegates to safeRichText.
 * Will be removed once all callers are updated.
 */
export function sanitizeMarkdown(markdown: string): string {
  return safeRichText(markdown)
}

/**
 * Extract a readable one-line preview from a raw orchestrator markdown string.
 * Used for the commentary collapse toggle label when no explicit title is present.
 *
 * Does NOT produce HTML — returns a plain text string safe for use as a React
 * text node (no dangerouslySetInnerHTML).
 *
 * Steps:
 * 1. Take the first non-empty line of the raw string.
 * 2. Decode XML entities (&amp; → &, etc.) so the label reads naturally.
 * 3. Strip markdown bold markers (**) so "**Lead phrase**" reads as "Lead phrase".
 */
export function plainTextPreview(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return ''
  const firstNonEmpty = markdown.split('\n').find((l) => l.trim().length > 0) ?? ''
  const decoded = decodeOrchestratorEntities(firstNonEmpty.trim())
  // Strip bold markers — leave the text content
  return decoded.replace(/\*\*/g, '')
}
