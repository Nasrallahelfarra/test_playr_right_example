// ─── Imports | الاستيرادات ────────────────────────────────────────────────────
// Playwright core: expect for assertions, test as the runner, Page for typing.
// أدوات Playwright الأساسية: expect للتحقق، test للتشغيل، Page للتنميط.
import { expect, test, type Page } from '@playwright/test';

// Node.js path utilities to resolve the local fixture HTML file path.
// أدوات مسار Node.js لحل مسار ملف HTML التجريبي المحلي.
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// ─── Fixture URL | رابط الـ Fixture ──────────────────────────────────────────
// Convert the local anti-cheat-exam.html file into a file:// URL for the browser.
// تحويل ملف anti-cheat-exam.html المحلي إلى رابط file:// للمتصفح.
const antiCheatFixtureUrl = pathToFileURL(
  resolve(__dirname, '..', 'fixtures', 'pages', 'anti-cheat-exam.html'),
);

// ─── Helpers | الدوال المساعدة ────────────────────────────────────────────────
// Builds the exam URL with examId and durationMs as query parameters.
// يبني رابط الاختبار مع examId ومدة الاختبار كمعاملات URL.
// examId: unique exam session identifier to isolate server-side state per run.
// examId: معرّف جلسة الاختبار الفريد لعزل حالة الخادم لكل تشغيل.
// durationMs: total exam duration in milliseconds passed to the fixture page.
// durationMs: المدة الكلية للاختبار بالميلي-ثانية ممررة إلى صفحة fixture.
function buildExamUrl(examId: string, durationMs: number): string {
  const url = new URL(antiCheatFixtureUrl.toString());
  url.searchParams.set('examId', examId);
  url.searchParams.set('durationMs', String(durationMs));
  return url.toString();
}

// Reads the current remaining milliseconds from the #countdown element's
// data-remaining-ms attribute via Playwright's locator API.
// يقرأ الميلي-ثواني المتبقية من data-remaining-ms في عنصر #countdown عبر locator.
async function readRemainingMs(page: Page): Promise<number> {
  const value = await page.locator('#countdown').getAttribute('data-remaining-ms');
  return Number(value ?? 0);
}

