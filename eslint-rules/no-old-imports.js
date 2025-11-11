/**
 * ESLint rule: no-old-imports
 *
 * Blocks imports from .old.* files to prevent legacy code from re-entering the codebase.
 *
 * Example violations:
 * - import { foo } from './Something.old'
 * - import './legacy.old.tsx'
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports from .old.* files',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noOldImports: 'Importing from .old.* files is not allowed. These are legacy backups and should not be used.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const importPath = node.source.value
        if (typeof importPath === 'string' && importPath.includes('.old')) {
          context.report({
            node: node.source,
            messageId: 'noOldImports',
          })
        }
      },
    }
  },
}
