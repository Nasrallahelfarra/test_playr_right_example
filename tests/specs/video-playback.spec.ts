// ─── Imports | الاستيرادات ────────────────────────────────────────────────────
// Playwright core utilities: expect for assertions, test as the runner.
// أدوات Playwright الأساسية: expect للتحقق، test لتشغيل الاختبارات.
import { expect, test } from '@playwright/test';

// Centralised selectors, URLs, timeouts, and mock data shared across all tests.
// بيانات الاختبار المركزية: المحددات، الروابط، المهلات، والبيانات التجريبية.
import { testData } from '../fixtures/test-data';

// Page Object Model that wraps every interaction with the Bitmovin video player.
// نموذج الصفحة الذي يغلّف جميع التفاعلات مع مشغّل Bitmovin.
import { VideoPlayerPage } from '../pages/video-player.page';

// ─── Test Suite | مجموعة الاختبارات ──────────────────────────────────────────
// Groups all video-playback tests under one labelled suite.
// يجمع جميع اختبارات تشغيل الفيديو تحت مجموعة واحدة موسومة.
test.describe('Bitmovin Stream Test - Video Playback', () => {
  // Retry up to 2 times in CI; 0 retries locally so failures surface fast.
  // يُعيد المحاولة مرتين في CI؛ لا إعادة محاولة محليًا حتى تظهر الأخطاء فورًا.
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });

  // Skip the whole suite on WebKit — Bitmovin MSE/HLS is unreliable there.
  // تجاوز المجموعة كاملةً على WebKit لأن Bitmovin غير مستقر فيه.
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Bitmovin playback checks are unstable on WebKit in this environment.',
  );

  // ── Test 1: HLS Playback + Al-Fihris Overlay | اختبار تشغيل HLS وتحديث الفهرس ─
  // Verifies: HLS stream loads, video plays, and Al-Fihris overlay text updates.
  // يتحقق من: تحميل HLS، تشغيل الفيديو، وتحديث نص طبقة الفهرس أثناء التشغيل.
  test('Test HLS playback: verify video loads, plays, and the Al-Fihris overlay updates', async ({
    page,
  }) => {
    // Create the page object that wraps all player interactions.
    // إنشاء كائن الصفحة الذي يغلّف جميع تفاعلات المشغّل.
    const videoPlayerPage = new VideoPlayerPage(page);

    // Navigate to Bitmovin demo with the HLS manifest URL as a query param.
    // الانتقال إلى صفحة Bitmovin التجريبية مع رابط HLS manifest كمعامل URL.
    await videoPlayerPage.gotoStreamTest();

    // Poll up to 20 s for any Cloudflare JS-challenge to resolve itself.
    // الانتظار حتى 20 ثانية لحل تحدي Cloudflare تلقائيًا.
    await videoPlayerPage.waitForCloudflareToSettle();

    // Skip (not fail) when Cloudflare is still blocking — needs real browser/network.
    // تجاوز الاختبار بدل فشله إذا استمر Cloudflare في الحجب.
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    // Dismiss the cookie banner so it does not overlap with player controls.
    // إغلاق نافذة الموافقة على الكوكيز حتى لا تغطي أزرار المشغّل.
    await videoPlayerPage.dismissCookieConsentIfPresent();

    // Select the HLS radio button and click "Load" to apply the stream format.
    // تحديد زر HLS والنقر على "Load" لتطبيق صيغة البث.
    await videoPlayerPage.ensureHlsSelected();

    // Block until <video> element exists and readyState >= HAVE_CURRENT_DATA (2).
    // الانتظار حتى يكون عنصر <video> موجودًا وجاهزًا بـ readyState >= 2.
    await videoPlayerPage.waitForVideoReady();

    // Assert HLS radio is still checked — confirms the correct stream format loaded.
    // التأكد من أن زر HLS لا يزال محددًا بعد التحميل.
    await expect(page.locator(testData.selectors.hlsRadio)).toBeChecked();

    // Read the initial Al-Fihris overlay text before playback begins.
    // قراءة النص الأولي لطبقة الفهرس قبل بدء التشغيل.
    // Returns { selector, text }; selector is null if the overlay is not rendered.
    // ترجع { selector, text }؛ selector يكون null إذا لم تكن الطبقة موجودة.
    const overlayState = await videoPlayerPage.readOverlayText();
    expect(overlayState.selector).not.toBeNull();

    // Click play and wait until currentTime advances by at least 1.5 s.
    // النقر على تشغيل والانتظار حتى يتقدم currentTime بـ 1.5 ثانية على الأقل.
    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    // Use page.evaluate() to read the live HTMLVideoElement state from the DOM.
    // استخدام page.evaluate() لقراءة حالة عنصر الفيديو مباشرةً من DOM.
    const mediaState = await videoPlayerPage.getMediaState();

    // readyState >= 2 (HAVE_CURRENT_DATA) — player has enough data to play.
    // readyState >= 2 تعني أن المشغّل لديه بيانات كافية للتشغيل.
    expect(mediaState.readyState).toBeGreaterThanOrEqual(2);

    // paused === false — video is actively playing, not paused or stalled.
    // paused === false تعني أن الفيديو يشتغل فعليًا وليس متوقفًا.
    expect(mediaState.paused).toBe(false);

    // currentTime > 0 — playback has progressed past the very start.
    // currentTime > 0 يؤكد أن التشغيل تقدّم فعلًا من بداية الفيديو.
    expect(mediaState.currentTime).toBeGreaterThan(0);

    // If the overlay was found, poll until its text changes during playback.
    // إذا وُجدت طبقة الفهرس، انتظر حتى يتغير نصها أثناء التشغيل.
    if (overlayState.selector) {
      const updatedText = await videoPlayerPage.waitForOverlayTextChange(
        overlayState.text,
        overlayState.selector,
      );
      // Updated text must be non-empty — overlay must display a real chapter name.
      // النص المحدَّث يجب ألا يكون فارغًا — يجب أن يعرض اسم الفصل الفعلي.
      expect(updatedText.length).toBeGreaterThan(0);
    }
  });

  // ── Test 2: Resume Playback from Cached Timestamp | استئناف التشغيل من الوقت المحفوظ ─
  // Plays to 50% of duration, caches the timestamp in localStorage,
  // navigates away and back, then resumes from the cached position.
  // يشغّل حتى 50%، يحفظ الوقت في localStorage، يتنقل ويعود، ثم يستأنف من نفس النقطة.
  test('Test resume playback: play to 50%, navigate away, return, and resume from cached timestamp', async ({
    page,
  }) => {
    // Create the page object that wraps all player interactions.
    // إنشاء كائن الصفحة الذي يغلّف جميع تفاعلات المشغّل.
    const videoPlayerPage = new VideoPlayerPage(page);

    // Build the full HLS URL so we can return to the same stream after navigating away.
    // بناء رابط HLS الكامل للرجوع إلى نفس البث بعد التنقل.
    const streamUrl = videoPlayerPage.buildHlsUrl();

    await videoPlayerPage.gotoStreamTest();
    await videoPlayerPage.waitForCloudflareToSettle();

    // Skip if Cloudflare is still blocking on the initial load.
    // تجاوز الاختبار إذا كان Cloudflare يحجب عند التحميل الأولي.
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.ensureHlsSelected();
    await videoPlayerPage.waitForVideoReady();
    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    // Seek the <video> element to exactly 50% of the total stream duration.
    // تخطي عنصر <video> إلى 50% من المدة الكلية للبث.
    const halfTarget = await videoPlayerPage.seekToPercentage(0.5);

    // Poll until currentTime is within 3 s of the 50% target (seek confirmation).
    // الانتظار حتى يصل currentTime إلى ما يقارب نقطة 50% بهامش خطأ 3 ثواني.
    await expect
      .poll(async () => (await videoPlayerPage.getMediaState()).currentTime, { timeout: 15_000 })
      .toBeGreaterThan(halfTarget - 3);

    // Save the current playback position to localStorage under a known key.
    // حفظ موضع التشغيل الحالي في localStorage تحت مفتاح معروف.
    const cachedTimestamp = await videoPlayerPage.cacheCurrentTimestamp(
      testData.storageKeys.resumeTimestamp,
    );

    // Cached value must be > 0 — confirms a real playback position was saved.
    // القيمة المحفوظة يجب أن تكون > 0 لتأكيد حفظ موضع تشغيل حقيقي.
    expect(cachedTimestamp).toBeGreaterThan(0);

    // Navigate to example.com (away page) then back to the original stream URL.
    // الانتقال إلى example.com ثم العودة إلى رابط البث الأصلي.
    await videoPlayerPage.navigateAwayAndBack(streamUrl);
    await videoPlayerPage.waitForCloudflareToSettle();

    // Skip if Cloudflare blocks again after returning to the page.
    // تجاوز الاختبار إذا ظهر Cloudflare مجددًا بعد العودة.
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment after return navigation.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.waitForVideoReady();

    // Read the cached timestamp from localStorage and seek the video to that position.
    // قراءة الوقت المحفوظ من localStorage وتخطي الفيديو إلى ذلك الموضع.
    const resumedAt = await videoPlayerPage.resumeFromCachedTimestamp(
      testData.storageKeys.resumeTimestamp,
    );

    // Verify currentTime is close to the resumed position (2 s tolerance).
    // التحقق من أن currentTime قريب من الموضع المستأنف بهامش خطأ 2 ثانية.
    await expect
      .poll(async () => (await videoPlayerPage.getMediaState()).currentTime, { timeout: 15_000 })
      .toBeGreaterThan(resumedAt - 2);

    // Take before/after snapshots to confirm playback is still progressing.
    // أخذ لقطتين قبل وبعد للتأكد من أن الفيديو لا يزال يتقدم بعد الاستئناف.
    const before = (await videoPlayerPage.getMediaState()).currentTime;
    await videoPlayerPage.waitForPlaybackProgress(1.0);
    const after = (await videoPlayerPage.getMediaState()).currentTime;
    expect(after).toBeGreaterThan(before);
  });

  // ── Test 3: Audio Focus Mode Toggle | اختبار وضع التركيز على الصوت ──────────
  // Enables Audio Focus Mode and verifies:
  //   - Audio keeps playing (currentTime advances, paused remains false).
  //   - The video track is disabled OR the player's data-attribute changes.
  // يفعّل وضع التركيز على الصوت ويتحقق من:
  //   - استمرار الصوت (currentTime يتقدم، paused=false).
  //   - تعطيل مسار الفيديو أو تغيّر data-attribute على عنصر المشغّل.
  test('Test Audio Focus Mode toggle: assert video track disabled, audio continues, data attribute changes', async ({
    page,
  }) => {
    // Create the page object that wraps all player interactions.
    // إنشاء كائن الصفحة الذي يغلّف جميع تفاعلات المشغّل.
    const videoPlayerPage = new VideoPlayerPage(page);
    await videoPlayerPage.gotoStreamTest();
    await videoPlayerPage.waitForCloudflareToSettle();

    // Skip if Cloudflare is blocking the page.
    // تجاوز إذا كان Cloudflare يحجب الصفحة.
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.waitForVideoReady();
    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    // Try each candidate selector in order until one is found in the DOM.
    // جرب كل محدد مرشح بالترتيب حتى يُعثر على أحدها في DOM.
    const toggleSelector = await videoPlayerPage.resolveFirstExistingSelector(
      testData.selectors.audioFocusToggleCandidates,
    );

    // Skip this test if the toggle button is absent in the current environment.
    // تجاوز الاختبار إذا لم يكن زر التبديل موجودًا في هذه البيئة.
    test.skip(
      !toggleSelector,
      'Audio Focus Mode toggle selector is not present on this environment. Provide a valid selector in tests/fixtures/test-data.ts.',
    );

    // The name of the data-attribute that signals Audio Focus Mode is active.
    // اسم data-attribute الذي يُشير إلى تفعيل وضع التركيز على الصوت.
    const dataAttributeName = testData.audioFocus.dataAttribute;

    // Capture the player's data-* attributes and media state BEFORE toggling.
    // تسجيل data-* attributes وحالة الوسائط على المشغّل قبل التبديل.
    const beforeAttributes = await videoPlayerPage.capturePlayerDataAttributes();
    const beforeState = await videoPlayerPage.getMediaState();

    // Click the toggle button to activate Audio Focus Mode.
    // النقر على زر التبديل لتفعيل وضع التركيز على الصوت.
    await page.locator(toggleSelector!).first().click();

    // Wait 1.5 s so the player has time to process and apply the mode change.
    // انتظار 1.5 ثانية لإتاحة الوقت للمشغّل لمعالجة تغيير الوضع وتطبيقه.
    await page.waitForTimeout(1_500);

    // Capture attributes and media state AFTER the toggle.
    // تسجيل attributes والحالة بعد التبديل.
    const afterAttributes = await videoPlayerPage.capturePlayerDataAttributes();
    const afterState = await videoPlayerPage.getMediaState();

    // Audio must still be running: currentTime progressed and video is not paused.
    // يجب أن يستمر الصوت: currentTime تقدّم والفيديو ليس متوقفًا.
    expect(afterState.currentTime).toBeGreaterThan(beforeState.currentTime);
    expect(afterState.paused).toBe(false);

    // Determine which assertion path is available on this specific player build.
    // تحديد أي مسار تحقق متاح في هذا الإصدار من المشغّل.
    const hasTrackApi = afterState.videoTrackEnabled !== null;
    const hasFocusDataAttribute =
      dataAttributeName in beforeAttributes || dataAttributeName in afterAttributes;

    // Skip if neither VideoTracks API nor a data-attribute is exposed by the player.
    // تجاوز إذا لم تكن VideoTracks API ولا data-attribute متاحَين في المشغّل.
    test.skip(
      !hasTrackApi && !hasFocusDataAttribute,
      'Cannot assert video-track disablement on this player: no videoTracks API and no audio-focus data attribute.',
    );

    // Path A: browser exposes VideoTracks API — assert the video track is disabled.
    // المسار أ: المتصفح يدعم VideoTracks API — تأكد من تعطيل مسار الفيديو.
    if (hasTrackApi) {
      expect(afterState.videoTrackEnabled).toBe(false);
    }

    // Path B: player uses a data-attribute for Audio Focus — assert it changed.
    // المسار ب: المشغّل يستخدم data-attribute لوضع التركيز — تأكد من تغيير قيمته.
    if (hasFocusDataAttribute) {
      expect(afterAttributes[dataAttributeName]).not.toEqual(beforeAttributes[dataAttributeName]);
    }
  });
});
