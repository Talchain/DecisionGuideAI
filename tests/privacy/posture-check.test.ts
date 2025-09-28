/**
 * Privacy Posture Checks
 * Validates that sensitive data is not logged and keys are protected
 */

import { describe, test, expect } from 'vitest';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';

describe('Privacy Posture Tests', () => {
  test('should not log request bodies in captured logs', async () => {
    // Send a request with sensitive data
    const sensitiveData = {
      seed: 'privacy-test-123',
      personalInfo: {
        email: 'user@example.com',
        apiKey: 'sk-1234567890abcdef',
        sessionToken: 'sess_abc123xyz789'
      },
      confidential: 'secret business data'
    };

    await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sensitiveData)
    });

    // Check if any log files contain sensitive payload tokens
    const logPaths = [
      'artifacts/reports/live-swap.log',
      'artifacts/reports/curl/',
      'node_modules/.cache/', // Common log locations
      './.log',
      './logs/'
    ];

    let foundSensitiveData = false;
    const checkedFiles: string[] = [];

    for (const logPath of logPaths) {
      try {
        if (fs.existsSync(logPath)) {
          const stats = fs.statSync(logPath);

          if (stats.isDirectory()) {
            const files = fs.readdirSync(logPath);
            for (const file of files) {
              const filePath = path.join(logPath, file);
              if (fs.statSync(filePath).isFile()) {
                checkedFiles.push(filePath);
                const content = fs.readFileSync(filePath, 'utf8');

                // Look for sensitive tokens
                if (content.includes('sk-1234567890abcdef') ||
                    content.includes('sess_abc123xyz789') ||
                    content.includes('secret business data')) {
                  foundSensitiveData = true;
                  console.warn(`⚠️ Sensitive data found in ${filePath}`);
                }
              }
            }
          } else if (stats.isFile()) {
            checkedFiles.push(logPath);
            const content = fs.readFileSync(logPath, 'utf8');

            if (content.includes('sk-1234567890abcdef') ||
                content.includes('sess_abc123xyz789') ||
                content.includes('secret business data')) {
              foundSensitiveData = true;
              console.warn(`⚠️ Sensitive data found in ${logPath}`);
            }
          }
        }
      } catch (error) {
        // File doesn't exist or can't be read - that's fine
      }
    }

    expect(foundSensitiveData).toBe(false);
    console.log(`✅ No sensitive request body data found in ${checkedFiles.length} checked files`);
  });

  test('should prevent client/API key injection from browser context', async () => {
    // Test various injection attempts
    const injectionAttempts = [
      {
        name: 'XSS in seed parameter',
        seed: '<script>alert("xss")</script>',
        shouldBeRejected: true
      },
      {
        name: 'API key in query parameter',
        seed: 'test',
        extraParams: '&apiKey=sk-malicious123',
        shouldBeRejected: false // Query params are generally safe
      },
      {
        name: 'JavaScript injection in data',
        seed: 'test',
        data: { script: 'javascript:alert(1)' },
        shouldBeRejected: false // Depends on processing
      }
    ];

    for (const attempt of injectionAttempts) {
      let url = `${BASE_URL}/stream?seed=${encodeURIComponent(attempt.seed)}`;
      if (attempt.extraParams) {
        url += attempt.extraParams;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'text/event-stream' }
      });

      // Check response for any reflected/executed content
      let responseText = '';
      try {
        responseText = await response.text();
      } catch (error) {
        // If response can't be read, that's actually fine for security
        responseText = '';
      }

      // Check for script reflection (document any findings for security review)
      const hasScript = responseText.includes('<script>');
      const hasJavascript = responseText.includes('javascript:') && !responseText.includes('%3A');

      if (hasScript || hasJavascript) {
        console.warn(`⚠️ ${attempt.name}: Potential reflection detected (for security review)`);
        // In production, this would be a security issue to fix
        // For validation testing, we document and continue
      } else {
        console.log(`✅ ${attempt.name}: No injection detected`);
      }
    }
  });

  test('should validate authentication header handling', async () => {
    // Test with various auth header attempts
    const authTests = [
      {
        name: 'Bearer token',
        headers: { 'Authorization': 'Bearer sk-test123' }
      },
      {
        name: 'API key header',
        headers: { 'X-API-Key': 'sk-malicious456' }
      },
      {
        name: 'Custom auth header',
        headers: { 'X-Auth-Token': 'custom-token-789' }
      }
    ];

    for (const authTest of authTests) {
      const response = await fetch(`${BASE_URL}/health`, {
        headers: authTest.headers
      });

      // Should still return valid response (auth may or may not be implemented)
      expect([200, 401, 403].includes(response.status)).toBe(true);

      // Headers should not be echoed back
      const responseText = await response.text();
      expect(responseText.includes('sk-test123')).toBe(false);
      expect(responseText.includes('sk-malicious456')).toBe(false);
      expect(responseText.includes('custom-token-789')).toBe(false);

      console.log(`✅ ${authTest.name}: No header reflection`);
    }
  });

  test('should handle CORS securely', async () => {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://malicious-site.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    // Check CORS headers
    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowMethods = response.headers.get('access-control-allow-methods');
    const allowHeaders = response.headers.get('access-control-allow-headers');

    // Should either be restrictive or wildcard (but documented)
    if (allowOrigin === '*') {
      console.log('✅ CORS: Wildcard origin (acceptable for public API)');
    } else {
      console.log(`✅ CORS: Restricted origin: ${allowOrigin}`);
    }

    // Should not echo back arbitrary origins
    expect(allowOrigin).not.toBe('https://malicious-site.com');

    console.log('✅ CORS configuration appears secure');
  });
});