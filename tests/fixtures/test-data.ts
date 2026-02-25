import type { BrowserContext } from '@playwright/test';

export type LocalAppRoute =
  | '/'
  | '/login'
  | '/dashboard'
  | '/video'
  | '/quiz'
  | '/exam'
  | '/ar'
  | '/ar/quiz'
  | '/ar/chatbot'
  | '/ar/video'
  | '/assets/tone.wav';

export type VideoLabState = {
  currentTime: number;
  paused: boolean;
  readyState: number;
  duration: number;
  ended: boolean;
  audioFocusMode: 'enabled' | 'disabled';
  logicalVideoTrackEnabled: boolean;
  overlay: string;
};

export type SyncSubmission = {
  answer: string;
  submittedAt: string;
};

export type SyncLabState = {
  queue: SyncSubmission[];
  server: { submissions: SyncSubmission[] };
  syncHistory: string[];
};

export type ExamLabState = {
  examId: string;
  durationMs: number;
  startEpochMs: number;
  getRemainingMs: () => number;
};

const appOrigin = 'http://edu.local';

export const testData = {
  origin: appOrigin,
  urls: {
    login: `${appOrigin}/login`,
    dashboard: `${appOrigin}/dashboard`,
    video: `${appOrigin}/video`,
    quiz: `${appOrigin}/quiz`,
    exam: `${appOrigin}/exam`,
    arRoot: `${appOrigin}/ar`,
    arQuiz: `${appOrigin}/ar/quiz`,
    arChatbot: `${appOrigin}/ar/chatbot`,
    arVideo: `${appOrigin}/ar/video`,
  },
  selectors: {
    studentSelect: '#student-id',
    loginButton: '#login-button',
    dashboardRoot: '#dashboard-root',
    navVideo: '[data-testid="nav-video"]',
    navQuiz: '[data-testid="nav-quiz"]',
    navExam: '[data-testid="nav-exam"]',
    navArabic: '[data-testid="nav-arabic"]',
    playerContainer: '#player',
    videoElement: 'video#lesson-video',
    hlsRadio: 'input[name="stream-format"][value="hls"]',
    loadHlsButton: '#load-hls',
    playButton: '#play-video',
    simulateBufferButton: '#simulate-buffer',
    audioFocusToggle: '#toggle-audio-focus',
    alFihrisOverlay: '[data-testid="al-fihris-overlay"]',
    offlineIndicator: '#offline-indicator',
    syncIndicator: '#sync-indicator',
    answerOption: 'input[data-testid="answer-option"]',
    submitAnswerButton: '#submit-answer',
    countdown: '#countdown',
    submissionState: '#submission-state',
    visibilityFlags: '#visibility-flags',
    eventLog: '#event-log',
  },
  storageKeys: {
    activeStudentId: 'pw.edu.auth.student-id',
    resumeTimestamp: 'pw.video.resume.timestamp',
    offlineQueue: 'pw.sync.queue',
    offlineServer: 'pw.sync.server',
    examStartPrefix: 'pw.exam.start.',
    examSubmittedPrefix: 'pw.exam.submitted.',
    examFlagPrefix: 'pw.exam.flags.',
  },
  waits: {
    shortMs: 1_000,
    mediumMs: 5_000,
    longMs: 15_000,
    syncTimeoutMs: 12_000,
    playbackTimeoutMs: 20_000,
  },
  students: [
    { id: 'stu-001', name: 'Sara', level: 'Grade 7' },
    { id: 'stu-002', name: 'Omar', level: 'Grade 8' },
  ],
  quizzes: [
    { id: 'quiz-001', title: 'Streaming Basics', durationMinutes: 20 },
    { id: 'quiz-002', title: 'Timed Reasoning', durationMinutes: 15 },
  ],
  videos: [
    { id: 'vid-001', title: 'HLS Lesson', type: 'hls' },
    { id: 'vid-002', title: 'Backup Lesson', type: 'progressive' },
  ],
} as const;

export type TestData = typeof testData;

export function buildExamUrl(examId: string, durationMs: number): string {
  const url = new URL(testData.urls.exam);
  url.searchParams.set('examId', examId);
  url.searchParams.set('durationMs', String(durationMs));
  return url.toString();
}

