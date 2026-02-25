// ─── Imports | الاستيرادات ────────────────────────────────────────────────────────────────────
// Playwright configuration builder and device presets.
// أداة بناء إعداد Playwright والإعدادات المسبقة للأجهزة.
import { defineConfig, devices } from '@playwright/test';

// ─── Playwright Configuration | إعداد Playwright ─────────────────────────────────────────────
// Central configuration for all Playwright test runs in this project.
// الإعداد المركزي لجميع تشغيلات اختبار Playwright في هذا المشروع.
export default defineConfig({
  // Directory containing all test spec files.
  // المجلد الذي يحتوي على جميع ملفات مواصفات الاختبار.
  testDir: './specs',

  // Disable full parallelism — tests run sequentially to avoid race conditions.
  // تعطيل التوازي الكامل — تُشغَّل الاختبارات بالتسلسل لتجنب حالات السباق.
  fullyParallel: false,

  // Number of parallel workers: 1 in CI for stability, auto-detect locally.
  // عدد العمال المتوازيين: 1 في CI للاستقرار، كشف تلقائي محليًا.
  workers: process.env.CI ? 1 : undefined,

  // Retry failed tests once in CI, no retries locally.
  // إعادة محاولة الاختبارات الفاشلة مرة واحدة في CI، بدون إعادة محاولة محليًا.
  retries: process.env.CI ? 1 : 0,

  // Global timeout for each test: 2 minutes (120,000 ms).
  // المهلة الزمنية العامة لكل اختبار: دقيقتان (120,000 مللي-ثانية).
  timeout: 120_000,

  // ─── Expect Configuration | إعداد Expect ─────────────────────────────────────────────────────
  expect: {
    // Timeout for each expect() assertion: 20 seconds.
    // المهلة الزمنية لكل تأكيد expect(): 20 ثانية.
    timeout: 20_000,
  },

  // ─── Reporters | المُبلِّغون ──────────────────────────────────────────────────────────────────
  // Output formats: console list + HTML report (never auto-opens).
  // تنسيقات الإخراج: قائمة وحدة التحكم + تقرير HTML (لا يُفتح تلقائيًا أبدًا).
  reporter: [['list'], ['html', { open: 'never' }]],

  // ─── Global Browser Options | خيارات المتصفح العامة ──────────────────────────────────────────
  use: {
    // Run headless in CI, headed (visible browser) locally.
    // تشغيل بدون رأس في CI، مع رأس (متصفح مرئي) محليًا.
    headless: !!process.env.CI,

    // Timeout for individual actions (click, fill, etc.): 15 seconds.
    // المهلة الزمنية للإجراءات الفردية (نقر، ملء، إلخ): 15 ثانية.
    actionTimeout: 15_000,

    // Timeout for page navigations (goto, waitForURL, etc.): 60 seconds.
    // المهلة الزمنية لتنقلات الصفحة (goto، waitForURL، إلخ): 60 ثانية.
    navigationTimeout: 60_000,

    // Capture screenshots only when a test fails.
    // التقاط لقطات الشاشة فقط عند فشل الاختبار.
    screenshot: 'only-on-failure',

    // Video recording: retain on failure in CI, on first retry locally.
    // تسجيل الفيديو: الاحتفاظ عند الفشل في CI، عند أول إعادة محاولة محليًا.
    video: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    // Trace recording: retain on failure in CI, on first retry locally.
    // تسجيل التتبع: الاحتفاظ عند الفشل في CI، عند أول إعادة محاولة محليًا.
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },

  // ─── Snapshot Path Template | قالب مسار اللقطات ────────────────────────────────────────────
  // Defines where screenshot snapshots are stored for visual regression tests.
  // يحدد مكان تخزين لقطات الشاشة لاختبارات الانحدار البصري.
  snapshotPathTemplate:
    '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',

  // ─── Test Projects | مشاريع الاختبار ──────────────────────────────────────────────────────────
  // Each project runs the same tests on a different browser/device configuration.
  // كل مشروع يشغّل نفس الاختبارات على إعداد متصفح/جهاز مختلف.
  projects: [
    {
      // Desktop Chrome on Windows/Mac/Linux.
      // Chrome سطح المكتب على Windows/Mac/Linux.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Mobile Chrome on Pixel 5 emulator.
      // Chrome للجوال على محاكي Pixel 5.
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      // Mobile Safari on iPhone 13 emulator.
      // Safari للجوال على محاكي iPhone 13.
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
