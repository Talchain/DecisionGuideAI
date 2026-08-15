/**
 * SafeRichText — restricted markdown-to-HTML converter
 *
 * Supports ONLY the subset used by the orchestrator:
 *   - Bold:    **text** → <strong>text</strong>
 *   - Bullets: - item / * item  → <ul><li>item</li></ul>
 *   - Numbered: 1. item / 1) item → <ol><li>item</li></ol>
 *   - Line breaks: single newline → <br>
 *
 * Graceful degradation for unsupported syntax:
 *   - Headings (# text) → rendered as bold
 *   - Horizontal rules (--- / ***) → small vertical gap
 *   - Pipe-delimited tables → structured text
 *   - Emoji characters → stripped (conservative allowlist)
 *
 * XSS safety:
 *   - Allowlist: <strong>, <br>, <ul>, <ol>, <li>, <span> only
 *     (<span> is emitted with class="md-number" for tabular-nums styling on
 *     standalone integers / decimals / percentages per DS v5 §2 prose rhythm)
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
const ALLOWED_TAGS = new Set(['strong', 'br', 'ul', 'ol', 'li', 'span'])

/**
 * Conservative emoji strip pattern.
 * Covers common emoji codepoint ranges used in orchestrator output.
 * Uses BMP codepoints and \u{...} syntax (ES2015+ required).
 */
const EMOJI_RE = /[\u2705\u26A0\u2714\u274C\u2757\u2B50\u2728\u23F0\u2615\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]/gu

/** Sentinel character for emoji stripping — collapses only emoji-adjacent whitespace. */
const EMOJI_SENTINEL = '\x00'
// eslint-disable-next-line no-control-regex -- intentional null sentinel for emoji whitespace collapse
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
 * Applies bold and numeric transforms; emits plain text otherwise.
 *
 * Numeric transform wraps standalone integers, decimals, and percentages in
 * <span class="md-number"> so they render with tabular-nums + medium weight
 * per DS v5 §2 prose rhythm. Word-boundary constrained to avoid matching
 * digits inside identifiers (e.g. "opt_raise_59" stays untouched).
 */
