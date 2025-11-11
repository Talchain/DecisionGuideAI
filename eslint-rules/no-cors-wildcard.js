// eslint-rules/no-cors-wildcard.js
//
// SECURITY: Forbid Access-Control-Allow-Origin: "*" in server code
// Use explicit allow-lists with Vary: Origin instead

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow CORS wildcard (*) in Access-Control-Allow-Origin headers',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noCorsWildcard: 'SECURITY: Never use Access-Control-Allow-Origin: "*". Use explicit allow-list with Vary: Origin instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      Property(node) {
        // Check for "Access-Control-Allow-Origin": "*"
        if (
          node.key &&
          ((node.key.type === 'Literal' && node.key.value === 'Access-Control-Allow-Origin') ||
           (node.key.type === 'Identifier' && node.key.name === 'Access-Control-Allow-Origin')) &&
          node.value &&
          node.value.type === 'Literal' &&
          node.value.value === '*'
        ) {
          context.report({
            node,
            messageId: 'noCorsWildcard',
          })
        }
      },
    }
  },
}
