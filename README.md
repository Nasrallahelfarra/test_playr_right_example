# Playwright E2E Test Suite (Local-Only)

Automated end-to-end tests for an educational platform test framework, fully local and deterministic.

## What Is Covered

### 1) Video Player Automation
File: `tests/specs/video-playback.spec.ts`

- HLS playback load/start verification
- Resume playback from cached timestamp after navigation
- Audio Focus Mode checks (audio/time continues, logical video track flag changes)
- Media state validation via `page.evaluate()` on `HTMLVideoElement` (`currentTime`, `paused`, `readyState`, `duration`)

### 2) Offline Mode Transitions
File: `tests/specs/offline-sync.spec.ts`

- Network drop/restore with `context.setOffline(true/false)`
- Offline indicator and no-crash guard checks
- Submit quiz answer while offline, then sync on reconnect
- PowerSync-style UI indicator flow: `queued -> syncing -> synced`

### 3) Timed Exam Anti-Cheat
File: `tests/specs/timed-exam.spec.ts`

- Countdown visibility and decrement verification
- Tab switch simulation via `visibilitychange`
- Timer continuity after close/reopen (server-side persisted start time behavior)
- Auto-submission on timer expiry

### 4) Arabic RTL Layout and Content
File: `tests/specs/rtl-layout.spec.ts`

- `dir="rtl"` and Arabic `lang` checks on Arabic locale pages
- Screenshot comparisons for key RTL pages
- Overflow/alignment assertions
- Arabic content rendering checks (quiz/chatbot/Al-Fihris)

## Local-Only Architecture

- No external websites are required.
- Local app routes are installed through `installLocalEducationalRoutes(context)` in `tests/fixtures/test-data.ts`.
- Route origin: `http://edu.local`
- Main routes:
  - `/login`
  - `/dashboard`
  - `/video`
  - `/quiz`
  - `/exam`
  - `/ar`, `/ar/quiz`, `/ar/chatbot`, `/ar/video`

## Tech Stack

- Node.js + npm
- TypeScript
- Playwright Test (`@playwright/test`)
- GitHub Actions

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm ci
npx playwright install --with-deps
```

## Run Tests

### Full Suite

```bash
npm test
```

Equivalent explicit config command:

```bash
npx playwright test --config=tests/playwright.config.ts
```

### Run Each Suite (All Projects)

```bash
npm run test:video
npm run test:offline
npm run test:anti-cheat
npm run test:rtl
```

### Run Each Suite (Chromium Only)

```bash
npm run test:video:chromium
npm run test:offline:chromium
npm run test:anti-cheat:chromium
npm run test:rtl:chromium
```

### Sequential Runs

```bash
npm run test:sequential
npm run test:sequential:chromium
```

### Debug Helpers

```bash
npm run e2e:headed
npm run e2e:ui
npm run show-report
```

### List Discovered Tests

```bash
npx playwright test --list --config=tests/playwright.config.ts
```

### Update RTL Snapshots

```bash
npx playwright test tests/specs/rtl-layout.spec.ts --config=tests/playwright.config.ts --update-snapshots
```

## CI

Workflow file: `.github/workflows/e2e.yml`

Pipeline behavior:

- Trigger on every `push`
- Manual trigger via `workflow_dispatch`
- Install dependencies and Playwright browsers
- Run full suite with `tests/playwright.config.ts`
- Upload HTML report on failure

## Project Structure

```text
.
|-- tests/
|   |-- fixtures/
|   |   |-- test-data.ts
|   |-- pages/
|   |   |-- login.page.ts
|   |   |-- dashboard.page.ts
|   |   |-- video-player.page.ts
|   |   |-- quiz.page.ts
|   |   |-- chatbot.page.ts
|   |-- specs/
|   |   |-- video-playback.spec.ts
|   |   |-- offline-sync.spec.ts
|   |   |-- timed-exam.spec.ts
|   |   |-- rtl-layout.spec.ts
|   |   |-- rtl-layout.spec.ts-snapshots/
|   |-- playwright.config.ts
|-- playwright.config.ts
|-- package.json
|-- .github/workflows/e2e.yml
```

## Notes

- Test comments in specs follow bilingual style (English + Arabic).
- Root `playwright.config.ts` re-exports `tests/playwright.config.ts`.