function convertInline(text: string): string {
  // Numeric: \d+(.\d+)?%? — applied first so bold markers don't interfere.
  // Lookbehind excludes:
  //   · mid-identifier digits ([A-Za-z_\d])
  //   · HTML numeric entities (&#123;, &#x1F;) which contain digits that
  //     must not be wrapped — the entity sequence is produced by escapeHtml.
  // Lookahead excludes semicolon (tail of a numeric entity) and identifier chars.
  const withNumbers = text.replace(
    /(?<![A-Za-z_\d]|&#[xX]?)(\d+(?:\.\d+)?%?)(?![A-Za-z_;])/g,
    '<span class="md-number">$1</span>',
  )
  // Bold: **text** → <strong>text</strong>
  // Non-greedy to handle multiple bold spans per line.
  return withNumbers.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
  // Step 1c: normalise all dash variants to spaced hyphens (safety net for LLM output)
  // U+2012 figure dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar
  const dashed = stripped.replace(/[\u2012\u2013\u2014\u2015]/g, ' - ')
  // Step 2: re-escape so angle brackets don't inject HTML
  const escaped = escapeHtml(dashed)

  // Split into lines for processing
  const rawLines = escaped.split('\n')

  // Track table headers for structured rendering
  let tableHeaders: string[] | null = null
  let tableHeaderConfirmed = false

  const outputParts: string[] = []
  let listGroup: string[] = []
  /** Which list the open group is — 'ul' for bullets, 'ol' for numbered. */
  let listKind: 'ul' | 'ol' = 'ul'
  /**
   * The first marker value of an open ORDERED group. Preserved into
   * `<ol start="N">` so a continuation list ("4. …, 5. …") is not silently
   * renumbered to 1 — presentation may demote content, never restate it.
   * Serialised from a parsed integer, so no producer text reaches the attribute.
   */
  let listStart = 1

  function flushList() {
    if (listGroup.length === 0) return
    const items = listGroup.map((item) => `<li>${convertInline(item)}</li>`).join('')
    const open =
      listKind === 'ol' && listStart !== 1 ? `<ol start="${listStart}">` : `<${listKind}>`
    outputParts.push(`${open}${items}</${listKind}>`)
    listGroup = []
  }

  /** Open (or continue) a list of the given kind, flushing a group of the other kind first. */
  function pushListItem(kind: 'ul' | 'ol', item: string, start: number) {
    if (listGroup.length > 0 && listKind !== kind) flushList()
    if (listGroup.length === 0) {
      listKind = kind
      listStart = start
    }
    listGroup.push(item)
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // Horizontal rules: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushList()
      tableHeaders = null
      outputParts.push('<br class="md-gap">')
      continue
    }

    // Headings: # text → bold text
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushList()
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
      flushList()
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

    // Ordered list markers: "1. item" / "1) item". Checked BEFORE the numeric
    // transform can reach the line, so the marker digit is consumed as the
    // marker and never wrapped in <span class="md-number"> (which is what made
    // a numbered list render as a run of prose). The trailing space is required,
    // so a decimal ("0.5 million") and a bare number line never match.
    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
    if (orderedMatch) {
      pushListItem('ol', orderedMatch[2], Number(orderedMatch[1]))
      continue
    }

    // Bullet markers: markdown "- " / "* " plus dedicated bullet glyphs CEE may
    // emit (• ‣ ◦). A trailing space is REQUIRED, and that requirement is what
    // makes "*" safe to include: neither "*italic*" nor "**bold**" has a space
    // after the marker, and a "***" rule is consumed by the horizontal-rule
    // branch above. "*" was previously excluded outright on emphasis grounds —
    // broader than the collision the space requirement already prevents, and
    // "* item" is the list form an LLM emits most often after "- ", so the
    // exclusion turned those turns into walls of text. Middle-dot "·" stays
    // excluded: it has a genuine inline-separator use with no space rule to
    // distinguish it.
    const bulletMatch = trimmed.match(/^[-*•‣◦]\s+(.+)$/)
    if (bulletMatch) {
      pushListItem('ul', bulletMatch[1], 1)
    } else if (trimmed === '-') {
      // Bare marker with no content — preserve prior empty-bullet behaviour
      pushListItem('ul', '', 1)
    } else {
      // Non-list line — flush any pending list group first
      flushList()

      if (trimmed === '') {
        // Empty line: separator between paragraphs — emit nothing (blank line)
        outputParts.push('')
      } else {
        outputParts.push(convertInline(trimmed))
      }
    }
  }

  // Flush any trailing bullet group
  flushList()

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
  let blankSeen = false
  for (const part of outputParts) {
    if (part === '') { blankSeen = true; continue }

    if (part.startsWith('<ul>') || part.startsWith('<ol') || part.startsWith('<br class="md-gap">')) {
      blankSeen = false
      result += part
    } else {
      if (result !== '') {
        // Gap spacer between paragraphs when any of:
        //   · blank line was seen (explicit paragraph break)
        //   · the following part starts with a bold lead (header-style)
        //   · the preceding part was a bold lead (header → body transition)
        //   · the preceding part ends a sentence (. ! ? :, optionally followed
        //     by a closing quote/bracket incl. curly ” ’) — CEE delimits
        //     paragraphs with SINGLE newlines, so a sentence-ending line is a
        //     paragraph boundary, not a soft wrap. Without this such lines
        //     collapse to a gap-less <br>.
        // Hotfix item 7: the second condition was missing, so streamed
        //   "**Header**\nbody\n**Next header**\nbody" rendered with plain
        //   <br> between header and body. DS v5 §2.4 requires ~12–16px.
        const useGap = blankSeen || isBoldLead(part) || isBoldLead(prevPart) || /[.!?:]["'”’)\]]?$/.test(prevPart)
        result += useGap ? '<br class="md-gap">' : '<br>'
      }
      blankSeen = false
      result += part
    }
    prevPart = part
  }

  // Belt-and-braces: strip any disallowed tags (should never trigger, but guards future changes)
  return stripDisallowedTags(result)
}

/** Normalise dash variants to spaced hyphens. For use on plain text that doesn't go through safeRichText. */
export function normaliseDashes(text: string): string {
  return text.replace(/[\u2012\u2013\u2014\u2015]/g, ' - ')
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
