// Imports needed for assertions and test runner.
// الاستيرادات اللازمة للتحقق وتشغيل الاختبارات.
import { expect, test, type Page } from '@playwright/test';

// Local route installer and shared config values.
// مُثبت المسارات المحلية وقيم الإعدادات المشتركة.
import { installLocalEducationalRoutes, testData } from '../fixtures/test-data';

// Page objects for login, dashboard navigation, and video player actions.
// كائنات الصفحات لتسجيل الدخول والتنقل في اللوحة والتحكم بمشغل الفيديو.
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { VideoPlayerPage } from '../pages/video-player.page';

// Helper function to navigate to the video lab page.
// دالة مساعدة للانتقال إلى صفحة مختبر الفيديو.
// Logs in as the first test student, navigates to dashboard, then opens the video page.
// تسجل الدخول كأول طالب اختبار، تنتقل إلى اللوحة، ثم تفتح صفحة الفيديو.
async function openVideoLab(page: Page): Promise<VideoPlayerPage> {
  // Create instances of all required page objects.
  // إنشاء نسخ من جميع كائنات الصفحات المطلوبة.
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const videoPage = new VideoPlayerPage(page);

  // Navigate to login page and authenticate.
  // الانتقال إلى صفحة تسجيل الدخول والمصادقة.
  await loginPage.goto();
  await loginPage.loginAs(testData.students[0].id);

  // Wait for dashboard to load, then click video navigation link.
  // انتظار تحميل اللوحة، ثم النقر على رابط التنقل للفيديو.
  await dashboardPage.assertLoaded();
  await dashboardPage.openVideo();

  // Return the video page object for further interactions.
  // إرجاع كائن صفحة الفيديو لمزيد من التفاعلات.
  return videoPage;
}

