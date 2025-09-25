#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
  };
}

interface ContractExample {
  id: string;
  name: string;
  method: string;
  path: string;
  request?: any;
  response: any;
  description: string;
}

class ContractExamplesSync {
  private projectRoot = process.cwd();
  private contractsDir = resolve(this.projectRoot, 'artifacts/contracts/examples');

  async loadOpenAPISpec(): Promise<OpenAPISpec | null> {
    const specPaths = [
      'docs/api/openapi.yaml',
      'docs/api/openapi.json',
      'openapi.yaml',
      'openapi.json',
      'api-spec.yaml',
      'api-spec.json'
    ];

    for (const specPath of specPaths) {
      const fullPath = resolve(this.projectRoot, specPath);
      if (existsSync(fullPath)) {
        console.log(`📖 Found OpenAPI spec: ${specPath}`);

        try {
          if (specPath.endsWith('.json')) {
            const content = readFileSync(fullPath, 'utf8');
            return JSON.parse(content);
          } else {
            // For YAML files, we'd need a YAML parser
            console.log('⚠️ YAML specs not supported in this simple implementation');
            continue;
          }
        } catch (error) {
          console.log(`⚠️ Failed to parse ${specPath}:`, error);
          continue;
        }
      }
    }

    return null;
  }

  generateExampleFromSpec(spec: OpenAPISpec): ContractExample[] {
    const examples: ContractExample[] = [];

    Object.entries(spec.paths).forEach(([path, pathObj]) => {
      Object.entries(pathObj).forEach(([method, operation]: [string, any]) => {
        if (method === 'parameters') return; // Skip path-level parameters

        const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Generate request example
        let requestExample = null;
        if (operation.requestBody?.content?.['application/json']?.schema) {
          requestExample = this.generateExampleFromSchema(
            operation.requestBody.content['application/json'].schema,
            spec.components?.schemas
          );
        }

        // Generate response example
        let responseExample = null;
        const responses = operation.responses || {};
        const successResponse = responses['200'] || responses['201'] || responses['202'];

        if (successResponse?.content?.['application/json']?.schema) {
          responseExample = this.generateExampleFromSchema(
            successResponse.content['application/json'].schema,
            spec.components?.schemas
          );
        }

        if (responseExample || requestExample) {
          examples.push({
            id: `example_${operationId}`,
            name: operation.summary || `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            path,
            request: requestExample,
            response: responseExample || { status: 'success' },
            description: operation.description || `Example for ${method.toUpperCase()} ${path}`
          });
        }
      });
    });

    return examples;
  }

  generateExampleFromSchema(schema: any, schemas?: Record<string, any>): any {
    // Handle $ref references
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      if (schemas && schemas[refPath]) {
        return this.generateExampleFromSchema(schemas[refPath], schemas);
      }
      return `<${refPath}>`;
    }

    // Handle different schema types
    switch (schema.type) {
      case 'object':
        const obj: Record<string, any> = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
            obj[key] = this.generateExampleFromSchema(prop, schemas);
          });
        }
        return obj;

      case 'array':
        if (schema.items) {
          return [this.generateExampleFromSchema(schema.items, schemas)];
        }
        return [];

      case 'string':
        if (schema.enum) return schema.enum[0];
        if (schema.format === 'date-time') return '2024-09-24T19:35:00Z';
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uri') return 'https://example.com';
        return schema.example || 'example string';

      case 'number':
      case 'integer':
        return schema.example || 42;

      case 'boolean':
        return schema.example !== undefined ? schema.example : true;

      default:
        return schema.example || null;
    }
  }

  generateFallbackExamples(): ContractExample[] {
    // Fallback examples based on known DecisionGuide AI API patterns
    return [
      {
        id: 'example_analysis_request',
        name: 'Create Analysis Request',
        method: 'POST',
        path: '/api/analysis',
        request: {
          decisionTitle: 'Choose Development Framework',
          options: [
            {
              name: 'React',
              description: 'Popular JavaScript library for building user interfaces'
            },
            {
              name: 'Vue.js',
              description: 'Progressive JavaScript framework'
            },
            {
              name: 'Angular',
              description: 'Platform for building mobile and desktop web applications'
            }
          ],
          context: {
            timeline: '3 months',
            budget: '$50,000',
            teamSize: '5 developers'
          }
        },
        response: {
          analysisId: 'ana_example_001',
          status: 'queued',
          timestamp: '2024-09-24T19:35:00Z',
          estimatedDuration: '45 seconds'
        },
        description: 'Submit a new decision analysis request with multiple options'
      },
      {
        id: 'example_analysis_status',
        name: 'Get Analysis Status',
        method: 'GET',
        path: '/api/analysis/{analysisId}/status',
        response: {
          analysisId: 'ana_example_001',
          status: 'completed',
          progress: 100,
          startedAt: '2024-09-24T19:35:00Z',
          completedAt: '2024-09-24T19:35:45Z',
          tokensGenerated: 256
        },
        description: 'Check the current status of an analysis'
      },
      {
        id: 'example_analysis_cancel',
        name: 'Cancel Analysis',
        method: 'POST',
        path: '/api/analysis/{analysisId}/cancel',
        request: {
          reason: 'user_requested',
          graceful: true
        },
        response: {
          analysisId: 'ana_example_001',
          status: 'cancelled',
          cancelledAt: '2024-09-24T19:35:30Z',
          partialResults: {
            tokensGenerated: 128,
            progress: 60,
            lastStage: 'option_analysis'
          }
        },
        description: 'Cancel a running analysis with optional graceful shutdown'
      }
    ];
  }

  async syncExamples(): Promise<void> {
    console.log('🔄 Syncing contract examples from OpenAPI spec...');

    // Try to load OpenAPI spec
    const spec = await this.loadOpenAPISpec();

    let examples: ContractExample[];

    if (spec) {
      console.log(`📋 Generating examples from OpenAPI spec (${spec.info?.title || 'Unknown'} v${spec.info?.version || '1.0'})`);
      examples = this.generateExampleFromSpec(spec);

      if (examples.length === 0) {
        console.log('⚠️ No examples generated from spec, using fallback examples');
        examples = this.generateFallbackExamples();
      }
    } else {
      console.log('📋 No OpenAPI spec found, using fallback examples');
      examples = this.generateFallbackExamples();
    }

    // Generate updated contract files
    const timestamp = new Date().toISOString();

    // Update main examples
    const examplesOutput = {
      info: {
        title: 'API Contract Examples',
        description: 'Generated from OpenAPI specification',
        version: '1.0',
        generated: timestamp,
        source: spec ? 'openapi_spec' : 'fallback_patterns'
      },
      examples: examples.reduce((acc, example) => {
        acc[example.id] = {
          name: example.name,
          method: example.method,
          path: example.path,
          description: example.description,
          ...(example.request && { request: example.request }),
          response: example.response
        };
        return acc;
      }, {} as Record<string, any>)
    };

    writeFileSync(
      resolve(this.contractsDir, 'api-examples.json'),
      JSON.stringify(examplesOutput, null, 2)
    );

    // Update stream examples (these are static/realistic)
    const streamExample = {
      info: {
        title: 'SSE Stream Examples',
        description: 'Server-Sent Events stream patterns',
        generated: timestamp
      },
      events: {
        connected: {
          event: 'connected',
          data: { sessionId: 'session_example_001', timestamp: timestamp }
        },
        start: {
          event: 'start',
          data: { analysisId: 'ana_example_001', status: 'started', timestamp: timestamp }
        },
        token: {
          event: 'token',
          data: { text: '# Decision Analysis Report\n\n' }
        },
        progress: {
          event: 'progress',
          data: { progress: 25, stage: 'option_analysis', message: 'Analyzing options...' }
        },
        complete: {
          event: 'complete',
          data: {
            analysisId: 'ana_example_001',
            status: 'completed',
            timestamp: timestamp,
            tokensGenerated: 256,
            duration: 45.0
          }
        }
      }
    };

    writeFileSync(
      resolve(this.contractsDir, 'sse-examples.json'),
      JSON.stringify(streamExample, null, 2)
    );

    console.log(`✅ Updated contract examples:`);
    console.log(`   - ${examples.length} API endpoint examples`);
    console.log(`   - 5 SSE event examples`);
    console.log(`   - Source: ${spec ? 'OpenAPI spec' : 'fallback patterns'}`);
    console.log(`   - Generated: ${timestamp}`);
  }

  async run(): Promise<void> {
    try {
      await this.syncExamples();
    } catch (error) {
      console.error('❌ Failed to sync contract examples:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new ContractExamplesSync();
  sync.run();
}

export { ContractExamplesSync };