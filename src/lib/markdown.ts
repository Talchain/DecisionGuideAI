// src/lib/markdown.ts
// Minimal, dependency-free Markdown rendering with basic sanitization.
// Intent: avoid external packages to keep the repo runnable in CI without install.
// Supported (subset): headings (#, ##, ###), lists, paragraphs, line breaks, fenced code blocks, inline code, bold, italic, basic links.
// Disallowed: raw HTML, images, tables.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeUrl(href: string): string {
  try {
    const u = String(href || '').trim()
    if (/^(https?:\/\/|mailto:)/i.test(u)) {
      // Escape quotes so href can't break out of attribute context
      return u.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }
  } catch {}
  return '#'
}

function renderInline(text: string): string {
  // Inline code: `code`
  let out = text.replace(/`([^`]+)`/g, (_m, g1) => `<code>${g1}</code>`)
  // Bold: **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, g1) => `<strong>${g1}</strong>`)
  // Italic: *text*
  out = out.replace(/\*([^*]+)\*/g, (_m, g1) => `<em>${g1}</em>`)
  // Links: [text](href)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, href) => {
    const safe = sanitizeUrl(href)
    return `<a href="${safe}" rel="noopener noreferrer">${txt}</a>`
  })
  return out
}

export function renderMarkdownSafe(src: string): string {
  if (!src || src.trim().length === 0) return ''
  // Escape HTML first
  const escaped = escapeHtml(src)
  const lines = escaped.split(/\r?\n/)
  const blocks: string[] = []
  let i = 0
  let inFence = false
  let fenceLang: string | null = null
  let fenceLines: string[] = []
  while (i < lines.length) {
    const line = lines[i]
    // Fenced code blocks ```lang
    if (!inFence && /^```/.test(line)) {
      const fenceOpen = line.match(/^```\s*([A-Za-z0-9#+\-_.]*)\s*$/)
      inFence = true
      fenceLang = fenceOpen && fenceOpen[1] ? fenceOpen[1].toLowerCase() : null
      fenceLines = []
      i++
      continue
    }
    if (inFence) {
      if (/^```/.test(line)) {
        // close fence
        const langClass = fenceLang ? ` class="language-${fenceLang}"` : ''
        const code = fenceLines.join('\n')
        // pre uses styling classes and a stable md-code marker; keep relative for positioning copy button overlays
        blocks.push(`<pre class="md-code font-mono text-xs p-2 rounded border bg-gray-50 max-h-[40vh] overflow-auto relative"><code${langClass}>${code}</code></pre>`)
        inFence = false
        fenceLang = null
        fenceLines = []
        i++
        continue
      } else {
        fenceLines.push(line)
        i++
        continue
      }
    }
    // Headings
    if (/^###\s+/.test(line)) {
      blocks.push(`<h3>${renderInline(line.replace(/^###\s+/, ''))}</h3>`) ; i++; continue
    }
    if (/^##\s+/.test(line)) {
      blocks.push(`<h2>${renderInline(line.replace(/^##\s+/, ''))}</h2>`) ; i++; continue
    }
    if (/^#\s+/.test(line)) {
      blocks.push(`<h1>${renderInline(line.replace(/^#\s+/, ''))}</h1>`) ; i++; continue
    }
    // Lists (very minimal). Collect contiguous - or * lines.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`) ; i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`) ; continue
    }
    // Blank line → paragraph separator
    if (/^\s*$/.test(line)) { blocks.push(''); i++; continue }
    // Paragraph. Collect until blank line.
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      para.push(lines[i]); i++
    }
    const html = renderInline(para.join('\n')).replace(/\n/g, '<br>')
    blocks.push(`<p>${html}</p>`) ;
  }
  // Join, removing extraneous empty blocks
  return blocks.filter(Boolean).join('\n')
}
