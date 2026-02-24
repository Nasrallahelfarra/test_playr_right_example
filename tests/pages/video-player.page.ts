// ─── Imports | الاستيرادات ────────────────────────────────────────────────────
// Playwright core: expect for polling assertions, Locator and Page for typing.
// أدوات Playwright الأساسية: expect للتحقق، Locator وPage للتنميط.
import { expect, type Locator, type Page } from '@playwright/test';

// Shared test configuration: selectors, URLs, storage keys, and timeouts.
// إعداد الاختبار المشترك: محددات، روابط، مفاتيح التخزين، والمهل الزمنية.
import { testData } from '../fixtures/test-data';

// ─── MediaState Type | نوع MediaState ────────────────────────────────────────
// Snapshot of the HTMLVideoElement's key runtime properties read via page.evaluate().
// لقطة من خصائص HTMLVideoElement الرئيسية في وقت التشغيل تُقرأ عبر page.evaluate().
export type MediaState = {
  // Whether the <video> element exists in the DOM.
  // هل يوجد عنصر <video> في DOM.
  exists: boolean;
  // Current playback position in seconds.
  // موضع التشغيل الحالي بالثواني.
  currentTime: number;
  // Whether playback is currently paused.
  // هل التشغيل متوقف حاليًا.
  paused: boolean;
  // HTMLMediaElement.readyState (0–4); ≥ 2 means enough data to play.
  // HTMLMediaElement.readyState (0–4)؛ ≥ 2 يعني توفر بيانات كافية للتشغيل.
  readyState: number;
  // Total duration of the media in seconds.
  // المدة الكلية للميديا بالثواني.
  duration: number;
  // Whether playback has reached the end.
  // هل وصل التشغيل إلى النهاية.
  ended: boolean;
  // Whether the first video track is enabled; null if the browser exposes no videoTracks API.
  // هل المسار المرئي الأول مفعّل؛ null إذا لم يكشف المتصفح عن videoTracks API.
  videoTrackEnabled: boolean | null;
};

// ─── Page Object | كائن الصفحة ───────────────────────────────────────────────
// VideoPlayerPage wraps all interactions with the Bitmovin stream-test demo page.
// It is used by every video-playback test to avoid duplicating navigation and
// DOM evaluation logic in multiple spec files.
// يُغلّف VideoPlayerPage جميع التفاعلات مع صفحة عرض Bitmovin التجريبية.
// تستخدمه جميع اختبارات تشغيل الفيديو لتجنب تكرار منطق التنقل وتقييم DOM.
export class VideoPlayerPage {
  // The raw Playwright Page object used for navigation and evaluate() calls.
  // كائن Playwright Page الخام المستخدم للتنقل واستدعاءات evaluate().
  readonly page: Page;

  // Locator for the outer player container element (#player).
  // محدد موضع حاوية المشغّل الخارجية (#player).
  readonly player: Locator;

  // Locator for the <video> element rendered by Bitmovin inside the player.
  // محدد موضع عنصر <video> الذي يُصيّره Bitmovin داخل المشغّل.
  readonly video: Locator;

  // Initialises the two shared locators from the testData selectors.
  // يُهيّئ المحددَين المشتركَين من محددات testData.
  constructor(page: Page) {
    this.page = page;
    this.player = page.locator(testData.selectors.playerContainer);
    this.video = page.locator(testData.selectors.videoElement);
  }

  // Builds the full stream-test URL with the HLS format and the given manifest URL.
  // يبني رابط stream-test الكامل مع تنسيق HLS ورابط manifest المعطى.
  // manifest defaults to the HLS test stream defined in testData.
  // manifest يعود إلى مجرى HLS التجريبي المعرّف في testData.
  buildHlsUrl(manifest: string = testData.videos.hlsManifest): string {
    const base = testData.urls.streamTest;
    const manifestParam = encodeURIComponent(manifest);
    return `${base}?format=hls&manifest=${manifestParam}`;
  }

