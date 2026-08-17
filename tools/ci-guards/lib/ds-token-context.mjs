/**
 * ds-token-context.mjs — WHERE a token sits, and WHAT it is.
 *
 * Two small pure functions used by check-ds-compliance.mjs's `production-hex` class.
 * They live here, separately unit-tested, because the July soak's 65 "net-new"
 * hexes were ALL false positives produced by a per-line prefix test standing in for
 * these two questions — and the guard was left report-only rather than fixed, which
 * is how the whole Design System became unenforced. See ds-token-context.spec.ts.
 *
 * ── WHY A STATE MACHINE AND NOT A PREFIX TEST ───────────────────────────────
 * The previous stripper asked "does this LINE start with //, *, /* or {/*?".
 * That is a per-line question about a MULTI-LINE construct, so it is blind to the
 * continuation lines of a block comment, which start with prose:
 *
 *     {\/* Analysis freshness is owned by the
 *         versions lane, #739). The trigger carries NO   <-- prose start: SCANNED
 *      *\/}
 *
 * 13 of the 16 net-new hexes measured on staging 289b730d were exactly this line
 * class. A prefix test cannot be extended to cover it: block-comment membership is
 * STATE, carried across lines. Do not "simplify" stripComments() back into a test
 * on line.trimStart() — that is the defect it exists to remove.
 *
 * ── WHY A CONTEXT RULE AND NOT "REJECT DIGIT-ONLY TOKENS" ───────────────────
 * The remaining false positives are `#NNN` PR references inside STRING literals,
 * which no comment stripper can reach:
 *
 *     note: "The user's success target ... #457 root cause when the old persist ..."
 *
 * The tempting fix — "a hex made only of digits is a PR number, not a colour" — is
 * measurably WRONG. These are live colour literals in shipped product code:
 *
 *     src/components/GraphCanvas.tsx:353  color: mode === 'connect' ? '#fff' : '#000'
 *     src/components/GraphCanvas.tsx:529  fill={connectFrom === node.id ? '#fff' : '#000'}
 *     src/lib/ErrorBoundary.tsx:42        color: '#900'
 *     src/main.tsx:124                    background: '#fee', color: '#900'
 *     src/main.tsx:227                    'padding:12px;background:#fee;color:#900;...'
 *
 * Rejecting digit-only tokens would make the guard blind to all five. So the
 * ambiguity is resolved by POSITION, not by the token's own characters: a colour
 * value sits at the start of a value slot (after `:` `;` `,` `(` `=` `[` `{` or an
 * opening quote); a PR reference sits mid-sentence, after prose.
 */

/** A `#hex` token whose characters cannot themselves settle colour-vs-reference. */
export function isAmbiguousNumericHex(token) {
  // Only the 3-character shape collides with issue references, and only when it
  // carries no hex LETTER: `#fee`/`#eee` are unambiguously colours, and a 4-digit
  // reference such as `#1004` never matches the detector's `\b` at all. A 6-digit
  // token is likewise never an issue reference in this estate.
  return /^#[0-9]{3}$/.test(token)
}

/** Characters that open a value slot; a colour may legitimately follow any of them. */
const VALUE_SLOT_LEFT = /[:;,(=[{'"`]\s*$/

/**
 * True when `index` (the offset of `#` in `codeLine`) sits where a VALUE belongs,
 * rather than mid-prose. Deliberately permissive on `(` and `,` so a future
 * `linear-gradient(#000, #fff)` is still caught; the block-comment machine, not
 * this rule, is what removes `(#629)`-style references in comment prose.
 */
export function isColourValuePosition(codeLine, index) {
  const left = codeLine.slice(0, index)
  return left.trim() === '' || VALUE_SLOT_LEFT.test(left)
}

/**
 * Blank every comment in `text`, returning ONE ENTRY PER SOURCE LINE with comment
 * characters replaced by spaces (never removed) so that column offsets — which
 * isColourValuePosition() and the guard's `var(--token, #hex)` exclusion both read —
 * still line up with the original source.
 *
 * Tracks, across lines: block-comment depth (`/* … *\/`, which is also how JSX
 * `{\/* … *\/}` is handled) and string/template-literal state, so that `//` inside
 * `'https://example.com'` is not mistaken for a comment and a template literal may
 * legitimately span lines.
 *
 * KNOWN LIMITATION, deliberate and measured: regex literals are not parsed, so a
 * regex containing `//` or `/*` would be read as opening a comment. That can only
 * ever DROP detections, never invent them; the promotion PR enumerated every token
 * the change drops across `src/` and confirmed each is a PR reference in prose.
 * Interpolations inside template literals keep their text (over-keeping, which is
 * the safe direction for a guard).
 */
export function stripComments(text) {
  const src = String(text)
  const n = src.length
  const lines = []
  let line = ''
  let inBlock = false
  let quote = null // "'" | '"' | '`'
  let i = 0

  while (i <= n) {
    const ch = i < n ? src[i] : '\n' // sentinel closes the final line
    if (ch === '\n') {
      lines.push(line)
      line = ''
      // A line comment ends at the newline. Only template literals survive one.
      if (quote !== '`') quote = null
      i++
      if (i > n) break
      continue
    }
    if (inBlock) {
      if (ch === '*' && src[i + 1] === '/') { inBlock = false; line += '  '; i += 2 }
      else { line += ' '; i += 1 }
      continue
    }
    if (quote) {
      line += ch
      if (ch === '\\' && i + 1 < n && src[i + 1] !== '\n') { line += src[i + 1]; i += 2; continue }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { line += ' '; i += 1 }
      continue
    }
    if (ch === '/' && src[i + 1] === '*') { inBlock = true; line += '  '; i += 2; continue }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; line += ch; i += 1; continue }
    line += ch
    i += 1
  }
  return lines
}
