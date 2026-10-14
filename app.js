/* ----------------------------------------------------
   1. COLOR THEMES
   ---------------------------------------------------- */
const BALLOON_THEMES = [
  {
    id: 'azure',
    name: 'Azure Pearl',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #7dd3fc 0%, #38bdf8 26%, #0284c7 65%, #0369a1 95%)',
    rimLight: 'rgba(224, 242, 254, 0.75)',
    ambientShadow: 'rgba(3, 105, 161, 0.4)',
    knotColor: '#0284c7',
    threadColor: 'rgba(240, 249, 255, 0.85)'
  },
  {
    id: 'ruby',
    name: 'Ruby Rose',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #fda4af 0%, #fb7185 26%, #e11d48 65%, #9f1239 95%)',
    rimLight: 'rgba(255, 228, 230, 0.75)',
    ambientShadow: 'rgba(159, 18, 57, 0.4)',
    knotColor: '#e11d48',
    threadColor: 'rgba(255, 241, 242, 0.85)'
  },
  {
    id: 'emerald',
    name: 'Emerald Jade',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #6ee7b7 0%, #34d399 26%, #059669 65%, #064e3b 95%)',
    rimLight: 'rgba(209, 250, 229, 0.75)',
    ambientShadow: 'rgba(6, 78, 59, 0.4)',
    knotColor: '#059669',
    threadColor: 'rgba(236, 253, 245, 0.85)'
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #fde68a 0%, #fbbf24 26%, #d97706 65%, #92400e 95%)',
    rimLight: 'rgba(254, 243, 199, 0.75)',
    ambientShadow: 'rgba(146, 64, 14, 0.4)',
    knotColor: '#d97706',
    threadColor: 'rgba(254, 252, 232, 0.85)'
  },
  {
    id: 'violet',
    name: 'Amethyst Violet',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #d8b4fe 0%, #c084fc 26%, #9333ea 65%, #581c87 95%)',
    rimLight: 'rgba(243, 232, 255, 0.75)',
    ambientShadow: 'rgba(88, 28, 135, 0.4)',
    knotColor: '#9333ea',
    threadColor: 'rgba(250, 245, 255, 0.85)'
  },
  {
    id: 'coral',
    name: 'Coral Sunset',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #fdba74 0%, #fb923c 26%, #ea580c 65%, #9a3412 95%)',
    rimLight: 'rgba(255, 237, 213, 0.75)',
    ambientShadow: 'rgba(154, 52, 18, 0.4)',
    knotColor: '#ea580c',
    threadColor: 'rgba(255, 247, 237, 0.85)'
  },
  {
    id: 'indigo',
    name: 'Cosmic Indigo',
    bodyGrad: 'radial-gradient(circle at 38% 30%, #a5b4fc 0%, #818cf8 26%, #4f46e5 65%, #312e81 95%)',
    rimLight: 'rgba(224, 231, 255, 0.75)',
    ambientShadow: 'rgba(49, 46, 129, 0.4)',
    knotColor: '#4f46e5',
    threadColor: 'rgba(238, 242, 255, 0.85)'
  }
];

let selectedThemeIndex = 0;
let roomCode = 'EXPO-2026';
let currentMode = 'kiosk';
let soundEnabled = true;
let audioContext = null;
let mqttClient = null;
let broadcastChannel = null;
let activeSpotlightId = null;

let userGust = { x: 0, y: 0, force: 0 };
let autoSkyEnabled = true;
let currentSkyPhase = '';

let autoLaunchTimer = null;
const AUTO_LAUNCH_DELAY_MS = 500;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
  roomCode = urlParams.get('room').toUpperCase().trim();
}

const STORAGE_KEY = `guestbook_vault_${roomCode}`;

function getLedger() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function recordInLedger(entry) {
  const records = getLedger();
  if (!records.some(r => r.id === entry.id)) {
    records.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  refreshStatsCounters();
}

function refreshStatsCounters() {
  const ledger = getLedger();
  const count = ledger.length;
  const wallCount = document.getElementById('wallActiveCount');
  const adminBadge = document.getElementById('adminTotalBadge');
  if (wallCount) wallCount.innerText = count;
  if (adminBadge) adminBadge.innerText = count;
}

/* ----------------------------------------------------
   2. AUTOMATIC REAL-TIME SKY CYCLE ENGINE
   ---------------------------------------------------- */
function determineSkyPhaseByHour() {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const timeVal = hour + minutes / 60;

  if (timeVal >= 5.0 && timeVal < 8.0) return 'dawn';
  if (timeVal >= 8.0 && timeVal < 16.5) return 'day';
  if (timeVal >= 16.5 && timeVal < 19.0) return 'sunset';
  return 'night';
}

function applySkyAtmosphere(phase) {
  if (currentSkyPhase === phase) return;
  currentSkyPhase = phase;

  const body = document.body;
  const stars = document.getElementById('starsLayer');

  body.classList.remove('sky-theme-dawn', 'sky-theme-day', 'sky-theme-sunset', 'sky-theme-night');
  body.classList.add(`sky-theme-${phase}`);

  if (stars) {
    if (phase === 'night') {
      stars.classList.remove('opacity-0');
    } else {
      stars.classList.add('opacity-0');
    }
  }

  // Clear active styling from all buttons
  ['btnCycleDawn', 'btnCycleDay', 'btnCycleSunset', 'btnCycleNight'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
  });

  const activeBtnId = {
    dawn: 'btnCycleDawn',
    day: 'btnCycleDay',
    sunset: 'btnCycleSunset',
    night: 'btnCycleNight'
  }[phase];

  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
  }
}

