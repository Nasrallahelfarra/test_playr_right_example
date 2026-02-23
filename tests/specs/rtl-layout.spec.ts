import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const arabicLocaleRoot = 'https://www.careem.com/ar-AE/';
const requiredArabicPages = [
  'https://www.careem.com/ar-AE/',
  'https://www.careem.com/ar-AE/ride/',
  'https://www.careem.com/ar-AE/food/',
  'https://www.careem.com/ar-AE/groceries/',
  'https://www.careem.com/ar-AE/pay/',
];
const maxDiscoveredPages = 12;

const dynamicMaskSelectors = [
  'iframe',
  'video',
  '[aria-live]',
  '[class*="carousel"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  'time',
];

const rtlFixtureUrl = pathToFileURL(
  resolve(__dirname, '..', 'fixtures', 'pages', 'arabic-rtl-lab.html'),
).toString();

function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function slugFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  return pathname.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'home';
}

function normalizeArabicUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return parsed.toString();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
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

async function collectArabicLocalePages(page: Page): Promise<string[]> {
  await page.goto(arabicLocaleRoot, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  const discovered = await page.evaluate((rootUrl) => {
    const root = new URL(rootUrl);
    const urls = new Set<string>();

    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const href = anchor.getAttribute('href');
      if (!href) {
        continue;
      }

      let absolute: URL;
      try {
        absolute = new URL(href, root);
      } catch {
        continue;
      }

      if (absolute.origin !== root.origin) {
        continue;
      }
      if (!absolute.pathname.startsWith('/ar-AE/')) {
        continue;
      }

      absolute.search = '';
      absolute.hash = '';
      absolute.pathname = absolute.pathname.endsWith('/')
        ? absolute.pathname
        : `${absolute.pathname}/`;

      urls.add(absolute.toString());
    }

    return Array.from(urls);
  }, arabicLocaleRoot);

  return discovered.slice(0, maxDiscoveredPages);
}

async function horizontalOverflowPx(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
}

async function majorMisalignmentPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const candidates = document.querySelectorAll<HTMLElement>('header, main, footer, [role="main"]');
    let maxOverflow = 0;

    for (const element of Array.from(candidates).slice(0, 40)) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      if (rect.right < 0 || rect.left > window.innerWidth) {
        continue;
      }

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      if (rect.width > window.innerWidth * 1.5) {
        continue;
      }

      const leftOverflow = Math.max(0, -rect.left);
      const rightOverflow = Math.max(0, rect.right - window.innerWidth);
      maxOverflow = Math.max(maxOverflow, leftOverflow, rightOverflow);
    }

    return Math.round(maxOverflow);
  });
}

test.describe('Arabic RTL Layout & Content', () => {
  // هذا الاختبار يتأكد أن الصفحات العربية تعمل فعليًا باتجاه RTL (dir/lang) على أكبر عدد ممكن من صفحات locale العربي.
  test('verify dir="rtl" on all discovered Arabic locale pages', async ({ page }) => {
    test.slow();

    const discoveredPages = await collectArabicLocalePages(page);
    const allArabicPages = unique(
      [...requiredArabicPages, ...discoveredPages].map((pageUrl) => normalizeArabicUrl(pageUrl)),
    );
    let validatedPages = 0;

    expect(allArabicPages.length).toBeGreaterThanOrEqual(requiredArabicPages.length);

    for (const targetUrl of allArabicPages) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

      const attributes = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          dir: (html.getAttribute('dir') ?? '').toLowerCase(),
          lang: (html.getAttribute('lang') ?? '').toLowerCase(),
        };
      });

      // بعض الروابط قد تعيد توجيهك لصفحة غير عربية، لذلك نتجاوزها حتى لا نعطي نتيجة خاطئة.
      if (!(attributes.dir === 'rtl' || attributes.lang.startsWith('ar'))) {
        continue;
      }

      validatedPages += 1;
      expect(attributes.dir).toBe('rtl');
      expect(attributes.lang.startsWith('ar')).toBe(true);
    }

    expect(validatedPages).toBeGreaterThanOrEqual(requiredArabicPages.length);
  });

  // هذا الاختبار يعمل مقارنة بصرية للصفحات العربية الأساسية ويتحقق من عدم وجود overflow أفقي أو انحراف واضح في layout.
  test('screenshot comparison for key pages with overflow and alignment checks', async ({
    page,
  }, testInfo) => {
    test.slow();
    const shouldCompareSnapshots =
      testInfo.project.name === 'chromium' && process.platform === 'win32' && !process.env.CI;

    for (const targetUrl of requiredArabicPages.map((pageUrl) => normalizeArabicUrl(pageUrl))) {
      await test.step(`Visual and layout check: ${targetUrl}`, async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await settlePage(page);

        await expect(page.locator('html')).toHaveAttribute('dir', /rtl/i);

        const overflow = await horizontalOverflowPx(page);
        expect(overflow).toBeLessThanOrEqual(24);

        const misalignment = await majorMisalignmentPx(page);
        expect(misalignment).toBeLessThanOrEqual(24);

        if (!shouldCompareSnapshots) {
          return;
        }

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

  // هذا الاختبار يتحقق من ظهور نص عربي صحيح لعناصر quiz/chatbot/Al-Fihris داخل صفحة RTL مخصصة للفحص.
  test('verify Arabic text rendering in quiz question, chatbot response, and Al-Fihris overlay', async ({
    page,
  }) => {
    await page.goto(rtlFixtureUrl);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const quizQuestion = page.locator('#quiz-question');
    const chatbotResponse = page.locator('#chatbot-response');
    const alFihrisOverlay = page.locator('[data-testid="al-fihris-overlay"]');

    await expect(quizQuestion).toBeVisible();
    await expect(chatbotResponse).toBeVisible();
    await expect(alFihrisOverlay).toBeVisible();

    const [quizText, chatbotText, overlayText] = await Promise.all([
      quizQuestion.innerText(),
      chatbotResponse.innerText(),
      alFihrisOverlay.innerText(),
    ]);

    expect(hasArabicText(quizText)).toBe(true);
    expect(hasArabicText(chatbotText)).toBe(true);
    expect(hasArabicText(overlayText)).toBe(true);

    expect(quizText).not.toContain('\uFFFD');
    expect(chatbotText).not.toContain('\uFFFD');
    expect(overlayText).not.toContain('\uFFFD');

    const overflow = await horizontalOverflowPx(page);
    expect(overflow).toBe(0);
  });
});
