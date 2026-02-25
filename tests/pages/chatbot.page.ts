// ─── Imports | الاستيرادات ────────────────────────────────────────────────────────────────────
// Playwright test framework and Page type for browser automation.
// إطار عمل Playwright للاختبار ونوع Page لأتمتة المتصفح.
import { expect, type Page } from '@playwright/test';

// Shared test data configuration (URLs, selectors, etc.).
// إعداد بيانات الاختبار المشتركة (الروابط، المحددات، إلخ).
import { testData } from '../fixtures/test-data';

// ─── ChatbotPage POM | كائن صفحة Chatbot ──────────────────────────────────────────────────────
// Page Object Model for the Arabic chatbot page.
// نموذج كائن الصفحة لصفحة الدردشة الآلية العربية.
// Provides methods to navigate to the chatbot, read responses, and verify RTL attributes.
// يوفر طرقًا للانتقال إلى الدردشة الآلية وقراءة الردود والتحقق من سمات RTL.
export class ChatbotPage {
  // Playwright Page instance — the browser tab/context this POM operates on.
  // نسخة Playwright Page — علامة تبويب/سياق المتصفح الذي يعمل عليه هذا الكائن.
  readonly page: Page;

  // Constructor — receives and stores the Page instance.
  // المُنشئ — يستقبل ويخزن نسخة Page.
  constructor(page: Page) {
    this.page = page;
  }

  // Navigates to the Arabic chatbot page using the URL from testData.
  // ينتقل إلى صفحة الدردشة الآلية العربية باستخدام الرابط من testData.
  async gotoArabicChatbot(): Promise<void> {
    await this.page.goto(testData.urls.arChatbot);
  }

  // Reads and returns the text content of the chatbot response element.
  // يقرأ ويرجع محتوى النص من عنصر رد الدردشة الآلية.
  // Used to verify that Arabic text is rendered correctly in chatbot responses.
  // يُستخدم للتحقق من أن النص العربي يُعرض بشكل صحيح في ردود الدردشة الآلية.
  async readArabicChatbotText(): Promise<string> {
    return this.page.locator('#chatbot-response').innerText();
  }

  // Asserts that the <html> element has dir="rtl" and lang starts with "ar".
  // يتأكد أن عنصر <html> يحتوي على dir="rtl" وأن lang تبدأ بـ "ar".
  // Confirms the page is properly configured for Arabic right-to-left layout.
  // يؤكد أن الصفحة مُعدّة بشكل صحيح لتخطيط العربي من اليمين إلى اليسار.
  async assertRtlAttributes(): Promise<void> {
    await expect(this.page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(this.page.locator('html')).toHaveAttribute('lang', /ar/i);
  }
}
