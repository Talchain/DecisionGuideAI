/**
 * Literal-aware comment stripper for source-scanning CI guards.
 *
 * WHY THIS EXISTS. Several guards read raw source text and regex-scan it for a
 * pattern — an opacity-modified Tailwind utility, an American spelling in copy,
 * a banned API. When the pattern also appears inside a COMMENT the scan pulls it
 * in and reddens CI over text that renders nothing and ships nothing. `bg-info/4`
 * quoted in ExpertBlock's header comment reddened staging exactly this way (#385),
 * and an `analyze` in a ceeRecovery.ts design-note JSDoc had to be reworded to
 * dodge the British-English guard. Both are the same footgun: the guard's intent
 * is about RENDERED / SHIPPED text, but it scans comments.
 *
 * The fix (PR #386, the alpha-emission guard) is to strip comments from the INPUT
 * TEXT before the scan runs. Comment characters are replaced with spaces (newlines
 * kept) so every line/column the scan reports stays accurate and offsets never
 * shift — the file is never collapsed. String, template and regex literals are
 * treated as CODE, so a `//` in a URL string, a `/*` inside a quoted example, a
 * regex full of slashes, and a class inside a `${...}` interpolation all survive.
 *
 * This is EXTRACTED here (rather than copied into each guard) so the two-plus
 * guards that need it share ONE implementation and cannot drift apart — the
 * hand-maintained-mirror is the dominant defect class in this codebase, so a
 * second hand-kept copy of a state machine is exactly what we do not want.
 *
 * It is a small hand-written state machine rather than a dependency: the repo
 * ships no comment-stripper (strip-comments / strip-json-comments are absent from
 * package.json and node_modules), and a general JS parser (acorn/espree) is not a
 * dependency either, so pulling one in for a CI guard's input pre-pass would be a
 * heavier, less transparent addition than the tokeniser below.
 */

/**
 * Remove comments from a file's text, dispatching on extension: `.css` files get
 * block-comment stripping only; `.tsx`/`.jsx` get JSX-aware JS tokenisation (a
 * JSX close `</` or self-close `/>` slash is never mistaken for a regex open);
 * every other extension (`.ts`/`.js`/`.mjs`/…) is plain JS/TS, tokenised exactly
 * as before — the JSX rule is opt-in by extension so it cannot change how a
 * non-JSX file is read.
 */
export function stripComments(text: string, file: string): string {
  if (/\.css$/.test(file)) return stripCssComments(text)
  return stripJsComments(text, /\.(tsx|jsx)$/.test(file))
}

/** May a `/` here begin a regex literal, given the previous significant char? */
export function regexCanStart(prev: string): boolean {
  // After a value (identifier, number, `)`, `]`, `}`, `.`, or a string/template
  // close) a `/` is division. Everywhere else (operators, `(`, `,`, `=`, `:`,
  // `[`, `{`, `;`, `!`, `&`, `|`, `?`, `+`, `-`, `*`, `%`, `<`, `>`, `^`, `~`) or
  // at the start of the file, a `/` opens a regex.
  return prev === '' || !/[A-Za-z0-9_$)\].}'"`]/.test(prev)
}

/**
 * Strip `//` line and block comments from JS/TS/JSX/TSX, treating string,
 * template and regex literals (and `${...}` interpolations) as code.
 *
 * JSX AWARENESS (`jsx = true`, set by `stripComments` for `.tsx`/`.jsx`). In JSX,
 * `<` is a tag opener rather than a less-than operator, so the `/` in a close tag
 * (`</div>`, `</>`) and the `/` in a self-close (`<Foo />`, `<br/>`) are tag
 * syntax, not the start of a regex literal. The plain tokeniser (`regexCanStart`)
 * only inspects the previous significant char, where after `<` a `/` looks like a
 * regex open — so on `</div>` it enters `regex` state and, finding no closing `/`
 * before EOF (or latching onto a later stray `/`), swallows every comment past
 * that point. The guard below suppresses the regex open for exactly the two JSX
 * shapes: a `/` whose previous significant char is `<` (close tag), and a `/`
 * whose next char is `>` (self-close). It runs AFTER the `//`/`/*` comment checks,
 * so a real comment immediately following a tag is still stripped, and only when
 * `jsx` is set — plain `.ts`/`.js` tokenisation (including the rare, legitimate
 * `a < /re/ … /` division-then-regex) is left byte-for-byte unchanged. In `.tsx`
 * that same `a < /re/` reads as JSX by design (JSX context wins), the documented
 * trade-off; a genuine regex whose FIRST char is not `>` still opens normally
 * (its opening `/` has neither a `<` before it nor a `>` after it).
 */
