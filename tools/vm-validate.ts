#!/usr/bin/env tsx
/**
 * View Model Validator
 * Compares generated view models against v3 fixtures' expected-props.json schemas
 * Usage: npm run vm:validate
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const VM_DIR = join(PROJECT_ROOT, 'artifacts', 'ui-viewmodels', 'example');
const FIXTURES_DIR = join(PROJECT_ROOT, 'artifacts', 'ui-fixtures');

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  schema?: string;
}

class ViewModelValidator {

  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    console.log('🔍 View Model Validator');
    console.log('=' .repeat(25));
  }

  log(message: string): void {
    console.log(message);
  }

  loadSchema(schemaPath: string) {
    try {
      const content = readFileSync(schemaPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load schema from ${schemaPath}: ${error}`);
    }
  }

  loadViewModel(viewModelPath: string) {
    try {
      const content = readFileSync(viewModelPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load view model from ${viewModelPath}: ${error}`);
    }
  }

  validateViewModel(viewModelPath: string, schemaPath: string): ValidationResult {
    const errors: string[] = [];

    try {
      const viewModel = this.loadViewModel(viewModelPath);
      const schema = this.loadSchema(schemaPath);

      const validate = this.ajv.compile(schema);
      const valid = validate(viewModel);

      if (!valid && validate.errors) {
        validate.errors.forEach(error => {
          errors.push(`${error.instancePath}: ${error.message}`);
        });
      }

      return {
        file: viewModelPath,
        valid,
        errors,
        schema: schemaPath
      };
    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return {
        file: viewModelPath,
        valid: false,
        errors,
        schema: schemaPath
      };
    }
  }

  async validateAllViewModels(): Promise<void> {
    const validations = [
      // Stream validations
      {
        viewModel: join(VM_DIR, 'stream.happy.json'),
        schema: join(FIXTURES_DIR, 'stream-resume-once', 'expected-props.json'),
        name: 'stream.happy.json vs stream fixtures'
      },
      {
        viewModel: join(VM_DIR, 'stream.resume-once.json'),
        schema: join(FIXTURES_DIR, 'stream-resume-once', 'expected-props.json'),
        name: 'stream.resume-once.json vs stream fixtures'
      },
      {
        viewModel: join(VM_DIR, 'stream.cancelled.json'),
        schema: join(FIXTURES_DIR, 'stream-cancel-mid', 'expected-props.json'),
        name: 'stream.cancelled.json vs cancel fixtures'
      },
      {
        viewModel: join(VM_DIR, 'stream.error.json'),
        schema: join(FIXTURES_DIR, 'stream-error', 'expected-props.json'),
        name: 'stream.error.json vs error fixtures'
      },
      // Jobs validations
      {
        viewModel: join(VM_DIR, 'jobs.progress.json'),
        schema: join(FIXTURES_DIR, 'jobs-cancel-50', 'expected-props.json'),
        name: 'jobs.progress.json vs jobs fixtures'
      },
      {
        viewModel: join(VM_DIR, 'jobs.cancelled.json'),
        schema: join(FIXTURES_DIR, 'jobs-cancel-50', 'expected-props.json'),
        name: 'jobs.cancelled.json vs jobs fixtures'
      },
      // Report validations
      {
        viewModel: join(VM_DIR, 'report.ready.json'),
        schema: join(FIXTURES_DIR, 'report-no-data', 'expected-props.json'),
        name: 'report.ready.json vs report fixtures'
      },
      {
        viewModel: join(VM_DIR, 'report.empty.json'),
        schema: join(FIXTURES_DIR, 'report-no-data', 'expected-props.json'),
        name: 'report.empty.json vs report fixtures'
      }
    ];

    this.log(`Validating ${validations.length} view models against v3 fixture schemas...\n`);

    let allValid = true;
    const results: ValidationResult[] = [];

    for (const { viewModel, schema, name } of validations) {
      if (!existsSync(viewModel)) {
        this.log(`❌ ${name} - view model not found`);
        allValid = false;
        continue;
      }

      if (!existsSync(schema)) {
        this.log(`⚠️  ${name} - schema not found, skipping`);
        continue;
      }

      const result = this.validateViewModel(viewModel, schema);
      results.push(result);

      if (result.valid) {
        this.log(`✅ ${name} - valid`);
      } else {
        allValid = false;
        this.log(`❌ ${name} - ${result.errors.length} error(s)`);
        result.errors.forEach(error => {
          this.log(`   ${error}`);
        });
      }
    }

    this.log('');

    if (allValid) {
      this.log('🎯 All view models are valid and schema-compliant');
      this.log('✨ Ready for Windsurf integration');
    } else {
      const invalidCount = results.filter(r => !r.valid).length;
      this.log(`❌ ${invalidCount}/${results.length} view models have validation errors`);
      process.exit(1);
    }
  }

  async run(): Promise<void> {
    try {
      await this.validateAllViewModels();
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ViewModelValidator();
  validator.run();
}

export { ViewModelValidator };