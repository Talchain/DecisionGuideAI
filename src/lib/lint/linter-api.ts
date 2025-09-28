/**
 * Linter API endpoint
 * POST /lint/scenario - Returns lint.v1 advice for scenarios
 */

import { lintScenario, LintResult } from './scenario-linter.js';

/**
 * Check if linter is enabled
 */
function isLinterEnabled(): boolean {
  return process.env.LINTER_ENABLE === '1';
}

/**
 * Add standard security headers
 */
function addSecurityHeaders(res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/**
 * Core linter API logic
 */
export class LinterApi {
  /**
   * Lint a scenario and return advice
   */
  async lintScenario(scenario: any): Promise<{ success: boolean; data?: LintResult; error?: string; status: number }> {
    if (!isLinterEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    if (!scenario) {
      return {
        success: false,
        error: 'Scenario data is required.',
        status: 400
      };
    }

    try {
      // Validate basic structure
      if (typeof scenario !== 'object') {
        return {
          success: false,
          error: 'Scenario must be a valid object.',
          status: 400
        };
      }

      // Run the linter
      const result = lintScenario(scenario);

      return {
        success: true,
        data: result,
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to analyse scenario at this time.',
        status: 500
      };
    }
  }
}

export const linterApi = new LinterApi();