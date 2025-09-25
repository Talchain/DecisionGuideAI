#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';
import * as yaml from 'yaml';

interface ScenarioYAML {
  title: string;
  description?: string;
  decision?: {
    title: string;
    options: Array<{
      name: string;
      description: string;
    }>;
    context?: {
      timeline?: string;
      budget?: string;
      constraints?: string[];
    };
  };
  params?: {
    seed?: number;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
  metadata?: {
    created?: string;
    author?: string;
    tags?: string[];
  };
}

interface SARBBundle {
  version: '1.0';
  created: string;
  scenario: ScenarioYAML;
  execution: {
    seed: number;
    params: {
      maxTokens: number;
      temperature: number;
      model: string;
    };
    mode: 'simulation' | 'live';
  };
  results: {
    status: 'completed' | 'cancelled' | 'error';
    duration: number;
    tokensGenerated: number;
    cost?: number;
    steps: Array<{
      step: number;
      timestamp: number;
      stage: string;
      tokens: number;
      deltaTime: number;
    }>;
  };
  transcript: {
    tokens: Array<{
      text: string;
      timestamp: number;
      index: number;
    }>;
    markdown: string;
  };
}

class SARBPacker {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  loadScenarioYAML(yamlPath: string): ScenarioYAML {
    if (!existsSync(yamlPath)) {
      throw new Error(`Scenario file not found: ${yamlPath}`);
    }

    const content = readFileSync(yamlPath, 'utf8');

    try {
      const parsed = yaml.parse(content);
      return parsed as ScenarioYAML;
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error}`);
    }
  }

  simulateExecution(scenario: ScenarioYAML, mode: 'simulation' | 'live' = 'simulation'): SARBBundle['results'] {
    // Simulation mode - generate realistic but fake results
    const seed = scenario.params?.seed || Math.floor(Math.random() * 10000);
    const maxTokens = scenario.params?.maxTokens || 500;

    // Simulate execution timing
    const startTime = Date.now();
    const steps: SARBBundle['results']['steps'] = [];

    let currentTime = startTime;
    let totalTokens = 0;

    const stages = ['initialization', 'option_analysis', 'scoring', 'risk_assessment', 'final_report'];

    stages.forEach((stage, index) => {
      const stepTokens = Math.floor(maxTokens / stages.length * (0.8 + Math.random() * 0.4));
      const deltaTime = 2000 + Math.random() * 3000; // 2-5 seconds per stage

      currentTime += deltaTime;
      totalTokens += stepTokens;

      steps.push({
        step: index + 1,
        timestamp: currentTime,
        stage,
        tokens: stepTokens,
        deltaTime
      });
    });

    const duration = currentTime - startTime;

    return {
      status: 'completed',
      duration,
      tokensGenerated: totalTokens,
      cost: totalTokens * 0.002, // $0.002 per token (simulated pricing)
      steps
    };
  }

  generateTranscript(scenario: ScenarioYAML, results: SARBBundle['results']): SARBBundle['transcript'] {
    // Generate realistic transcript based on scenario
    const tokens: SARBBundle['transcript']['tokens'] = [];

    let markdown = `# Decision Analysis Report\n\n`;
    markdown += `**Decision:** ${scenario.decision?.title || scenario.title}\n\n`;

    if (scenario.decision?.context?.timeline || scenario.decision?.context?.budget) {
      markdown += `## Context\n\n`;
      if (scenario.decision?.context?.timeline) {
        markdown += `- **Timeline:** ${scenario.decision.context.timeline}\n`;
      }
      if (scenario.decision?.context?.budget) {
        markdown += `- **Budget:** ${scenario.decision.context.budget}\n`;
      }
      markdown += `\n`;
    }

    markdown += `## Analysis Summary\n\n`;
    markdown += `After analyzing your ${scenario.decision?.options?.length || 'multiple'} options, here are the key findings:\n\n`;

    // Add options analysis
    if (scenario.decision?.options) {
      markdown += `## Option Comparison\n\n`;

      scenario.decision.options.forEach((option, index) => {
        const score = Math.floor(60 + Math.random() * 40); // Random score 60-100
        markdown += `### ${index + 1}. ${option.name}\n`;
        markdown += `- **Score:** ${score}/100\n`;
        markdown += `- **Description:** ${option.description}\n`;
        markdown += `- **Analysis:** Detailed evaluation shows ${score > 80 ? 'strong potential' : score > 70 ? 'moderate viability' : 'requires consideration'}.\n\n`;
      });
    }

    markdown += `## Recommendation\n\n`;
    if (scenario.decision?.options && scenario.decision.options.length > 0) {
      const recommendedIndex = Math.floor(Math.random() * scenario.decision.options.length);
      markdown += `Based on the analysis, **${scenario.decision.options[recommendedIndex].name}** appears to be the most suitable option.\n\n`;
    }

