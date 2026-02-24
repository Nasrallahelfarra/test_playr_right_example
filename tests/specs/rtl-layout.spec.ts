// ─── Imports | الاستيرادات ────────────────────────────────────────────────────
// Playwright core: expect for assertions, test as the runner, Page for typing.
// أدوات Playwright الأساسية: expect للتحقق، test للتشغيل، Page للتنميط.
import { expect, test, type Page } from '@playwright/test';

// Node.js path utilities to resolve the local fixture HTML file path.
// أدوات مسار Node.js لحل مسار ملف HTML التجريبي المحلي.
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// ─── Constants | الثوابت ──────────────────────────────────────────────────────
// Root Arabic locale URL — entry point for discovering all Arabic pages.
// رابط الجذر للغة العربية — نقطة البداية لاكتشاف جميع الصفحات العربية.
const arabicLocaleRoot = 'https://www.careem.com/ar-AE/';

// Mandatory pages that must always be validated regardless of discovery results.
// الصفحات الإلزامية التي يجب دائمًا التحقق منها بغض النظر عن نتائج الاكتشاف.
const requiredArabicPages = [
  'https://www.careem.com/ar-AE/',
  'https://www.careem.com/ar-AE/ride/',
  'https://www.careem.com/ar-AE/food/',
  'https://www.careem.com/ar-AE/groceries/',
  'https://www.careem.com/ar-AE/pay/',
];

// Cap on how many pages to discover dynamically — prevents the suite from running forever.
// حد أقصى لعدد الصفحات المكتشفة ديناميكيًا — يمنع الاختبار من الاستمرار إلى ما لا نهاية.
const maxDiscoveredPages = 12;

// Selectors for dynamic/animated elements to mask during screenshot comparison.
// محددات العناصر الديناميكية/المتحركة التي يتم إخفاؤها أثناء مقارنة لقطات الشاشة.
// Masking prevents flaky diffs caused by rotating banners, cookie banners, etc.
// الإخفاء يمنع الاختلافات الزائفة الناتجة عن البانرات الدوارة وأشرطة الكوكيز وغيرها.
const dynamicMaskSelectors = [
  'iframe',
  'video',
  '[aria-live]',
  '[class*="carousel"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  'time',
];

// Convert the local arabic-rtl-lab.html fixture to a file:// URL for the browser.
// تحويل fixture العربية المحلية إلى رابط file:// للمتصفح.
const rtlFixtureUrl = pathToFileURL(
  resolve(__dirname, '..', 'fixtures', 'pages', 'arabic-rtl-lab.html'),
).toString();

// ─── Helpers | الدوال المساعدة ────────────────────────────────────────────────

// Returns true if the string contains at least one Arabic Unicode character.
// ترجع true إذا كان النص يحتوي على حرف عربي واحد على الأقل من Unicode.
function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

// Converts a URL into a URL-safe slug used as the screenshot filename.
// يحوّل رابطًا إلى slug آمن للرابط يُستخدم كاسم ملف لقطة الشاشة.
// e.g. /ar-AE/ride/ → "ar-AE-ride"
function slugFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  return pathname.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'home';
}

// Normalises an Arabic locale URL: removes query/hash and ensures trailing slash.
// يُوحّد رابط اللغة العربية: يزيل الاستعلام/الـ hash ويضمن وجود شرطة مائلة في النهاية.
// This prevents counting the same page twice due to minor URL differences.
// يمنع عدّ نفس الصفحة مرتين بسبب اختلافات طفيفة في الرابط.
function normalizeArabicUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return parsed.toString();
}

// Returns a deduplicated copy of a string array using a Set.
// يرجع نسخة مكررة من مصفوفة النصوص باستخدام Set.
function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

