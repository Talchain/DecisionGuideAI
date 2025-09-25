# Glossary

## A

**Analysis**: The process where the AI looks at your decision options and gives you a detailed comparison with pros, cons, and recommendations.

**Artifacts**: Files created by the platform (reports, status pages, documentation) - they live in the `/artifacts/` folder.

## C

**Cancel/Stop**: Stopping an analysis before it finishes. The system tries to stop within 1 second when you hit Escape or click Stop.

**Contract**: The rules for how data should be formatted when talking to the API. Like a recipe that both sides follow.

**Contract Wall**: A dashboard showing if all the API contracts are working correctly - green means good, red means something's broken.

## D

**Demo Mode**: Running the platform with fake data so you can show how it works without needing real AI services.

**Determinism**: When you run the same analysis twice, you should get very similar results. We test this to make sure the AI is consistent.

## E

**Evidence Pack**: A collection of all the important status pages and documentation, bundled together for easy sharing.

**ESC**: The Escape key - your quick way to stop/cancel things in the platform.

## F

**Feature Flag**: An on/off switch for platform features. Everything starts OFF for safety, you turn ON only what you need.

**Fixture**: Fake but realistic data used for testing and demos. No real user information, just examples.

## G

**Gateway**: The front door of the platform - it receives your requests and routes them to the right services.

**GO/NO-GO**: A decision point in releases - GO means it's safe to deploy, NO-GO means we need to fix things first.

## I

**Integration Check**: A test that verifies all parts of the platform work together correctly. Can run in simulation mode (no real services needed).

## J

**Jobs**: Background tasks that handle analysis requests. You can see their progress in real-time if the feature is enabled.

## L

**LocalStorage**: Browser storage where your settings and feature flags are saved. Survives browser restarts.

## M

**Mock/Mocked**: Fake responses that look real but don't come from actual AI services. Perfect for testing and demos.

## N

**NDJSON**: Newline Delimited JSON - a format where each line is a separate JSON object. Used for streaming data.

**NO-GO**: See GO/NO-GO above.

## O

**Options**: The different choices you're trying to decide between. The platform compares these to help you choose.

## P

**Payload**: The actual data being sent in a request or response. We never log these to protect privacy.

**PII** (Personal Information): Any data that could identify a real person. The platform is designed never to log or store this.

**PoC** (Proof of Concept): An early version built to test ideas and show how things might work. Not ready for real production use.

## R

**Real vs Mock**: Real means using actual AI services, Mock means using fake responses. Mock is safer for demos and testing.

**Readiness Gate**: A checklist of things that must pass before we can release - like a safety inspection.

## S

**Sandbox**: A safe environment where you can experiment without affecting anything important.

**Simulation Mode**: Running tests with fake services instead of real ones. Faster and safer for development.

**SSE** (Server-Sent Events): A way for the server to send real-time updates to your browser, like streaming analysis results.

**Stream**: Real-time flow of data from the server to your browser, token by token as the analysis happens.

## T

**Token**: A small piece of text - could be a word, part of a word, or punctuation. AI generates responses token by token.

**Typecheck**: Checking that all the code types are correct. Helps catch bugs before they happen.

## W

**Warp**: One of the internal services that handles analysis processing. You don't interact with it directly.

**Worktree**: An isolated copy of the code repository where we can work safely without affecting the main version.

---

*For common questions and answers, see the [FAQ](./faq.md).*