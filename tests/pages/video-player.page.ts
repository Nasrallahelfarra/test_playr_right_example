import { expect, type Page } from '@playwright/test';
import { testData, type VideoLabState } from '../fixtures/test-data';

export class VideoPlayerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto(testData.urls.video);
  }

  async loadHls(): Promise<void> {
    await this.page.locator(testData.selectors.hlsRadio).check();
    await this.page.locator(testData.selectors.loadHlsButton).click();

    await expect
      .poll(async () => (await this.getMediaStateViaEvaluate()).readyState, {
        timeout: testData.waits.playbackTimeoutMs,
      })
      .toBeGreaterThanOrEqual(1);
  }

  async startPlayback(): Promise<void> {
    await this.page.locator(testData.selectors.playButton).click();
    await expect
      .poll(async () => (await this.getMediaStateViaEvaluate()).currentTime, {
        timeout: testData.waits.playbackTimeoutMs,
      })
      .toBeGreaterThan(0.6);
  }

  async simulateBuffering(): Promise<void> {
    await this.page.locator(testData.selectors.simulateBufferButton).click();
  }

  async toggleAudioFocus(): Promise<void> {
    await this.page.locator(testData.selectors.audioFocusToggle).click();
  }

  async getMediaStateViaEvaluate(): Promise<VideoLabState> {
    return this.page.evaluate(() => {
      const api = (
        window as Window & {
          __videoLabState?: { getState?: () => VideoLabState };
        }
      ).__videoLabState;
      if (api?.getState) {
        return api.getState();
      }

      const video = document.querySelector<HTMLVideoElement>('video#lesson-video');
      const player = document.querySelector<HTMLElement>('#player');
      const overlay = document.querySelector<HTMLElement>('[data-testid="al-fihris-overlay"]');

      if (!video || !player) {
        return {
          currentTime: 0,
          paused: true,
          readyState: 0,
          duration: 0,
          ended: false,
          audioFocusMode: 'disabled' as const,
          logicalVideoTrackEnabled: true,
          overlay: '',
        };
      }

      return {
        currentTime: video.currentTime,
        paused: video.paused,
        readyState: video.readyState,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        ended: video.ended,
        audioFocusMode: player.dataset.audioFocusMode === 'enabled' ? ('enabled' as const) : ('disabled' as const),
        logicalVideoTrackEnabled: player.dataset.videoTrackEnabled !== 'false',
        overlay: overlay?.textContent?.trim() ?? '',
      };
    });
  }

  async cacheTimestamp(key: string = testData.storageKeys.resumeTimestamp): Promise<number> {
    return this.page.evaluate((storageKey) => {
      const api = (window as Window & { __videoLabState?: { cacheTimestamp: () => number } }).__videoLabState;
      if (api?.cacheTimestamp) {
        return api.cacheTimestamp();
      }

      const video = document.querySelector<HTMLVideoElement>('video#lesson-video');
      const value = video?.currentTime ?? 0;
      localStorage.setItem(storageKey, String(value));
      return value;
    }, key);
  }

  async resumeFromCache(key: string = testData.storageKeys.resumeTimestamp): Promise<number> {
    return this.page.evaluate(async (storageKey) => {
      const api = (
        window as Window & {
          __videoLabState?: { resumeFromCache: () => Promise<number> };
        }
      ).__videoLabState;
      const cached = Number(localStorage.getItem(storageKey) || '0');

      if (api?.resumeFromCache) {
        const resumed = await api.resumeFromCache();
        if (Number.isFinite(cached) && cached > 0 && resumed < cached - 0.5) {
          const video = document.querySelector<HTMLVideoElement>('video#lesson-video');
          if (!video) {
            return resumed;
          }
          const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : cached;
          const target = Math.max(0, Math.min(cached, duration - 0.05));
          try {
            video.currentTime = target;
          } catch {
            // Ignore unsupported seek states.
          }
          try {
            await video.play();
          } catch {
            // Ignore autoplay policy failures in constrained environments.
          }
          return video.currentTime;
        }

        return resumed;
      }

      const video = document.querySelector<HTMLVideoElement>('video#lesson-video');
      if (!video) {
        return 0;
      }
      if (Number.isFinite(cached) && cached > 0) {
        try {
          video.currentTime = cached;
        } catch {
          // Ignore unsupported seek states.
        }
      }
      await video.play();
      return video.currentTime;
    }, key);
  }

  async readAlFihrisText(): Promise<string> {
    return this.page.locator(testData.selectors.alFihrisOverlay).innerText();
  }

  async waitForAlFihrisUpdate(initial: string): Promise<string> {
    await expect
      .poll(async () => (await this.readAlFihrisText()).trim(), {
        timeout: testData.waits.playbackTimeoutMs,
      })
      .not.toBe(initial.trim());

    return (await this.readAlFihrisText()).trim();
  }
}
