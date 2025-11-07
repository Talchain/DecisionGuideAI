/**
 * ESLint rule: no-payload-logging
 *
 * Prevents accidental logging of request/response payloads in production.
 * Requires DEV guard for logging stringified request/response objects.
 *
 * Forbidden patterns (without DEV guard):
 * - console.log(JSON.stringify(req...))
 * - console.log(JSON.stringify(res...))
 * - console.log(JSON.stringify(...request...))
 * - console.log(JSON.stringify(...response...))
 * - console.log(JSON.stringify(...payload...))
 *
 * Allowed:
 * - if (import.meta.env.DEV) { console.log(JSON.stringify(req)) }
 * - Logging non-sensitive data
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent logging of request/response payloads without DEV guard',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noPayloadLogging: 'Logging stringified {{varType}} "{{varName}}" without DEV guard is forbidden. Wrap in: if (import.meta.env.DEV) { ... }',
    },
    schema: [],
  },
  create(context) {
    // Sensitive variable name patterns
    const SENSITIVE_PATTERNS = [
      /\breq(uest)?\b/i,
      /\bres(ponse)?\b/i,
      /\bpayload\b/i,
      /\bbody\b/i,
      /\bdata\b/i,
    ]

    // Track if we're inside a DEV guard
    let devGuardDepth = 0

    function isSensitiveVarName(name) {
      return SENSITIVE_PATTERNS.some(pattern => pattern.test(name))
    }

    function checkConsoleLog(node) {
      // Skip if inside DEV guard
      if (devGuardDepth > 0) return

      // Check if this is console.log/console.error/etc
      if (
        node.callee.type !== 'MemberExpression' ||
        node.callee.object.name !== 'console'
      ) {
        return
      }

      // Check each argument
      for (const arg of node.arguments) {
        // Check for JSON.stringify(sensitiveVar)
        if (
          arg.type === 'CallExpression' &&
          arg.callee.type === 'MemberExpression' &&
          arg.callee.object.name === 'JSON' &&
          arg.callee.property.name === 'stringify'
        ) {
          // Check the argument to JSON.stringify
          const stringifyArg = arg.arguments[0]
          if (stringifyArg) {
            let varName = null
            let varType = 'variable'

            // Identifier: JSON.stringify(req)
            if (stringifyArg.type === 'Identifier') {
              varName = stringifyArg.name
            }
            // MemberExpression: JSON.stringify(data.request)
            else if (stringifyArg.type === 'MemberExpression') {
              const sourceCode = context.getSourceCode()
              varName = sourceCode.getText(stringifyArg)
              varType = 'property'
            }
            // ObjectExpression: JSON.stringify({ req, res })
            else if (stringifyArg.type === 'ObjectExpression') {
              for (const prop of stringifyArg.properties) {
                if (prop.type === 'Property' || prop.type === 'SpreadElement') {
                  const propName = prop.key?.name || prop.argument?.name
                  if (propName && isSensitiveVarName(propName)) {
                    context.report({
                      node: arg,
                      messageId: 'noPayloadLogging',
                      data: { varType: 'object property', varName: propName },
                    })
                  }
                }
              }
              continue
            }

            if (varName && isSensitiveVarName(varName)) {
              context.report({
                node: arg,
                messageId: 'noPayloadLogging',
                data: { varType, varName },
              })
            }
          }
        }
      }
    }

    return {
      // Track DEV guards
      IfStatement(node) {
        // Check if this is: if (import.meta.env.DEV)
        if (
          node.test.type === 'MemberExpression' &&
          node.test.object.type === 'MemberExpression' &&
          node.test.object.object.type === 'MetaProperty' &&
          node.test.object.object.meta.name === 'import' &&
          node.test.object.object.property.name === 'meta' &&
          node.test.object.property.name === 'env' &&
          node.test.property.name === 'DEV'
        ) {
          devGuardDepth++
        }
      },
      'IfStatement:exit'(node) {
        // Check if this was a DEV guard
        if (
          node.test.type === 'MemberExpression' &&
          node.test.object.type === 'MemberExpression' &&
          node.test.object.object.type === 'MetaProperty' &&
          node.test.object.object.meta.name === 'import' &&
          node.test.object.object.property.name === 'meta' &&
          node.test.object.property.name === 'env' &&
          node.test.property.name === 'DEV'
        ) {
          devGuardDepth--
        }
      },
      // Check console calls
      CallExpression(node) {
        checkConsoleLog(node)
      },
    }
  },
}
