// Imports needed for assertions and test runner.
// الاستيرادات اللازمة للتحقق وتشغيل الاختبارات.
import { expect, test, type Page } from '@playwright/test';

// Local route installer and Arabic locale URLs.
// مُثبت المسارات المحلية وروابط النسخة العربية.
import { installLocalEducationalRoutes, testData } from '../fixtures/test-data';

// List of required Arabic locale pages to test.
// قائمة صفحات النسخة العربية المطلوب اختبارها.
const requiredArabicPages = [
  testData.urls.arRoot,
  testData.urls.arQuiz,
  testData.urls.arChatbot,
  testData.urls.arVideo,
];

// Helper function to detect Arabic text using Unicode range \u0600-\u06FF.
// دالة مساعدة للكشف عن النص العربي باستخدام نطاق Unicode \u0600-\u06FF.
// Returns true if the string contains at least one Arabic character.
// ترجع true إذا كانت السلسلة تحتوي على حرف عربي واحد على الأقل.
function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

// Helper function to generate a slug from a URL pathname.
// دالة مساعدة لإنشاء slug من مسار URL.
// Replaces non-alphanumeric characters with dashes and removes leading/trailing dashes.
// تستبدل الأحرف غير الأبجدية الرقمية بشرطات وتزيل الشرطات البادئة/اللاحقة.
function slugFromUrl(url: string): string {
  const path = new URL(url).pathname;
  return path.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'ar-home';
}

// Helper function to measure horizontal overflow in pixels.
// دالة مساعدة لقياس الفائض الأفقي بالبكسل.
// Returns the difference between scrollWidth and innerWidth (0 if no overflow).
// ترجع الفرق بين scrollWidth و innerWidth (0 إذا لم يكن هناك فائض).
async function horizontalOverflowPx(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
}

// Helper function to detect major layout misalignment in pixels.
// دالة مساعدة للكشف عن عدم محاذاة التخطيط الرئيسي بالبكسل.
// Checks header, main, footer, and [role="main"] elements for overflow beyond viewport.
// تتحقق من عناصر header و main و footer و [role="main"] للفائض خارج منفذ العرض.
async function majorMisalignmentPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    // Select candidate elements for layout check.
    // اختيار العناصر المرشحة لفحص التخطيط.
    const candidates = document.querySelectorAll<HTMLElement>('header, main, footer, [role="main"]');
    let maxOverflow = 0;

    // Check first 30 elements for overflow.
    // فحص أول 30 عنصرًا للفائض.
    for (const element of Array.from(candidates).slice(0, 30)) {
      const rect = element.getBoundingClientRect();

      // Skip invisible elements.
      // تخطي العناصر غير المرئية.
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      // Calculate left and right overflow.
      // حساب الفائض الأيسر والأيمن.
      const left = Math.max(0, -rect.left);
      const right = Math.max(0, rect.right - window.innerWidth);
      maxOverflow = Math.max(maxOverflow, left, right);
    }

    // Return rounded maximum overflow.
    // إرجاع الفائض الأقصى المقرب.
    return Math.round(maxOverflow);
  });
}