  // Navigates the browser to the Bitmovin stream-test page configured for HLS.
  // يُوجّه المتصفح إلى صفحة Bitmovin stream-test المُهيأة لـ HLS.
  // Waits only for domcontentloaded to avoid hanging on long network requests.
  // ينتظر فقط domcontentloaded لتجنب التوقف عند الطلبات الشبكية الطويلة.
  async gotoStreamTest(manifest: string = testData.videos.hlsManifest): Promise<void> {
    await this.page.goto(this.buildHlsUrl(manifest), {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
  }

  // Returns true if the current page shows a Cloudflare anti-bot challenge.
  // يرجع true إذا كانت الصفحة الحالية تعرض تحدي Cloudflare لمكافحة الروبوتات.
  // Checks both the page title ("Just a moment") and body text patterns.
  // يفحص عنوان الصفحة ("Just a moment") وأنماط نص الجسم.
  async isCloudflareChallenge(): Promise<boolean> {
    const title = await this.page.title();
    if (/just a moment/i.test(title)) {
      return true;
    }

    // Also catch body-text variants of the Cloudflare challenge page.
    // اصطياد أيضًا متغيرات نص الجسم لصفحة تحدي Cloudflare.
    const bodyText = await this.page.locator('body').innerText().catch(() => '');
    return /security verification|enable javascript and cookies to continue/i.test(bodyText);
  }

  // Polls isCloudflareChallenge() until it returns false or the grace period expires.
  // يُستطلع isCloudflareChallenge() حتى تعود بـ false أو تنتهي فترة السماح.
  // Cloudflare typically clears within a few seconds for headed browsers.
  // يُزيل Cloudflare عادةً خلال ثوانٍ قليلة للمتصفحات ذات الواجهة الرسومية.
  async waitForCloudflareToSettle(): Promise<void> {
    const timeoutAt = Date.now() + testData.waits.cloudflareGraceMs;
    while (Date.now() < timeoutAt) {
      if (!(await this.isCloudflareChallenge())) {
        return;
      }
      await this.page.waitForTimeout(1_000);
    }
  }

  // Clicks the cookie consent "Accept" button if it is visible on the page.
  // ينقر على زر "Accept" لموافقة الكوكيز إذا كان مرئيًا على الصفحة.
  // Silently ignores click timeouts — the consent may already be dismissed.
  // يتجاهل بصمت مهل النقر — قد تكون الموافقة قد رُفضت بالفعل.
  async dismissCookieConsentIfPresent(): Promise<void> {
    const acceptButton = this.page.locator('button:has-text("Accept")').first();
    const isVisible = await acceptButton.isVisible().catch(() => false);
    if (isVisible) {
      await acceptButton.click({ timeout: 3_000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  // Ensures the HLS radio button is selected and triggers loading the stream settings.
  // يتأكد من تحديد زر راديو HLS ويشغّل تحميل إعدادات البث.
  // Clicks the "Load" button so the player initialises the HLS manifest.
  // ينقر زر "Load" حتى يبدأ المشغّل في تهيئة manifest لـ HLS.
  async ensureHlsSelected(): Promise<void> {
    const hlsRadio = this.page.locator(testData.selectors.hlsRadio);
    await hlsRadio.waitFor({ state: 'visible', timeout: 30_000 });
    const checked = await hlsRadio.isChecked();
    if (!checked) {
      await hlsRadio.check();
    }
    await this.page.locator(testData.selectors.loadSettingsButton).click();
  }

  // Waits until the player container is visible AND the video element has loaded
  // enough data to begin playback (readyState ≥ 2 = HAVE_CURRENT_DATA).
  // ينتظر حتى تصبح حاوية المشغّل مرئية وحتى يحمّل عنصر الفيديو بيانات كافية
  // لبدء التشغيل (readyState ≥ 2 = HAVE_CURRENT_DATA).
  async waitForVideoReady(): Promise<void> {
    await this.player.waitFor({ state: 'visible', timeout: 90_000 });
    await expect.poll(async () => (await this.getMediaState()).exists, {
      timeout: 60_000,
    }).toBe(true);
    await expect.poll(async () => (await this.getMediaState()).readyState, {
      timeout: 60_000,
    }).toBeGreaterThanOrEqual(2);
  }

  // Reads the live state of the <video> element from the browser DOM via page.evaluate().
  // يقرأ الحالة الحية لعنصر <video> من DOM المتصفح عبر page.evaluate().
  // Returns a full MediaState snapshot; returns an "empty" state if the element is absent.
  // يرجع لقطة MediaState كاملة؛ يرجع حالة "فارغة" إذا كان العنصر غائبًا.
  async getMediaState(): Promise<MediaState> {
    return this.page.evaluate((videoSelector) => {
      const video = document.querySelector<HTMLVideoElement>(videoSelector);

      // If the <video> element doesn't exist yet, return a default "not found" state.
      // إذا لم يكن عنصر <video> موجودًا بعد، أرجع حالة "غير موجود" افتراضية.
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

      // videoTracks is a non-standard API — cast defensively and check length before access.
      // videoTracks واجهة برمجية غير معيارية — يُلقى بحذر ويُفحص الطول قبل الوصول.
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

  // Attempts to start playback by trying each play-button selector in order,
  // then falls back to calling video.play() directly via page.evaluate().
  // يحاول بدء التشغيل بتجربة كل محدد زر تشغيل بالترتيب،
  // ثم يلجأ إلى استدعاء video.play() مباشرةً عبر page.evaluate().
  async startPlayback(): Promise<void> {
    for (const selector of testData.selectors.playButtons) {
      const playButton = this.page.locator(selector).first();

      // Skip selectors that don't match any element in the current DOM.
      // تجاوز المحددات التي لا تطابق أي عنصر في DOM الحالي.
      const exists = (await playButton.count()) > 0;
      if (!exists) {
        continue;
      }

      // Skip buttons that exist but are hidden (e.g., collapsed player controls).
      // تجاوز الأزرار الموجودة لكنها مخفية (مثل عناصر تحكم المشغّل المطوية).
      const isVisible = await playButton.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      // Click the first visible play button found and stop trying further selectors.
      // النقر على أول زر تشغيل مرئي يُعثر عليه والتوقف عن تجربة المحددات الأخرى.
      await playButton.click({ force: true });
      break;
    }

    // Programmatically call video.play() as a fallback — some test environments block
    // UI clicks due to browser autoplay policies or missing user gesture requirements.
    // استدعاء video.play() برمجيًا كخيار احتياطي — بعض بيئات الاختبار تحجب
    // نقرات واجهة المستخدم بسبب سياسات التشغيل التلقائي أو متطلبات إيماءة المستخدم.
    await this.page.evaluate(async (videoSelector) => {
      const video = document.querySelector<HTMLVideoElement>(videoSelector);
      if (!video) {
        throw new Error(`Video element not found: ${videoSelector}`);
      }
      try {
        await video.play();
      } catch {
        // Some environments require a real click; click path above already attempted.
        // بعض البيئات تتطلب نقرة حقيقية؛ مسار النقر أعلاه جُرِّب بالفعل.
      }
    }, testData.selectors.videoElement);
  }

  // Polls currentTime until it has advanced by at least minDeltaSeconds from the snapshot
  // taken at the start of the call — confirms the video is actually playing, not frozen.
  // يستطلع currentTime حتى يتقدم بمقدار minDeltaSeconds على الأقل من اللقطة المأخوذة
  // في بداية الاستدعاء — يؤكد أن الفيديو يُشغَّل فعليًا وليس متجمدًا.
  async waitForPlaybackProgress(minDeltaSeconds: number = 1.5): Promise<void> {
    const before = await this.getMediaState();
    await expect
      .poll(
        async () => {
          const current = await this.getMediaState();
          // Return the elapsed seconds since the snapshot — must exceed minDeltaSeconds.
          // إرجاع الثواني المنقضية منذ اللقطة — يجب أن تتجاوز minDeltaSeconds.
          return current.currentTime - before.currentTime;
        },
        {
          timeout: testData.waits.progressTimeoutMs,
        },
      )
      .toBeGreaterThan(minDeltaSeconds);
  }

  // Iterates through a list of CSS selector candidates and returns the first one
  // that matches at least one element in the current DOM.
  // يُكرر عبر قائمة محددات CSS المرشحة ويرجع أول محدد يطابق عنصرًا واحدًا على الأقل في DOM الحالي.
  // Returns null if none of the candidates match anything.
  // يرجع null إذا لم يطابق أي من المرشحين أي شيء.
  async resolveFirstExistingSelector(candidates: readonly string[]): Promise<string | null> {
    for (const selector of candidates) {
      const element = this.page.locator(selector).first();
      if ((await element.count()) > 0) {
        return selector;
      }
    }
    return null;
  }

  // Reads the text from the Al-Fihris overlay element (chapter/topic marker).
  // يقرأ النص من عنصر تراكب Al-Fihris (علامة الفصل/الموضوع).
  // Uses the preferredSelector if supplied; otherwise resolves the first existing
  // candidate from testData.selectors.alFihrisOverlayCandidates.
  // يستخدم preferredSelector إذا أُعطي؛ وإلا يحل أول مرشح موجود من alFihrisOverlayCandidates.
  // Returns { selector: null, text: '' } if no overlay element is found.
  // يرجع { selector: null, text: '' } إذا لم يُعثر على عنصر تراكب.
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

  // Polls the overlay element until its text differs from initialText AND is non-empty.
  // يستطلع عنصر التراكب حتى يختلف نصه عن initialText وأن يكون غير فارغ.
  // Used to confirm the Al-Fihris overlay updated to a new chapter/topic title.
  // يُستخدم للتأكد من تحديث تراكب Al-Fihris إلى عنوان فصل/موضوع جديد.
  // Returns the final (changed) overlay text.
  // يرجع النص النهائي (المتغيّر) للتراكب.
  async waitForOverlayTextChange(initialText: string, selector: string): Promise<string> {
    await expect
      .poll(
        async () => {
          const next = await this.page
            .locator(selector)
            .first()
            .innerText()
            .catch(() => '');
          // Condition: text changed AND is not empty.
          // الشرط: النص تغيّر وليس فارغًا.
          return next.trim() !== initialText.trim() && next.trim().length > 0;
        },
        {
          timeout: testData.waits.overlayTimeoutMs,
        },
      )
      .toBe(true);

    return this.page.locator(selector).first().innerText().then((text) => text.trim());
  }

  // Reads the current video timestamp and saves it to localStorage under cacheKey.
  // يقرأ ختم الوقت الحالي للفيديو ويحفظه في localStorage تحت cacheKey.
  // Returns the saved timestamp (in seconds) so the caller can assert against it later.
  // يرجع الختم الزمني المحفوظ (بالثواني) ليتحقق منه المستدعي لاحقًا.
  async cacheCurrentTimestamp(cacheKey: string): Promise<number> {
    const state = await this.getMediaState();
    await this.page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, String(value)),
      [cacheKey, state.currentTime] as const,
    );
    return state.currentTime;
  }

  // Reads and parses the timestamp stored in localStorage under cacheKey.
  // يقرأ ويحلل الختم الزمني المخزن في localStorage تحت cacheKey.
  // Returns null if the key is absent or the value is not a finite number.
  // يرجع null إذا كان المفتاح غائبًا أو القيمة ليست رقمًا محدودًا.
  async readCachedTimestamp(cacheKey: string): Promise<number | null> {
    const value = await this.page.evaluate((key) => window.localStorage.getItem(key), cacheKey);
    if (value === null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Sets video.currentTime to (duration × percentage) via page.evaluate().
  // يضبط video.currentTime على (duration × percentage) عبر page.evaluate().
  // Used to seek to a specific progress point (e.g., 0.5 = 50% of the video).
  // يُستخدم للانتقال إلى نقطة تقدم محددة (مثل 0.5 = 50% من الفيديو).
  // Returns the absolute time target in seconds.
  // يرجع الهدف الزمني المطلق بالثواني.
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

  // Reads the cached timestamp from localStorage and seeks the video to that position,
  // then calls startPlayback() so the video resumes from exactly where it was left off.
  // يقرأ الختم الزمني المخبّأ من localStorage ويضبط الفيديو على ذلك الموضع،
  // ثم يستدعي startPlayback() ليستأنف الفيديو من النقطة التي توقف عندها بالضبط.
  // Throws if no cached value is found — the cache step must precede this call.
  // يرمي خطأ إذا لم تُوجد قيمة مخبّأة — يجب أن تسبق خطوة التخبئة هذا الاستدعاء.
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
        // Seek to the cached position before resuming playback.
        // الانتقال إلى الموضع المخبّأ قبل استئناف التشغيل.
        video.currentTime = target;
      },
      [testData.selectors.videoElement, cached] as const,
    );
    await this.startPlayback();
    return cached;
  }

  // Navigates away to a neutral page (example.com) then back to backUrl.
  // ينتقل بعيدًا إلى صفحة محايدة (example.com) ثم يعود إلى backUrl.
  // Simulates a user leaving and returning, triggering page lifecycle events
  // and clearing in-memory state (while keeping localStorage intact).
  // يحاكي مستخدمًا يغادر ويعود، مما يُشغّل أحداث دورة حياة الصفحة
  // ويمسح الحالة في الذاكرة (مع الاحتفاظ بـ localStorage سليمة).
  async navigateAwayAndBack(backUrl: string): Promise<void> {
    await this.page.goto(testData.urls.awayPage, { waitUntil: 'domcontentloaded' });
    await this.page.goto(backUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  }

  // Reads all data-* attributes from the player container element via page.evaluate().
  // يقرأ جميع سمات data-* من عنصر حاوية المشغّل عبر page.evaluate().
  // Returns a plain object mapping attribute name → value.
  // يرجع كائنًا بسيطًا يربط اسم السمة ← قيمتها.
  // Returns an empty object {} if the player element is not found.
  // يرجع كائنًا فارغًا {} إذا لم يُعثر على عنصر المشغّل.
  async capturePlayerDataAttributes(): Promise<Record<string, string>> {
    return this.page.evaluate((playerSelector) => {
      const player = document.querySelector(playerSelector);
      if (!player) {
        return {};
      }
      const attributes: Record<string, string> = {};
      for (const attribute of Array.from(player.attributes)) {
        // Only collect data-* attributes — ignore class, id, aria-*, etc.
        // جمع سمات data-* فقط — تجاهل class وid وaria-* وغيرها.
        if (attribute.name.startsWith('data-')) {
          attributes[attribute.name] = attribute.value;
        }
      }
      return attributes;
    }, testData.selectors.playerContainer);
  }

  // Finds and clicks the Audio Focus Mode toggle button if it exists in the DOM.
  // يجد وينقر زر تبديل وضع التركيز الصوتي إذا كان موجودًا في DOM.
  // Tries multiple selector candidates from testData.selectors.audioFocusToggleCandidates.
  // يجرب محددات متعددة من testData.selectors.audioFocusToggleCandidates.
  // Returns the matched selector string, or null if the toggle is not present.
  // يرجع سلسلة المحدد المطابق، أو null إذا لم يكن التبديل موجودًا.
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
