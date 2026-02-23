import { expect, type Locator, type Page } from '@playwright/test';
import { testData } from '../fixtures/test-data';

export type MediaState = {
  exists: boolean;
  currentTime: number;
  paused: boolean;
  readyState: number;
  duration: number;
  ended: boolean;
  videoTrackEnabled: boolean | null;
};

export class VideoPlayerPage {
  readonly page: Page;
  readonly player: Locator;
  readonly video: Locator;

  constructor(page: Page) {
    this.page = page;
    this.player = page.locator(testData.selectors.playerContainer);
    this.video = page.locator(testData.selectors.videoElement);
  }

  buildHlsUrl(manifest: string = testData.videos.hlsManifest): string {
    const base = testData.urls.streamTest;
    const manifestParam = encodeURIComponent(manifest);
    return `${base}?format=hls&manifest=${manifestParam}`;
  }

  async gotoStreamTest(manifest: string = testData.videos.hlsManifest): Promise<void> {
    await this.page.goto(this.buildHlsUrl(manifest), {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
  }

  async isCloudflareChallenge(): Promise<boolean> {
    const title = await this.page.title();
    if (/just a moment/i.test(title)) {
      return true;
    }

    const bodyText = await this.page.locator('body').innerText().catch(() => '');
    return /security verification|enable javascript and cookies to continue/i.test(bodyText);
  }

  async waitForCloudflareToSettle(): Promise<void> {
    const timeoutAt = Date.now() + testData.waits.cloudflareGraceMs;
    while (Date.now() < timeoutAt) {
      if (!(await this.isCloudflareChallenge())) {
        return;
      }
      await this.page.waitForTimeout(1_000);
    }
  }

  async dismissCookieConsentIfPresent(): Promise<void> {
    const acceptButton = this.page.locator('button:has-text("Accept")').first();
    const isVisible = await acceptButton.isVisible().catch(() => false);
    if (isVisible) {
      await acceptButton.click({ timeout: 3_000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  async ensureHlsSelected(): Promise<void> {
    const hlsRadio = this.page.locator(testData.selectors.hlsRadio);
    await hlsRadio.waitFor({ state: 'visible', timeout: 30_000 });
    const checked = await hlsRadio.isChecked();
    if (!checked) {
      await hlsRadio.check();
    }
    await this.page.locator(testData.selectors.loadSettingsButton).click();
  }

  async waitForVideoReady(): Promise<void> {
    await this.player.waitFor({ state: 'visible', timeout: 90_000 });
    await expect.poll(async () => (await this.getMediaState()).exists, {
      timeout: 60_000,
    }).toBe(true);
    await expect.poll(async () => (await this.getMediaState()).readyState, {
      timeout: 60_000,
    }).toBeGreaterThanOrEqual(2);
  }

  async getMediaState(): Promise<MediaState> {
    return this.page.evaluate((videoSelector) => {
      const video = document.querySelector<HTMLVideoElement>(videoSelector);
      if (!video) {
        return {
          exists: false,
          currentTime: 0,
          paused: true,
          readyState: 0,
          duration: 0,
          ended: false,
          videoTrackEnabled: null,
        };
      }

      const videoTracks = (video as HTMLVideoElement & { videoTracks?: { length: number; [n: number]: { enabled: boolean } } }).videoTracks;
      const videoTrackEnabled =
        videoTracks && videoTracks.length > 0 ? Boolean(videoTracks[0].enabled) : null;

      return {
        exists: true,
        currentTime: video.currentTime,
        paused: video.paused,
        readyState: video.readyState,
        duration: video.duration,
        ended: video.ended,
        videoTrackEnabled,
      };
    }, testData.selectors.videoElement);
  }

  async startPlayback(): Promise<void> {
    for (const selector of testData.selectors.playButtons) {
      const playButton = this.page.locator(selector).first();
      const exists = (await playButton.count()) > 0;
      if (!exists) {
        continue;
      }

      const isVisible = await playButton.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      await playButton.click({ force: true });
      break;
    }

    await this.page.evaluate(async (videoSelector) => {
      const video = document.querySelector<HTMLVideoElement>(videoSelector);
      if (!video) {
        throw new Error(`Video element not found: ${videoSelector}`);
      }
      try {
        await video.play();
      } catch {
        // Some environments require a real click; click path above already attempted.
      }
    }, testData.selectors.videoElement);
  }

  async waitForPlaybackProgress(minDeltaSeconds: number = 1.5): Promise<void> {
    const before = await this.getMediaState();
    await expect
      .poll(
        async () => {
          const current = await this.getMediaState();
          return current.currentTime - before.currentTime;
        },
        {
          timeout: testData.waits.progressTimeoutMs,
        },
      )
      .toBeGreaterThan(minDeltaSeconds);
  }

  async resolveFirstExistingSelector(candidates: readonly string[]): Promise<string | null> {
    for (const selector of candidates) {
      const element = this.page.locator(selector).first();
      if ((await element.count()) > 0) {
        return selector;
      }
    }
    return null;
  }

  async readOverlayText(
    preferredSelector?: string,
  ): Promise<{ selector: string | null; text: string }> {
    const selector =
      preferredSelector ??
      (await this.resolveFirstExistingSelector(testData.selectors.alFihrisOverlayCandidates));
    if (!selector) {
      return { selector: null, text: '' };
    }

    const text = await this.page
      .locator(selector)
      .first()
      .innerText()
      .catch(() => '');
    return { selector, text: text.trim() };
  }

  async waitForOverlayTextChange(initialText: string, selector: string): Promise<string> {
    await expect
      .poll(
        async () => {
          const next = await this.page
            .locator(selector)
            .first()
            .innerText()
            .catch(() => '');
          return next.trim() !== initialText.trim() && next.trim().length > 0;
        },
        {
          timeout: testData.waits.overlayTimeoutMs,
        },
      )
      .toBe(true);

    return this.page.locator(selector).first().innerText().then((text) => text.trim());
  }

  async cacheCurrentTimestamp(cacheKey: string): Promise<number> {
    const state = await this.getMediaState();
    await this.page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, String(value)),
      [cacheKey, state.currentTime] as const,
    );
    return state.currentTime;
  }

  async readCachedTimestamp(cacheKey: string): Promise<number | null> {
    const value = await this.page.evaluate((key) => window.localStorage.getItem(key), cacheKey);
    if (value === null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async seekToPercentage(percentage: number): Promise<number> {
    return this.page.evaluate(
      ([videoSelector, ratio]) => {
        const video = document.querySelector<HTMLVideoElement>(videoSelector);
        if (!video) {
          throw new Error(`Video element not found: ${videoSelector}`);
        }
        const target = video.duration * ratio;
        video.currentTime = target;
        return target;
      },
      [testData.selectors.videoElement, percentage] as const,
    );
  }

  async resumeFromCachedTimestamp(cacheKey: string): Promise<number> {
    const cached = await this.readCachedTimestamp(cacheKey);
    if (cached === null) {
      throw new Error(`No cached timestamp found in localStorage for key: ${cacheKey}`);
    }

    await this.page.evaluate(
      ([videoSelector, target]) => {
        const video = document.querySelector<HTMLVideoElement>(videoSelector);
        if (!video) {
          throw new Error(`Video element not found: ${videoSelector}`);
        }
        video.currentTime = target;
      },
      [testData.selectors.videoElement, cached] as const,
    );
    await this.startPlayback();
    return cached;
  }

  async navigateAwayAndBack(backUrl: string): Promise<void> {
    await this.page.goto(testData.urls.awayPage, { waitUntil: 'domcontentloaded' });
    await this.page.goto(backUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  }

  async capturePlayerDataAttributes(): Promise<Record<string, string>> {
    return this.page.evaluate((playerSelector) => {
      const player = document.querySelector(playerSelector);
      if (!player) {
        return {};
      }
      const attributes: Record<string, string> = {};
      for (const attribute of Array.from(player.attributes)) {
        if (attribute.name.startsWith('data-')) {
          attributes[attribute.name] = attribute.value;
        }
      }
      return attributes;
    }, testData.selectors.playerContainer);
  }

  async toggleAudioFocusModeIfPresent(): Promise<string | null> {
    const selector = await this.resolveFirstExistingSelector(
      testData.selectors.audioFocusToggleCandidates,
    );
    if (!selector) {
      return null;
    }

    await this.page.locator(selector).first().click();
    return selector;
  }
}