export function stripJsComments(src: string, jsx = false): string {
  const a = src.split('')
  const n = a.length
  const blank = (i: number): void => {
    if (a[i] !== '\n' && a[i] !== '\r') a[i] = ' '
  }

  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template' | 'regex'
  let state: State = 'code'
  let prev = '' // previous significant code char, for regex detection
  let regexClass = false // inside a regex `[...]` char class, where `/` is literal
  let interp = 0 // brace depth inside the current `${...}`; 0 = not in one
  const interpStack: number[] = [] // suspended depths, for templates nested in `${...}`

  let i = 0
  while (i < n) {
    const c = a[i]
    const d = i + 1 < n ? a[i + 1] : ''

    if (state === 'code') {
      if (c === '/' && d === '/') { blank(i); blank(i + 1); state = 'line'; i += 2; continue }
      if (c === '/' && d === '*') { blank(i); blank(i + 1); state = 'block'; i += 2; continue }
      if (c === "'") { state = 'single'; prev = c; i++; continue }
      if (c === '"') { state = 'double'; prev = c; i++; continue }
      if (c === '`') { state = 'template'; prev = c; i++; continue }
      // JSX tag slash (`.tsx`/`.jsx` only): a `/` in a close tag (`</…`, prev is
      // `<`) or a self-close (`…/>`, next char is `>`) is tag syntax, not a regex
      // open. Kept as an ordinary code char so tokenisation stays aligned and any
      // comment after the tag is still seen. Runs before the regex check below.
      if (c === '/' && jsx && (prev === '<' || d === '>')) { prev = c; i++; continue }
      if (c === '/' && regexCanStart(prev)) { state = 'regex'; regexClass = false; prev = c; i++; continue }
      if (interp > 0) {
        if (c === '{') interp++
        else if (c === '}') {
          interp--
          if (interp === 0) { state = 'template'; interp = interpStack.pop() ?? 0; prev = c; i++; continue }
        }
      }
      if (!/\s/.test(c)) prev = c
      i++
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue }
      blank(i); i++; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); state = 'code'; i += 2; continue }
      blank(i); i++; continue
    }
    if (state === 'single') {
      if (c === '\\') { i += 2; continue }
      if (c === "'") { state = 'code'; prev = c; i++; continue }
      i++; continue
    }
    if (state === 'double') {
      if (c === '\\') { i += 2; continue }
      if (c === '"') { state = 'code'; prev = c; i++; continue }
      i++; continue
    }
    if (state === 'template') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { state = 'code'; prev = c; i++; continue }
      if (c === '$' && d === '{') { interpStack.push(interp); interp = 1; state = 'code'; prev = '{'; i += 2; continue }
      i++; continue
    }
    // state === 'regex'
    if (c === '\\') { i += 2; continue }
    if (c === '[') { regexClass = true; i++; continue }
    if (c === ']') { regexClass = false; i++; continue }
    if (c === '/' && !regexClass) { state = 'code'; prev = c; i++; continue }
    i++
  }
  return a.join('')
}

