#!/usr/bin/env tsx
/**
 * UI Fixtures Validator
 * Validates determinism and schema compliance for UI fixtures
 * Usage: npm run fixtures:validate
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const FIXTURES_DIR = join(PROJECT_ROOT, 'artifacts', 'ui-fixtures');

interface ValidationResult {
  fixture: string;
  valid: boolean;
  errors: string[];
}

class UIFixturesValidator {

  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.log('🔍 UI Fixtures Validator');
    this.log('=' .repeat(30));
  }

  log(message: string): void {
    console.log(message);
  }

  validateDeterminism(fixtureName: string): string[] {
    const errors: string[] = [];
    const metadataPath = join(FIXTURES_DIR, fixtureName, 'metadata.json');

    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

      if (!metadata.deterministic) {
        errors.push('metadata.deterministic is not true');
      }

      if (!metadata.seed) {
        errors.push('metadata.seed is missing');
      }

      if (!metadata.baseTimestamp) {
        errors.push('metadata.baseTimestamp is missing');
      } else {
        // Validate timestamp format
        const timestamp = new Date(metadata.baseTimestamp);
        if (isNaN(timestamp.getTime())) {
          errors.push('metadata.baseTimestamp is not a valid ISO string');
        }
      }
    } catch (error) {
      errors.push(`Failed to parse metadata.json: ${error}`);
    }

    return errors;
  }

  validateSchemaCompliance(fixtureName: string): string[] {
    const errors: string[] = [];

    try {
      const viewModelPath = join(FIXTURES_DIR, fixtureName, 'view-model.json');
      const expectedPropsPath = join(FIXTURES_DIR, fixtureName, 'expected-props.json');

      const viewModel = JSON.parse(readFileSync(viewModelPath, 'utf-8'));
      const schema = JSON.parse(readFileSync(expectedPropsPath, 'utf-8'));

      const validate = this.ajv.compile(schema);
      const valid = validate(viewModel);

      if (!valid && validate.errors) {
        validate.errors.forEach(error => {
          errors.push(`Schema validation: ${error.instancePath} ${error.message}`);
        });
      }
    } catch (error) {
      errors.push(`Schema validation failed: ${error}`);
    }

    return errors;
  }

  validateEventStructure(fixtureName: string): string[] {
    const errors: string[] = [];
    const eventsPath = join(FIXTURES_DIR, fixtureName, 'events.ndjson');

    try {
      const content = readFileSync(eventsPath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length === 0) {
        errors.push('events.ndjson is empty');
        return errors;
      }

      let lastEventId = 0;
      for (let i = 0; i < lines.length; i++) {
        try {
          const event = JSON.parse(lines[i]);

          // Validate required fields
          if (!event.id) {
            errors.push(`Line ${i + 1}: missing event.id`);
          } else {
            // Validate monotonic IDs
            const eventId = parseInt(event.id);
            if (eventId !== lastEventId + 1) {
              errors.push(`Line ${i + 1}: event.id should be ${lastEventId + 1}, got ${eventId}`);
            }
            lastEventId = eventId;
          }

          if (!event.event) {
            errors.push(`Line ${i + 1}: missing event.event`);
          }

          if (!event.data) {
            errors.push(`Line ${i + 1}: missing event.data`);
          } else {
            // Validate data is valid JSON string
            try {
              JSON.parse(event.data);
            } catch {
              errors.push(`Line ${i + 1}: event.data is not valid JSON`);
            }
          }
        } catch (parseError) {
          errors.push(`Line ${i + 1}: invalid JSON`);
        }
      }
    } catch (error) {
      errors.push(`Failed to read events.ndjson: ${error}`);
    }

    return errors;
  }

  validateFixture(fixtureName: string): ValidationResult {
    const errors: string[] = [];

    // Check all required files exist
    const requiredFiles = ['events.ndjson', 'view-model.json', 'expected-props.json', 'metadata.json'];
    for (const file of requiredFiles) {
      const filePath = join(FIXTURES_DIR, fixtureName, file);
      if (!existsSync(filePath)) {
        errors.push(`Missing required file: ${file}`);
      }
    }

    // If files are missing, skip further validation
    if (errors.length > 0) {
      return { fixture: fixtureName, valid: false, errors };
    }

    // Validate determinism
    errors.push(...this.validateDeterminism(fixtureName));

    // Validate schema compliance
    errors.push(...this.validateSchemaCompliance(fixtureName));

    // Validate event structure
    errors.push(...this.validateEventStructure(fixtureName));

    return {
      fixture: fixtureName,
      valid: errors.length === 0,
      errors
    };
  }

  async validateAllFixtures(): Promise<void> {
    const fixtures = [
      'stream-resume-once',
      'stream-cancel-mid',
      'stream-error',
      'jobs-cancel-50',
      'report-no-data'
    ];

    this.log(`Validating ${fixtures.length} fixture sets...\n`);

    const results: ValidationResult[] = [];
    let allValid = true;

    for (const fixture of fixtures) {
      const result = this.validateFixture(fixture);
      results.push(result);

      if (result.valid) {
        this.log(`✅ ${fixture} - valid`);
      } else {
        allValid = false;
        this.log(`❌ ${fixture} - ${result.errors.length} error(s)`);
        result.errors.forEach(error => {
          this.log(`   ${error}`);
        });
      }
    }

    this.log('');

    if (allValid) {
      this.log('🎯 All fixtures are valid, deterministic, and contract-compliant');
      this.log('✨ Ready for Windsurf integration');
    } else {
      const invalidCount = results.filter(r => !r.valid).length;
      this.log(`❌ ${invalidCount}/${fixtures.length} fixtures have validation errors`);
      process.exit(1);
    }
  }

  async run(): Promise<void> {
    try {
      await this.validateAllFixtures();
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new UIFixturesValidator();
  validator.run();
}

export { UIFixturesValidator };