function updateAutoSky() {
  if (!autoSkyEnabled) return;
  const phase = determineSkyPhaseByHour();
  applySkyAtmosphere(phase);
}

function toggleAutoSkyMode() {
  autoSkyEnabled = !autoSkyEnabled;
  const btn = document.getElementById('btnCycleAuto');
  if (autoSkyEnabled) {
    btn.className = 'px-2 py-1 rounded-xl text-[9px] sm:text-[10px] font-extrabold bg-sky-600 text-white transition flex items-center gap-1';
    updateAutoSky();
  } else {
    btn.className = 'px-2 py-1 rounded-xl text-[9px] sm:text-[10px] font-extrabold bg-slate-500/20 text-slate-400 hover:text-white transition flex items-center gap-1';
  }
}

function setSkyCycleManual(phase) {
  autoSkyEnabled = false;
  const autoBtn = document.getElementById('btnCycleAuto');
  if (autoBtn) {
    autoBtn.className = 'px-2 py-1 rounded-xl text-[9px] sm:text-[10px] font-extrabold bg-slate-500/20 text-slate-400 hover:text-white transition flex items-center gap-1';
  }
  applySkyAtmosphere(phase);
}

setInterval(updateAutoSky, 30000);

/* ----------------------------------------------------
   3. PROCEDURAL CLOUD CANVAS
   ---------------------------------------------------- */
const cloudCanvas = document.getElementById('cloudCanvas');
const cloudCtx = cloudCanvas.getContext('2d');
let clouds = [];

function resizeCloudCanvas() {
  cloudCanvas.width = window.innerWidth;
  cloudCanvas.height = window.innerHeight;
  initClouds();
}

function initClouds() {
  clouds = [];
  const count = Math.max(3, Math.floor(window.innerWidth / 340));
  for (let i = 0; i < count; i++) {
    const puffCount = 8 + Math.floor(Math.random() * 5);
    const puffs = [];
    const baseW = 160 + Math.random() * 120;

    for (let p = 0; p < puffCount; p++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (baseW * 0.45);
      puffs.push({
        ox: Math.cos(angle) * dist,
        oy: (Math.sin(angle) * dist * 0.35) - (Math.random() * 12),
        r: 30 + Math.random() * 40,
        alphaOffset: 0.15 + Math.random() * 0.2
      });
    }

    clouds.push({
      x: Math.random() * window.innerWidth,
      y: 30 + Math.random() * (window.innerHeight * 0.35),
      speed: 0.12 + Math.random() * 0.16,
      puffs: puffs
    });
  }
}

function renderClouds() {
  cloudCtx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);

  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x - 300 > cloudCanvas.width) {
      c.x = -300;
      c.y = 30 + Math.random() * (cloudCanvas.height * 0.35);
    }

    c.puffs.forEach(p => {
      const px = c.x + p.ox;
      const py = c.y + p.oy + 6;
      const grad = cloudCtx.createRadialGradient(px, py, p.r * 0.1, px, py, p.r * 1.15);
      grad.addColorStop(0, 'rgba(148, 163, 184, 0.16)');
      grad.addColorStop(0.6, 'rgba(148, 163, 184, 0.06)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cloudCtx.fillStyle = grad;
      cloudCtx.beginPath();
      cloudCtx.arc(px, py, p.r * 1.15, 0, Math.PI * 2);
      cloudCtx.fill();
    });

    c.puffs.forEach(p => {
      const px = c.x + p.ox;
      const py = c.y + p.oy;
      const grad = cloudCtx.createRadialGradient(px, py - p.r * 0.2, p.r * 0.15, px, py, p.r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${p.alphaOffset + 0.35})`);
      grad.addColorStop(0.55, `rgba(255, 255, 255, ${p.alphaOffset})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cloudCtx.fillStyle = grad;
      cloudCtx.beginPath();
      cloudCtx.arc(px, py, p.r, 0, Math.PI * 2);
      cloudCtx.fill();
    });
  });

  requestAnimationFrame(renderClouds);
}

/* ----------------------------------------------------
   4. SIGNATURE ENGINE WITH BOUNDING-BOX AUTO-CROP
   ---------------------------------------------------- */
