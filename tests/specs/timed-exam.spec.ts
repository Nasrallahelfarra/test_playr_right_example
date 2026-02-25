// Imports needed for assertions and test runner.
// الاستيرادات اللازمة للتحقق وتشغيل الاختبارات.
import { expect, test, type Page } from '@playwright/test';

// Local route installer and exam URL helper.
// مُثبت المسارات المحلية ومُنشئ روابط الاختبار الزمني.
import { buildExamUrl, installLocalEducationalRoutes } from '../fixtures/test-data';

// Helper function to read remaining time in milliseconds from the countdown element.
// دالة مساعدة لقراءة الوقت المتبقي بالمللي-ثانية من عنصر العداد التنازلي.
// Reads the data-remaining-ms attribute and converts it to a number.
// تقرأ سمة data-remaining-ms وتحولها إلى رقم.
async function readRemainingMs(page: Page): Promise<number> {
  const raw = await page.locator('#countdown').getAttribute('data-remaining-ms');
  return Number(raw ?? '0');
}

// ─── Test Suite: Timed Exam Anti-Cheat | مجموعة اختبارات: مكافحة الغش في الامتحان الزمني ───
// Tests countdown timer, visibilitychange event logging, and auto-submission on expiry.
// تختبر العداد التنازلي، تسجيل حدث visibilitychange، والإرسال التلقائي عند انتهاء الوقت.
test.describe('Timed Exam Anti-Cheat (Local-Only)', () => {
  // Install local mock routes before each test to simulate the educational platform.
  // تثبيت المسارات المحلية الوهمية قبل كل اختبار لمحاكاة منصة التعليم.
  test.beforeEach(async ({ context }) => {
    await installLocalEducationalRoutes(context);
  });

  // Start timed exam and verify countdown is visible and decrementing.
  // بدء اختبار زمني والتأكد من ظهور العداد التنازلي وانخفاضه مع الوقت.
  test('countdown timer is visible and decrementing', async ({ page }) => {
    // Generate unique exam ID using current timestamp.
    // إنشاء معرف امتحان فريد باستخدام الوقت الحالي.
    const examId = `countdown-${Date.now()}`;

    // Navigate to exam page with 10-second duration.
    // الانتقال إلى صفحة الامتحان بمدة 10 ثوانٍ.
    await page.goto(buildExamUrl(examId, 10_000));

    // Assert countdown element is visible.
    // التأكد من أن عنصر العداد التنازلي مرئي.
    await expect(page.locator('#countdown')).toBeVisible();

    // Read remaining time before waiting.
    // قراءة الوقت المتبقي قبل الانتظار.
    const before = await readRemainingMs(page);

    // Wait 1.25 seconds.
    // الانتظار 1.25 ثانية.
    await page.waitForTimeout(1_250);

    // Read remaining time after waiting.
    // قراءة الوقت المتبقي بعد الانتظار.
    const after = await readRemainingMs(page);

    // Assert timer started with positive value.
    // التأكد من أن المؤقت بدأ بقيمة موجبة.
    expect(before).toBeGreaterThan(0);

    // Assert timer has decremented (time is passing).
    // التأكد من أن المؤقت قد انخفض (الوقت يمر).
    expect(after).toBeLessThan(before);
  });

  // Simulate tab switch via visibilitychange and assert event/flag logging.
  // محاكاة تبديل التبويب عبر visibilitychange والتحقق من تسجيل الحدث والعلامة.
  test('visibilitychange is logged and timer keeps tracking exam session', async ({ page }) => {
    // Generate unique exam ID.
    // إنشاء معرف امتحان فريد.
    const examId = `flags-${Date.now()}`;

    // Navigate to exam page with 15-second duration.
    // الانتقال إلى صفحة الامتحان بمدة 15 ثانية.
    await page.goto(buildExamUrl(examId, 15_000));

    // Dispatch visibilitychange event via page.evaluate() to simulate tab switch.
    // إرسال حدث visibilitychange عبر page.evaluate() لمحاكاة تبديل التبويب.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // Assert visibility flag counter has incremented.
    // التأكد من أن عداد علامات الرؤية قد زاد.
    await expect
      .poll(async () => Number(await page.locator('#visibility-flags').innerText()))
      .toBeGreaterThan(0);

    // Assert event log contains "visibilitychange detected" message.
    // التأكد من أن سجل الأحداث يحتوي على رسالة "visibilitychange detected".
    await expect(page.locator('#event-log')).toContainText('visibilitychange detected');
  });

  // Close and reopen page with same examId, timer must continue from persisted start epoch.
  // إغلاق وإعادة فتح الصفحة بنفس examId ويجب أن يستمر المؤقت من وقت البداية المحفوظ.
  test('close/reopen keeps timer anchored to server-side start time', async ({
    page,
    context,
  }) => {
    // Generate unique exam ID and build exam URL with 15-second duration.
    // إنشاء معرف امتحان فريد وبناء رابط الامتحان بمدة 15 ثانية.
    const examId = `resume-${Date.now()}`;
    const examUrl = buildExamUrl(examId, 15_000);

    // Navigate to exam page.
    // الانتقال إلى صفحة الامتحان.
    await page.goto(examUrl);

    // Read start epoch from global __examLabState object via page.evaluate().
    // قراءة وقت البداية من كائن __examLabState العام عبر page.evaluate().
    const startEpochBefore = await page.evaluate(() => {
      const state = (
        window as Window & {
          __examLabState?: { startEpochMs: number };
        }
      ).__examLabState;
      return state?.startEpochMs ?? 0;
    });

    // Wait 1.25 seconds to let timer decrement.
    // الانتظار 1.25 ثانية للسماح للمؤقت بالانخفاض.
    await page.waitForTimeout(1_250);

    // Read remaining time before closing page.
    // قراءة الوقت المتبقي قبل إغلاق الصفحة.
    const remainingBeforeClose = await readRemainingMs(page);

    // Close the page.
    // إغلاق الصفحة.
    await page.close();

    // Open a new page in the same context.
    // فتح صفحة جديدة في نفس السياق.
    const reopened = await context.newPage();

    // Navigate to the same exam URL.
    // الانتقال إلى نفس رابط الامتحان.
    await reopened.goto(examUrl);

    // Read start epoch from reopened page.
    // قراءة وقت البداية من الصفحة المعاد فتحها.
    const startEpochAfter = await reopened.evaluate(() => {
      const state = (
        window as Window & {
          __examLabState?: { startEpochMs: number };
        }
      ).__examLabState;
      return state?.startEpochMs ?? 0;
    });

    // Read remaining time after reopening.
    // قراءة الوقت المتبقي بعد إعادة الفتح.
    const remainingAfterReopen = await readRemainingMs(reopened);

    // Assert start epoch is the same (timer anchored to server-side start time).
    // التأكد من أن وقت البداية هو نفسه (المؤقت مثبت على وقت البداية من جانب الخادم).
    expect(startEpochAfter).toBe(startEpochBefore);

    // Assert remaining time has decreased (timer continued during closure).
    // التأكد من أن الوقت المتبقي قد انخفض (المؤقت استمر أثناء الإغلاق).
    expect(remainingAfterReopen).toBeLessThan(remainingBeforeClose);

    // Close the reopened page.
    // إغلاق الصفحة المعاد فتحها.
    await reopened.close();
  });

  // Let timer expire and verify auto-submission fires.
  // ترك المؤقت ينتهي والتأكد من تنفيذ الإرسال التلقائي.
  test('timer expiration triggers auto-submission', async ({ page }) => {
    // Generate unique exam ID.
    // إنشاء معرف امتحان فريد.
    const examId = `expiry-${Date.now()}`;

    // Navigate to exam page with short 3.5-second duration.
    // الانتقال إلى صفحة الامتحان بمدة قصيرة 3.5 ثانية.
    await page.goto(buildExamUrl(examId, 3_500));

    // Wait for submission state to become "auto-submitted" (max 12 seconds).
    // انتظار حالة الإرسال لتصبح "auto-submitted" (بحد أقصى 12 ثانية).
    await expect(page.locator('#submission-state')).toHaveAttribute('data-state', 'auto-submitted', {
      timeout: 12_000,
    });

    // Assert event log contains "auto-submitted" message.
    // التأكد من أن سجل الأحداث يحتوي على رسالة "auto-submitted".
    await expect(page.locator('#event-log')).toContainText('auto-submitted');
  });
});
