// ─── Imports | الاستيرادات ────────────────────────────────────────────────────────────────────
// Playwright test framework and Page type for browser automation.
// إطار عمل Playwright للاختبار ونوع Page لأتمتة المتصفح.
import { expect, type Page } from '@playwright/test';

// Shared test data configuration (URLs, selectors, etc.).
// إعداد بيانات الاختبار المشتركة (الروابط، المحددات، إلخ).
import { testData } from '../fixtures/test-data';

// ─── DashboardPage POM | كائن صفحة لوحة التحكم ────────────────────────────────────────────────
// Page Object Model for the student dashboard (home page after login).
// نموذج كائن الصفحة للوحة تحكم الطالب (الصفحة الرئيسية بعد تسجيل الدخول).
// Provides methods to verify the dashboard loaded and navigate to different sections.
// يوفر طرقًا للتحقق من تحميل لوحة التحكم والانتقال إلى أقسام مختلفة.
export class DashboardPage {
  // Playwright Page instance — the browser tab/context this POM operates on.
  // نسخة Playwright Page — علامة تبويب/سياق المتصفح الذي يعمل عليه هذا الكائن.
  readonly page: Page;

  // Constructor — receives and stores the Page instance.
  // المُنشئ — يستقبل ويخزن نسخة Page.
  constructor(page: Page) {
    this.page = page;
  }

  // Asserts that the dashboard page has loaded successfully.
  // يتأكد من أن صفحة لوحة التحكم قد تحمّلت بنجاح.
  // Checks that the root dashboard element is visible and the URL matches.
  // يتحقق من أن عنصر لوحة التحكم الجذري مرئي وأن الرابط يطابق.
  async assertLoaded(): Promise<void> {
    await expect(this.page.locator(testData.selectors.dashboardRoot)).toBeVisible();
    await expect(this.page).toHaveURL(testData.urls.dashboard);
  }

  // Clicks the "Video" navigation link and waits for navigation to the video page.
  // ينقر على رابط التنقل "فيديو" وينتظر الانتقال إلى صفحة الفيديو.
  async openVideo(): Promise<void> {
    await this.page.locator(testData.selectors.navVideo).click();
    await expect(this.page).toHaveURL(testData.urls.video);
  }

  // Clicks the "Quiz" navigation link and waits for navigation to the quiz page.
  // ينقر على رابط التنقل "اختبار" وينتظر الانتقال إلى صفحة الاختبار.
  async openQuiz(): Promise<void> {
    await this.page.locator(testData.selectors.navQuiz).click();
    await expect(this.page).toHaveURL(testData.urls.quiz);
  }

  // Clicks the "Exam" navigation link and waits for navigation to any exam URL.
  // ينقر على رابط التنقل "امتحان" وينتظر الانتقال إلى أي رابط امتحان.
  // Uses .toContain() because exam URLs are dynamic (e.g., /exam/123).
  // يستخدم .toContain() لأن روابط الامتحان ديناميكية (مثل /exam/123).
  async openExam(): Promise<void> {
    await this.page.locator(testData.selectors.navExam).click();
    expect(this.page.url()).toContain('/exam');
  }

  // Clicks the "Arabic" locale switcher and waits for navigation to the Arabic root page.
  // ينقر على مبدّل اللغة "العربية" وينتظر الانتقال إلى الصفحة الجذرية العربية.
  async openArabic(): Promise<void> {
    await this.page.locator(testData.selectors.navArabic).click();
    await expect(this.page).toHaveURL(testData.urls.arRoot);
  }
}
