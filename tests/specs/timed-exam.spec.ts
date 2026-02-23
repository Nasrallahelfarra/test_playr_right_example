import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const antiCheatFixtureUrl = pathToFileURL(
  resolve(__dirname, '..', 'fixtures', 'pages', 'anti-cheat-exam.html'),
);

function buildExamUrl(examId: string, durationMs: number): string {
  const url = new URL(antiCheatFixtureUrl.toString());
  url.searchParams.set('examId', examId);
  url.searchParams.set('durationMs', String(durationMs));
  return url.toString();
}

async function readRemainingMs(page: Page): Promise<number> {
  const value = await page.locator('#countdown').getAttribute('data-remaining-ms');
  return Number(value ?? 0);
}

test.describe('Timed Exam Anti-Cheat', () => {
  // يتأكد من ظهور المؤقت التنازلي وأن الوقت ينقص فعليًا مع مرور الزمن.
  test('countdown timer is visible and decrementing', async ({ page }) => {
    const examId = `countdown-${Date.now()}`;
    await page.goto(buildExamUrl(examId, 10_000));

    await expect(page.locator('#countdown')).toBeVisible();

    const before = await readRemainingMs(page);
    await page.waitForTimeout(1_250);
    const after = await readRemainingMs(page);

    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  // يحاكي visibilitychange، يتأكد من تسجيل flag، ثم يتحقق أن المؤقت يستمر من وقت البداية المحفوظ بعد إعادة الفتح.
  test('visibilitychange is logged and timer continues after close/reopen', async ({
    page,
    context,
  }) => {
    const examId = `resume-${Date.now()}`;
    const examUrl = buildExamUrl(examId, 15_000);

    await page.goto(examUrl);

    const startEpoch = await page.evaluate(() => {
      const extendedWindow = window as Window & {
        __antiCheatState?: { startEpochMs: number };
      };
      return extendedWindow.__antiCheatState?.startEpochMs ?? 0;
    });

    await page.waitForTimeout(1_500);
    const remainingBeforeClose = await readRemainingMs(page);

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect
      .poll(async () => Number(await page.locator('#visibility-flags').innerText()))
      .toBeGreaterThan(0);

    await page.close();

    const reopenedPage = await context.newPage();
    await reopenedPage.goto(examUrl);

    const resumedState = await reopenedPage.evaluate(() => {
      const extendedWindow = window as Window & {
        __antiCheatState?: { startEpochMs: number };
      };
      return extendedWindow.__antiCheatState?.startEpochMs ?? 0;
    });
    const remainingAfterReopen = await readRemainingMs(reopenedPage);

    expect(resumedState).toBe(startEpoch);
    expect(remainingAfterReopen).toBeLessThan(remainingBeforeClose);

    await reopenedPage.close();
  });

  // يترك المؤقت حتى الانتهاء ويتأكد من تنفيذ auto-submission تلقائيًا.
  test('timer expiration triggers auto-submission', async ({ page }) => {
    const examId = `expiry-${Date.now()}`;
    await page.goto(buildExamUrl(examId, 4_000));

    await expect(page.locator('#submission-state')).toHaveAttribute('data-state', 'auto-submitted', {
      timeout: 12_000,
    });
    await expect(page.locator('#event-log')).toContainText('auto-submitted');
  });
});
