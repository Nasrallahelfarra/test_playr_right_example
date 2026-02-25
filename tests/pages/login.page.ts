// ─── Imports | الاستيرادات ────────────────────────────────────────────────────────────────────
// Playwright test framework and Page type for browser automation.
// إطار عمل Playwright للاختبار ونوع Page لأتمتة المتصفح.
import { expect, type Page } from '@playwright/test';

// Shared test data configuration (URLs, selectors, etc.).
// إعداد بيانات الاختبار المشتركة (الروابط، المحددات، إلخ).
import { testData } from '../fixtures/test-data';

// ─── LoginPage POM | كائن صفحة تسجيل الدخول ───────────────────────────────────────────────────
// Page Object Model for the student login page.
// نموذج كائن الصفحة لصفحة تسجيل دخول الطالب.
// Provides methods to navigate to the login page and authenticate as a specific student.
// يوفر طرقًا للانتقال إلى صفحة تسجيل الدخول والمصادقة كطالب محدد.
export class LoginPage {
  // Playwright Page instance — the browser tab/context this POM operates on.
  // نسخة Playwright Page — علامة تبويب/سياق المتصفح الذي يعمل عليه هذا الكائن.
  readonly page: Page;

  // Constructor — receives and stores the Page instance.
  // المُنشئ — يستقبل ويخزن نسخة Page.
  constructor(page: Page) {
    this.page = page;
  }

  // Navigates to the login page using the URL from testData.
  // ينتقل إلى صفحة تسجيل الدخول باستخدام الرابط من testData.
  async goto(): Promise<void> {
    await this.page.goto(testData.urls.login);
  }

  // Selects a student from the dropdown and clicks the login button.
  // يختار طالبًا من القائمة المنسدلة وينقر على زر تسجيل الدخول.
  // Waits for navigation to the dashboard page to confirm successful login.
  // ينتظر الانتقال إلى صفحة لوحة التحكم لتأكيد نجاح تسجيل الدخول.
  async loginAs(studentId: string): Promise<void> {
    // Select the student by their ID from the dropdown.
    // اختيار الطالب بواسطة معرّفه من القائمة المنسدلة.
    await this.page.locator(testData.selectors.studentSelect).selectOption(studentId);

    // Click the login button to submit the form.
    // النقر على زر تسجيل الدخول لإرسال النموذج.
    await this.page.locator(testData.selectors.loginButton).click();

    // Assert that the page navigated to the dashboard URL after login.
    // التأكد من أن الصفحة انتقلت إلى رابط لوحة التحكم بعد تسجيل الدخول.
    await expect(this.page).toHaveURL(testData.urls.dashboard);
  }
}