const pad = document.getElementById('padCanvas');
const padCtx = pad.getContext('2d');
let padStrokeWeight = 5;
let padDrawing = false;
let strokes = [];
let activeStroke = null;

function resizePad() {
  const rect = pad.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  pad.width = rect.width * dpr;
  pad.height = rect.height * dpr;
  padCtx.resetTransform();
  padCtx.scale(dpr, dpr);
  redrawPad();
}

const resizeObserver = new ResizeObserver(() => {
  resizePad();
});
resizeObserver.observe(pad);

function redrawPad() {
  const rect = pad.getBoundingClientRect();
  padCtx.clearRect(0, 0, rect.width, rect.height);
  padCtx.strokeStyle = '#ffffff';
  padCtx.lineCap = 'round';
  padCtx.lineJoin = 'round';

  strokes.forEach(stk => {
    if (stk.points.length < 2) return;
    padCtx.lineWidth = stk.weight;
    padCtx.beginPath();
    padCtx.moveTo(stk.points[0].x, stk.points[0].y);
    for (let i = 1; i < stk.points.length - 1; i++) {
      const xc = (stk.points[i].x + stk.points[i + 1].x) / 2;
      const yc = (stk.points[i].y + stk.points[i + 1].y) / 2;
      padCtx.quadraticCurveTo(stk.points[i].x, stk.points[i].y, xc, yc);
    }
    padCtx.lineTo(stk.points[stk.points.length - 1].x, stk.points[stk.points.length - 1].y);
    padCtx.stroke();
  });
}

function getPadPos(e) {
  const r = pad.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: cx - r.left, y: cy - r.top };
}

function onPadStart(e) {
  const nameInput = document.getElementById('inputName');
  const nameVal = nameInput.value.trim();
  const validationMsg = document.getElementById('nameValidationMsg');

  if (!nameVal) {
    validationMsg.classList.remove('hidden');
    nameInput.focus();
    nameInput.classList.add('ring-2', 'ring-rose-500');
    e.preventDefault();
    return;
  } else {
    validationMsg.classList.add('hidden');
    nameInput.classList.remove('ring-2', 'ring-rose-500');
  }

  padDrawing = true;
  clearAutoLaunchCountdown();

  document.getElementById('padPlaceholder').classList.add('hidden');
  document.getElementById('sigValidBadge').classList.remove('hidden');

  const pos = getPadPos(e);
  activeStroke = { weight: padStrokeWeight, points: [pos] };
  strokes.push(activeStroke);
  e.preventDefault();
}

function onPadMove(e) {
  if (!padDrawing || !activeStroke) return;
  const pos = getPadPos(e);
  activeStroke.points.push(pos);
  redrawPad();
  e.preventDefault();
}

function onPadEnd() {
  if (!padDrawing) return;
  padDrawing = false;
  activeStroke = null;

  const totalPoints = strokes.reduce((acc, s) => acc + s.points.length, 0);
  if (totalPoints >= 8) {
    scheduleAutoLaunch();
  }
}

pad.addEventListener('pointerdown', onPadStart);
pad.addEventListener('pointermove', onPadMove);
window.addEventListener('pointerup', onPadEnd);

document.getElementById('inputName').addEventListener('input', () => {
  const validationMsg = document.getElementById('nameValidationMsg');
  const nameInput = document.getElementById('inputName');
  if (nameInput.value.trim()) {
    validationMsg.classList.add('hidden');
    nameInput.classList.remove('ring-2', 'ring-rose-500');
  }
});

function clearAutoLaunchCountdown() {
  if (autoLaunchTimer) {
    clearTimeout(autoLaunchTimer);
    autoLaunchTimer = null;
  }
  const banner = document.getElementById('countdownBanner');
  if (banner) banner.classList.add('hidden');
}

function scheduleAutoLaunch() {
  clearAutoLaunchCountdown();

  const banner = document.getElementById('countdownBanner');
  if (banner) banner.classList.remove('hidden');

  autoLaunchTimer = setTimeout(() => {
    executeBalloonLaunch();
  }, AUTO_LAUNCH_DELAY_MS);
}

function clearSignature() {
  clearAutoLaunchCountdown();
  strokes = [];
  redrawPad();
  document.getElementById('padPlaceholder').classList.remove('hidden');
  document.getElementById('sigValidBadge').classList.add('hidden');
}

function setStrokeWeight(w) {
  padStrokeWeight = w;
  [3, 5, 7.5].forEach(val => {
    const btn = document.getElementById(`strokeBtn-${val}`);
    if (val === w) {
      btn.className = 'px-1.5 sm:px-2 py-0.5 rounded font-bold bg-white text-sky-700 shadow-sm';
    } else {
      btn.className = 'theme-btn-dim px-1.5 sm:px-2 py-0.5 rounded font-bold';
    }
  });
}