// ─── Test Suite: Arabic RTL Layout & Content | مجموعة اختبارات: تخطيط ومحتوى RTL العربي ───
// Tests dir="rtl" on all pages, screenshot comparison, and Arabic text rendering.
// تختبر dir="rtl" على جميع الصفحات، مقارنة اللقطات، وعرض النص العربي.
test.describe('Arabic RTL Layout & Content (Local-Only)', () => {
  // Install local mock routes before each test to simulate the educational platform.
  // تثبيت المسارات المحلية الوهمية قبل كل اختبار لمحاكاة منصة التعليم.
  test.beforeEach(async ({ context }) => {
    await installLocalEducationalRoutes(context);
  });

  // Verify dir="rtl" and Arabic locale attributes on all discovered Arabic pages.
  // التحقق من dir="rtl" وسمات اللغة العربية على جميع الصفحات المكتشفة.
  test('verify dir="rtl" on all pages in Arabic locale', async ({ page }) => {
    // Navigate to Arabic root page.
    // الانتقال إلى الصفحة الجذرية العربية.
    await page.goto(testData.urls.arRoot);

    // Discover all Arabic locale pages by scanning anchor links via page.evaluate().
    // اكتشاف جميع صفحات النسخة العربية بمسح روابط الأنكور عبر page.evaluate().
    const discovered = await page.evaluate(() => {
      const urls = new Set<string>();

      // Loop through all anchor elements with href attribute.
      // المرور عبر جميع عناصر الأنكور التي تحتوي على سمة href.
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        const href = anchor.getAttribute('href');
        if (!href) {
          continue;
        }

        // Convert relative URLs to absolute.
        // تحويل الروابط النسبية إلى مطلقة.
        const absolute = new URL(href, window.location.origin);

        // Only include URLs starting with /ar.
        // تضمين الروابط التي تبدأ بـ /ar فقط.
        if (absolute.pathname.startsWith('/ar')) {
          // Remove query and hash for consistency.
          // إزالة الاستعلام والهاش للاتساق.
          absolute.search = '';
          absolute.hash = '';
          urls.add(absolute.toString());
        }
      }
      return Array.from(urls);
    });

    // Combine required pages with discovered pages (remove duplicates).
    // دمج الصفحات المطلوبة مع الصفحات المكتشفة (إزالة التكرارات).
    const allPages = [...new Set([...requiredArabicPages, ...discovered])];

    // Assert we found at least the required pages.
    // التأكد من أننا وجدنا على الأقل الصفحات المطلوبة.
    expect(allPages.length).toBeGreaterThanOrEqual(requiredArabicPages.length);

    // Loop through all pages and verify RTL attributes.
    // المرور عبر جميع الصفحات والتحقق من سمات RTL.
    for (const url of allPages) {
      await page.goto(url);

      // Assert <html> element has dir="rtl".
      // التأكد من أن عنصر <html> يحتوي على dir="rtl".
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      // Assert <html> element has lang attribute matching "ar" (case-insensitive).
      // التأكد من أن عنصر <html> يحتوي على سمة lang تطابق "ar" (غير حساسة لحالة الأحرف).
      await expect(page.locator('html')).toHaveAttribute('lang', /ar/i);
    }
  });

  // Capture screenshots and assert no major overflow/misalignment for key pages.
  // التقاط صور مرجعية والتأكد من عدم وجود فيض أو انحراف كبير في الصفحات الأساسية.
  test('screenshot comparison for key pages with overflow and alignment checks', async ({ page }) => {
    // Loop through all required Arabic pages.
    // المرور عبر جميع الصفحات العربية المطلوبة.
    for (const targetUrl of requiredArabicPages) {
      // Use test.step() to group assertions for each page in the report.
      // استخدام test.step() لتجميع التأكيدات لكل صفحة في التقرير.
      await test.step(`Visual check: ${targetUrl}`, async () => {
        // Navigate to the target page.
        // الانتقال إلى الصفحة المستهدفة.
        await page.goto(targetUrl);

        // Assert <html> has dir="rtl".
        // التأكد من أن <html> يحتوي على dir="rtl".
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

        // Measure horizontal overflow (scrollWidth - innerWidth).
        // قياس الفائض الأفقي (scrollWidth - innerWidth).
        const overflow = await horizontalOverflowPx(page);

        // Assert overflow is within acceptable tolerance (≤8px).
        // التأكد من أن الفائض ضمن التسامح المقبول (≤8 بكسل).
        expect(overflow).toBeLessThanOrEqual(8);

        // Measure major layout misalignment (elements overflowing viewport).
        // قياس عدم محاذاة التخطيط الرئيسي (عناصر تتجاوز منفذ العرض).
        const misalignment = await majorMisalignmentPx(page);

        // Assert misalignment is within acceptable tolerance (≤8px).
        // التأكد من أن عدم المحاذاة ضمن التسامح المقبول (≤8 بكسل).
        expect(misalignment).toBeLessThanOrEqual(8);

        // Capture full-page screenshot and compare with baseline.
        // التقاط لقطة شاشة كاملة للصفحة ومقارنتها بالخط الأساسي.
        await expect(page).toHaveScreenshot(`rtl-${slugFromUrl(targetUrl)}.png`, {
          fullPage: true,              // Capture entire page, not just viewport | التقاط الصفحة بأكملها، وليس فقط منفذ العرض
          animations: 'disabled',       // Disable animations for consistent snapshots | تعطيل الرسوم المتحركة للقطات متسقة
          caret: 'hide',                // Hide text cursor | إخفاء مؤشر النص
          maxDiffPixelRatio: 0.2,       // Allow up to 20% pixel difference | السماح بفرق بكسل يصل إلى 20%
        });
      });
    }
  });

  // Verify Arabic text rendering in quiz/chatbot/Al-Fihris without replacement chars.
  // التحقق من عرض النص العربي في الاختبار/المساعد/الفهرس بدون محارف إحلال.
  test('verify Arabic text rendering in quiz questions, chatbot responses, and Al-Fihris overlay', async ({
    page,
  }) => {
    // Navigate to Arabic root page.
    // الانتقال إلى الصفحة الجذرية العربية.
    await page.goto(testData.urls.arRoot);

    // Assert <html> has dir="rtl".
    // التأكد من أن <html> يحتوي على dir="rtl".
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Locate quiz question element.
    // تحديد موقع عنصر سؤال الاختبار.
    const quizQuestion = page.locator('#quiz-question');

    // Locate chatbot response element.
    // تحديد موقع عنصر رد المساعد.
    const chatbotResponse = page.locator('#chatbot-response');

    // Locate Al-Fihris overlay element.
    // تحديد موقع عنصر تراكب الفهرس.
    const alFihrisOverlay = page.locator('[data-testid="al-fihris-overlay"]');

    // Assert all three elements are visible.
    // التأكد من أن جميع العناصر الثلاثة مرئية.
    await expect(quizQuestion).toBeVisible();
    await expect(chatbotResponse).toBeVisible();
    await expect(alFihrisOverlay).toBeVisible();

    // Read text content from all three elements in parallel.
    // قراءة محتوى النص من جميع العناصر الثلاثة بشكل متوازٍ.
    const [quizText, chatbotText, overlayText] = await Promise.all([
      quizQuestion.innerText(),
      chatbotResponse.innerText(),
      alFihrisOverlay.innerText(),
    ]);

    // Assert quiz question contains Arabic text.
    // التأكد من أن سؤال الاختبار يحتوي على نص عربي.
    expect(hasArabicText(quizText)).toBe(true);

    // Assert chatbot response contains Arabic text.
    // التأكد من أن رد المساعد يحتوي على نص عربي.
    expect(hasArabicText(chatbotText)).toBe(true);

    // Assert Al-Fihris overlay contains Arabic text.
    // التأكد من أن تراكب الفهرس يحتوي على نص عربي.
    expect(hasArabicText(overlayText)).toBe(true);

    // Assert quiz question does not contain replacement character U+FFFD.
    // التأكد من أن سؤال الاختبار لا يحتوي على محرف الإحلال U+FFFD.
    expect(quizText).not.toContain('\uFFFD');

    // Assert chatbot response does not contain replacement character U+FFFD.
    // التأكد من أن رد المساعد لا يحتوي على محرف الإحلال U+FFFD.
    expect(chatbotText).not.toContain('\uFFFD');

    // Assert Al-Fihris overlay does not contain replacement character U+FFFD.
    // التأكد من أن تراكب الفهرس لا يحتوي على محرف الإحلال U+FFFD.
    expect(overlayText).not.toContain('\uFFFD');
  });
});
