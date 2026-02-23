import { expect, test } from '@playwright/test';
import { testData } from '../fixtures/test-data';
import { VideoPlayerPage } from '../pages/video-player.page';

test.describe('Bitmovin Stream Test - Video Playback', () => {
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Bitmovin playback checks are unstable on WebKit in this environment.',
  );

  // يتحقق من تحميل HLS وتشغيل الفيديو وتغيّر نص طبقة Al-Fihris أثناء التشغيل.
  test('Test HLS playback: verify video loads, plays, and the Al-Fihris overlay updates', async ({
    page,
  }) => {
    const videoPlayerPage = new VideoPlayerPage(page);
    await videoPlayerPage.gotoStreamTest();
    await videoPlayerPage.waitForCloudflareToSettle();

    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.ensureHlsSelected();
    await videoPlayerPage.waitForVideoReady();

    await expect(page.locator(testData.selectors.hlsRadio)).toBeChecked();

    const overlayState = await videoPlayerPage.readOverlayText();
    expect(overlayState.selector).not.toBeNull();

    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    const mediaState = await videoPlayerPage.getMediaState();
    expect(mediaState.readyState).toBeGreaterThanOrEqual(2);
    expect(mediaState.paused).toBe(false);
    expect(mediaState.currentTime).toBeGreaterThan(0);

    if (overlayState.selector) {
      const updatedText = await videoPlayerPage.waitForOverlayTextChange(
        overlayState.text,
        overlayState.selector,
      );
      expect(updatedText.length).toBeGreaterThan(0);
    }
  });

  // يشغّل الفيديو حتى منتصفه ثم يحفظ الوقت ويتأكد من استئناف التشغيل من نفس النقطة بعد الرجوع.
  test('Test resume playback: play to 50%, navigate away, return, and resume from cached timestamp', async ({
    page,
  }) => {
    const videoPlayerPage = new VideoPlayerPage(page);
    const streamUrl = videoPlayerPage.buildHlsUrl();

    await videoPlayerPage.gotoStreamTest();
    await videoPlayerPage.waitForCloudflareToSettle();
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.ensureHlsSelected();
    await videoPlayerPage.waitForVideoReady();
    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    const halfTarget = await videoPlayerPage.seekToPercentage(0.5);
    await expect
      .poll(async () => (await videoPlayerPage.getMediaState()).currentTime, { timeout: 15_000 })
      .toBeGreaterThan(halfTarget - 3);

    const cachedTimestamp = await videoPlayerPage.cacheCurrentTimestamp(
      testData.storageKeys.resumeTimestamp,
    );
    expect(cachedTimestamp).toBeGreaterThan(0);

    await videoPlayerPage.navigateAwayAndBack(streamUrl);
    await videoPlayerPage.waitForCloudflareToSettle();
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment after return navigation.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.waitForVideoReady();

    const resumedAt = await videoPlayerPage.resumeFromCachedTimestamp(
      testData.storageKeys.resumeTimestamp,
    );
    await expect
      .poll(async () => (await videoPlayerPage.getMediaState()).currentTime, { timeout: 15_000 })
      .toBeGreaterThan(resumedAt - 2);

    const before = (await videoPlayerPage.getMediaState()).currentTime;
    await videoPlayerPage.waitForPlaybackProgress(1.0);
    const after = (await videoPlayerPage.getMediaState()).currentTime;
    expect(after).toBeGreaterThan(before);
  });

  // يفعّل Audio Focus Mode ويتأكد من استمرار الصوت وتغيّر حالة track/data-attribute إن كانت متاحة.
  test('Test Audio Focus Mode toggle: assert video track disabled, audio continues, data attribute changes', async ({
    page,
  }) => {
    const videoPlayerPage = new VideoPlayerPage(page);
    await videoPlayerPage.gotoStreamTest();
    await videoPlayerPage.waitForCloudflareToSettle();
    test.skip(
      await videoPlayerPage.isCloudflareChallenge(),
      'Cloudflare challenge blocked the test environment. Run in headed mode or with a trusted network.',
    );

    await videoPlayerPage.dismissCookieConsentIfPresent();
    await videoPlayerPage.waitForVideoReady();
    await videoPlayerPage.startPlayback();
    await videoPlayerPage.waitForPlaybackProgress();

    const toggleSelector = await videoPlayerPage.resolveFirstExistingSelector(
      testData.selectors.audioFocusToggleCandidates,
    );
    test.skip(
      !toggleSelector,
      'Audio Focus Mode toggle selector is not present on this environment. Provide a valid selector in tests/fixtures/test-data.ts.',
    );

    const dataAttributeName = testData.audioFocus.dataAttribute;
    const beforeAttributes = await videoPlayerPage.capturePlayerDataAttributes();
    const beforeState = await videoPlayerPage.getMediaState();

    await page.locator(toggleSelector!).first().click();
    await page.waitForTimeout(1_500);

    const afterAttributes = await videoPlayerPage.capturePlayerDataAttributes();
    const afterState = await videoPlayerPage.getMediaState();

    expect(afterState.currentTime).toBeGreaterThan(beforeState.currentTime);
    expect(afterState.paused).toBe(false);

    const hasTrackApi = afterState.videoTrackEnabled !== null;
    const hasFocusDataAttribute =
      dataAttributeName in beforeAttributes || dataAttributeName in afterAttributes;

    test.skip(
      !hasTrackApi && !hasFocusDataAttribute,
      'Cannot assert video-track disablement on this player: no videoTracks API and no audio-focus data attribute.',
    );

    if (hasTrackApi) {
      expect(afterState.videoTrackEnabled).toBe(false);
    }
    if (hasFocusDataAttribute) {
      expect(afterAttributes[dataAttributeName]).not.toEqual(beforeAttributes[dataAttributeName]);
    }
  });
});
