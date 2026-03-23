// eslint-rules/no-unsafe-innerhtml.js
//
// SECURITY: Forbid dangerouslySetInnerHTML without explicit opt-in
// All usages must be sanitised via DOMPurify and annotated with an eslint-disable comment

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow dangerouslySetInnerHTML without explicit eslint-disable annotation',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noUnsafeInnerHTML: 'SECURITY: dangerouslySetInnerHTML requires DOMPurify sanitisation. Add /* eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised via DOMPurify */ if mitigated.',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name && node.name.name === 'dangerouslySetInnerHTML') {
          context.report({
            node,
            messageId: 'noUnsafeInnerHTML',
          })
        }
      },
    }
  },
}