/* TIGHT BOUNDING-BOX CROP TO MAKE SIGNATURE HUGE ON BALLOONS */
function generateSignatureStreams() {
  if (strokes.length === 0) return null;

  // Calculate actual drawn stroke bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let hasValidPoints = false;

  strokes.forEach(stk => {
    stk.points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      hasValidPoints = true;
    });
  });

  if (!hasValidPoints || maxX <= minX || maxY <= minY) return null;

  // Add 12% padding around the bounding box
  const paddingX = Math.max(16, (maxX - minX) * 0.12);
  const paddingY = Math.max(12, (maxY - minY) * 0.12);
  const boxX = Math.max(0, minX - paddingX);
  const boxY = Math.max(0, minY - paddingY);
  const boxW = (maxX - minX) + paddingX * 2;
  const boxH = (maxY - minY) + paddingY * 2;

  // High-Resolution Cropped Canvas
  const targetW = 420;
  const targetH = Math.max(160, Math.round((boxH / boxW) * targetW));

  // Stream 1: White Ink on Transparent PNG
  const s1 = document.createElement('canvas');
  s1.width = targetW;
  s1.height = targetH;
  const c1 = s1.getContext('2d');
  c1.imageSmoothingEnabled = true;
  c1.imageSmoothingQuality = 'high';

  const scale = targetW / boxW;
  c1.scale(scale, scale);
  c1.translate(-boxX, -boxY);
  c1.strokeStyle = '#ffffff';
  c1.lineCap = 'round';
  c1.lineJoin = 'round';

  strokes.forEach(stk => {
    if (stk.points.length < 2) return;
    c1.lineWidth = stk.weight * 1.15;
    c1.beginPath();
    c1.moveTo(stk.points[0].x, stk.points[0].y);
    for (let i = 1; i < stk.points.length - 1; i++) {
      const xc = (stk.points[i].x + stk.points[i + 1].x) / 2;
      const yc = (stk.points[i].y + stk.points[i + 1].y) / 2;
      c1.quadraticCurveTo(stk.points[i].x, stk.points[i].y, xc, yc);
    }
    c1.lineTo(stk.points[stk.points.length - 1].x, stk.points[stk.points.length - 1].y);
    c1.stroke();
  });

  // Stream 2: Deep Dark Ink on Pure White (for PDF Export)
  const s2 = document.createElement('canvas');
  s2.width = targetW;
  s2.height = targetH;
  const c2 = s2.getContext('2d');
  c2.fillStyle = '#ffffff';
  c2.fillRect(0, 0, targetW, targetH);
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = 'high';

  c2.scale(scale, scale);
  c2.translate(-boxX, -boxY);
  c2.strokeStyle = '#0f172a';
  c2.lineCap = 'round';
  c2.lineJoin = 'round';

  strokes.forEach(stk => {
    if (stk.points.length < 2) return;
    c2.lineWidth = stk.weight * 1.35;
    c2.beginPath();
    c2.moveTo(stk.points[0].x, stk.points[0].y);
    for (let i = 1; i < stk.points.length - 1; i++) {
      const xc = (stk.points[i].x + stk.points[i + 1].x) / 2;
      const yc = (stk.points[i].y + stk.points[i + 1].y) / 2;
      c2.quadraticCurveTo(stk.points[i].x, stk.points[i].y, xc, yc);
    }
    c2.lineTo(stk.points[stk.points.length - 1].x, stk.points[stk.points.length - 1].y);
    c2.stroke();
  });

  return {
    displayWhitePNG: s1.toDataURL('image/png'),
    pdfDarkPNG: s2.toDataURL('image/png')
  };
}

/* ----------------------------------------------------
   5. COLOR PICKER BUTTONS
   ---------------------------------------------------- */
const colorPickerContainer = document.getElementById('colorPickerContainer');
BALLOON_THEMES.forEach((thm, idx) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `w-full h-7 sm:h-9 rounded-lg sm:rounded-xl transition-transform border-2 ${idx === 0 ? 'border-white scale-110 shadow-md ring-2 ring-sky-500' : 'border-transparent hover:scale-105'}`;
  b.style.background = thm.bodyGrad;
  b.title = thm.name;
  b.onclick = () => {
    selectedThemeIndex = idx;
    document.getElementById('selectedThemeLabel').innerText = thm.name;
    document.querySelectorAll('#colorPickerContainer button').forEach((btn, i) => {
      btn.className = `w-full h-7 sm:h-9 rounded-lg sm:rounded-xl transition-transform border-2 ${i === idx ? 'border-white scale-110 shadow-md ring-2 ring-sky-500' : 'border-transparent hover:scale-105'}`;
    });
  };
  colorPickerContainer.appendChild(b);
});

/* ----------------------------------------------------
   6. HIGH-SPEED INSTANT LAUNCH BALLOON PHYSICS
   ---------------------------------------------------- */
const stage = document.getElementById('balloonStage');
const stringCanvas = document.getElementById('stringCanvas');
const stringCtx = stringCanvas.getContext('2d');
let balloons = [];

function resizeStringCanvas() {
  stringCanvas.width = window.innerWidth;
  stringCanvas.height = window.innerHeight;
}