function createToneWavBuffer(seconds: number = 10, sampleRate: number = 8_000): Buffer {
  const sampleCount = Math.max(1, Math.floor(sampleRate * seconds));
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * 220 * t) * 0.2;
    const clamped = Math.max(-1, Math.min(1, value));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return buffer;
}

type AppShellOptions = {
  title: string;
  body: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  extraStyle?: string;
  script?: string;
};

function appShell(options: AppShellOptions): string {
  const { title, body, lang = 'en', dir = 'ltr', extraStyle = '', script = '' } = options;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f3f7fb;
      --card: #ffffff;
      --ink: #102539;
      --muted: #4f6274;
      --stroke: #d6e2ed;
      --ok: #0f7d46;
      --warn: #955f00;
      --danger: #9d1c1c;
      --info: #1753a8;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: linear-gradient(160deg, #eef4fa 0%, #f6f8fb 100%);
      color: var(--ink);
      font-family: "Segoe UI", Tahoma, sans-serif;
    }

    main {
      width: min(960px, calc(100vw - 24px));
      margin: 20px auto;
      padding: 20px;
      border: 1px solid var(--stroke);
      border-radius: 14px;
      background: var(--card);
      box-shadow: 0 8px 28px rgba(16, 37, 57, 0.08);
    }

    h1, h2, h3 {
      margin: 0 0 10px;
    }

    p {
      margin: 0 0 10px;
      color: var(--muted);
      line-height: 1.5;
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .card {
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .pill.online, .pill.synced {
      background: #eaf8ef;
      color: var(--ok);
      border-color: #9fd8b7;
    }

    .pill.offline {
      background: #feeeee;
      color: var(--danger);
      border-color: #f5b2b2;
    }

    .pill.queued {
      background: #fff6e7;
      color: var(--warn);
      border-color: #efc97f;
    }

    .pill.syncing {
      background: #eaf1ff;
      color: var(--info);
      border-color: #a4c0f5;
    }

    .pill.idle {
      background: #f2f5f8;
      color: #4f6274;
      border-color: #ccd8e5;
    }

    .muted {
      color: var(--muted);
      font-size: 13px;
    }

    .mono {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 12px;
    }

    button, a.button {
      border: 1px solid #1b5ca8;
      background: #1b5ca8;
      color: #fff;
      border-radius: 8px;
      padding: 8px 12px;
      text-decoration: none;
      cursor: pointer;
      font-size: 14px;
      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: filter 120ms ease;
    }

    button.secondary, a.button.secondary {
      border-color: #6c8196;
      background: #fff;
      color: #21374d;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    input, select {
      border: 1px solid #b7c8da;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 14px;
      background: #fff;
      color: var(--ink);
    }

    pre {
      margin: 0;
      max-width: 100%;
      overflow: auto;
      border-radius: 10px;
      border: 1px solid #d8e5f1;
      background: #f8fbff;
      color: #17324b;
      padding: 10px;
    }

    nav a {
      color: #0f4d95;
      text-decoration: none;
      font-weight: 600;
      margin-inline-end: 10px;
    }

    nav a:hover {
      text-decoration: underline;
    }

    footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--stroke);
      color: var(--muted);
      font-size: 12px;
    }

    ${extraStyle}
  </style>
</head>
<body>
  ${body}
  ${script}
