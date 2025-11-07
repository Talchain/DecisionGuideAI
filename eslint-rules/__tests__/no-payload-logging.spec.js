/**
 * Unit tests for security/no-payload-logging ESLint rule (Sprint 2)
 */

import { RuleTester } from 'eslint'
import noPayloadLogging from '../no-payload-logging.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
})

ruleTester.run('security/no-payload-logging', noPayloadLogging, {
  valid: [
    // ✅ Allowed: JSON.stringify inside DEV guard
    {
      code: `
        if (import.meta.env.DEV) {
          console.log('Request:', JSON.stringify(request))
        }
      `,
    },
    // ✅ Allowed: JSON.stringify of non-sensitive variable
    {
      code: `
        console.log('Config:', JSON.stringify(config))
      `,
    },
    // ✅ Allowed: logging without JSON.stringify
    {
      code: `
        console.log('Payload received:', payload)
      `,
    },
    // ✅ Allowed: nested DEV guard
    {
      code: `
        if (import.meta.env.DEV) {
          if (someCondition) {
            console.log('Response:', JSON.stringify(response))
          }
        }
      `,
    },
  ],

  invalid: [
    // ❌ Forbidden: JSON.stringify(request) without DEV guard
    {
      code: `
        console.log('Request:', JSON.stringify(request))
      `,
      errors: [
        {
          messageId: 'noPayloadLogging',
          data: { varType: 'variable', varName: 'request' },
        },
      ],
    },
    // ❌ Forbidden: JSON.stringify(response) without DEV guard
    {
      code: `
        console.log('Response:', JSON.stringify(response))
      `,
      errors: [
        {
          messageId: 'noPayloadLogging',
          data: { varType: 'variable', varName: 'response' },
        },
      ],
    },
    // ❌ Forbidden: JSON.stringify(payload) without DEV guard
    {
      code: `
        fetch('/api', {
          body: JSON.stringify(payload)
        })
        console.log(JSON.stringify(payload))
      `,
      errors: [
        {
          messageId: 'noPayloadLogging',
          data: { varType: 'variable', varName: 'payload' },
        },
      ],
    },
    // ❌ Forbidden: JSON.stringify inside non-DEV condition
    {
      code: `
        if (someOtherCondition) {
          console.log('Request:', JSON.stringify(request))
        }
      `,
      errors: [
        {
          messageId: 'noPayloadLogging',
          data: { varType: 'variable', varName: 'request' },
        },
      ],
    },
  ],
})

console.log('✅ All security/no-payload-logging tests passed!')
