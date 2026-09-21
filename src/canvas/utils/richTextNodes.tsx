/**
 * richTextNodes — the estate's markdown dialect, rendered as REACT ELEMENTS
 * instead of an HTML string.
 *
 * ─── Why this exists ───────────────────────────────────────────────────────
 * `safeRichText` returns sanitised HTML, which a consumer hands to
 * `dangerouslySetInnerHTML`. That is fine where it is allowed — but the
 * pre-analysis v3 subtree BANS that prop outright, enforced by a source-scan
 * guard (`signals/__tests__/registry.spec.ts`, "never uses
 * dangerouslySetInnerHTML") that reads every `.ts`/`.tsx` under the directory.
 *
 * That ban is deliberate and worth keeping, so the way to render marked copy
 * there is not to carve an exemption out of it — it is to stop producing an
 * HTML string at all. This module takes `safeRichText`'s output and walks it
 * into React elements. No innerHTML anywhere, which is a STRICTLY STRONGER
 * safety property than the surfaces that do use it.
 *
 * ─── What it is NOT ────────────────────────────────────────────────────────
 * ⚠ IT IS NOT A SECOND MARKDOWN PARSER, and that distinction is the whole
 * design. Every rule about what `**` means, which schemes may become links,
 * how lists are detected and what gets escaped stays in `safeRichText`. This
 * module never sees the original markdown — it consumes the SANITISED OUTPUT
 * and maps a tiny, fixed tag set onto elements. Adding a rule to the dialect
 * therefore means editing ONE file, not two, so the two renderers cannot drift
 * (CLAUDE.md trap 12: the hand-maintained mirror).
 *
 * ─── The safety properties, and why each is here ───────────────────────────
 *   1. ESCAPING ALREADY HAPPENED. `safeRichText` escapes before it transforms,
 *      so an element in its output is one IT generated, never one the producer
 *      supplied. We parse that output, so the same holds here.
 *   2. FAIL CLOSED ON TAGS. Only `SAFE_RICH_TEXT_TAGS` become elements. An
 *      unexpected element renders its CHILDREN ONLY — the words survive, the
 *      tag does not. Dropping the subtree would lose producer text, which is
 *      the worse failure.
 *   3. HREF RE-CHECKED, ONE PREDICATE. `isSafeLinkUrl` is imported from
 *      `safeRichText` rather than restated. By construction the URL already
 *      passed; re-checking is defence in depth, and a link that somehow fails
 *      renders as plain text rather than as an anchor.
 *   4. ATTRIBUTES ARE ALLOWLISTED, NOT COPIED. Only `class` (as `className`)
 *      and, on an anchor, `href` survive. Nothing can carry an event handler
 *      through, because nothing but those two is ever read.
 *   5. NO DOMParser, NO RENDER. Parsing happens in a detached document that is
 *      never inserted, and where `DOMParser` is unavailable the function
 *      returns the plain text — degraded, never blank, never thrown.
 */
import type { ReactNode } from 'react'
import { safeRichText, isSafeLinkUrl, SAFE_RICH_TEXT_TAGS } from './safeRichText'

/** Elements that take no children and must be self-closed in React. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br'])

function childrenOf(node: Node, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  node.childNodes.forEach((child, i) => {
    const rendered = toNode(child, `${keyPrefix}.${i}`)
    if (rendered !== null) out.push(rendered)
  })
  return out
}

function toNode(node: Node, key: string): ReactNode {
  if (node.nodeType === 3 /* TEXT_NODE */) return node.nodeValue ?? ''
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return null

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const className = el.getAttribute('class') ?? undefined

  // Property 2 — fail closed: keep the words, drop the unknown tag.
  if (!SAFE_RICH_TEXT_TAGS.has(tag)) return <span key={key}>{childrenOf(el, key)}</span>

  if (VOID_TAGS.has(tag)) return <br key={key} className={className} />

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? ''
    // Property 3 — a link that fails the shared gate is text, never an anchor.
    if (!isSafeLinkUrl(href)) return <span key={key}>{childrenOf(el, key)}</span>
    return (
      <a key={key} href={href} className={className} target="_blank" rel="noopener noreferrer">
        {childrenOf(el, key)}
      </a>
    )
  }

  const kids = childrenOf(el, key)
  switch (tag) {
    case 'strong':
      return <strong key={key} className={className}>{kids}</strong>
    case 'em':
      return <em key={key} className={className}>{kids}</em>
    case 'ul':
      return <ul key={key} className={className}>{kids}</ul>
    case 'ol':
      return <ol key={key} className={className}>{kids}</ol>
    case 'li':
      return <li key={key} className={className}>{kids}</li>
    default:
      return <span key={key} className={className}>{kids}</span>
  }
}

/**
 * Render the estate's markdown dialect as React nodes.
 *
 * Returns the plain string unchanged when there is nothing to mark up, and
 * degrades to plain text where `DOMParser` is unavailable.
 */
export function richTextNodes(markdown: string): ReactNode {
  if (!markdown) return ''
  if (typeof DOMParser === 'undefined') return markdown

  const html = safeRichText(markdown)
  // Nothing was marked — hand back the text so callers render an ordinary
  // child and the DOM is byte-identical to before this module existed.
  if (!html.includes('<')) return markdown

  let body: HTMLElement | null = null
  try {
    body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  } catch {
    return markdown
  }
  if (!body) return markdown
  return childrenOf(body, 'r')
}

/** Component form, for the common `<RichText text={producerString} />` case. */
export function RichText({ text }: { text: string }): ReactNode {
  return richTextNodes(text)
}
