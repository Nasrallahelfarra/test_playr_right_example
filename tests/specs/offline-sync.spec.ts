// ─── Imports | الاستيرادات ────────────────────────────────────────────────────
// Playwright core: expect for assertions, test as the runner.
// أدوات Playwright الأساسية: expect للتحقق، test لتشغيل الاختبارات.
import { expect, test } from '@playwright/test';

// Node.js path utilities to build absolute paths to local fixture HTML files.
// أدوات مسارات Node.js لبناء مسارات مطلقة لملفات HTML التجريبية المحلية.
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// ─── URLs | الروابط ───────────────────────────────────────────────────────────
// External PWA tester tool used to simulate offline/online transitions.
// أداة اختبار PWA الخارجية المستخدمة لمحاكاة الانتقال بين الأونلاين والأوفلاين.
const pwaOfflineTesterUrl = 'https://mobiview.github.io/pwa-offline-tester';

// The Bitmovin stream-test demo loaded inside the PWA tester's iframe.
// صفحة Bitmovin التجريبية التي يتم تحميلها داخل iframe الخاص بأداة PWA.
const bitmovinStreamTestUrl = 'https://bitmovin.com/demos/stream-test';

// ─── Helper | مساعد ──────────────────────────────────────────────────────────
// Converts a local fixture HTML filename into a file:// URL the browser can load.
// يحوّل اسم ملف HTML محلي إلى رابط file:// يمكن للمتصفح تحميله.
function fixturePageUrl(fileName: string): string {
  const fullPath = resolve(__dirname, '..', 'fixtures', 'pages', fileName);
  return pathToFileURL(fullPath).toString();
}

