# Frequently Asked Questions

## Getting Started

**Q: What is DecisionGuide AI?**
A: It's a platform that helps you analyze decisions by comparing different options. You give it choices, it streams back analysis in real-time.

**Q: How do I run the platform?**
A: Use `npm run dev` or `./tools/poc-start.sh` for the full setup. Everything starts with safe defaults (features OFF).

**Q: Why are features turned OFF by default?**
A: Safety first! You explicitly enable only what you need. This prevents accidental data logging or resource usage.

**Q: How do I enable a feature?**
A: Either set environment variables (like `VITE_FEATURE_SSE=1`) or use browser localStorage (`localStorage.setItem('feature.sseStreaming','1')`).

## Usage and Features

**Q: What's the difference between the sandbox and real analysis?**
A: Sandbox uses mock data and simulated responses - perfect for demos. Real analysis connects to actual AI services (when enabled).

**Q: Can I see my analysis history?**
A: Yes! Press 'h' or click the history button. It keeps your last 5 runs locally.

**Q: Why did my stream stop?**
A: Could be budget limit, network issue, or you hit Stop. Check the status message - it usually explains what happened.

**Q: How do I cancel a running analysis?**
A: Hit Escape or click Stop. The system aims to cancel within 1 second.

## Technical Questions

**Q: What ports does the platform use?**
A: Gateway (3001), Warp (4311), Jobs (4500), Usage Meter (4600), and the web UI (5176).

**Q: Where are artifacts saved?**
A: Everything goes in the `/artifacts/` folder - reports, status files, documentation, etc.

**Q: How do I check if everything is working?**
A: Run `npm run integration:check` - it tests all the important parts without needing real services.

**Q: Can I run this without Docker?**
A: Yes! Use `npm run dev` for the frontend. The integration check runs in simulation mode by default.

## Troubleshooting

**Q: The stream isn't starting**
A: Check that `VITE_FEATURE_SSE=1` is set and your gateway URL is correct (`VITE_EDGE_GATEWAY_URL`).

**Q: I'm getting connection errors**
A: Verify all services are running with `./tools/poc-start.sh` and check `curl http://localhost:3001/health`.

**Q: Features I enabled aren't showing**
A: Try refreshing the page. Some flags need a page reload to take effect.

**Q: Where do I find logs?**
A: Use `docker compose --profile poc logs -f` for service logs, or check the browser console for frontend issues.

## Development

**Q: How do I add a new feature flag?**
A: Edit `src/flags.ts`, add the flag with default OFF, then use it in components. Always start disabled!

**Q: Can I modify the mock responses?**
A: Yes, they're in `src/fixtures/`. Keep them realistic but never include real user data.

**Q: How do I run tests?**
A: `npm test` for unit tests, `npm run e2e` for end-to-end tests, `npm run integration:check` for full system validation.

**Q: What's the release process?**
A: Run `npm run release:poc` to check everything, then `npm run notes:prepare` to generate release notes.

## Security and Privacy

**Q: Is user data logged?**
A: No! The system is designed never to log payloads or personal information. Only counters and metadata.

**Q: How do I reset everything to safe defaults?**
A: Use the panic-off switch: `source ./tools/panic-off.sh` - it forces all features OFF.

**Q: Can I see what data is being sent?**
A: Check the browser network tab, or use the contract examples in `/artifacts/contracts/` to see expected formats.

**Q: Is this production ready?**
A: This is a PoC (Proof of Concept). It's designed for safe experimentation and demos, not production workloads.

## Getting Help

**Q: Where is the documentation?**
A: Start with the [Start Here page](./start-here.html), then check the [Evidence Pack](./index.html) for comprehensive docs.

**Q: Who do I contact for support?**
A: Check the [Operator Handbook](./operator-handbook.md) for troubleshooting, or the project README for contact info.

**Q: How do I report a bug?**
A: Include steps to reproduce, what you expected vs. what happened, and any error messages. Screenshots help too!

---

*For technical terms and definitions, see the [Glossary](./glossary.md).*