// ─── Test Suite | مجموعة الاختبارات ──────────────────────────────────────────
// Groups all timed-exam anti-cheat tests under one labelled suite.
// يجمع جميع اختبارات مكافحة الغش في الاختبار الزمني تحت مجموعة واحدة موسومة.
test.describe('Timed Exam Anti-Cheat', () => {

  // ── Test 1: Countdown Visible and Decrementing | المؤقت التنازلي ظاهر وينقص ─
  // Verifies the countdown timer renders on screen and its value decreases over time.
  // يتحقق من ظهور المؤقت التنازلي على الشاشة وأن قيمته تنقص مع مرور الزمن.
  test('countdown timer is visible and decrementing', async ({ page }) => {
    // Generate a unique exam ID using the current timestamp to avoid state collisions.
    // توليد examId فريد باستخدام الوقت الحالي لتجنب تعارض الحالات بين التشغيلات.
    const examId = `countdown-${Date.now()}`;

    // Navigate to the fixture page with a 10-second exam duration.
    // الانتقال إلى صفحة fixture مع مدة اختبار 10 ثوانٍ.
    await page.goto(buildExamUrl(examId, 10_000));

    // Assert the countdown element is visible in the DOM.
    // التأكد من أن عنصر العد التنازلي ظاهر في DOM.
    await expect(page.locator('#countdown')).toBeVisible();

    // Read the remaining time before the wait.
    // قراءة الوقت المتبقي قبل الانتظار.
    const before = await readRemainingMs(page);

    // Wait 1.25 s so the timer has time to tick down noticeably.
    // الانتظار 1.25 ثانية لإتاحة الوقت للمؤقت للانخفاض بشكل ملحوظ.
    await page.waitForTimeout(1_250);

    // Read the remaining time after the wait.
    // قراءة الوقت المتبقي بعد الانتظار.
    const after = await readRemainingMs(page);

    // Before value must be positive — timer started counting.
    // القيمة قبل يجب أن تكون موجبة — بدأ المؤقت في العد.
    expect(before).toBeGreaterThan(0);

    // After value must be less than before — timer is actually decrementing.
    // القيمة بعد يجب أن تكون أقل من القبل — المؤقت ينقص فعليًا.
    expect(after).toBeLessThan(before);
  });

  // ── Test 2: Tab-Switch Flag + Timer Persistence | رصد تبديل التبويب واستمرار المؤقت ─
  // Dispatches a visibilitychange event (tab-switch simulation), asserts the flag is
  // logged, then closes and reopens the page to confirm the timer resumes from the
  // original server-side start time — not reset to zero.
  // يُطلق حدث visibilitychange لمحاكاة تبديل التبويب، يتأكد من تسجيل الـ flag،
  // ثم يغلق الصفحة ويعيد فتحها للتأكد من أن المؤقت يستمر من وقت البداية الأصلي
  // المحفوظ على الخادم — ولا يُعاد تعيينه إلى الصفر.
  test('visibilitychange is logged and timer continues after close/reopen', async ({
    page,
    context,
  }) => {
    // Unique exam ID scoped to this run.
    // معرّف اختبار فريد لهذا التشغيل.
    const examId = `resume-${Date.now()}`;
    const examUrl = buildExamUrl(examId, 15_000);

    // Load the exam page with a 15-second duration.
    // تحميل صفحة الاختبار بمدة 15 ثانية.
    await page.goto(examUrl);

    // Read the server-assigned exam start epoch (ms since Unix epoch) from window state.
    // قراءة وقت بدء الاختبار المعيّن من الخادم (ms منذ Unix epoch) من حالة النافذة.
    const startEpoch = await page.evaluate(() => {
      const extendedWindow = window as Window & {
        __antiCheatState?: { startEpochMs: number };
      };
      return extendedWindow.__antiCheatState?.startEpochMs ?? 0;
    });

    // Let 1.5 s pass so the timer ticks down before we record the "before" snapshot.
    // انتظار 1.5 ثانية حتى ينقص المؤقت قبل تسجيل اللقطة "قبل".
    await page.waitForTimeout(1_500);
    const remainingBeforeClose = await readRemainingMs(page);

    // Simulate a tab-switch by dispatching a native visibilitychange event on document.
    // محاكاة تبديل التبويب بإطلاق حدث visibilitychange الأصلي على document.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // Poll the #visibility-flags counter until it increments above 0.
    // الاستعلام عن عداد #visibility-flags حتى يتجاوز الصفر.
    // This confirms the anti-cheat logic caught and recorded the tab-switch.
    // هذا يؤكد أن منطق مكافحة الغش رصد وسجّل حدث تبديل التبويب.
    await expect
      .poll(async () => Number(await page.locator('#visibility-flags').innerText()))
      .toBeGreaterThan(0);

    // Close the current page to simulate the student leaving the exam tab.
    // إغلاق الصفحة الحالية لمحاكاة مغادرة الطالب لتبويب الاختبار.
    await page.close();

    // Open a new page in the same browser context and reload the exam URL.
    // فتح صفحة جديدة في نفس سياق المتصفح وإعادة تحميل رابط الاختبار.
    const reopenedPage = await context.newPage();
    await reopenedPage.goto(examUrl);

    // Read the startEpochMs from the reopened page — must match the original.
    // قراءة startEpochMs من الصفحة المعاد فتحها — يجب أن تطابق الأصلي.
    const resumedState = await reopenedPage.evaluate(() => {
      const extendedWindow = window as Window & {
        __antiCheatState?: { startEpochMs: number };
      };
      return extendedWindow.__antiCheatState?.startEpochMs ?? 0;
    });
    const remainingAfterReopen = await readRemainingMs(reopenedPage);

    // The start epoch must be identical — timer is anchored to the server start time.
    // وقت البداية يجب أن يكون متطابقًا — المؤقت مرتبط بوقت البداية على الخادم.
    expect(resumedState).toBe(startEpoch);

    // Remaining time after reopen must be less than before close — timer kept running.
    // الوقت المتبقي بعد إعادة الفتح يجب أن يكون أقل مما كان — المؤقت استمر في العمل.
    expect(remainingAfterReopen).toBeLessThan(remainingBeforeClose);

    await reopenedPage.close();
  });

  // ── Test 3: Timer Expiry → Auto-Submission | انتهاء المؤقت → إرسال تلقائي ──
  // Sets a very short exam (4 s), waits for expiry, then asserts auto-submission fired.
  // يضبط اختبارًا قصيرًا جدًا (4 ثوانٍ)، ينتظر انتهاءه، ثم يتأكد من تشغيل الإرسال التلقائي.
  test('timer expiration triggers auto-submission', async ({ page }) => {
    // Unique exam ID for this run.
    // معرّف اختبار فريد لهذا التشغيل.
    const examId = `expiry-${Date.now()}`;

    // Navigate with a 4-second duration — short enough to expire quickly in the test.
    // الانتقال بمدة 4 ثوانٍ — قصيرة بما يكفي لتنتهي بسرعة خلال الاختبار.
    await page.goto(buildExamUrl(examId, 4_000));

    // Poll for up to 12 s until the submission state reaches "auto-submitted".
    // الاستعلام لمدة 12 ثانية حتى تصل حالة الإرسال إلى "auto-submitted".
    // 12 s > 4 s duration + rendering time — gives the fixture room to process.
    // 12 ثانية > 4 ثوانٍ مدة + وقت الرسم — تمنح صفحة fixture وقتًا للمعالجة.
    await expect(page.locator('#submission-state')).toHaveAttribute('data-state', 'auto-submitted', {
      timeout: 12_000,
    });

    // Also assert the event log contains the "auto-submitted" text entry.
    // التأكد أيضًا من أن سجل الأحداث يحتوي على نص "auto-submitted".
    await expect(page.locator('#event-log')).toContainText('auto-submitted');
  });
});