window.addEventListener('pointermove', (e) => {
  if (currentMode !== 'wall') return;
  userGust = {
    x: e.clientX,
    y: e.clientY,
    force: Math.min(Math.hypot(e.movementX, e.movementY) * 0.15, 4.0)
  };
});

class BalloonInstance {
  constructor(data, isInitialBatch = false) {
    this.data = data;
    this.id = data.id;
    this.theme = BALLOON_THEMES[data.themeIndex] || BALLOON_THEMES[0];

    const stageW = window.innerWidth;
    const stageH = window.innerHeight;

    this.x = Math.random() * (stageW - 320) + 160;

    // Instant entrance: Newly launched balloons start just off the bottom edge with a high-speed launch burst
    if (isInitialBatch) {
      this.y = 110 + Math.random() * (stageH * 0.35);
      this.vy = 0;
    } else {
      this.y = stageH + 40; // Starts right at screen bottom, not 240px away
      this.vy = -14.5;      // High speed rocket ascent burst (<0.8s to screen center)
    }

    this.vx = (Math.random() - 0.5) * 1.5;
    this.targetHoverY = 110 + Math.random() * (stageH * 0.32);
    this.hoverPhase = Math.random() * Math.PI * 2;
    this.hoverSpeed = 0.02 + Math.random() * 0.015;

    this.squashX = 1.0;
    this.squashY = 1.0;
    this.tilt = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.pointerDownPos = { x: 0, y: 0 };

    this.segmentLength = 12;
    this.nodes = [];
    for (let i = 0; i < 9; i++) {
      this.nodes.push({
        x: this.x,
        y: this.y + 115 + i * this.segmentLength,
        oldX: this.x,
        oldY: this.y + 115 + i * this.segmentLength
      });
    }

    this.el = document.createElement('div');
    this.el.className = 'balloon-wrapper';
    this.el.id = this.id;

    // Bold, Clear, High-Visibility Balloon Face
    this.el.innerHTML = `
      <div class="balloon-bulb" style="background: ${this.theme.bodyGrad}; box-shadow: 0 24px 38px -10px ${this.theme.ambientShadow}, 0 0 16px ${this.theme.rimLight} inset;">
        <p class="font-black text-white text-sm sm:text-base tracking-tight text-center truncate w-full drop-shadow-md px-1">${data.name}</p>
        <div class="balloon-signature-box">
          <img src="${data.displayWhitePNG}" class="balloon-signature-img" alt="signature">
        </div>
        <span class="text-[9px] sm:text-[10px] text-white/90 font-bold tracking-wider">${data.timestamp}</span>
      </div>
      <div class="balloon-knot-container">
        <div class="balloon-knot" style="background: ${this.theme.knotColor};"></div>
        <div class="balloon-knot-skirt" style="background: ${this.theme.knotColor};"></div>
      </div>
    `;

    this.bindEvents();
    stage.appendChild(this.el);
  }

  bindEvents() {
    const onDown = (e) => {
      this.isDragging = true;
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      this.dragStartX = cx;
      this.dragStartY = cy;
      this.pointerDownPos = { x: cx, y: cy };
      this.vx = 0;
      this.vy = 0;
      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = cx - this.dragStartX;
      const dy = cy - this.dragStartY;
      this.x += dx;
      this.y += dy;
      this.dragStartX = cx;
      this.dragStartY = cy;
      this.vx = dx * 0.45;
      this.vy = dy * 0.45;
    };

    const onUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      const cx = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
      const cy = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
      const dist = Math.hypot(cx - this.pointerDownPos.x, cy - this.pointerDownPos.y);

      if (dist < 6) {
        openSpotlight(this.data);
      }
    };

