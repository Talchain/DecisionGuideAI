/**
 * The channel-triple colour form, and how to read it back.
 *
 * WHY THIS FORM EXISTS. Tailwind can only apply an opacity modifier
 * (`border-info/30`) to a colour it can decompose into channels. A colour
 * declared as a bare `var(--info)` cannot be decomposed, so Tailwind 3.4
 * emits NOTHING AT ALL for the modified utility — no rule, no warning, no
 * error. The element silently keeps whatever colour it would otherwise have
 * had (for borders, preflight's `#e5e7eb`). The design system's own
 * documented pill recipe — `bg-transparent border-{colour}/30` — had never
 * emitted a single rule for any semantic colour.
 *
 * So each semantic colour declares its CHANNELS as the source of truth and
 * derives the colour from them:
 *
 *     --info-rgb: 39 122 157;
 *     --info: rgb(var(--info-rgb));
 *
 * `--info` still resolves to exactly the same colour, so every existing
 * `var(--info)` reference is untouched, and `rgb(var(--info-rgb) / <alpha-value>)`
 * in tailwind.config.js now gives Tailwind the channels it needs.
 *
 * WHY THIS MODULE EXISTS. Five separate places parse brand.css to recover a
 * token's literal value — the artefact-template mirror, the --text-light
 * contrast pin, the brand-token AA suite, the ghost-option contrast pin and
 * the css-var census. Each had its own `#[0-9A-Fa-f]{3,8}` regex. Teaching
 * the new form to five copies would be five chances to teach it differently,
 * which is this repo's dominant defect class (trap 12). They now share this
 * one implementation.
 *
 * It is `.mjs` (with a `.d.mts` sibling, the pattern already used by
 * `src/generated/validators.js`) because `scripts/css-var-census.mjs` is a
 * plain node script that cannot import TypeScript, and a resolver the census
 * could not use would be a resolver with a sixth copy.
 *
 * Every function here is TOTAL and fail-quiet-to-null: a caller that gets
 * null must report the value as uncomparable rather than assume it is fine.
 * Each of the five callers already does exactly that.
 */

/**
 * A colour declared as `rgb(var(--x-rgb))` — the channel-triple form.
 * Captures the channel property name.
 */
export const CHANNEL_TRIPLE_FORM = /^rgb\(\s*var\(\s*(--[A-Za-z0-9_-]+)\s*\)\s*\)$/

/** A bare `var(--x)` alias, used to follow `--primary-rgb: var(--info-rgb)`. */
const VAR_ALIAS = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/

/** Three space- or comma-separated 0-255 channels: `39 122 157`. */
const TRIPLE = /^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/

/**
 * `'39 122 157'` -> `'#277A9D'`. Returns null if the value is not three
 * in-range channels, so a malformed triple is reported rather than silently
 * rendered as some other colour.
 *
 * @param {string} triple
 * @returns {string | null}
 */
export function tripleToHex(triple) {
  const m = String(triple).trim().match(TRIPLE)
  if (!m) return null
  const ch = [m[1], m[2], m[3]].map(Number)
  if (ch.some((c) => c > 255)) return null
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * If `value` is the channel-triple form, resolve it to a literal hex using
 * `lookup` to read the channel property (and to follow one alias hop, so
 * `--primary-rgb: var(--info-rgb)` resolves). Returns null for anything that
 * is not the triple form, or whose channels cannot be found or parsed.
 *
 * @param {string} value           the token's declared value
 * @param {(name: string) => string | null | undefined} lookup
 * @param {number} [depth]
 * @returns {string | null}
 */
export function resolveChannelTriple(value, lookup, depth = 0) {
  if (depth > 8) return null
  const m = String(value).trim().match(CHANNEL_TRIPLE_FORM)
  if (!m) return null
  return resolveTripleProperty(m[1], lookup, depth)
}

/**
 * Resolve a `--x-rgb` channel property to a hex, following alias hops.
 *
 * @param {string} name
 * @param {(name: string) => string | null | undefined} lookup
 * @param {number} [depth]
 * @returns {string | null}
 */
function resolveTripleProperty(name, lookup, depth = 0) {
  if (depth > 8) return null
  const raw = lookup(name)
  if (raw == null || raw === '') return null
  const alias = String(raw).trim().match(VAR_ALIAS)
  if (alias) return resolveTripleProperty(alias[1], lookup, depth + 1)
  return tripleToHex(raw)
}

/**
 * Read a `--token`'s declared value straight out of a brand.css source string.
 * Shared so the callers do not each carry their own declaration regex.
 *
 * @param {string} css
 * @param {string} token  including the leading `--`
 * @returns {string | null}
 */
export function declaredValue(css, token) {
  const m = css.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm'))
  return m ? m[1].trim() : null
}

/**
 * The literal hex a `--token` in `css` ultimately resolves to, understanding
 * all three declaration forms brand.css uses: a literal hex, a `var()` alias
 * (`--primary: var(--info)`), and the channel-triple form. Returns null when
 * the token does not resolve to a literal colour — callers MUST surface that
 * as uncomparable rather than skipping it.
 *
 * @param {string} css
 * @param {string} token  including the leading `--`
 * @param {number} [depth]
 * @returns {string | null}
 */
export function resolveTokenHex(css, token, depth = 0) {
  if (depth > 8) return null
  const raw = declaredValue(css, token)
  if (raw == null) return null

  const literal = raw.match(/^(#[0-9A-Fa-f]{3,8})$/)
  if (literal) return expandHex(literal[1])

  const triple = resolveChannelTriple(raw, (n) => declaredValue(css, n))
  if (triple) return triple

  const alias = raw.match(VAR_ALIAS)
  if (alias) return resolveTokenHex(css, alias[1], depth + 1)

  return null
}

/** `#abc` -> `#AABBCC`; already-long hexes are just upper-cased. */
function expandHex(hex) {
  const h = hex.slice(1)
  if (h.length === 3) return '#' + [...h].map((c) => c + c).join('').toUpperCase()
  return hex.toUpperCase()
}