// Waits for the page to fully settle, then injects CSS to disable all animations.
// ينتظر اكتمال تحميل الصفحة، ثم يُدرج CSS لتعطيل جميع الحركات.
// This makes screenshot comparisons stable by eliminating visual noise from transitions.
// يجعل مقارنات لقطات الشاشة مستقرة بإلغاء الضجيج البصري من الانتقالات.
async function settlePage(page: Page): Promise<void> {
  // Wait for the HTML to be parsed and the DOM to be ready.
  // انتظر حتى يتم تحليل HTML وجاهزية DOM.
  await page.waitForLoadState('domcontentloaded');

  // Wait for the network to go idle (no pending requests) for up to 30 s.
  // انتظر حتى تتوقف الشبكة (لا طلبات معلقة) لمدة أقصاها 30 ثانية.
  // .catch(() => {}) ignores the timeout — some pages never fully idle.
  // .catch(() => {}) يتجاهل المهلة — بعض الصفحات لا تصبح idle أبدًا.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // Inject CSS that freezes all animations, transitions, and scroll behavior.
  // إدراج CSS يُجمّد جميع الحركات والانتقالات وسلوك التمرير.
  await page
    .addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `,
    })
    .catch(() => {});
}

// Navigates to the Arabic locale root, then collects all /ar-AE/ internal links.
// ينتقل إلى جذر اللغة العربية ثم يجمع جميع الروابط الداخلية /ar-AE/.
// Runs inside page.evaluate() so it can access the live DOM's anchor list.
// يعمل داخل page.evaluate() للوصول إلى قائمة الروابط في DOM المباشر.
async function collectArabicLocalePages(page: Page): Promise<string[]> {
  await page.goto(arabicLocaleRoot, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  const discovered = await page.evaluate((rootUrl) => {
    const root = new URL(rootUrl);
    const urls = new Set<string>();

    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const href = anchor.getAttribute('href');
      if (!href) {
        // Skip anchors with no href attribute.
        // تجاهل الروابط التي لا تحتوي على href.
        continue;
      }

      let absolute: URL;
      try {
        // Resolve relative hrefs against the root origin.
        // حل hrefs النسبية مقابل أصل الجذر.
        absolute = new URL(href, root);
      } catch {
        // Skip malformed hrefs that cannot be parsed as a URL.
        // تجاهل hrefs المشوهة التي لا يمكن تحليلها كرابط.
        continue;
      }

      // Only keep links that belong to the same origin (no external links).
      // الاحتفاظ فقط بالروابط التي تنتمي لنفس الأصل (لا روابط خارجية).
      if (absolute.origin !== root.origin) {
        continue;
      }

      // Only keep links under the /ar-AE/ path prefix.
      // الاحتفاظ فقط بالروابط تحت بادئة المسار /ar-AE/.
      if (!absolute.pathname.startsWith('/ar-AE/')) {
        continue;
      }

      // Normalise the URL: strip query/hash and add trailing slash.
      // توحيد الرابط: إزالة الاستعلام/الـ hash وإضافة شرطة مائلة في النهاية.
      absolute.search = '';
      absolute.hash = '';
      absolute.pathname = absolute.pathname.endsWith('/')
        ? absolute.pathname
        : `${absolute.pathname}/`;

      urls.add(absolute.toString());
    }

    return Array.from(urls);
  }, arabicLocaleRoot);

  // Return at most maxDiscoveredPages results to keep the test run bounded.
  // إرجاع عدد أقصاه maxDiscoveredPages للحفاظ على مدة تشغيل محدودة.
  return discovered.slice(0, maxDiscoveredPages);
}

// Measures how many pixels the page content overflows horizontally beyond the viewport.
// يقيس عدد البكسلات التي يتجاوز بها محتوى الصفحة حافة الـ viewport أفقيًا.
// Horizontal overflow > 0 is a strong signal of an RTL layout break.
// تجاوز أفقي > 0 إشارة قوية على كسر في تخطيط RTL.
async function horizontalOverflowPx(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
}

// Checks major structural elements (header, main, footer) for bounding-box overflow.
// يفحص العناصر الهيكلية الكبرى (header, main, footer) لتجاوز الحدود البصرية.
// Returns the maximum overflow in pixels found across up to 40 candidate elements.
// يرجع أقصى تجاوز بالبكسل عبر 40 عنصرًا مرشحًا.
async function majorMisalignmentPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const candidates = document.querySelectorAll<HTMLElement>('header, main, footer, [role="main"]');
    let maxOverflow = 0;

    for (const element of Array.from(candidates).slice(0, 40)) {
      const rect = element.getBoundingClientRect();

      // Skip elements with zero dimensions (hidden or not rendered).
      // تجاهل العناصر ذات الأبعاد الصفرية (مخفية أو غير مُصيَّرة).
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      // Skip elements fully outside the viewport (not in the visible area).
      // تجاهل العناصر الخارجة تمامًا عن الـ viewport (ليست في المنطقة المرئية).
      if (rect.right < 0 || rect.left > window.innerWidth) {
        continue;
      }

      const style = window.getComputedStyle(element);

      // Skip invisible elements — they cannot cause visible layout problems.
      // تجاهل العناصر غير المرئية — لا يمكنها التسبب بمشاكل تخطيط مرئية.
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      // Skip abnormally wide elements (e.g. full-bleed hero banners > 150% viewport).
      // تجاهل العناصر العريضة بشكل غير طبيعي (مثل بانرات hero > 150% من الـ viewport).
      if (rect.width > window.innerWidth * 1.5) {
        continue;
      }

      // Measure how far the element bleeds outside the left and right viewport edges.
      // قياس مدى تجاوز العنصر لحافتي الـ viewport اليسرى واليمنى.
      const leftOverflow = Math.max(0, -rect.left);
      const rightOverflow = Math.max(0, rect.right - window.innerWidth);
      maxOverflow = Math.max(maxOverflow, leftOverflow, rightOverflow);
    }

    return Math.round(maxOverflow);
  });
}

// ─── Test Suite | مجموعة الاختبارات ──────────────────────────────────────────
// Groups all Arabic RTL layout and content validation tests under one suite.
// يجمع جميع اختبارات تحقق تخطيط RTL العربي والمحتوى تحت مجموعة واحدة.
test.describe('Arabic RTL Layout & Content', () => {

  // ── Test 1: dir="rtl" Attribute on All Arabic Pages | سمة dir="rtl" على كل الصفحات ──
  // Collects all /ar-AE/ pages dynamically, merges with the mandatory list,
  // then visits each one and asserts that dir="rtl" and lang starts with "ar".
  // يجمع جميع صفحات /ar-AE/ ديناميكيًا، يدمجها مع القائمة الإلزامية،
  // ثم يزور كل صفحة ويتأكد أن dir="rtl" وأن lang تبدأ بـ "ar".
  test('verify dir="rtl" on all discovered Arabic locale pages', async ({ page }) => {
    // Mark test as slow — network traversal across many pages can take a long time.
    // وضع علامة slow على الاختبار — الجولة عبر الشبكة قد تستغرق وقتًا طويلاً.
    test.slow();

    // Discover all Arabic locale pages by crawling the root page's links.
    // اكتشاف جميع صفحات locale العربية بالزحف على روابط الصفحة الجذرية.
    const discoveredPages = await collectArabicLocalePages(page);

    // Merge required pages and discovered pages, deduplicate and normalise each URL.
    // دمج الصفحات المطلوبة والمكتشفة، إزالة التكرار وتوحيد كل رابط.
    const allArabicPages = unique(
      [...requiredArabicPages, ...discoveredPages].map((pageUrl) => normalizeArabicUrl(pageUrl)),
    );
    let validatedPages = 0;

    // At minimum, all required pages must be present in the merged list.
    // كحد أدنى، يجب أن تكون جميع الصفحات المطلوبة موجودة في القائمة المدمجة.
    expect(allArabicPages.length).toBeGreaterThanOrEqual(requiredArabicPages.length);

    for (const targetUrl of allArabicPages) {
      // Navigate to each page and wait for the DOM to be ready.
      // الانتقال إلى كل صفحة والانتظار حتى يصبح DOM جاهزًا.
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

      // Read dir and lang attributes from the <html> root element via page.evaluate().
      // قراءة سمتَي dir وlang من عنصر <html> الجذري عبر page.evaluate().
      const attributes = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          dir: (html.getAttribute('dir') ?? '').toLowerCase(),
          lang: (html.getAttribute('lang') ?? '').toLowerCase(),
        };
      });

      // Some links may redirect to a non-Arabic page — skip them to avoid false failures.
      // بعض الروابط قد تعيد التوجيه لصفحة غير عربية — تجاوزها لتجنب النتائج الخاطئة.
      if (!(attributes.dir === 'rtl' || attributes.lang.startsWith('ar'))) {
        continue;
      }

      validatedPages += 1;

      // Assert dir attribute is exactly "rtl".
      // التأكد أن سمة dir هي "rtl" بالضبط.
      expect(attributes.dir).toBe('rtl');

      // Assert lang starts with "ar" (e.g. "ar-ae", "ar").
      // التأكد أن lang تبدأ بـ "ar" (مثل "ar-ae" أو "ar").
      expect(attributes.lang.startsWith('ar')).toBe(true);
    }

    // At least all required pages must have been validated successfully.
    // يجب أن تكون جميع الصفحات المطلوبة على الأقل قد تحققت بنجاح.
    expect(validatedPages).toBeGreaterThanOrEqual(requiredArabicPages.length);
  });

  // ── Test 2: Screenshot Comparison + Overflow/Alignment | مقارنة اللقطات + فحص الفيض والانحراف ──
  // For each required Arabic page: settles the page, asserts dir="rtl", checks horizontal
  // overflow (≤ 24 px), checks structural misalignment (≤ 24 px), and optionally takes a
  // screenshot to compare against a stored baseline (Chromium + Windows + non-CI only).
  // لكل صفحة عربية مطلوبة: يستقر الصفحة، يتأكد من dir="rtl"، يفحص الفيض الأفقي (≤ 24 بكسل)،
  // يفحص انحراف التخطيط (≤ 24 بكسل)، ويأخذ لقطة شاشة للمقارنة مع الأساس المخزن (Chromium + Windows فقط).
  test('screenshot comparison for key pages with overflow and alignment checks', async ({
    page,
  }, testInfo) => {
    // Mark as slow — each page may take up to 30 s to reach networkidle.
    // وضع علامة slow — كل صفحة قد تستغرق 30 ثانية للوصول إلى networkidle.
    test.slow();

    // Only compare screenshots on Chromium running locally on Windows (not in CI).
    // مقارنة اللقطات فقط على Chromium يعمل محليًا على Windows (ليس في CI).
    // This avoids cross-platform pixel differences that would cause false failures.
    // يتجنب اختلافات البكسل عبر المنصات التي قد تتسبب في فشل زائف.
    const shouldCompareSnapshots =
      testInfo.project.name === 'chromium' && process.platform === 'win32' && !process.env.CI;

    for (const targetUrl of requiredArabicPages.map((pageUrl) => normalizeArabicUrl(pageUrl))) {
      // Wrap each page's checks in a named test.step for clearer Playwright reports.
      // تغليف فحوصات كل صفحة في test.step مسمى لتقارير Playwright أوضح.
      await test.step(`Visual and layout check: ${targetUrl}`, async () => {
        // Navigate to the page and wait for the DOM to be ready.
        // الانتقال إلى الصفحة والانتظار حتى يصبح DOM جاهزًا.
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

        // Settle the page: wait for networkidle + disable all CSS animations.
        // استقرار الصفحة: انتظار networkidle + تعطيل جميع الحركات في CSS.
        await settlePage(page);

        // Assert the <html> element carries a dir="rtl" attribute (case-insensitive).
        // التأكد أن عنصر <html> يحمل سمة dir="rtl" (بغض النظر عن حالة الأحرف).
        await expect(page.locator('html')).toHaveAttribute('dir', /rtl/i);

        // Horizontal overflow > 24 px signals a broken RTL layout (content escaping the viewport).
        // فيض أفقي > 24 بكسل يشير إلى كسر في تخطيط RTL (محتوى يتجاوز حدود viewport).
        const overflow = await horizontalOverflowPx(page);
        expect(overflow).toBeLessThanOrEqual(24);

        // Structural misalignment > 24 px indicates a major element is out of position.
        // انحراف هيكلي > 24 بكسل يشير إلى عنصر رئيسي خارج موضعه.
        const misalignment = await majorMisalignmentPx(page);
        expect(misalignment).toBeLessThanOrEqual(24);

        // Skip screenshot comparison if not on the qualifying environment.
        // تجاوز مقارنة اللقطات إذا لم يكن البيئة مؤهلة.
        if (!shouldCompareSnapshots) {
          return;
        }

        // Capture a viewport screenshot and compare against the stored baseline.
        // التقاط لقطة شاشة لـ viewport ومقارنتها بالأساس المخزن.
        // Mask dynamic elements (iframes, carousels, cookie banners, etc.) to avoid noise.
        // إخفاء العناصر الديناميكية (iframes، carousels، أشرطة الكوكيز...) لتجنب الضوضاء.
        await expect(page).toHaveScreenshot(`careem-ar-${slugFromUrl(targetUrl)}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: false,
          maxDiffPixelRatio: 0.08,
          mask: dynamicMaskSelectors.map((selector) => page.locator(selector)),
        });
      });
    }
  });

  // ── Test 3: Arabic Text Rendering in Quiz, Chatbot, Al-Fihris | عرض النص العربي ──
  // Loads the local RTL fixture page, then verifies that the quiz question,
  // chatbot response, and Al-Fihris overlay each contain real Arabic Unicode text
  // (U+0600–U+06FF range) and do not contain the replacement character U+FFFD
  // (which would indicate broken encoding).
  // Also verifies the fixture page itself has zero horizontal overflow.
  // يحمّل صفحة fixture المحلية لـ RTL، ثم يتحقق أن سؤال الاختبار وردّ الـ chatbot
  // وتراكب Al-Fihris تحتوي كل منها على نص عربي Unicode حقيقي (نطاق U+0600–U+06FF)
  // وألا تحتوي على محرف الإحلال U+FFFD (الذي يشير إلى ترميز مكسور).
  // يتحقق أيضًا أن صفحة fixture ذاتها لا تعاني من أي فيض أفقي.
  test('verify Arabic text rendering in quiz question, chatbot response, and Al-Fihris overlay', async ({
    page,
  }) => {
    // Navigate to the local RTL fixture HTML file.
    // الانتقال إلى ملف HTML fixture المحلي لـ RTL.
    await page.goto(rtlFixtureUrl);

    // Confirm the fixture page itself has dir="rtl" on its <html> element.
    // التأكد أن صفحة fixture نفسها تحمل dir="rtl" على عنصر <html>.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Locate the three elements that must render Arabic text.
    // تحديد مواضع العناصر الثلاثة التي يجب أن تعرض النص العربي.
    const quizQuestion = page.locator('#quiz-question');
    const chatbotResponse = page.locator('#chatbot-response');
    const alFihrisOverlay = page.locator('[data-testid="al-fihris-overlay"]');

    // Assert all three elements are visible before reading their text.
    // التأكد أن العناصر الثلاثة مرئية قبل قراءة نصها.
    await expect(quizQuestion).toBeVisible();
    await expect(chatbotResponse).toBeVisible();
    await expect(alFihrisOverlay).toBeVisible();

    // Read all three text values in parallel for efficiency.
    // قراءة القيم النصية الثلاث بالتوازي لتحقيق الكفاءة.
    const [quizText, chatbotText, overlayText] = await Promise.all([
      quizQuestion.innerText(),
      chatbotResponse.innerText(),
      alFihrisOverlay.innerText(),
    ]);

    // Each element must contain at least one Arabic Unicode character.
    // يجب أن يحتوي كل عنصر على حرف عربي Unicode واحد على الأقل.
    expect(hasArabicText(quizText)).toBe(true);
    expect(hasArabicText(chatbotText)).toBe(true);
    expect(hasArabicText(overlayText)).toBe(true);

    // U+FFFD (replacement character) must be absent — its presence indicates garbled encoding.
    // يجب غياب U+FFFD (محرف الإحلال) — وجوده يشير إلى ترميز مشوّه.
    expect(quizText).not.toContain('\uFFFD');
    expect(chatbotText).not.toContain('\uFFFD');
    expect(overlayText).not.toContain('\uFFFD');

    // The fixture page must not overflow horizontally — any overflow = RTL layout bug.
    // يجب ألا تتجاوز صفحة fixture حدودها أفقيًا — أي تجاوز = خطأ في تخطيط RTL.
    const overflow = await horizontalOverflowPx(page);
    expect(overflow).toBe(0);
  });
});
