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
 * block-comment stripping only; everything else is treated as JS/TS/JSX/TSX.
 */
export function stripComments(text: string, file: string): string {
  return /\.css$/.test(file) ? stripCssComments(text) : stripJsComments(text)
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
 */
export function stripJsComments(src: string): string {
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
