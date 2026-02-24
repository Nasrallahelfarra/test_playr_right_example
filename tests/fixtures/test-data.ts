// ─── Shared Test Configuration | إعداد الاختبار المشترك ─────────────────────
// Central repository for all URLs, selectors, storage keys, and wait timeouts
// used across every test suite in the project.
// مستودع مركزي لجميع الروابط والمحددات ومفاتيح التخزين والمهل الزمنية
// المستخدمة في جميع مجموعات الاختبار في المشروع.
export const testData = {

  // ── URLs | الروابط ────────────────────────────────────────────────────────
  urls: {
    // Bitmovin stream-test demo page — the main page under test for HLS playback.
    // صفحة Bitmovin stream-test التجريبية — الصفحة الرئيسية المختبَرة لتشغيل HLS.
    streamTest: 'https://bitmovin.com/demos/stream-test',

    // Neutral away-page used to trigger a full page unload during resume tests.
    // صفحة بعيدة محايدة لتشغيل إلغاء تحميل كامل للصفحة أثناء اختبارات الاستئناف.
    awayPage: 'https://example.com/',
  },

  // ── Video Manifests | ملفات بيان الفيديو ─────────────────────────────────
  videos: {
    // Default HLS .m3u8 manifest URL (Bitmovin "Art of Motion" demo stream).
    // رابط manifest الافتراضي لـ HLS (مجرى Bitmovin التجريبي "Art of Motion").
    hlsManifest:
      'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
  },

  // ── CSS Selectors | محددات CSS ────────────────────────────────────────────
  selectors: {
    // The outer wrapper div that Bitmovin renders its player inside.
    // عنصر div الخارجي الذي يُصيّر داخله Bitmovin مشغّله.
    playerContainer: '#player',

    // The actual <video> element created by the Bitmovin SDK.
    // عنصر <video> الفعلي الذي ينشئه Bitmovin SDK.
    videoElement: 'video#bitmovinplayer-video-player',

    // Radio button that selects HLS as the stream format on the demo page.
    // زر الراديو الذي يحدد HLS كتنسيق بث في الصفحة التجريبية.
    hlsRadio: 'input[name="stream-format"][value="hls"]',

    // Button that applies the chosen stream format and loads the manifest.
    // الزر الذي يطبّق تنسيق البث المختار ويحمّل manifest.
    loadSettingsButton: '#manifest-load',

    // Ordered list of selectors tried to find and click the play button.
    // قائمة مرتبة من المحددات تُجرَّب للعثور على زر التشغيل والنقر عليه.
    playButtons: ['button[aria-label="Play"]', '.bmpui-ui-playbacktogglebutton'],

    // Selector for the event/chapter log overlay that updates during playback.
    // محدد تراكب سجل الأحداث/الفصول الذي يتحدث أثناء التشغيل.
    eventLogOverlay: '#logContent',

    // Candidate selectors for the Al-Fihris (chapter) overlay; tried in order.
    // محددات مرشحة لتراكب Al-Fihris (الفهرس)؛ تُجرَّب بالترتيب.
    alFihrisOverlayCandidates: ['[data-testid="al-fihris-overlay"]', '#logContent'],

    // Candidate selectors for the Audio Focus Mode toggle button; tried in order.
    // محددات مرشحة لزر تبديل وضع التركيز الصوتي؛ تُجرَّب بالترتيب.
    audioFocusToggleCandidates: [
      '[data-testid="audio-focus-toggle"]',
      '[aria-label="Audio Focus Mode"]',
      'button:has-text("Audio Focus")',
    ],
  },

  // ── localStorage Keys | مفاتيح localStorage ──────────────────────────────
  storageKeys: {
    // Key under which the video resume timestamp is stored between navigations.
    // المفتاح الذي يُخزَّن تحته ختم الوقت لاستئناف الفيديو بين التنقلات.
    resumeTimestamp: 'pw.video.resume.timestamp',
  },

  // ── Audio Focus Mode | وضع التركيز الصوتي ────────────────────────────────
  audioFocus: {
    // data-* attribute name set on the player container when Audio Focus Mode is active.
    // اسم سمة data-* تُضبط على حاوية المشغّل عندما يكون وضع التركيز الصوتي نشطًا.
    dataAttribute: 'data-audio-focus-mode',

    // The value the above attribute holds when the mode is turned on.
    // القيمة التي تحملها السمة أعلاه عندما يكون الوضع مفعّلاً.
    enabledValue: 'enabled',
  },

  // ── Wait Timeouts | المهل الزمنية للانتظار ───────────────────────────────
  waits: {
    // Maximum ms to wait for a Cloudflare challenge to clear before giving up.
    // الحد الأقصى بالمللي-ثانية لانتظار حل تحدي Cloudflare قبل الاستسلام.
    cloudflareGraceMs: 20_000,

    // Maximum ms to wait for video currentTime to advance during playback checks.
    // الحد الأقصى بالمللي-ثانية لانتظار تقدم currentTime أثناء فحوصات التشغيل.
    progressTimeoutMs: 20_000,

    // Maximum ms to wait for the Al-Fihris overlay text to change to a new entry.
    // الحد الأقصى بالمللي-ثانية لانتظار تغيّر نص تراكب Al-Fihris إلى مدخل جديد.
    overlayTimeoutMs: 15_000,
  },

  // ── Mock Data | البيانات التجريبية ────────────────────────────────────────
  // Lightweight seed data used by tests that need student, quiz, or video records
  // without hitting a real backend.
  // بيانات أولية خفيفة تستخدمها الاختبارات التي تحتاج سجلات طلاب أو اختبارات أو فيديوهات
  // دون الاتصال بخادم حقيقي.
  mockData: {
    // Sample student records — id, display name, and school level.
    // سجلات طلاب نموذجية — المعرف والاسم ومستوى المدرسة.
    students: [
      { id: 'stu-001', name: 'Sara', level: 'Grade 7' },
      { id: 'stu-002', name: 'Omar', level: 'Grade 8' },
    ],

    // Sample quiz records — id, title, and allotted duration in minutes.
    // سجلات اختبارات نموذجية — المعرف والعنوان والمدة المخصصة بالدقائق.
    quizzes: [
      { id: 'quiz-001', title: 'Arabic Grammar Basics', durationMinutes: 20 },
      { id: 'quiz-002', title: 'History: Umayyad Era', durationMinutes: 15 },
    ],

    // Sample video records — id, human-readable title, and stream type.
    // سجلات فيديو نموذجية — المعرف والعنوان المقروء ونوع البث.
    videos: [
      { id: 'vid-001', title: 'HLS Demo Stream', type: 'hls' },
      { id: 'vid-002', title: 'Progressive Backup Stream', type: 'mp4' },
    ],
  },
} as const;

// TypeScript type alias derived from the testData shape — allows typed access in helpers.
// اسم مستعار لنوع TypeScript مشتق من شكل testData — يتيح الوصول المنمَّط في الدوال المساعدة.
export type TestData = typeof testData;