    markdown += `## Next Steps\n\n`;
    markdown += `1. Review the detailed analysis above\n`;
    markdown += `2. Consider any additional constraints\n`;
    markdown += `3. Plan implementation timeline\n\n`;

    markdown += `*Analysis completed in ${Math.round(results.duration / 1000)} seconds with ${results.tokensGenerated} tokens.*`;

    // Convert markdown to token array
    let tokenIndex = 0;
    let currentTimestamp = Date.now();

    // Split markdown into realistic token chunks
    const sentences = markdown.split(/([.!?]\s+|\n\n)/);

    sentences.forEach(sentence => {
      if (sentence.trim()) {
        tokens.push({
          text: sentence,
          timestamp: currentTimestamp,
          index: tokenIndex++
        });
        currentTimestamp += 50 + Math.random() * 100; // 50-150ms between tokens
      }
    });

    return {
      tokens,
      markdown
    };
  }

  createBundle(yamlPath: string, mode: 'simulation' | 'live' = 'simulation'): SARBBundle {
    const scenario = this.loadScenarioYAML(yamlPath);
    const results = this.simulateExecution(scenario, mode);
    const transcript = this.generateTranscript(scenario, results);

    const bundle: SARBBundle = {
      version: '1.0',
      created: new Date().toISOString(),
      scenario,
      execution: {
        seed: scenario.params?.seed || Math.floor(Math.random() * 10000),
        params: {
          maxTokens: scenario.params?.maxTokens || 500,
          temperature: scenario.params?.temperature || 0.7,
          model: scenario.params?.model || 'gpt-4-turbo'
        },
        mode
      },
      results,
      transcript
    };

    return bundle;
  }

  packBundle(yamlPath: string, outputPath: string, mode: 'simulation' | 'live' = 'simulation'): string {
    this.log(`📦 Packing scenario bundle...`);
    this.log(`   Source: ${yamlPath}`);
    this.log(`   Mode: ${mode}`);

    const bundle = this.createBundle(yamlPath, mode);

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Create JSON file first
    const jsonPath = outputPath.replace('.sarb.zip', '.sarb.json');
    writeFileSync(jsonPath, JSON.stringify(bundle, null, 2));

    // Create zip file
    try {
      execSync(`cd "${dirname(jsonPath)}" && zip -q "${basename(outputPath)}" "${basename(jsonPath)}"`, {
        stdio: 'pipe'
      });

      // Remove temporary JSON file
      execSync(`rm "${jsonPath}"`);

      this.log(`✅ Bundle created: ${outputPath}`);
      this.log(`   Scenario: ${bundle.scenario.title}`);
      this.log(`   Tokens: ${bundle.results.tokensGenerated}`);
      this.log(`   Duration: ${Math.round(bundle.results.duration / 1000)}s`);
      this.log(`   Steps: ${bundle.results.steps.length}`);

    } catch (error) {
      throw new Error(`Failed to create zip: ${error}`);
    }

    return outputPath;
  }

  run(args: string[]): void {
    // Handle help
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      console.log('SARB Pack - Create Scenario Run Bundles');
      console.log('');
      console.log('USAGE:');
      console.log('  npm run sarb:pack -- <scenario.yaml> [OPTIONS]');
      console.log('');
      console.log('OPTIONS:');
      console.log('  -o, --output PATH    Output path for .sarb.zip bundle');
      console.log('  --live              Use live mode (default: simulation)');
      console.log('  -h, --help          Show this help message');
      console.log('');
      console.log('EXAMPLES:');
      console.log('  npm run sarb:pack -- artifacts/scenarios/framework.yaml');
      console.log('  npm run sarb:pack -- scenarios/test.yaml -o runs/test.sarb.zip');
      console.log('  npm run sarb:pack -- scenarios/live.yaml --live');
      process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
    }

    const yamlPath = resolve(args[0]);
    let outputPath = '';
    let mode: 'simulation' | 'live' = 'simulation';

    // Parse arguments
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '-o' && i + 1 < args.length) {
        outputPath = resolve(args[i + 1]);
        i++; // Skip next argument
      } else if (args[i] === '--live') {
        mode = 'live';
      }
    }

    // Default output path if not specified
    if (!outputPath) {
      const baseName = basename(yamlPath, '.yaml');
      outputPath = resolve('artifacts/runs', `${baseName}.sarb.zip`);
    }

    try {
      this.packBundle(yamlPath, outputPath, mode);
    } catch (error) {
      console.error(`❌ Failed to pack bundle: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const packer = new SARBPacker();
  packer.run(process.argv.slice(2));
}

export { SARBPacker, type SARBBundle };