    this.el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  updatePhysics(wind) {
    if (!this.isDragging) {
      // Rapid ascent zone: Smooth friction braking as it nears target altitude
      if (this.y > this.targetHoverY + 30) {
        this.vy *= 0.94; // Brake gradually
        if (this.vy > -2.8) this.vy = -2.8; // Maintain fast baseline ascent
      } else {
        // Natural Floating Equilibrium Zone
        this.hoverPhase += this.hoverSpeed;
        const equilibriumTarget = this.targetHoverY + Math.sin(this.hoverPhase) * 12;
        const dy = equilibriumTarget - this.y;
        this.vy += dy * 0.025;
        this.vy *= 0.88; // Damping
      }

      if (userGust.force > 0.1) {
        const dUserX = this.x - userGust.x;
        const dUserY = this.y - userGust.y;
        const dist = Math.hypot(dUserX, dUserY);
        if (dist < 200 && dist > 1) {
          const push = (1 - dist / 200) * userGust.force * 1.8;
          this.vx += (dUserX / dist) * push;
          this.vy += (dUserY / dist) * push * 0.4;
        }
      }

      this.vx += (wind - this.vx) * 0.032;
      this.x += this.vx;
      this.y += this.vy;

      const zenithLimit = 95;
      if (this.y < zenithLimit) {
        this.y = zenithLimit;
        if (this.vy < 0) this.vy = 0;
      }

      if (this.x < 80) { this.x = 80; this.vx = Math.abs(this.vx) * 0.7; }
      if (this.x > window.innerWidth - 80) { this.x = window.innerWidth - 80; this.vx = -Math.abs(this.vx) * 0.7; }
    }

    this.squashX += (1.0 - this.squashX) * 0.1;
    this.squashY += (1.0 - this.squashY) * 0.1;
    this.tilt = (this.vx - wind) * 3.8;

    this.el.style.left = `${this.x}px`;
    this.el.style.top = `${this.y}px`;
    const bulb = this.el.querySelector('.balloon-bulb');
    if (bulb) {
      bulb.style.transform = `rotate(${this.tilt}deg) scale(${this.squashX}, ${this.squashY})`;
    }

    const knotAnchorX = this.x;
    const knotAnchorY = this.y + 115;
    this.nodes[0].x = knotAnchorX;
    this.nodes[0].y = knotAnchorY;

    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const stringWave = Math.sin(Date.now() * 0.003 + i * 0.6) * 0.35;
      const vx = (n.x - n.oldX) * 0.93 + (wind * 0.45) + stringWave;
      const vy = (n.y - n.oldY) * 0.93 + 0.32;
      n.oldX = n.x;
      n.oldY = n.y;
      n.x += vx;
      n.y += vy;
    }

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.nodes.length - 1; i++) {
        const n1 = this.nodes[i];
        const n2 = this.nodes[i + 1];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const diff = (dist - this.segmentLength) / dist;
        if (i === 0) {
          n2.x -= dx * diff;
          n2.y -= dy * diff;
        } else {
          n1.x += dx * diff * 0.5;
          n1.y += dy * diff * 0.5;
          n2.x -= dx * diff * 0.5;
          n2.y -= dy * diff * 0.5;
        }
      }
    }
  }

  drawRope(ctx) {
    if (this.nodes.length < 2) return;
    ctx.save();

    // Shadow pass
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(this.nodes[0].x + 1, this.nodes[0].y + 2);
    for (let i = 1; i < this.nodes.length - 1; i++) {
      const xc = (this.nodes[i].x + this.nodes[i + 1].x) / 2 + 1;
      const yc = (this.nodes[i].y + this.nodes[i + 1].y) / 2 + 2;
      ctx.quadraticCurveTo(this.nodes[i].x + 1, this.nodes[i].y + 2, xc, yc);
    }
    ctx.stroke();

    // Cotton rope line
    ctx.strokeStyle = this.theme.threadColor || 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
    for (let i = 1; i < this.nodes.length - 1; i++) {
      const xc = (this.nodes[i].x + this.nodes[i + 1].x) / 2;
      const yc = (this.nodes[i].y + this.nodes[i + 1].y) / 2;
      ctx.quadraticCurveTo(this.nodes[i].x, this.nodes[i].y, xc, yc);
    }
    ctx.lineTo(this.nodes[this.nodes.length - 1].x, this.nodes[this.nodes.length - 1].y);
    ctx.stroke();

    // End node
    const endNode = this.nodes[this.nodes.length - 1];
    ctx.fillStyle = this.theme.knotColor;
    ctx.beginPath();
    ctx.arc(endNode.x, endNode.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 60 FPS Physics Engine Loop
let windStep = 0;
function physicsLoop() {
  windStep += 0.015;
  const wind = Math.sin(windStep) * 0.65 + Math.cos(windStep * 0.3) * 0.3;
  userGust.force *= 0.92;

  stringCtx.clearRect(0, 0, stringCanvas.width, stringCanvas.height);

  balloons.forEach(b => {
    b.updatePhysics(wind);
    b.drawRope(stringCtx);
  });

  requestAnimationFrame(physicsLoop);
}

function addBalloon(entry, isInitialBatch = false) {
  if (balloons.some(b => b.id === entry.id)) return;
  const b = new BalloonInstance(entry, isInitialBatch);
  balloons.push(b);
  const wallCount = document.getElementById('wallActiveCount');
  if (wallCount) wallCount.innerText = balloons.length;
}

function popBalloonById(id, broadcast) {
  const idx = balloons.findIndex(b => b.id === id);
  if (idx === -1) return;
  const b = balloons[idx];

  playAudioPop();

  const rx = b.x / window.innerWidth;
  const ry = b.y / window.innerHeight;
  confetti({
    particleCount: 50,
    spread: 70,
    origin: { x: rx, y: ry },
    colors: ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#c084fc', '#ffffff']
  });

  b.el.classList.add('balloon-bursting');

  setTimeout(() => {
    if (b.el.parentElement) b.el.parentElement.removeChild(b.el);
    balloons.splice(idx, 1);
    const wallCount = document.getElementById('wallActiveCount');
    if (wallCount) wallCount.innerText = balloons.length;
  }, 150);

  if (broadcast) {
    broadcastMessage({ action: 'POP', id: id });
  }
}

function popAllBalloons() {
  const list = [...balloons];
  list.forEach((b, i) => {
    setTimeout(() => popBalloonById(b.id, true), i * 60);
  });
}

/* ----------------------------------------------------
   7. BALLOON SPOTLIGHT
   ---------------------------------------------------- */
function openSpotlight(data) {
  activeSpotlightId = data.id;
  const modal = document.getElementById('modalSpotlight');
  modal.classList.remove('hidden');

  document.getElementById('spotlightName').innerText = data.name;
  document.getElementById('spotlightDate').innerText = `Signed on ${data.date || 'Today'} at ${data.timestamp}`;
  document.getElementById('spotlightSigImg').src = data.displayWhitePNG;

  const thm = BALLOON_THEMES[data.themeIndex] || BALLOON_THEMES[0];
  document.getElementById('spotlightThemeBadge').style.background = thm.bodyGrad;
}

function closeSpotlight() {
  document.getElementById('modalSpotlight').classList.add('hidden');
  activeSpotlightId = null;
}

function dischargeBalloonSparkles() {
  if (!activeSpotlightId) return;
  popBalloonById(activeSpotlightId, true);
  closeSpotlight();
}

/* ----------------------------------------------------
   8. WEB AUDIO POP
   ---------------------------------------------------- */
function playAudioPop() {
  if (!soundEnabled) return;
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, audioContext.currentTime + 0.13);

    gain.gain.setValueAtTime(0.65, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.13);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.14);
  } catch (e) {}
}

