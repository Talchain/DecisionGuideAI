/**
 * ESLint rule: no-bare-light-bg
 *
 * DS v5 §3.2 / §15.2: `bg-{semantic}-light` must NOT be used as a fill on cards,
 * banners, pills, badges, or accordion headers. Light shades are reserved for
 * canvas node fills and panel entity-HOVER states only.
 *
 * This rule flags BARE `bg-*-light` — i.e. with no state variant prefix. A
 * variant-prefixed form (`hover:bg-*-light`, `group-hover:…`, `focus:…`) is the
 * allowed panel-hover case and is NOT flagged.
 *
 * Scope note: the rule matches by content (string/template literals), so it cannot
 * tell a node-fill class from a card class. Two legitimate uses of bg-{entity}-light
 * are therefore exempted at the eslint.config.js level, not here: (1) test files,
 * and (2) the canvas node-fill colour map src/canvas/nodes/colors.ts (DS v5 §3.2
 * allows light shades as canvas node fills). Everything else stays covered.
 *
 * Stage 2a ships this as a WARNING (report-only soak). A follow-up promotes it to
 * `error` once the baseline has soaked. The production code already has zero bare
 * occurrences (the 4 found in Stage 1 were fixed), so this currently produces no
 * output — it exists to prevent regressions.
 *
 * Fix: use `bg-panel` or a transparent background with a `border-{colour}/30`
 * outline and `text-{colour}` (the colour channel still conveys state).
 */

// Preceded by start / whitespace / quote / backtick / brace / paren means BARE.
// A variant prefix would put a ':' immediately before "bg-", which is excluded here.
const BARE_LIGHT = /(?:^|[\s"'`{(])bg-(?:success|info|danger|warning|primary|goal|option|factor)-light(?![\w-])/g

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid bare bg-{semantic}-light fills on non-canvas surfaces (DS v5 §3.2)',
      recommended: true,
    },
    messages: {
      bareLight:
        'Bare "{{value}}" is forbidden on cards/banners/pills/badges (DS v5 §3.2). ' +
        'Use bg-panel or a transparent background with a border-{colour}/30 outline; ' +
        'light shades are only for canvas node fills and panel hover (prefix with hover:).',
    },
    schema: [],
  },
  create(context) {
    function check(node, value) {
      let m
      BARE_LIGHT.lastIndex = 0
      while ((m = BARE_LIGHT.exec(value)) !== null) {
        const cls = m[0].replace(/^[\s"'`{(]+/, '')
        context.report({ node, messageId: 'bareLight', data: { value: cls } })
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateLiteral(node) {
        // Join quasis with a space so an interpolation boundary cannot fuse a
        // `hover:` prefix onto a following `bg-*-light` (which would mask a bare use).
        check(node, node.quasis.map((q) => q.value.raw).join(' '))
      },
    }
  },
}
