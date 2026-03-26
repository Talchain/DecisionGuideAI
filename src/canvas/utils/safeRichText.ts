/**
 * SafeRichText — restricted markdown-to-HTML converter
 *
 * Supports ONLY the subset used by the orchestrator:
 *   - Bold:    **text** → <strong>text</strong>
 *   - Bullets: - item  → <ul><li>item</li></ul>
 *   - Line breaks: single newline → <br>
 *
 * Graceful degradation for unsupported syntax:
 *   - Headings (# text) → rendered as bold
 *   - Horizontal rules (--- / ***) → small vertical gap
 *   - Pipe-delimited tables → structured text
 *   - Emoji characters → stripped (conservative allowlist)
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
 * Conservative emoji strip pattern.
 * Covers common emoji codepoint ranges used in orchestrator output.
 * Uses BMP codepoints and \u{...} syntax (ES2015+ required).
 */
const EMOJI_RE = /[\u2705\u26A0\uFE0F\u2714\u274C\u2757\u2B50\u2728\u23F0\u2615\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]/gu

/** Sentinel character for emoji stripping — collapses only emoji-adjacent whitespace. */
const EMOJI_SENTINEL = '\x00'
const EMOJI_SENTINEL_COLLAPSE_RE = /\s*\x00+\s*/g

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
 * 1b. Strip emoji characters (conservative allowlist)
 * 2. Escape all HTML (→ safe text content)
 * 3. Process line types: headings, rules, tables, bullets, text
 * 4. Join remaining lines with <br> for single-newline line breaks
 * 5. Apply bold transforms within text
 * 6. Strip any residual disallowed tags (belt-and-braces)
 */
export function safeRichText(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return ''

  // Step 1: decode entities
  const decoded = decodeOrchestratorEntities(markdown)
  // Step 1b: strip emoji — use sentinel to collapse only emoji-adjacent whitespace
  const sentinelled = decoded.replace(EMOJI_RE, EMOJI_SENTINEL)
  const stripped = sentinelled.replace(EMOJI_SENTINEL_COLLAPSE_RE, ' ').trim()
  // Step 2: re-escape so angle brackets don't inject HTML
  const escaped = escapeHtml(stripped)

  // Split into lines for processing
  const rawLines = escaped.split('\n')

  // Track table headers for structured rendering
  let tableHeaders: string[] | null = null
  let tableHeaderConfirmed = false

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

    // Horizontal rules: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushBullets()
      tableHeaders = null
      outputParts.push('<br class="md-gap">')
      continue
    }

    // Headings: # text → bold text
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushBullets()
      tableHeaders = null
      outputParts.push(`<strong>${convertInline(headingMatch[2])}</strong>`)
      continue
    }

    // Table separator row: |---|---|
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      // Separator confirms previous row was headers — keep tableHeaders, skip this line
      if (tableHeaders) tableHeaderConfirmed = true
      continue
    }

    // Table row: | col1 | col2 |
    const tableMatch = trimmed.match(/^\|(.+)\|$/)
    if (tableMatch) {
      flushBullets()
      const cells = tableMatch[1].split('|').map(c => c.trim()).filter(Boolean)

      if (!tableHeaders) {
        // First table row — tentatively store as headers (confirmed by separator)
        tableHeaders = cells
        tableHeaderConfirmed = false
      } else if (!tableHeaderConfirmed) {
        // Second table row without intervening separator — no real headers.
        // Flush stored row as data, then emit this row as data too.
        outputParts.push(convertInline(tableHeaders.join(', ')))
        outputParts.push(convertInline(cells.join(', ')))
        tableHeaders = null
      } else {
        // Data row with confirmed headers: structured rendering
        if (tableHeaders.length === 2 && cells.length >= 2) {
          // Two-column table: <strong>header:</strong> value
          outputParts.push(`<strong>${convertInline(tableHeaders[0])}:</strong> ${convertInline(cells[0])}, <strong>${convertInline(tableHeaders[1])}:</strong> ${convertInline(cells[1])}`)
        } else {
          // Three+ columns: comma-separated
          outputParts.push(convertInline(cells.join(', ')))
        }
      }
      continue
    }

    // Non-table line resets table context — flush unconfirmed header as data
    if (tableHeaders) {
      if (!tableHeaderConfirmed) {
        outputParts.push(convertInline(tableHeaders.join(', ')))
      }
      tableHeaders = null
      tableHeaderConfirmed = false
    }

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

  // Flush any trailing unconfirmed table headers as data
  if (tableHeaders && !tableHeaderConfirmed) {
    outputParts.push(convertInline(tableHeaders.join(', ')))
  }

  // Join parts:
  // - Any two adjacent non-empty parts → one <br> between them
  // - Empty strings (blank lines) → skipped; the <br> is emitted when the next
  //   non-empty part is appended, so multiple consecutive blank lines still
  //   produce exactly one <br> separator
  // - <ul>…</ul> and <br class="md-gap"> → no leading <br> (block-level spacing)
  // Helper: detect bold-lead pattern (<strong>…</strong> at start of part)
  const isBoldLead = (s: string) => s.startsWith('<strong>')

  let result = ''
  let prevPart = ''
  for (const part of outputParts) {
    if (part === '') continue  // blank lines: separator emitted by next non-empty part

    if (part.startsWith('<ul>') || part.startsWith('<br class="md-gap">')) {
      result += part
    } else {
      if (result !== '') {
        // Use gap spacer between consecutive bold-lead paragraphs for 16px separation
        result += (isBoldLead(prevPart) && isBoldLead(part)) ? '<br class="md-gap">' : '<br>'
      }
      result += part
    }
    prevPart = part
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
