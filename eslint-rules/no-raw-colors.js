/**
 * ESLint rule: no-raw-colors
 *
 * Forbids hard-coded colors and legacy Olumi tokens in favor of
 * Olumi v1.2 design system tokens.
 *
 * Forbidden patterns:
 * - Hex colors: #AABBCC, #ABC
 * - RGB/RGBA: rgb(...), rgba(...)
 * - HSL/HSLA: hsl(...), hsla(...)
 * - Legacy Olumi tokens: var(--olumi-*)
 *
 * Allowed:
 * - Olumi v1.2 tokens: var(--semantic-info), var(--sky-500), etc.
 * - Tailwind classes
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid hard-coded colors and legacy --olumi-* tokens',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noHexColor: 'Hard-coded hex color "{{value}}" is forbidden. Use Olumi v1.2 design tokens (e.g., var(--semantic-info)).',
      noRgbColor: 'Hard-coded rgb/rgba color "{{value}}" is forbidden. Use Olumi v1.2 design tokens.',
      noHslColor: 'Hard-coded hsl/hsla color "{{value}}" is forbidden. Use Olumi v1.2 design tokens.',
      noLegacyToken: 'Legacy Olumi token "{{value}}" is forbidden. Use Olumi v1.2 tokens from brand.css.',
    },
    schema: [],
  },
  create(context) {
    // Regex patterns
    const HEX_COLOR = /#[0-9A-Fa-f]{3,8}\b/g
    const RGB_COLOR = /rgba?\s*\([^)]+\)/gi
    const HSL_COLOR = /hsla?\s*\([^)]+\)/gi
    const LEGACY_TOKEN = /var\(--olumi-[^)]+\)/g

    function checkString(node, value) {
      // Check for hex colors
      let match
      while ((match = HEX_COLOR.exec(value)) !== null) {
        context.report({
          node,
          messageId: 'noHexColor',
          data: { value: match[0] },
        })
      }

      // Check for rgb/rgba
      while ((match = RGB_COLOR.exec(value)) !== null) {
        context.report({
          node,
          messageId: 'noRgbColor',
          data: { value: match[0] },
        })
      }

      // Check for hsl/hsla
      while ((match = HSL_COLOR.exec(value)) !== null) {
        context.report({
          node,
          messageId: 'noHslColor',
          data: { value: match[0] },
        })
      }

      // Check for legacy --olumi-* tokens
      while ((match = LEGACY_TOKEN.exec(value)) !== null) {
        context.report({
          node,
          messageId: 'noLegacyToken',
          data: { value: match[0] },
        })
      }
    }

    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value === 'string') {
          checkString(node, node.value)
        }
      },
      // Check template literals
      TemplateLiteral(node) {
        const value = node.quasis.map(q => q.value.raw).join('')
        checkString(node, value)
      },
      // Check JSX attributes
      JSXAttribute(node) {
        if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
          checkString(node.value, node.value.value)
        }
        if (node.value && node.value.type === 'JSXExpressionContainer') {
          if (node.value.expression.type === 'Literal' && typeof node.value.expression.value === 'string') {
            checkString(node.value.expression, node.value.expression.value)
          }
        }
      },
    }
  },
}
