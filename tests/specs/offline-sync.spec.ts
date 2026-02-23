import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const pwaOfflineTesterUrl = 'https://mobiview.github.io/pwa-offline-tester';
const bitmovinStreamTestUrl = 'https://bitmovin.com/demos/stream-test';

function fixturePageUrl(fileName: string): string {
  const fullPath = resolve(__dirname, '..', 'fixtures', 'pages', fileName);
  return pathToFileURL(fullPath).toString();
}

test.describe('Offline Mode Transitions', () => {
  // يحمّل bitmovin داخل PWA Offline Tester ويحاكي فصل/عودة الشبكة ويتحقق من مؤشر الحالة.
  test('simulate network drop mid-session with PWA tester + Bitmovin stream', async ({
    page,
    context,
  }) => {
    test.slow();

    await page.goto(pwaOfflineTesterUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('#pwaUrlInput')).toBeVisible();

    await page.fill('#pwaUrlInput', bitmovinStreamTestUrl);
    await page.getByRole('button', { name: 'Load App' }).click();

    const streamFrame = page.locator('#pwaFrame');
    await expect(streamFrame).toHaveAttribute('src', /bitmovin\.com\/demos\/stream-test/i);
    await expect(page.locator('#networkLabel')).toHaveText(/online/i);

    await context.setOffline(true);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    await page.locator('#toggleNetwork').click();
    await expect(page.locator('#networkLabel')).toHaveText(/offline/i);
    await expect(page.locator('#previewContainer')).toHaveClass(/offline-mode/);
    await expect(page.locator('#mainWorkspace')).toBeVisible();
    await expect(streamFrame).toBeVisible();

    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    await page.locator('#toggleNetwork').click();
    await expect(page.locator('#networkLabel')).toHaveText(/online/i);
  });

  // يرسل إجابة أثناء Offline ثم يعيد الاتصال ويتأكد من انتقال المزامنة إلى synced وتحديث حالة الخادم.
  test('submit quiz answer offline then restore network and verify sync completion', async ({
    page,
    context,
  }) => {
    await page.goto(fixturePageUrl('offline-sync-lab.html'));
    await expect(page.locator('#offline-indicator')).toHaveAttribute('data-state', 'online');

    await page.locator('input[data-testid="answer-option"][value="HLS"]').check();

    await context.setOffline(true);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(page.locator('#offline-indicator')).toHaveAttribute('data-state', 'offline');

    await page.getByRole('button', { name: 'Submit Answer' }).click();
    await expect(page.locator('#sync-indicator')).toHaveAttribute('data-state', 'queued');

    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const extendedWindow = window as Window & {
            __syncLabState?: { syncHistory: string[] };
          };
          return extendedWindow.__syncLabState?.syncHistory.includes('syncing') ?? false;
        });
      })
      .toBe(true);

    await expect(page.locator('#sync-indicator')).toHaveAttribute('data-state', 'synced', {
      timeout: 10_000,
    });

    const syncedState = await page.evaluate(() => {
      const extendedWindow = window as Window & {
        __syncLabState?: {
          server: { submissions: Array<{ answer: string; submittedAt: string }> };
          syncHistory: string[];
        };
      };
      return extendedWindow.__syncLabState ?? null;
    });

    expect(syncedState).not.toBeNull();
    expect(syncedState!.server.submissions.length).toBeGreaterThan(0);
    expect(syncedState!.server.submissions.at(-1)?.answer).toBe('HLS');
    expect(syncedState!.syncHistory).toContain('syncing');
    expect(syncedState!.syncHistory).toContain('synced');
  });
});
