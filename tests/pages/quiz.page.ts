// ─── Imports | الاستيرادات ────────────────────────────────────────────────────────────────────
// Playwright test framework and Page type for browser automation.
// إطار عمل Playwright للاختبار ونوع Page لأتمتة المتصفح.
import { expect, type Page } from '@playwright/test';

// Shared test data configuration and SyncLabState type for offline sync tests.
// إعداد بيانات الاختبار المشتركة ونوع SyncLabState لاختبارات المزامنة اللاأونلاين.
import { testData, type SyncLabState } from '../fixtures/test-data';

// ─── QuizPage POM | كائن صفحة الاختبار ────────────────────────────────────────────────────────
// Page Object Model for the quiz page.
// نموذج كائن الصفحة لصفحة الاختبار.
// Provides methods to navigate, select answers, submit, and read sync/offline state.
// يوفر طرقًا للانتقال واختيار الإجابات والإرسال وقراءة حالة المزامنة/اللاأونلاين.
export class QuizPage {
  // Playwright Page instance — the browser tab/context this POM operates on.
  // نسخة Playwright Page — علامة تبويب/سياق المتصفح الذي يعمل عليه هذا الكائن.
  readonly page: Page;

  // Constructor — receives and stores the Page instance.
  // المُنشئ — يستقبل ويخزن نسخة Page.
  constructor(page: Page) {
    this.page = page;
  }

  // Navigates to the quiz page using the URL from testData.
  // ينتقل إلى صفحة الاختبار باستخدام الرابط من testData.
  async goto(): Promise<void> {
    await this.page.goto(testData.urls.quiz);
  }

  // Selects (checks) a specific answer option by its value attribute.
  // يختار (يحدد) خيار إجابة محدد بواسطة سمة value الخاصة به.
  // Used to simulate a student choosing an answer in a multiple-choice quiz.
  // يُستخدم لمحاكاة طالب يختار إجابة في اختبار متعدد الخيارات.
  async selectAnswer(answer: string): Promise<void> {
    await this.page
      .locator(`${testData.selectors.answerOption}[value="${answer}"]`)
      .check();
  }

  // Clicks the submit button to send the selected answer.
  // ينقر على زر الإرسال لإرسال الإجابة المختارة.
  async submitAnswer(): Promise<void> {
    await this.page.locator(testData.selectors.submitAnswerButton).click();
  }

  // Reads the current sync state from the sync indicator element's data-state attribute.
  // يقرأ حالة المزامنة الحالية من سمة data-state لعنصر مؤشر المزامنة.
  // Returns values like "synced", "pending", "offline", etc.
  // يرجع قيمًا مثل "synced" أو "pending" أو "offline" وغيرها.
  async getSyncState(): Promise<string> {
    return (await this.page.locator(testData.selectors.syncIndicator).getAttribute('data-state')) ?? '';
  }

  // Reads the current offline state from the offline indicator element's data-state attribute.
  // يقرأ حالة اللاأونلاين الحالية من سمة data-state لعنصر مؤشر اللاأونلاين.
  // Returns values like "online", "offline", etc.
  // يرجع قيمًا مثل "online" أو "offline" وغيرها.
  async getOfflineState(): Promise<string> {
    return (await this.page.locator(testData.selectors.offlineIndicator).getAttribute('data-state')) ?? '';
  }

  // Reads the server-side sync state from a hidden element that displays JSON.
  // يقرأ حالة المزامنة من جانب الخادم من عنصر مخفي يعرض JSON.
  // Used in offline-sync tests to verify what the server received after reconnection.
  // يُستخدم في اختبارات المزامنة اللاأونلاين للتحقق مما استلمه الخادم بعد إعادة الاتصال.
  async readServerState(): Promise<SyncLabState['server']> {
    const value = await this.page.locator('#server-state').innerText();
    const parsed = JSON.parse(value || '{}') as SyncLabState['server'];
    return parsed;
  }

  // Reads the sync history array from the global __syncLabState object via page.evaluate().
  // يقرأ مصفوفة سجل المزامنة من كائن __syncLabState العام عبر page.evaluate().
  // Returns an array of sync event timestamps or identifiers logged during the test.
  // يرجع مصفوفة من أختام وقت أحداث المزامنة أو المعرّفات المسجلة أثناء الاختبار.
  async readSyncHistory(): Promise<string[]> {
    return this.page.evaluate(() => {
      const state = (
        window as Window & {
          __syncLabState?: { syncHistory?: string[] };
        }
      ).__syncLabState;
      return state?.syncHistory ?? [];
    });
  }

  // Waits for the sync indicator to show data-state="synced" within the configured timeout.
  // ينتظر حتى يُظهر مؤشر المزامنة data-state="synced" ضمن المهلة الزمنية المحددة.
  // Used to confirm that offline quiz submissions were successfully synced to the server.
  // يُستخدم لتأكيد أن إرسالات الاختبار اللاأونلاين تمت مزامنتها بنجاح إلى الخادم.
  async expectSynced(): Promise<void> {
    await expect(this.page.locator(testData.selectors.syncIndicator)).toHaveAttribute('data-state', 'synced', {
      timeout: testData.waits.syncTimeoutMs,
    });
  }
}
