// Imports needed for assertions and test runner.
// الاستيرادات اللازمة للتحقق وتشغيل الاختبارات.
import { expect, test, type Page } from '@playwright/test';

// Local app bootstrap and shared constants.
// تجهيز التطبيق المحلي والثوابت المشتركة.
import { installLocalEducationalRoutes, testData } from '../fixtures/test-data';

// Page objects used for navigation and quiz sync interactions.
// كائنات الصفحات المستخدمة للتنقل والتفاعل مع مزامنة الاختبار.
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { QuizPage } from '../pages/quiz.page';

// Helper function to navigate to the quiz lab page.
// دالة مساعدة للانتقال إلى صفحة مختبر الاختبار.
// Logs in as the first test student, navigates to dashboard, then opens the quiz page.
// تسجل الدخول كأول طالب اختبار، تنتقل إلى اللوحة، ثم تفتح صفحة الاختبار.
async function openQuizLab(page: Page): Promise<QuizPage> {
  // Create instances of all required page objects.
  // إنشاء نسخ من جميع كائنات الصفحات المطلوبة.
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const quizPage = new QuizPage(page);

  // Navigate to login page and authenticate.
  // الانتقال إلى صفحة تسجيل الدخول والمصادقة.
  await loginPage.goto();
  await loginPage.loginAs(testData.students[0].id);

  // Wait for dashboard to load, then click quiz navigation link.
  // انتظار تحميل اللوحة، ثم النقر على رابط التنقل للاختبار.
  await dashboardPage.assertLoaded();
  await dashboardPage.openQuiz();

  // Return the quiz page object for further interactions.
  // إرجاع كائن صفحة الاختبار لمزيد من التفاعلات.
  return quizPage;
}

