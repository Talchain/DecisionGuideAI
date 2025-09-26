#!/usr/bin/env tsx

/**
 * SARB Verification Tool
 * Verifies integrity and safety of SARB bundles (including redacted ones)
 */

import fs from 'fs/promises';
import path from 'path';

interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    bundleId?: string;
    sessions: number;
    totalSize: number;
    hasSensitiveData: boolean;
    redacted: boolean;
  };
}

async function verifySarbBundle(bundlePath: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      sessions: 0,
      totalSize: 0,
      hasSensitiveData: false,
      redacted: false
    }
  };

  try {
    // Read bundle
    const data = await fs.readFile(bundlePath, 'utf8');
    const stats = await fs.stat(bundlePath);
    result.summary.totalSize = stats.size;

    const bundle = JSON.parse(data);

    // Basic structure validation
    if (!bundle.meta) {
      result.errors.push('Missing meta section');
      result.valid = false;
    } else {
      result.summary.bundleId = bundle.meta.bundleId;
    }

    if (!bundle.sessions || !Array.isArray(bundle.sessions)) {
      result.errors.push('Missing or invalid sessions array');
      result.valid = false;
    } else {
      result.summary.sessions = bundle.sessions.length;
    }

    // Check for sensitive data
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{32,}/,  // OpenAI keys
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/, // Emails
      /password/i,
      /secret/i,
      /token/i,
      /authorization/i
    ];

    const bundleStr = JSON.stringify(bundle);
    for (const pattern of sensitivePatterns) {
      if (pattern.test(bundleStr)) {
        result.summary.hasSensitiveData = true;
        result.warnings.push(`Potentially sensitive data detected: ${pattern.source}`);
      }
    }

    // Check if this appears to be redacted
    const hasRedactionIndicators =
      bundleStr.includes('redacted') ||
      bundleStr.includes('[REMOVED]') ||
      (bundle.meta && bundle.meta.redacted === true);

    result.summary.redacted = hasRedactionIndicators;

    // Validate session structure
    if (bundle.sessions) {
      bundle.sessions.forEach((session: any, index: number) => {
        if (!session.sessionId) {
          result.errors.push(`Session ${index}: Missing sessionId`);
          result.valid = false;
        }
        if (!session.traces || !Array.isArray(session.traces)) {
          result.errors.push(`Session ${index}: Missing or invalid traces`);
          result.valid = false;
        }
      });
    }

    // Additional validations for redacted bundles
    if (result.summary.redacted) {
      // Check that sensitive fields were actually removed
      const sensitiveFields = ['apiKey', 'secret', 'password', 'authorization'];
      for (const field of sensitiveFields) {
        if (bundleStr.toLowerCase().includes(field.toLowerCase() + ':')) {
          result.warnings.push(`Redacted bundle still contains field: ${field}`);
        }
      }
    }

  } catch (error) {
    result.errors.push(`Failed to parse bundle: ${error instanceof Error ? error.message : error}`);
    result.valid = false;
  }

  return result;
}

function printVerificationResult(result: VerificationResult, bundlePath: string): void {
  console.log(`\\n🔍 SARB Bundle Verification: ${path.basename(bundlePath)}`);
  console.log('='.repeat(50));

  // Overall status
  if (result.valid) {
    console.log('✅ Status: VALID');
  } else {
    console.log('❌ Status: INVALID');
  }

  // Summary
  console.log('\\n📊 Summary:');
  console.log(`  Bundle ID: ${result.summary.bundleId || 'Unknown'}`);
  console.log(`  Sessions: ${result.summary.sessions}`);
  console.log(`  Size: ${(result.summary.totalSize / 1024).toFixed(1)} KB`);
  console.log(`  Redacted: ${result.summary.redacted ? '✅ Yes' : '❌ No'}`);
  console.log(`  Has Sensitive Data: ${result.summary.hasSensitiveData ? '⚠️ Yes' : '✅ No'}`);

  // Errors
  if (result.errors.length > 0) {
    console.log('\\n❌ Errors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\\n⚠️ Warnings:');
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  // Recommendations
  console.log('\\n💡 Recommendations:');
  if (result.summary.hasSensitiveData && !result.summary.redacted) {
    console.log('  - Consider redacting this bundle before sharing');
    console.log('  - Run: npm run sarb:redact -- input.sarb.zip output.sarb.zip');
  } else if (result.valid && result.summary.redacted) {
    console.log('  - Bundle appears safe for sharing');
  } else if (result.valid) {
    console.log('  - Bundle is valid for internal use');
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: npm run sarb:verify -- <bundle.sarb.zip>');
    console.log('');
    console.log('Verifies integrity and safety of SARB bundles.');
    console.log('Checks for sensitive data and validates structure.');
    process.exit(1);
  }

  const bundlePath = args[0];

  try {
    await fs.access(bundlePath);
    const result = await verifySarbBundle(bundlePath);

    printVerificationResult(result, bundlePath);

    // Exit with appropriate code
    if (!result.valid) {
      process.exit(1);
    } else if (result.warnings.length > 0) {
      process.exit(2); // Warnings
    } else {
      process.exit(0); // Success
    }

  } catch (error) {
    console.error(`❌ Cannot access bundle: ${bundlePath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { verifySarbBundle };