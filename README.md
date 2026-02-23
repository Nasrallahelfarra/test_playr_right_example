# Playwright E2E Test Suite

Automated end-to-end tests for:

- Video playback reliability (Bitmovin player)
- Offline/online synchronization flows
- Timed exam anti-cheat behavior
- Arabic RTL layout and content validation

This repository is focused on realistic browser-level checks for learning/product UX flows, using Playwright with reusable page objects and local test fixtures.

## Test Coverage

### 1) Video playback (`tests/specs/video-playback.spec.ts`)
- HLS playback load/start validation
- Resume playback after navigation away/back
- Audio Focus Mode assertions (when available)

### 2) Offline sync (`tests/specs/offline-sync.spec.ts`)
- Simulated network drop and restore
- Queueing an answer while offline
- Verifying sync completion after reconnect

### 3) Timed anti-cheat exam (`tests/specs/timed-exam.spec.ts`)
- Countdown visibility and decrement checks
- `visibilitychange` logging and persistence
- Auto-submission on timer expiry

### 4) Arabic RTL layout (`tests/specs/rtl-layout.spec.ts`)
- `dir="rtl"` and Arabic locale checks across discovered pages
- Overflow/alignment guardrails for key pages
- Arabic text rendering checks in local RTL fixture
- Optional visual snapshot comparison in local Chromium on Windows

## Tech Stack

- Node.js + npm
- TypeScript
- Playwright Test (`@playwright/test`)
- GitHub Actions CI

## Prerequisites

- Node.js 20+ (CI currently runs on Node 20)
- npm (bundled with Node.js)

## Setup

```bash
npm ci
npx playwright install --with-deps
```

## Running Tests

Run full suite:

```bash
npm test
```

Run headed/local debugging:

```bash
npm run e2e:headed
npm run e2e:ui
```

Run individual specs:

```bash
npm run test:video
npm run test:offline
npm run test:anti-cheat
npm run test:rtl
```

Run sequentially (all domains):

```bash
npm run test:sequential
```

Chromium-only variants:

```bash
npm run test:video:chromium
npm run test:offline:chromium
npm run test:anti-cheat:chromium
npm run test:rtl:chromium
npm run test:sequential:chromium
```

Open HTML report:

```bash
npm run show-report
```

## CI

Workflow file: `.github/workflows/playwright-full-suite.yml`

Current pipeline behavior:

- Triggered on every `push` and manual `workflow_dispatch`
- Installs dependencies and Playwright browsers
- Runs full test suite
- Uploads Playwright HTML report artifact on failure

## Project Structure

```text
.
|-- tests/
|   |-- fixtures/
|   |   |-- pages/
|   |-- pages/
|   |-- specs/
|-- playwright.config.ts
|-- package.json
|-- .github/workflows/playwright-full-suite.yml
```

## Notes

- Some tests depend on external websites (`bitmovin.com`, `careem.com`, and the PWA tester). Internet/network restrictions may affect reliability.
- Video playback checks include handling for Cloudflare challenge screens and may skip under blocked conditions.
- Snapshot comparisons for RTL pages are designed for local Windows Chromium runs, not CI.