// ─── Test Suite: Offline Mode Transitions | مجموعة اختبارات: انتقالات الوضع اللاأونلاين ─────
// Tests network drop mid-session and offline quiz submission with sync verification.
// تختبر انقطاع الشبكة أثناء الجلسة وإرسال الاختبار اللاأونلاين مع التحقق من المزامنة.
test.describe('Offline Mode Transitions (Local-Only)', () => {
  // Install local mock routes before each test to simulate the educational platform.
  // تثبيت المسارات المحلية الوهمية قبل كل اختبار لمحاكاة منصة التعليم.
  test.beforeEach(async ({ context }) => {
    await installLocalEducationalRoutes(context);
  });

  // Simulate network drop using context.setOffline(true) and verify UI survives.
  // محاكاة انقطاع الشبكة باستخدام setOffline(true) والتأكد من بقاء الواجهة مستقرة.
  test('simulate network drop mid-session: offline indicator, no crash, cached content visible', async ({
    page,
    context,
  }) => {
    // Navigate to quiz lab page.
    // الانتقال إلى صفحة مختبر الاختبار.
    const quizPage = await openQuizLab(page);

    // Assert initial state is online.
    // التأكد من أن الحالة الأولية هي أونلاين.
    expect(await quizPage.getOfflineState()).toBe('online');

    // Simulate network disconnection using Playwright's context.setOffline().
    // محاكاة انقطاع الشبكة باستخدام context.setOffline() من Playwright.
    await context.setOffline(true);

    // Verify navigator.onLine is false via page.evaluate().
    // التحقق من أن navigator.onLine هو false عبر page.evaluate().
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    // Assert offline indicator shows "offline" state.
    // التأكد من أن مؤشر اللاأونلاين يعرض حالة "offline".
    expect(await quizPage.getOfflineState()).toBe('offline');

    // Assert app health indicator shows "stable" (no crash).
    // التأكد من أن مؤشر صحة التطبيق يعرض "stable" (لا يوجد انهيار).
    await expect(page.locator('#app-health')).toHaveAttribute('data-state', 'stable');

    // Assert cached content is visible (UI survives offline mode).
    // التأكد من أن المحتوى المخزن مؤقتًا مرئي (الواجهة تنجو من الوضع اللاأونلاين).
    await expect(page.locator('#cached-content')).toBeVisible();

    // Restore network connection.
    // استعادة اتصال الشبكة.
    await context.setOffline(false);

    // Verify navigator.onLine is true again.
    // التحقق من أن navigator.onLine أصبح true مرة أخرى.
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    // Assert offline indicator returns to "online" state.
    // التأكد من أن مؤشر اللاأونلاين يعود إلى حالة "online".
    expect(await quizPage.getOfflineState()).toBe('online');
  });

  // Submit while offline, restore network, then assert queued -> syncing -> synced and server match.
  // إرسال إجابة أثناء الأوفلاين ثم استعادة الشبكة والتحقق من تسلسل الحالات ومطابقة الخادم.
  test('submit quiz while offline then reconnect: assert sync completes and server state matches', async ({
    page,
    context,
  }) => {
    // Navigate to quiz lab page.
    // الانتقال إلى صفحة مختبر الاختبار.
    const quizPage = await openQuizLab(page);

    // Select an answer option.
    // اختيار خيار إجابة.
    await quizPage.selectAnswer('HLS');

    // Disconnect network before submitting.
    // قطع الشبكة قبل الإرسال.
    await context.setOffline(true);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(false);

    // Submit answer while offline.
    // إرسال الإجابة أثناء اللاأونلاين.
    await quizPage.submitAnswer();

    // Assert sync state is "queued" (waiting for network).
    // التأكد من أن حالة المزامنة هي "queued" (في انتظار الشبكة).
    expect(await quizPage.getSyncState()).toBe('queued');

    // Restore network connection.
    // استعادة اتصال الشبكة.
    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);

    // Wait for sync history to include "syncing" state.
    // انتظار سجل المزامنة ليتضمن حالة "syncing".
    await expect
      .poll(async () => (await quizPage.readSyncHistory()).includes('syncing'))
      .toBe(true);

    // Wait for sync to complete (state becomes "synced").
    // انتظار اكتمال المزامنة (تصبح الحالة "synced").
    await quizPage.expectSynced();

    // Read server state and verify submission was received.
    // قراءة حالة الخادم والتحقق من استلام الإرسال.
    const server = await quizPage.readServerState();
    expect(server.submissions.length).toBeGreaterThan(0);

    // Assert last submission matches the answer we sent.
    // التأكد من أن آخر إرسال يطابق الإجابة التي أرسلناها.
    expect(server.submissions.at(-1)?.answer).toBe('HLS');
  });

  // Explicit PowerSync indicator verification: syncing then synced in order.
  // تحقق صريح من مؤشر PowerSync: ظهور syncing ثم synced بالترتيب.
  test('verify PowerSync indicator reflects syncing -> synced states', async ({
    page,
    context,
  }) => {
    // Navigate to quiz lab page.
    // الانتقال إلى صفحة مختبر الاختبار.
    const quizPage = await openQuizLab(page);

    // Select an answer option.
    // اختيار خيار إجابة.
    await quizPage.selectAnswer('MP4');

    // Disconnect network and submit answer.
    // قطع الشبكة وإرسال الإجابة.
    await context.setOffline(true);
    await quizPage.submitAnswer();

    // Assert sync state is "queued".
    // التأكد من أن حالة المزامنة هي "queued".
    expect(await quizPage.getSyncState()).toBe('queued');

    // Restore network and wait for sync to complete.
    // استعادة الشبكة وانتظار اكتمال المزامنة.
    await context.setOffline(false);
    await quizPage.expectSynced();

    // Read sync history from global __syncLabState object.
    // قراءة سجل المزامنة من كائن __syncLabState العام.
    const history = await quizPage.readSyncHistory();

    // Find indices of "syncing" and "synced" states in history.
    // إيجاد فهارس حالات "syncing" و"synced" في السجل.
    const syncingIndex = history.indexOf('syncing');
    const syncedIndex = history.lastIndexOf('synced');

    // Assert "syncing" state was logged.
    // التأكد من تسجيل حالة "syncing".
    expect(syncingIndex).toBeGreaterThan(-1);

    // Assert "synced" state came after "syncing" (correct order).
    // التأكد من أن حالة "synced" جاءت بعد "syncing" (الترتيب الصحيح).
    expect(syncedIndex).toBeGreaterThan(syncingIndex);
  });
});