</body>
</html>`;
}

function createLoginPage(): string {
  const studentOptions = testData.students
    .map((student) => `<option value="${student.id}">${student.name} (${student.level})</option>`)
    .join('');

  return appShell({
    title: 'Local Login',
    body: `
      <main id="login-root">
        <h1>Local Educational Platform Login</h1>
        <p>Authenticate with a mock student account to open dashboard flows.</p>

        <form id="login-form" class="card" style="max-width: 460px;">
          <label for="student-id">Student</label>
          <div class="row" style="margin-top: 8px;">
            <select id="student-id" name="student">${studentOptions}</select>
            <button id="login-button" type="submit">Login</button>
          </div>
          <p class="muted" style="margin-top: 10px;">State is persisted in localStorage only.</p>
        </form>
      </main>
    `,
    script: `
      <script>
        (function () {
          var authKey = '${testData.storageKeys.activeStudentId}';
          var form = document.getElementById('login-form');
          var select = document.getElementById('student-id');

          form.addEventListener('submit', function (event) {
            event.preventDefault();
            localStorage.setItem(authKey, select.value);
            window.location.assign('/dashboard');
          });
        })();
      </script>
    `,
  });
}

function createDashboardPage(): string {
  return appShell({
    title: 'Local Dashboard',
    body: `
      <main id="dashboard-root">
        <h1>Student Dashboard</h1>
        <p class="muted">Local-only environment for E2E test automation.</p>

        <div class="card" style="margin-bottom: 12px;">
          <strong>Active student:</strong>
          <span id="student-badge" class="pill idle" style="margin-inline-start: 6px;">unknown</span>
        </div>

        <div class="row">
          <a class="button" data-testid="nav-video" href="/video">Open Video Lab</a>
          <a class="button" data-testid="nav-quiz" href="/quiz">Open Quiz Sync Lab</a>
          <a class="button" data-testid="nav-exam" href="/exam">Open Timed Exam</a>
          <a class="button secondary" data-testid="nav-arabic" href="/ar">Open Arabic Locale</a>
        </div>
      </main>
    `,
    script: `
      <script>
        (function () {
          var authKey = '${testData.storageKeys.activeStudentId}';
          var student = localStorage.getItem(authKey);
          if (!student) {
            window.location.replace('/login');
            return;
          }

          var badge = document.getElementById('student-badge');
          badge.textContent = student;
          badge.className = 'pill online';
        })();
      </script>
    `,
  });
}

function createVideoPage(): string {
  return appShell({
    title: 'Video Lab',
    body: `
      <main>
        <h1>Video Player Lab</h1>
        <p class="muted">Hybrid media playback checks with local deterministic controls.</p>

        <section id="player" class="card" data-audio-focus-mode="disabled" data-video-track-enabled="true" data-stream-format="none">
          <div class="row" style="margin-bottom: 10px;">
            <label><input id="format-hls" type="radio" name="stream-format" value="hls" checked> HLS</label>
            <button id="load-hls" type="button">Load HLS</button>
            <button id="play-video" type="button">Play</button>
            <button id="simulate-buffer" type="button" class="secondary">Simulate Buffer</button>
            <button id="toggle-audio-focus" type="button" class="secondary">Toggle Audio Focus</button>
          </div>

          <div class="row" style="margin-bottom: 10px;">
            <strong>Player state:</strong>
            <span id="video-state" class="pill idle" data-state="idle">idle</span>
            <span id="format-state" class="pill idle" data-state="none">none</span>
          </div>

          <video id="lesson-video" controls muted playsinline preload="auto" style="width: 100%; max-height: 240px;"></video>
          <p data-testid="al-fihris-overlay" id="al-fihris-overlay" style="margin-top: 10px; border-inline-start: 4px solid #0f7d46; padding-inline-start: 8px;">الفهرس: المقدمة / Intro</p>
        </section>
      </main>
    `,
    script: `
      <script>
        (function () {
          var resumeKey = '${testData.storageKeys.resumeTimestamp}';
          var player = document.getElementById('player');
          var video = document.getElementById('lesson-video');
          var hlsRadio = document.getElementById('format-hls');
          var loadButton = document.getElementById('load-hls');
          var playButton = document.getElementById('play-video');
          var bufferButton = document.getElementById('simulate-buffer');
          var audioFocusButton = document.getElementById('toggle-audio-focus');
          var overlay = document.getElementById('al-fihris-overlay');
          var stateBadge = document.getElementById('video-state');
          var formatBadge = document.getElementById('format-state');

          var chapters = [
            { at: 0, text: 'الفهرس: المقدمة / Intro' },
            { at: 2, text: 'الفهرس: الأساسيات / Basics' },
            { at: 4, text: 'الفهرس: التطبيق / Practice' },
            { at: 6, text: 'الفهرس: المراجعة / Review' }
          ];

          function setState(next) {
            stateBadge.dataset.state = next;
            stateBadge.textContent = next;
            stateBadge.className = 'pill ' + (next === 'playing' ? 'online' : next === 'buffering' ? 'syncing' : next === 'ready' ? 'synced' : 'idle');
          }

          function setFormat(next) {
            formatBadge.dataset.state = next;
            formatBadge.textContent = next;
            formatBadge.className = 'pill ' + (next === 'hls' ? 'synced' : 'idle');
            player.dataset.streamFormat = next;
          }

          var localSource = '/assets/tone.wav';
          var synthetic = {
            enabled: false,
            currentTime: 0,
            duration: 10,
            paused: true,
            ended: false,
            timerId: 0
          };

          function stopSyntheticTimer() {
            if (synthetic.timerId) {
              clearInterval(synthetic.timerId);
              synthetic.timerId = 0;
            }
          }

          function startSyntheticTimer() {
            stopSyntheticTimer();
            synthetic.timerId = setInterval(function () {
              if (synthetic.paused) {
                return;
              }
              synthetic.currentTime = Math.min(synthetic.duration, synthetic.currentTime + 0.1);
              if (synthetic.currentTime >= synthetic.duration) {
                synthetic.ended = true;
                synthetic.paused = true;
                stopSyntheticTimer();
              }
              updateOverlay();
            }, 100);
          }

          function enableSyntheticMedia() {
            if (synthetic.enabled) {
              return;
            }
            synthetic.enabled = true;
            synthetic.currentTime = 0;
            synthetic.paused = true;
            synthetic.ended = false;
            player.dataset.syntheticMedia = 'true';
            setState('ready');
          }

          function playbackTime() {
            return synthetic.enabled ? synthetic.currentTime : (video.currentTime || 0);
          }

          function currentChapter(currentTime) {
            var text = chapters[0].text;
            for (var i = 0; i < chapters.length; i += 1) {
              if (currentTime >= chapters[i].at) {
                text = chapters[i].text;
              }
            }
            return text;
          }

          function updateOverlay() {
            overlay.textContent = currentChapter(playbackTime());
          }

          function waitForMetadata() {
            return new Promise(function (resolve) {
              if (synthetic.enabled) {
                resolve();
                return;
              }

              if (video.readyState >= 1) {
                resolve();
                return;
              }

              var done = false;
              var timeoutId = setTimeout(function () {
                if (!done) {
                  done = true;
                  if (video.readyState === 0) {
                    enableSyntheticMedia();
                  }
                  resolve();
                }
              }, 2500);

              video.addEventListener('loadedmetadata', function onLoaded() {
                if (done) {
                  return;
                }
                done = true;
                clearTimeout(timeoutId);
                video.removeEventListener('loadedmetadata', onLoaded);
                resolve();
              });
            });
          }

          function loadHls() {
            stopSyntheticTimer();
            synthetic.paused = true;
            synthetic.ended = false;
            synthetic.currentTime = 0;
            synthetic.enabled = false;
            player.dataset.syntheticMedia = 'false';

            if (hlsRadio.checked) {
              setFormat('hls');
            } else {
              setFormat('none');
            }

            setState('loading');
            video.src = localSource;
            video.load();

            setTimeout(function () {
              if (!synthetic.enabled && video.readyState === 0) {
                enableSyntheticMedia();
              }
            }, 600);
          }

          async function startPlayback() {
            await waitForMetadata();
            if (synthetic.enabled) {
              synthetic.paused = false;
              synthetic.ended = false;
              setState('playing');
              startSyntheticTimer();
              updateOverlay();
              return;
            }
            try {
              await video.play();
              setState('playing');
            } catch (error) {
              enableSyntheticMedia();
              synthetic.paused = false;
              synthetic.ended = false;
              setState('playing');
              startSyntheticTimer();
            }
            updateOverlay();
          }

          function simulateBuffering() {
            setState('buffering');
            video.dispatchEvent(new Event('waiting'));
            setTimeout(function () {
              var paused = synthetic.enabled ? synthetic.paused : video.paused;
              setState(paused ? 'ready' : 'playing');
              video.dispatchEvent(new Event('playing'));
            }, 500);
          }

          function toggleAudioFocus() {
            var isEnabled = player.dataset.audioFocusMode === 'enabled';
            var next = isEnabled ? 'disabled' : 'enabled';
            player.dataset.audioFocusMode = next;
            player.dataset.videoTrackEnabled = next === 'enabled' ? 'false' : 'true';
            return next;
          }

          function getState() {
            var duration = synthetic.enabled
              ? synthetic.duration
              : (Number.isFinite(video.duration) ? video.duration : 0);
            return {
              currentTime: playbackTime(),
              paused: synthetic.enabled ? synthetic.paused : video.paused,
              readyState: synthetic.enabled ? 2 : video.readyState,
              duration: duration,
              ended: synthetic.enabled ? synthetic.ended : video.ended,
              audioFocusMode: player.dataset.audioFocusMode === 'enabled' ? 'enabled' : 'disabled',
              logicalVideoTrackEnabled: player.dataset.videoTrackEnabled !== 'false',
              overlay: overlay.textContent || ''
            };
          }

          function cacheTimestamp() {
            var current = playbackTime();
            localStorage.setItem(resumeKey, String(current));
            return current;
          }

          async function resumeFromCache() {
            if (!video.src) {
              loadHls();
            }

            await waitForMetadata();
            var cached = Number(localStorage.getItem(resumeKey) || '0');
            if (synthetic.enabled) {
              if (Number.isFinite(cached) && cached > 0) {
                synthetic.currentTime = Math.max(0, Math.min(cached, synthetic.duration - 0.05));
                synthetic.ended = false;
              }
              await startPlayback();
              return synthetic.currentTime;
            }
            if (Number.isFinite(cached) && cached > 0) {
              var duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : cached;
              var target = Math.max(0, Math.min(cached, duration - 0.05));
              try {
                video.currentTime = target;
              } catch (error) {
                // Ignore seek errors for unsupported states.
              }
            }

            await startPlayback();
            return video.currentTime;
          }

          video.addEventListener('loadedmetadata', function () {
            if (!synthetic.enabled) {
              setState('ready');
            }
            updateOverlay();
          });
          video.addEventListener('timeupdate', updateOverlay);
          video.addEventListener('play', function () {
            if (!synthetic.enabled) {
              setState('playing');
            }
          });
          video.addEventListener('pause', function () {
            if (!synthetic.enabled) {
              setState('ready');
            }
          });

          loadButton.addEventListener('click', loadHls);
          playButton.addEventListener('click', function () { void startPlayback(); });
          bufferButton.addEventListener('click', simulateBuffering);
          audioFocusButton.addEventListener('click', toggleAudioFocus);

          window.__videoLabState = {
            loadHls: loadHls,
            startPlayback: startPlayback,
            simulateBuffering: simulateBuffering,
            toggleAudioFocus: toggleAudioFocus,
            cacheTimestamp: cacheTimestamp,
            resumeFromCache: resumeFromCache,
            getState: getState
          };
        })();
      </script>
    `,
  });
}

function createQuizPage(): string {
  return appShell({
    title: 'Offline Sync Lab',
    body: `
      <main>
        <h1>Offline Mode Transition Lab</h1>
        <p class="muted">Deterministic queue/sync simulation for local E2E assertions.</p>

        <div class="row" style="margin-bottom: 10px;">
          <strong>Connection</strong>
          <span id="offline-indicator" class="pill online" data-state="online">online</span>
          <strong>PowerSync</strong>
          <span id="sync-indicator" class="pill idle" data-state="idle">idle</span>
        </div>

        <div id="app-health" class="card" data-state="stable" style="margin-bottom: 10px;">
          <strong>App Health:</strong> stable
        </div>

        <div id="cached-content" class="card" style="margin-bottom: 10px;">
          Cached lessons are still visible while offline.
        </div>

        <form id="quiz-form" class="card" style="margin-bottom: 10px;">
          <h2>Quiz</h2>
          <p>Which stream format is adaptive by default?</p>
          <label><input data-testid="answer-option" type="radio" name="answer" value="HLS"> HLS</label><br>
          <label><input data-testid="answer-option" type="radio" name="answer" value="MP4"> MP4</label><br>
          <label><input data-testid="answer-option" type="radio" name="answer" value="WAV"> WAV</label><br><br>
          <button id="submit-answer" type="submit">Submit Answer</button>
          <button id="force-sync" type="button" class="secondary">Force Sync</button>
        </form>

        <pre id="server-state" class="mono"></pre>
      </main>
    `,
    script: `
      <script>
        (function () {
          var queueKey = '${testData.storageKeys.offlineQueue}';
          var serverKey = '${testData.storageKeys.offlineServer}';

          var state = {
            queue: [],
            server: { submissions: [] },
            syncHistory: []
          };

          window.__syncLabState = state;

          var offlineIndicator = document.getElementById('offline-indicator');
          var syncIndicator = document.getElementById('sync-indicator');
          var form = document.getElementById('quiz-form');
          var forceSyncButton = document.getElementById('force-sync');
          var serverStateView = document.getElementById('server-state');

          function renderServerState() {
            serverStateView.textContent = JSON.stringify(state.server, null, 2);
          }

          function persist() {
            localStorage.setItem(queueKey, JSON.stringify(state.queue));
            localStorage.setItem(serverKey, JSON.stringify(state.server));
          }

          function restore() {
            var savedQueue = localStorage.getItem(queueKey);
            var savedServer = localStorage.getItem(serverKey);

            if (savedQueue) {
              try {
                var parsedQueue = JSON.parse(savedQueue);
                if (Array.isArray(parsedQueue)) {
                  state.queue = parsedQueue;
                }
              } catch (error) {
                state.queue = [];
              }
            }

            if (savedServer) {
              try {
                var parsedServer = JSON.parse(savedServer);
                if (parsedServer && Array.isArray(parsedServer.submissions)) {
                  state.server = parsedServer;
                }
              } catch (error) {
                state.server = { submissions: [] };
              }
            }
          }

          function setOfflineIndicator() {
            var online = navigator.onLine;
            offlineIndicator.dataset.state = online ? 'online' : 'offline';
            offlineIndicator.textContent = online ? 'online' : 'offline';
            offlineIndicator.className = 'pill ' + (online ? 'online' : 'offline');
          }

          function setSyncIndicator(next) {
            syncIndicator.dataset.state = next;
            syncIndicator.textContent = next;
            syncIndicator.className = 'pill ' + next;
            state.syncHistory.push(next);
          }

          function flushQueue() {
            if (!navigator.onLine) {
              setSyncIndicator('queued');
              return;
            }

            if (state.queue.length === 0) {
              setSyncIndicator('synced');
              return;
            }

            setSyncIndicator('syncing');

            setTimeout(function () {
              while (state.queue.length > 0) {
                state.server.submissions.push(state.queue.shift());
              }
              persist();
              renderServerState();
              setSyncIndicator('synced');
            }, 700);
          }

          function submitAnswer(answer) {
            state.queue.push({
              answer: answer,
              submittedAt: new Date().toISOString()
            });
            persist();

            if (!navigator.onLine) {
              setSyncIndicator('queued');
              return;
            }

            flushQueue();
          }

          form.addEventListener('submit', function (event) {
            event.preventDefault();
            var selected = form.querySelector('input[name="answer"]:checked');
            if (!selected) {
              return;
            }
            submitAnswer(selected.value);
          });

          forceSyncButton.addEventListener('click', flushQueue);

          window.addEventListener('online', function () {
            setOfflineIndicator();
            flushQueue();
          });

          window.addEventListener('offline', function () {
            setOfflineIndicator();
            if (state.queue.length > 0) {
              setSyncIndicator('queued');
            }
          });

          restore();
          setOfflineIndicator();
          renderServerState();
          setSyncIndicator(state.queue.length > 0 ? 'queued' : 'idle');
        })();
      </script>
    `,
  });
}

function createExamPage(): string {
  return appShell({
    title: 'Timed Exam Lab',
    body: `
      <main>
        <h1>Timed Exam Anti-Cheat Lab</h1>
        <div id="countdown" class="pill syncing" data-remaining-ms="0" style="font-size: 28px;">00:00</div>
        <p id="exam-meta" class="muted"></p>
        <div class="row" style="margin: 10px 0;">
          <strong>Submission:</strong>
          <span id="submission-state" class="pill queued" data-state="pending">pending</span>
          <strong>Visibility Flags:</strong>
          <span id="visibility-flags" class="pill idle">0</span>
        </div>
        <ol id="event-log" class="card" style="margin: 0; padding: 12px 24px;"></ol>
      </main>
    `,
    script: `
      <script>
        (function () {
          var params = new URLSearchParams(window.location.search);
          var examId = params.get('examId') || 'default-exam';
          var durationMs = Number(params.get('durationMs')) || 30 * 60 * 1000;

          var startKey = '${testData.storageKeys.examStartPrefix}' + examId;
          var submittedKey = '${testData.storageKeys.examSubmittedPrefix}' + examId;
          var flagKey = '${testData.storageKeys.examFlagPrefix}' + examId;

          var startEpochMs = Number(localStorage.getItem(startKey));
          if (!Number.isFinite(startEpochMs) || startEpochMs <= 0) {
            startEpochMs = Date.now();
            localStorage.setItem(startKey, String(startEpochMs));
          }

          var submitted = localStorage.getItem(submittedKey) === 'true';
          var visibilityFlags = Number(localStorage.getItem(flagKey) || '0');

          var countdown = document.getElementById('countdown');
          var submissionState = document.getElementById('submission-state');
          var visibilityFlagsEl = document.getElementById('visibility-flags');
          var eventLog = document.getElementById('event-log');
          var examMeta = document.getElementById('exam-meta');

          function formatRemaining(ms) {
            var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
            var minutes = Math.floor(totalSeconds / 60);
            var seconds = totalSeconds % 60;
            return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
          }

          function addLog(message) {
            var item = document.createElement('li');
            item.textContent = new Date().toISOString() + ' - ' + message;
            eventLog.appendChild(item);
          }

          function setSubmissionState(next) {
            submissionState.dataset.state = next;
            submissionState.textContent = next;
            submissionState.className = 'pill ' + (next === 'auto-submitted' ? 'synced' : 'queued');
          }

          function markSubmitted() {
            if (submitted) {
              return;
            }
            submitted = true;
            localStorage.setItem(submittedKey, 'true');
            setSubmissionState('auto-submitted');
            addLog('Timer expired, exam auto-submitted.');
          }

          function renderRemaining() {
            var elapsed = Date.now() - startEpochMs;
            var remaining = Math.max(0, durationMs - elapsed);
            countdown.dataset.remainingMs = String(remaining);
            countdown.textContent = formatRemaining(remaining);
            if (remaining <= 0) {
              markSubmitted();
            }
          }

          document.addEventListener('visibilitychange', function () {
            visibilityFlags += 1;
            localStorage.setItem(flagKey, String(visibilityFlags));
            visibilityFlagsEl.textContent = String(visibilityFlags);
            addLog('visibilitychange detected (hidden=' + String(document.hidden) + ').');
          });

          setSubmissionState(submitted ? 'auto-submitted' : 'pending');
          visibilityFlagsEl.textContent = String(visibilityFlags);
          examMeta.textContent = 'Exam ID: ' + examId + ' | Duration (ms): ' + durationMs + ' | Start (epoch): ' + startEpochMs;

          window.__examLabState = {
            examId: examId,
            durationMs: durationMs,
            startEpochMs: startEpochMs,
            getRemainingMs: function () {
              return Number(countdown.dataset.remainingMs || '0');
            }
          };

          addLog('Exam started from persisted server-side start time.');
          renderRemaining();
          setInterval(renderRemaining, 250);
        })();
      </script>
    `,
  });
}

function createArabicRootPage(): string {
  return appShell({
    title: 'Arabic Locale Home',
    lang: 'ar',
    dir: 'rtl',
    body: `
      <main>
        <header class="card" style="margin-bottom: 10px;">
          <h1>منصة تعليمية عربية</h1>
          <p>واجهة محلية لاختبارات اتجاه RTL والمحتوى العربي.</p>
          <nav>
            <a href="/ar">الرئيسية</a>
            <a href="/ar/quiz">الاختبار</a>
            <a href="/ar/chatbot">المساعد الذكي</a>
            <a href="/ar/video">الفيديو</a>
          </nav>
        </header>

        <section class="grid" style="margin-bottom: 10px;">
          <article class="card">
            <h2>سؤال الاختبار</h2>
            <p id="quiz-question">ما المصطلح الذي يصف البث المتكيف مع سرعة الشبكة؟</p>
          </article>
          <article class="card">
            <h2>رد المساعد الذكي</h2>
            <p id="chatbot-response">البث المتكيف يعني أن الجودة تتغير تلقائيًا لضمان الاستمرارية.</p>
          </article>
          <article class="card">
            <h2>الفهرس</h2>
            <p data-testid="al-fihris-overlay">الفهرس: مقدمة، شرح، مراجعة نهائية.</p>
          </article>
        </section>

        <footer>جميع الصفحات هنا محلية بالكامل بدون اتصال خارجي.</footer>
      </main>
    `,
  });
}

function createArabicQuizPage(): string {
  return appShell({
    title: 'Arabic Quiz Page',
    lang: 'ar',
    dir: 'rtl',
    body: `
      <main>
        <header class="card" style="margin-bottom: 10px;">
          <h1>صفحة الاختبار</h1>
          <nav>
            <a href="/ar">الرئيسية</a>
            <a href="/ar/quiz">الاختبار</a>
            <a href="/ar/chatbot">المساعد الذكي</a>
            <a href="/ar/video">الفيديو</a>
          </nav>
        </header>

        <section class="card" role="main">
          <h2>سؤال باللغة العربية</h2>
          <p id="quiz-question">اختر الإجابة الصحيحة حول تزامن البيانات في وضع عدم الاتصال.</p>
        </section>
      </main>
    `,
  });
}

function createArabicChatbotPage(): string {
  return appShell({
    title: 'Arabic Chatbot Page',
    lang: 'ar',
    dir: 'rtl',
    body: `
      <main>
        <header class="card" style="margin-bottom: 10px;">
          <h1>صفحة المساعد الذكي</h1>
          <nav>
            <a href="/ar">الرئيسية</a>
            <a href="/ar/quiz">الاختبار</a>
            <a href="/ar/chatbot">المساعد الذكي</a>
            <a href="/ar/video">الفيديو</a>
          </nav>
        </header>

        <section class="card" role="main">
          <h2>رد المساعد</h2>
          <p id="chatbot-response">تم تسجيل حالتك بنجاح، وسيتم مزامنة الإجابات عند عودة الشبكة.</p>
        </section>
      </main>
    `,
  });
}

function createArabicVideoPage(): string {
  return appShell({
    title: 'Arabic Video Page',
    lang: 'ar',
    dir: 'rtl',
    body: `
      <main>
        <header class="card" style="margin-bottom: 10px;">
          <h1>صفحة الفيديو</h1>
          <nav>
            <a href="/ar">الرئيسية</a>
            <a href="/ar/quiz">الاختبار</a>
            <a href="/ar/chatbot">المساعد الذكي</a>
            <a href="/ar/video">الفيديو</a>
          </nav>
        </header>

        <section class="card" role="main">
          <h2>طبقة الفهرس</h2>
          <p data-testid="al-fihris-overlay">الفهرس: التحميل، التشغيل، الاستئناف من آخر نقطة.</p>
        </section>
      </main>
    `,
  });
}

function createNotFoundPage(pathname: string): string {
  return appShell({
    title: 'Not Found',
    body: `
      <main>
        <h1>404</h1>
        <p>Unknown local route: <strong>${pathname}</strong></p>
      </main>
    `,
  });
}

function normalizePath(pathname: string): LocalAppRoute | string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export async function installLocalEducationalRoutes(context: BrowserContext): Promise<void> {
  await context.route(`${testData.origin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = normalizePath(url.pathname);

    if (request.method() !== 'GET') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (path === '/favicon.ico') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (path === '/assets/tone.wav') {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: createToneWavBuffer(10),
      });
      return;
    }

    let html = '';

    switch (path) {
      case '/':
      case '/login':
        html = createLoginPage();
        break;
      case '/dashboard':
        html = createDashboardPage();
        break;
      case '/video':
        html = createVideoPage();
        break;
      case '/quiz':
        html = createQuizPage();
        break;
      case '/exam':
        html = createExamPage();
        break;
      case '/ar':
        html = createArabicRootPage();
        break;
      case '/ar/quiz':
        html = createArabicQuizPage();
        break;
      case '/ar/chatbot':
        html = createArabicChatbotPage();
        break;
      case '/ar/video':
        html = createArabicVideoPage();
        break;
      default:
        html = createNotFoundPage(String(path));
        await route.fulfill({
          status: 404,
          contentType: 'text/html; charset=utf-8',
          body: html,
        });
        return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });
}