// ─── Test Suite: Video Player Automation | مجموعة اختبارات: أتمتة مشغل الفيديو ─────────────
// Tests HLS playback, resume from cached timestamp, and Audio Focus Mode toggle.
// تختبر تشغيل HLS، الاستئناف من الوقت المحفوظ، وتبديل وضع التركيز الصوتي.
test.describe('Video Player Automation (Local-Only)', () => {
  // Install local mock routes before each test to simulate the educational platform.
  // تثبيت المسارات المحلية الوهمية قبل كل اختبار لمحاكاة منصة التعليم.
  test.beforeEach(async ({ context }) => {
    await installLocalEducationalRoutes(context);
  });

  // Test HLS playback: verify video loads, plays, and Al-Fihris overlay updates.
  // اختبار تشغيل HLS: التأكد من التحميل والتشغيل وتحديث طبقة الفهرس.
  test('Test HLS playback: verify video loads, plays, and the Al-Fihris overlay updates', async ({
    page,
  }) => {
    // Navigate to the video lab page.
    // الانتقال إلى صفحة مختبر الفيديو.
    const videoPage = await openVideoLab(page);

    // Load HLS stream and capture initial Al-Fihris overlay text.
    // تحميل بث HLS والتقاط نص طبقة الفهرس الأولي.
    await videoPage.loadHls();
    const initialOverlay = (await videoPage.readAlFihrisText()).trim();

    // Start video playback.
    // بدء تشغيل الفيديو.
    await videoPage.startPlayback();

    // Read HTMLVideoElement state via page.evaluate()-based page object API.
    // قراءة حالة HTMLVideoElement عبر API يعتمد على page.evaluate().
    const mediaState = await videoPage.getMediaStateViaEvaluate();

    // Assert video is ready (readyState >= 2 means HAVE_CURRENT_DATA or higher).
    // التأكد من جاهزية الفيديو (readyState >= 2 يعني HAVE_CURRENT_DATA أو أعلى).
    expect(mediaState.readyState).toBeGreaterThanOrEqual(2);

    // Assert video is playing (not paused).
    // التأكد من أن الفيديو يعمل (غير متوقف).
    expect(mediaState.paused).toBe(false);

    // Assert playback has progressed (currentTime > 0).
    // التأكد من تقدم التشغيل (currentTime > 0).
    expect(mediaState.currentTime).toBeGreaterThan(0);

    // Wait for Al-Fihris overlay to update (text changes as video plays).
    // انتظار تحديث طبقة الفهرس (يتغير النص مع تشغيل الفيديو).
    const updatedOverlay = await videoPage.waitForAlFihrisUpdate(initialOverlay);

    // Assert overlay text has changed.
    // التأكد من تغير نص الطبقة.
    expect(updatedOverlay.length).toBeGreaterThan(0);
  });

  // Test resume playback: play to ~50%, navigate away/back, then resume from cached timestamp.
  // اختبار الاستئناف: تشغيل حتى ~50% ثم التنقل ذهابًا وإيابًا والاستئناف من الوقت المخزن.
  test('Test resume playback: play to 50%, navigate away, return, and resume from cached timestamp', async ({
    page,
  }) => {
    // Navigate to video lab and start playback.
    // الانتقال إلى مختبر الفيديو وبدء التشغيل.
    const videoPage = await openVideoLab(page);

    await videoPage.loadHls();
    await videoPage.startPlayback();

    // Calculate target seek position (50% of duration).
    // حساب موضع البحث المستهدف (50% من المدة).
    const beforeSeek = await videoPage.getMediaStateViaEvaluate();
    const duration = beforeSeek.duration > 0 ? beforeSeek.duration : 10;
    const target = Math.max(0.5, duration * 0.5);

    // Seek to 50% of video duration using page.evaluate() to access HTMLVideoElement.
    // الانتقال إلى 50% من مدة الفيديو باستخدام page.evaluate() للوصول إلى HTMLVideoElement.
    await page.evaluate((seekTarget) => {
      const video = document.querySelector<HTMLVideoElement>('video#lesson-video');
      if (!video) {
        return;
      }
      // Calculate safe seek position (avoid seeking past end).
      // حساب موضع بحث آمن (تجنب البحث بعد النهاية).
      const maxSeek = Number.isFinite(video.duration) && video.duration > 0 ? video.duration - 0.05 : seekTarget;
      video.currentTime = Math.max(0.1, Math.min(seekTarget, maxSeek));
    }, target);

    // Wait for seek to complete.
    // انتظار اكتمال البحث.
    await expect
      .poll(async () => (await videoPage.getMediaStateViaEvaluate()).currentTime)
      .toBeGreaterThan(target - 0.4);

    // Cache current timestamp to localStorage.
    // حفظ الوقت الحالي في localStorage.
    const cachedTimestamp = await videoPage.cacheTimestamp();
    expect(cachedTimestamp).toBeGreaterThan(0);

    // Navigate away to dashboard, then back to video page.
    // الانتقال إلى اللوحة، ثم العودة إلى صفحة الفيديو.
    await page.goto(testData.urls.dashboard);
    await page.goto(testData.urls.video);

    // Reload HLS and restore cached timestamp to localStorage.
    // إعادة تحميل HLS واستعادة الوقت المحفوظ إلى localStorage.
    await videoPage.loadHls();
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, String(value)),
      [testData.storageKeys.resumeTimestamp, cachedTimestamp] as const,
    );

    // Resume playback from cached timestamp.
    // استئناف التشغيل من الوقت المحفوظ.
    await videoPage.resumeFromCache();

    // Assert video resumed near cached timestamp (within 0.6s tolerance).
    // التأكد من استئناف الفيديو بالقرب من الوقت المحفوظ (ضمن تسامح 0.6 ثانية).
    await expect
      .poll(async () => (await videoPage.getMediaStateViaEvaluate()).currentTime)
      .toBeGreaterThan(cachedTimestamp - 0.6);

    // Assert playback continues to progress.
    // التأكد من استمرار تقدم التشغيل.
    const progressBefore = (await videoPage.getMediaStateViaEvaluate()).currentTime;
    await expect
      .poll(async () => (await videoPage.getMediaStateViaEvaluate()).currentTime)
      .toBeGreaterThan(progressBefore + 0.5);
  });

  // Test Audio Focus toggle: video track logical flag disables while audio/time keeps advancing.
  // اختبار تبديل Audio Focus: تعطيل المؤشر المنطقي لمسار الفيديو مع استمرار الصوت/الزمن.
  test('Test Audio Focus Mode toggle: assert video track disabled, audio continues, data attribute changes', async ({
    page,
  }) => {
    // Navigate to video lab and start playback.
    // الانتقال إلى مختبر الفيديو وبدء التشغيل.
    const videoPage = await openVideoLab(page);

    // Load HLS stream and start playback.
    // تحميل بث HLS وبدء التشغيل.
    await videoPage.loadHls();
    await videoPage.startPlayback();

    // Simulate buffering to ensure video is ready.
    // محاكاة التخزين المؤقت للتأكد من جاهزية الفيديو.
    await videoPage.simulateBuffering();

    // Capture media state before toggling Audio Focus Mode.
    // التقاط حالة الوسائط قبل تبديل وضع التركيز الصوتي.
    const beforeToggle = await videoPage.getMediaStateViaEvaluate();

    // Toggle Audio Focus Mode (disables video track, keeps audio playing).
    // تبديل وضع التركيز الصوتي (يعطل مسار الفيديو، يبقي الصوت يعمل).
    await videoPage.toggleAudioFocus();

    // Wait for Audio Focus Mode to be enabled.
    // انتظار تفعيل وضع التركيز الصوتي.
    await expect
      .poll(async () => (await videoPage.getMediaStateViaEvaluate()).audioFocusMode)
      .toBe('enabled');

    // Capture media state after toggling.
    // التقاط حالة الوسائط بعد التبديل.
    const afterToggle = await videoPage.getMediaStateViaEvaluate();

    // Assert video track is logically disabled.
    // التأكد من تعطيل مسار الفيديو منطقيًا.
    expect(afterToggle.logicalVideoTrackEnabled).toBe(false);

    // Assert playback time has advanced (audio continues).
    // التأكد من تقدم وقت التشغيل (الصوت مستمر).
    expect(afterToggle.currentTime).toBeGreaterThan(beforeToggle.currentTime);

    // Assert video is still playing (not paused).
    // التأكد من أن الفيديو لا يزال يعمل (غير متوقف).
    expect(afterToggle.paused).toBe(false);
  });
});