function toggleAudio() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('iconAudio');
  if (icon) {
    icon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
    lucide.createIcons();
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

/* ----------------------------------------------------
   9. REAL-TIME MULTI-DEVICE SYNC
   ---------------------------------------------------- */
function initSyncNetwork() {
  try {
    broadcastChannel = new BroadcastChannel(`guestbook_${roomCode}`);
    broadcastChannel.onmessage = (ev) => handleSyncPayload(ev.data);
  } catch (e) {}

  const clientId = 'guest_' + Math.random().toString(16).slice(2, 10);
  const topic = `exhibition/sky/${roomCode}/feed`;

  mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
    clientId: clientId,
    clean: true,
    reconnectPeriod: 3000
  });

  mqttClient.on('connect', () => {
    mqttClient.subscribe(topic);
  });

  mqttClient.on('message', (t, msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      handleSyncPayload(payload);
    } catch (e) {}
  });
}

function broadcastMessage(payload) {
  if (broadcastChannel) broadcastChannel.postMessage(payload);
  if (mqttClient && mqttClient.connected) {
    const topic = `exhibition/sky/${roomCode}/feed`;
    mqttClient.publish(topic, JSON.stringify(payload));
  }
}

function handleSyncPayload(payload) {
  if (!payload) return;
  if (payload.action === 'NEW_BALLOON') {
    recordInLedger(payload.data);
    addBalloon(payload.data, false);
  } else if (payload.action === 'POP') {
    popBalloonById(payload.id, false);
  }
}

/* ----------------------------------------------------
   10. INSTANT AUTO-LAUNCH EXECUTION
   ---------------------------------------------------- */
function executeBalloonLaunch() {
  clearAutoLaunchCountdown();
  const nameInput = document.getElementById('inputName');
  const name = nameInput.value.trim();

  if (!name) {
    document.getElementById('nameValidationMsg').classList.remove('hidden');
    nameInput.focus();
    return;
  }

  const streams = generateSignatureStreams();
  if (!streams) return;

  const now = new Date();
  const entryData = {
    id: 'sky_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: name,
    themeIndex: selectedThemeIndex,
    displayWhitePNG: streams.displayWhitePNG,
    pdfDarkPNG: streams.pdfDarkPNG,
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString()
  };

  // 1. Immediately spawn locally and broadcast so it ascends without delay
  recordInLedger(entryData);
  addBalloon(entryData, false);
  broadcastMessage({ action: 'NEW_BALLOON', data: entryData });

  // 2. Play subtle confetti
  confetti({
    particleCount: 35,
    spread: 55,
    origin: { y: 0.85 }
  });

  // 3. Display kiosk feedback
  const notice = document.getElementById('kioskSuccessNotice');
  const counterSpan = document.getElementById('resetSeconds');
  notice.classList.remove('hidden');

  let remaining = 2;
  counterSpan.innerText = remaining;
  const timer = setInterval(() => {
    remaining -= 1;
    counterSpan.innerText = remaining;
    if (remaining <= 0) {
      clearInterval(timer);
      document.getElementById('inputName').value = '';
      clearSignature();
      notice.classList.add('hidden');
    }
  }, 1000);
}

/* ----------------------------------------------------
   11. PDF EXPORT (jsPDF)
   ---------------------------------------------------- */
