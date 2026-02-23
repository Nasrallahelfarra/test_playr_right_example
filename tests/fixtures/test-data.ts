export const testData = {
  urls: {
    streamTest: 'https://bitmovin.com/demos/stream-test',
    awayPage: 'https://example.com/',
  },
  videos: {
    hlsManifest:
      'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
  },
  selectors: {
    playerContainer: '#player',
    videoElement: 'video#bitmovinplayer-video-player',
    hlsRadio: 'input[name="stream-format"][value="hls"]',
    loadSettingsButton: '#manifest-load',
    playButtons: ['button[aria-label="Play"]', '.bmpui-ui-playbacktogglebutton'],
    eventLogOverlay: '#logContent',
    alFihrisOverlayCandidates: ['[data-testid="al-fihris-overlay"]', '#logContent'],
    audioFocusToggleCandidates: [
      '[data-testid="audio-focus-toggle"]',
      '[aria-label="Audio Focus Mode"]',
      'button:has-text("Audio Focus")',
    ],
  },
  storageKeys: {
    resumeTimestamp: 'pw.video.resume.timestamp',
  },
  audioFocus: {
    dataAttribute: 'data-audio-focus-mode',
    enabledValue: 'enabled',
  },
  waits: {
    cloudflareGraceMs: 20_000,
    progressTimeoutMs: 20_000,
    overlayTimeoutMs: 15_000,
  },
  mockData: {
    students: [
      { id: 'stu-001', name: 'Sara', level: 'Grade 7' },
      { id: 'stu-002', name: 'Omar', level: 'Grade 8' },
    ],
    quizzes: [
      { id: 'quiz-001', title: 'Arabic Grammar Basics', durationMinutes: 20 },
      { id: 'quiz-002', title: 'History: Umayyad Era', durationMinutes: 15 },
    ],
    videos: [
      { id: 'vid-001', title: 'HLS Demo Stream', type: 'hls' },
      { id: 'vid-002', title: 'Progressive Backup Stream', type: 'mp4' },
    ],
  },
} as const;

export type TestData = typeof testData;
