// eslint-rules/no-dangerous-browser.js
//
// SECURITY: Forbid dangerouslyAllowBrowser in OpenAI client initialization
// All OpenAI calls must go through server-side proxy

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow dangerouslyAllowBrowser in OpenAI client configuration',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noDangerousBrowser: 'SECURITY: Never use dangerouslyAllowBrowser. Proxy OpenAI calls through server-side endpoint instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      Property(node) {
        // Check for dangerouslyAllowBrowser: true
        if (
          node.key &&
          node.key.type === 'Identifier' &&
          node.key.name === 'dangerouslyAllowBrowser' &&
          node.value &&
          node.value.type === 'Literal' &&
          node.value.value === true
        ) {
          context.report({
            node,
            messageId: 'noDangerousBrowser',
          })
        }
      },
    }
  },
}
