#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import type { SARBBundle } from './sarb-pack.js';

class SARBTranscript {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  loadBundle(zipPath: string): SARBBundle {
    if (!existsSync(zipPath)) {
      throw new Error(`Bundle not found: ${zipPath}`);
    }

    const tempDir = resolve('tmp', `sarb-transcript-${Date.now()}`);
    const jsonFile = basename(zipPath).replace('.sarb.zip', '.sarb.json');

    try {
      execSync(`mkdir -p "${tempDir}"`, { stdio: 'pipe' });
      execSync(`cd "${tempDir}" && unzip -q "${zipPath}"`, { stdio: 'pipe' });

      const jsonPath = resolve(tempDir, jsonFile);
      const content = readFileSync(jsonPath, 'utf8');
      const bundle = JSON.parse(content) as SARBBundle;

      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
      return bundle;

    } catch (error) {
      try { execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' }); } catch {}
      throw new Error(`Failed to load bundle: ${error}`);
    }
  }

  generateHTML(bundle: SARBBundle): string {
    const createdDate = new Date(bundle.created);
    const totalCost = bundle.results.cost || 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SARB Transcript - ${bundle.scenario.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }

        .header h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-size: 1.75rem;
        }

        .header .subtitle {
            color: #6c757d;
            font-size: 1rem;
            margin-bottom: 1.5rem;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .meta-item {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .meta-label {
            font-size: 0.85rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.25rem;
        }

        .meta-value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .execution-steps {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }

        .steps-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .step {
            display: flex;
            align-items: center;
            padding: 1rem;
            border-left: 4px solid #28a745;
            background: #f8f9fa;
            margin-bottom: 1rem;
            border-radius: 0 8px 8px 0;
        }

        .step-number {
            background: #28a745;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 1rem;
        }

        .step-details {
            flex: 1;
        }

        .step-stage {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 0.25rem;
        }

        .step-metrics {
            font-size: 0.9rem;
            color: #6c757d;
        }

        .transcript {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }

        .transcript h2 {
            color: #2c3e50;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .reveal-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            background: #007bff;
            color: white;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s ease;
        }

        .btn:hover {
            background: #0056b3;
        }

        .btn.secondary {
            background: #6c757d;
        }

        .btn.secondary:hover {
            background: #545b62;
        }

        .transcript-content {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1.5rem;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
            font-size: 0.95rem;
            line-height: 1.7;
            white-space: pre-wrap;
            border: 1px solid #e9ecef;
        }

        .token {
            opacity: 0;
            animation: fadeIn 0.3s ease-in-out forwards;
            display: inline;
        }

        .token.revealed {
            opacity: 1;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .footer {
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            padding: 2rem 0;
        }

        @media print {
            body {
                background: white;
            }

            .container {
                padding: 1rem;
            }

            .header, .execution-steps, .transcript {
                box-shadow: none;
                border: 1px solid #e9ecef;
            }

            .reveal-controls {
                display: none;
            }

            .token {
                opacity: 1 !important;
            }
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .meta-grid {
                grid-template-columns: 1fr;
            }

            .reveal-controls {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 ${bundle.scenario.title}</h1>
            <div class="subtitle">${bundle.scenario.description || 'Scenario Analysis Transcript'}</div>

            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Created</div>
                    <div class="meta-value">${createdDate.toLocaleDateString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Duration</div>
                    <div class="meta-value">${Math.round(bundle.results.duration / 1000)}s</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Tokens</div>
                    <div class="meta-value">${bundle.results.tokensGenerated.toLocaleString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Cost</div>
                    <div class="meta-value">$${totalCost.toFixed(4)}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Model</div>
                    <div class="meta-value">${bundle.execution.params.model}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Seed</div>
                    <div class="meta-value">${bundle.execution.seed}</div>
                </div>
            </div>
        </div>

        <div class="execution-steps">
            <h2>⚡ Execution Timeline</h2>
            ${bundle.results.steps.map(step => `
            <div class="step">
                <div class="step-number">${step.step}</div>
                <div class="step-details">
                    <div class="step-stage">${step.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                    <div class="step-metrics">${step.tokens} tokens • ${Math.round(step.deltaTime/1000)}s</div>
                </div>
            </div>
            `).join('')}
        </div>

        <div class="transcript">
            <h2>📄 Analysis Transcript</h2>

            <div class="reveal-controls">
                <button class="btn" onclick="revealAll()">⚡ Reveal All</button>
                <button class="btn secondary" onclick="revealStep()">👆 Reveal Step-by-Step</button>
                <button class="btn secondary" onclick="resetReveal()">🔄 Reset</button>
            </div>

            <div class="transcript-content" id="transcriptContent">
                ${bundle.transcript.tokens.map((token, index) =>
                    `<span class="token" data-index="${index}">${this.escapeHtml(token.text)}</span>`
                ).join('')}
            </div>
        </div>

        <div class="footer">
            <p>Generated by SARB Transcript Tool • Self-contained HTML • Print/Save Friendly</p>
            <p>Bundle: ${basename(bundle.scenario.title).replace(/[^a-zA-Z0-9]/g, '-')}.sarb.zip</p>
        </div>
    </div>

    <script>
        let revealIndex = 0;
        const tokens = document.querySelectorAll('.token');

        function revealAll() {
            tokens.forEach(token => {
                token.classList.add('revealed');
            });
            revealIndex = tokens.length;
        }

        function revealStep() {
            if (revealIndex < tokens.length) {
                // Reveal next 5-10 tokens at once (realistic typing speed)
                const step = Math.min(Math.floor(Math.random() * 5) + 5, tokens.length - revealIndex);

                for (let i = 0; i < step; i++) {
                    if (revealIndex < tokens.length) {
                        setTimeout(() => {
                            tokens[revealIndex].classList.add('revealed');
                        }, i * 50); // 50ms between tokens
                        revealIndex++;
                    }
                }
            }
        }

        function resetReveal() {
            tokens.forEach(token => {
                token.classList.remove('revealed');
            });
            revealIndex = 0;
        }

        // Auto-reveal on scroll for better UX
        function handleScroll() {
            const transcriptEl = document.getElementById('transcriptContent');
            const rect = transcriptEl.getBoundingClientRect();

            if (rect.top < window.innerHeight && revealIndex < tokens.length * 0.3) {
                revealStep();
            }
        }

        window.addEventListener('scroll', handleScroll);

        // Reveal first few tokens immediately
        setTimeout(() => {
            revealStep();
        }, 500);
    </script>
</body>
</html>`;
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  generateTranscript(zipPath: string): string {
    this.log(`📝 Generating shareable transcript...`);

    const bundle = this.loadBundle(zipPath);
    const bundleName = basename(zipPath, '.sarb.zip');

    this.log(`   Scenario: ${bundle.scenario.title}`);
    this.log(`   Tokens: ${bundle.results.tokensGenerated}`);
    this.log(`   Duration: ${Math.round(bundle.results.duration / 1000)}s`);

    const html = this.generateHTML(bundle);
    const outputPath = resolve('artifacts/transcripts', `${bundleName}.html`);

    writeFileSync(outputPath, html);

    this.log(`✅ Transcript generated: ${outputPath}`);
    this.log(`   Self-contained HTML with no external dependencies`);
    this.log(`   Features: token reveal animation, print-friendly, responsive`);

    return outputPath;
  }

  run(args: string[]): void {
    if (args.length < 1) {
      console.error('Usage: npm run sarb:transcript -- <bundle.sarb.zip>');
      console.error('Example: npm run sarb:transcript -- artifacts/runs/framework.sarb.zip');
      process.exit(1);
    }

    const bundlePath = resolve(args[0]);

    try {
      this.generateTranscript(bundlePath);
    } catch (error) {
      console.error(`❌ Failed to generate transcript: ${error}`);
      process.exit(1);
    }
  }
}

// Node.js DOM simulation for escapeHtml
if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: () => ({
      textContent: '',
      get innerHTML() { return this.textContent?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') || ''; }
    })
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const transcript = new SARBTranscript();
  transcript.run(process.argv.slice(2));
}

export { SARBTranscript };