// ─── Test Suite | مجموعة الاختبارات ──────────────────────────────────────────
// Groups all offline-mode transition tests under one labelled suite.
// يجمع جميع اختبارات انتقال الوضع الأوفلاين تحت مجموعة واحدة موسومة.
test.describe('Offline Mode Transitions', () => {

  // ── Test 1: Network Drop Mid-Session | اختبار انقطاع الشبكة أثناء الجلسة ──
  // Loads Bitmovin inside the PWA Offline Tester, cuts the network, and verifies:
  //   - The offline indicator updates correctly.
  //   - The cached content (iframe) remains visible with no crash.
  //   - Restoring the network brings the indicator back to "online".
  // يحمّل Bitmovin داخل PWA Tester، يقطع الشبكة، ويتحقق من:
  //   - تحديث مؤشر الأوفلاين بشكل صحيح.
  //   - بقاء المحتوى المحفوظ (iframe) ظاهرًا دون تعطّل.
  //   - عودة المؤشر إلى "online" بعد استعادة الشبكة.
  test('simulate network drop mid-session with PWA tester + Bitmovin stream', async ({
    page,
    context,
  }) => {
    // Mark this test as slow — external pages and network toggling take extra time.
    // وضع علامة "بطيء" على هذا الاختبار لأن الصفحات الخارجية وتبديل الشبكة تستغرق وقتًا إضافيًا.
    test.slow();

    // Open the PWA Offline Tester tool and wait for its URL input to appear.
    // فتح أداة PWA Offline Tester والانتظار حتى يظهر حقل إدخال الرابط.
    await page.goto(pwaOfflineTesterUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.locator('#pwaUrlInput')).toBeVisible();

    // Type the Bitmovin stream URL into the input and click "Load App".
    // كتابة رابط Bitmovin في الحقل والنقر على "Load App".
    await page.fill('#pwaUrlInput', bitmovinStreamTestUrl);
    await page.getByRole('button', { name: 'Load App' }).click();

    // Confirm the iframe src was set to the Bitmovin demo URL.
    // التأكد من أن src الـ iframe تم ضبطه على رابط Bitmovin.
    const streamFrame = page.locator('#pwaFrame');
    await expect(streamFrame).toHaveAttribute('src', /bitmovin\.com\/demos\/stream-test/i);

    // Verify the network label shows "online" before cutting the connection.
    // التأكد من أن مؤشر الشبكة يعرض "online" قبل قطع الاتصال.
    await expect(page.locator('#networkLabel')).toHaveText(/online/i);

    // Use Playwright's context.setOffline(true) to simulate a real network drop.
    // استخدام context.setOffline(true) لمحاكاة انقطاع الشبكة الفعلي.
    await context.setOffline(true);

    // Poll navigator.onLine via page.evaluate() to confirm the browser sees offline.
    // الاستعلام عن navigator.onLine عبر page.evaluate() للتأكد من رؤية المتصفح للوضع الأوفلاين.
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    // Click the UI toggle to reflect the new offline state in the app's indicators.
    // النقر على زر التبديل في الواجهة ليعكس حالة الأوفلاين في مؤشرات التطبيق.
    await page.locator('#toggleNetwork').click();

    // Assert the network label now shows "offline".
    // التأكد من أن مؤشر الشبكة يعرض الآن "offline".
    await expect(page.locator('#networkLabel')).toHaveText(/offline/i);

    // Assert the preview container received the "offline-mode" CSS class.
    // التأكد من أن حاوية المعاينة حصلت على CSS class "offline-mode".
    await expect(page.locator('#previewContainer')).toHaveClass(/offline-mode/);

    // The main workspace must still be visible — no crash or blank screen.
    // يجب أن تظل مساحة العمل الرئيسية ظاهرة — لا تعطّل ولا شاشة فارغة.
    await expect(page.locator('#mainWorkspace')).toBeVisible();

    // The Bitmovin iframe must remain visible (cached content still accessible).
    // يجب أن يظل iframe Bitmovin ظاهرًا (المحتوى المخزّن مؤقتًا لا يزال متاحًا).
    await expect(streamFrame).toBeVisible();

    // Restore the network connection using context.setOffline(false).
    // استعادة الاتصال بالشبكة باستخدام context.setOffline(false).
    await context.setOffline(false);

    // Confirm the browser's navigator.onLine is back to true.
    // التأكد من أن navigator.onLine في المتصفح عاد إلى true.
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    // Click the toggle again to reflect the restored online state in the UI.
    // النقر على زر التبديل مجددًا ليعكس استعادة الاتصال في الواجهة.
    await page.locator('#toggleNetwork').click();

    // Assert the network label is back to "online".
    // التأكد من أن مؤشر الشبكة عاد إلى "online".
    await expect(page.locator('#networkLabel')).toHaveText(/online/i);
  });

  // ── Test 2: Offline Quiz Submission + Sync | إرسال الاختبار أوفلاين ثم المزامنة ─
  // Submits a quiz answer while offline, restores the network, then verifies:
  //   - The sync indicator transitions: queued → syncing → synced.
  //   - The server-side state matches the submitted answer.
  // يرسل إجابة الاختبار في وضع أوفلاين، يستعيد الشبكة، ثم يتحقق من:
  //   - انتقال مؤشر المزامنة: queued → syncing → synced.
  //   - تطابق حالة الخادم مع الإجابة المرسلة.
  test('submit quiz answer offline then restore network and verify sync completion', async ({
    page,
    context,
  }) => {
    // Load the local offline-sync fixture page (simulates a quiz with sync logic).
    // تحميل صفحة fixture المحلية للمزامنة الأوفلاين (تحاكي اختبارًا مع منطق مزامنة).
    await page.goto(fixturePageUrl('offline-sync-lab.html'));

    // Verify the app starts in the "online" state before going offline.
    // التأكد من أن التطبيق يبدأ في حالة "online" قبل الانتقال للأوفلاين.
    await expect(page.locator('#offline-indicator')).toHaveAttribute('data-state', 'online');

    // Select the "HLS" answer option in the quiz form.
    // تحديد خيار الإجابة "HLS" في نموذج الاختبار.
    await page.locator('input[data-testid="answer-option"][value="HLS"]').check();

    // Cut the network with Playwright's context.setOffline(true).
    // قطع الشبكة باستخدام context.setOffline(true) من Playwright.
    await context.setOffline(true);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    // Assert the offline indicator reacted to the network drop.
    // التأكد من أن مؤشر الأوفلاين تفاعل مع انقطاع الشبكة.
    await expect(page.locator('#offline-indicator')).toHaveAttribute('data-state', 'offline');

    // Submit the quiz answer while the network is still offline.
    // إرسال إجابة الاختبار بينما الشبكة لا تزال مقطوعة.
    await page.getByRole('button', { name: 'Submit Answer' }).click();

    // Assert the sync indicator moved to "queued" — answer is saved locally.
    // التأكد من انتقال مؤشر المزامنة إلى "queued" — الإجابة محفوظة محليًا.
    await expect(page.locator('#sync-indicator')).toHaveAttribute('data-state', 'queued');

    // Restore the network connection.
    // استعادة الاتصال بالشبكة.
    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    // Poll the window.__syncLabState object to confirm "syncing" was recorded.
    // الاستعلام عن window.__syncLabState للتأكد من تسجيل حالة "syncing".
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

    // Assert the sync indicator reaches "synced" within 10 s of network restoration.
    // التأكد من وصول مؤشر المزامنة إلى "synced" خلال 10 ثوانٍ من استعادة الشبكة.
    await expect(page.locator('#sync-indicator')).toHaveAttribute('data-state', 'synced', {
      timeout: 10_000,
    });

    // Read the full sync lab state object from the page's global scope.
    // قراءة كائن الحالة الكامل من النطاق العام للصفحة.
    const syncedState = await page.evaluate(() => {
      const extendedWindow = window as Window & {
        __syncLabState?: {
          server: { submissions: Array<{ answer: string; submittedAt: string }> };
          syncHistory: string[];
        };
      };
      return extendedWindow.__syncLabState ?? null;
    });

    // State object must exist — confirms the fixture initialised correctly.
    // كائن الحالة يجب أن يكون موجودًا — يؤكد أن fixture تهيّأت بشكل صحيح.
    expect(syncedState).not.toBeNull();

    // At least one submission must have reached the server after sync.
    // يجب أن تصل إجابة واحدة على الأقل إلى الخادم بعد المزامنة.
    expect(syncedState!.server.submissions.length).toBeGreaterThan(0);

    // The last submission's answer must match what we selected ("HLS").
    // إجابة آخر إرسال يجب أن تطابق ما اخترناه ("HLS").
    expect(syncedState!.server.submissions.at(-1)?.answer).toBe('HLS');

    // Sync history must contain both "syncing" and "synced" states in order.
    // سجل المزامنة يجب أن يحتوي على حالتَي "syncing" و"synced" بالترتيب.
    expect(syncedState!.syncHistory).toContain('syncing');
    expect(syncedState!.syncHistory).toContain('synced');
  });
});