/**
 * Blank comments AND string/template bodies, preserving byte offsets and
 * newlines. This is the `blankNonCode` CLASS of stripper (distinct from
 * `stripComments` above): where `stripComments` keeps string/template/regex
 * literals as CODE, `blankNonCode` also erases the INSIDE of every quoted
 * string — the opening quote is kept so the remaining token still parses as a
 * value. Use it for CODE-PATTERN guards where the forbidden thing (a raw
 * `.update({ graph })`, an `as any` cast, a camera-move `duration:`) is only
 * ever real when it appears as executable code, never inside a string; there,
 * a mention of the pattern quoted in a doc string must not read as a call site.
 *
 * Do NOT use it for guards whose forbidden pattern legitimately lives in a
 * string literal — an import specifier (`from './x'`), a route string
 * (`'#/sandbox'`), a bracket-key read (`x['field']`) — blanking the string
 * body there would make the guard blind to real violations. Those want
 * `stripComments` (comments only).
 *
 * CONVERGED (2026-07-20): this is the single implementation of the state
 * machine that was hand-duplicated in cameraMotion.sourceScan.spec.ts and
 * graphWriteSourceGuard.spec.ts. Both now import it; each still carries its own
 * detector-contract block (incl. "ignores … comments and strings") that pins
 * this function, so a drift would fail those positive controls loudly rather
 * than returning a wrong verdict.
 */
export function blankNonCode(src: string): string {
  const out = src.split('')
  let i = 0
  const blankTo = (end: number): void => {
    for (let k = i; k < end && k < src.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      let end = src.indexOf('\n', i)
      if (end === -1) end = src.length
      blankTo(end)
      i = end
    } else if (two === '/*') {
      let end = src.indexOf('*/', i + 2)
      end = end === -1 ? src.length : end + 2
      blankTo(end)
      i = end
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i]
      let j = i + 1
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\') j++
        j++
      }
      i++ // keep the opening quote so the token still parses as a value
      blankTo(j)
      i = Math.min(j + 1, src.length)
    } else {
      i++
    }
  }
  return out.join('')
}

/**
 * Blank HTML comments (`<!-- … -->`) AND the JS comments inside every
 * `<script>…</script>` block, preserving byte offsets and newlines so a
 * source-scanning guard's positions stay accurate.
 *
 * A hand-written HTML document (index.html) is neither pure JS nor pure CSS:
 * `stripJsComments` cannot be applied to the whole file because a bare `//`
 * in an `https://…` URL that sits in HTML text (not inside a JS string) would
 * be misread as the start of a line comment. So this handles the two comment
 * grammars that actually occur: HTML `<!-- -->` markers anywhere, and JS line
 * and block comments inside `<script>` bodies (delegated to `stripJsComments`,
 * which keeps string/regex literals — so a quoted URL in a `fetch()` argument
 * survives while a `//`-commented copy of it does not).
 */
export function stripHtmlComments(html: string): string {
  const a = html.split('')
  let i = 0
  while (i < a.length) {
    if (html.startsWith('<!--', i)) {
      let end = html.indexOf('-->', i + 4)
      end = end === -1 ? html.length : end + 3
      for (let k = i; k < end; k++) if (a[k] !== '\n' && a[k] !== '\r') a[k] = ' '
      i = end
    } else {
      i++
    }
  }
  // stripJsComments preserves length exactly, so replacing each script body
  // in place never shifts any offset outside the block.
  return a
    .join('')
    .replace(
      /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
      (_m, open: string, body: string, close: string) => open + stripJsComments(body) + close,
    )
}

/** Strip only block comments from CSS (no line comments), treating strings as code. */
export function stripCssComments(src: string): string {
  const a = src.split('')
  const n = a.length
  const blank = (i: number): void => {
    if (a[i] !== '\n' && a[i] !== '\r') a[i] = ' '
  }

  type State = 'code' | 'block' | 'single' | 'double'
  let state: State = 'code'

  let i = 0
  while (i < n) {
    const c = a[i]
    const d = i + 1 < n ? a[i + 1] : ''

    if (state === 'code') {
      if (c === '/' && d === '*') { blank(i); blank(i + 1); state = 'block'; i += 2; continue }
      if (c === "'") { state = 'single'; i++; continue }
      if (c === '"') { state = 'double'; i++; continue }
      i++; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); state = 'code'; i += 2; continue }
      blank(i); i++; continue
    }
    if (state === 'single') {
      if (c === '\\') { i += 2; continue }
      if (c === "'") { state = 'code'; i++; continue }
      i++; continue
    }
    // state === 'double'
    if (c === '\\') { i += 2; continue }
    if (c === '"') { state = 'code'; i++; continue }
    i++
  }
  return a.join('')
}