async function exportGuestbookPDF() {
  const records = getLedger();
  if (records.length === 0) {
    alert('No visitors have signed the guestbook yet.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  function drawBanner(pageNum, totalPages) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('EXHIBITION OFFICIAL GUESTBOOK', 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(186, 230, 253);
    doc.text(`Exhibition Room: ${roomCode}   |   Date: ${new Date().toLocaleDateString()}   |   Total Signatures: ${records.length}`, 14, 26);
  }

  let currentY = 46;
  const margin = 14;
  const colGap = 8;
  const colWidth = (pageWidth - (margin * 2) - colGap) / 2;
  const cardHeight = 36;

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const isCol2 = i % 2 !== 0;
    const currentX = isCol2 ? margin + colWidth + colGap : margin;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(currentX, currentY, colWidth, cardHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(item.name || 'Anonymous Guest', colWidth - 8)[0], currentX + 5, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const sub = `${item.date || ''} ${item.timestamp || ''}`;
    doc.text(doc.splitTextToSize(sub, colWidth - 8)[0], currentX + 5, currentY + 13);

    if (item.pdfDarkPNG) {
      doc.addImage(item.pdfDarkPNG, 'PNG', currentX + 5, currentY + 15, colWidth - 10, 18);
    }

    if (isCol2) {
      currentY += cardHeight + 6;
      if (currentY + cardHeight > pageHeight - 16 && i < records.length - 1) {
        doc.addPage();
        currentY = 46;
      }
    }
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawBanner(p, totalPages);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Official Exhibition Registry Archive  —  Page ${p} of ${totalPages}`, margin, pageHeight - 8);
  }

  doc.save(`Guestbook-Archive-${roomCode}-${Date.now()}.pdf`);
}

function clearLedgerRecords() {
  if (confirm('Erase all stored signatures in the local database?')) {
    localStorage.removeItem(STORAGE_KEY);
    refreshStatsCounters();
    alert('Ledger cleared.');
  }
}

/* ----------------------------------------------------
   12. MODE SWITCHING & MODALS
   ---------------------------------------------------- */
function switchMode(m) {
  currentMode = m;
  const screenKiosk = document.getElementById('screenKiosk');
  const screenWall = document.getElementById('screenWall');
  const btnKiosk = document.getElementById('btnSwitchKiosk');
  const btnWall = document.getElementById('btnSwitchWall');

  if (m === 'kiosk') {
    screenKiosk.classList.remove('hidden');
    screenWall.classList.add('hidden');
    btnKiosk.classList.add('active-pill');
    btnWall.classList.remove('active-pill');
    setTimeout(resizePad, 60);
  } else {
    screenKiosk.classList.add('hidden');
    screenWall.classList.remove('hidden');
    btnWall.classList.add('active-pill');
    btnKiosk.classList.remove('active-pill');
    resizeStringCanvas();
  }
}

function toggleQRModal() {
  const modal = document.getElementById('modalQR');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) {
    const qrBox = document.getElementById('qrcodeBox');
    qrBox.innerHTML = '';
    const kioskURL = window.location.origin + window.location.pathname + `?room=${roomCode}#kiosk`;
    document.getElementById('qrUrlLabel').innerText = kioskURL;
    new QRCode(qrBox, {
      text: kioskURL,
      width: 130,
      height: 130,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

function openAdmin() {
  document.getElementById('modalAdmin').classList.remove('hidden');
  document.getElementById('adminPinView').classList.remove('hidden');
  document.getElementById('adminPanelView').classList.add('hidden');
  document.getElementById('adminPinError').classList.add('hidden');
  document.getElementById('inputAdminPin').value = '';
}

function closeAdmin() {
  document.getElementById('modalAdmin').classList.add('hidden');
}

function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('inputAdminPin').value.trim();
  if (pin === '1234') {
    document.getElementById('adminPinView').classList.add('hidden');
    document.getElementById('adminPanelView').classList.remove('hidden');
    refreshStatsCounters();
  } else {
    document.getElementById('adminPinError').classList.remove('hidden');
  }
}

setInterval(() => {
  const clock = document.getElementById('wallLiveClock');
  if (clock) clock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

/* ----------------------------------------------------
   13. INITIALIZATION
   ---------------------------------------------------- */
window.addEventListener('load', () => {
  lucide.createIcons();
  resizeCloudCanvas();
  renderClouds();
  resizeStringCanvas();
  resizePad();
  initSyncNetwork();
  refreshStatsCounters();
  updateAutoSky();

  // Initial historic balloons loaded in place
  const history = getLedger();
  history.slice(-14).forEach(entry => addBalloon(entry, true));

  requestAnimationFrame(physicsLoop);

  if (window.location.hash === '#wall') {
    switchMode('wall');
  }
});

window.addEventListener('resize', () => {
  resizeCloudCanvas();
  resizeStringCanvas();
  resizePad();
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resizeCloudCanvas();
    resizeStringCanvas();
    resizePad();
  }, 150);
});
