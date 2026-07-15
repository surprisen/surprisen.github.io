const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const year = document.querySelector("#year");

const colorStage = document.querySelector("#color-stage");
const targetSwatch = document.querySelector("#target-swatch");
const selectedSwatch = document.querySelector("#selected-swatch");
const colorPalette = document.querySelector("#color-palette");
const colorPicker = document.querySelector("#color-picker");
const colorPickerCursor = document.querySelector("#color-picker-cursor");
const colorPickerPreview = document.querySelector("#color-picker-preview");
const colorKicker = document.querySelector("#color-kicker");
const colorTitle = document.querySelector("#color-title");
const colorHint = document.querySelector("#color-hint");
const memoryMessage = document.querySelector("#memory-message");
const roundValue = document.querySelector("#round-value");
const scoreValue = document.querySelector("#score-value");
const bestValue = document.querySelector("#best-value");
const statusValue = document.querySelector("#status-value");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const resultCard = document.querySelector("#result-card");
const resultValue = document.querySelector("#result-value");
const resultMessage = document.querySelector("#result-message");

const STORAGE_KEY = "surprisen.color-match.best";
const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 ** 2);
const PICKER_SATURATION = 82;
const PICKER_LIGHT_TOP = 70;
const PICKER_LIGHT_BOTTOM = 32;

const game = {
  target: null,
  selected: null,
  score: 0,
  best: 0,
  round: 0,
  active: false,
  pickerPosition: { x: 0.5, y: 0.5 },
};

if (year) {
  year.textContent = String(new Date().getFullYear());
}

if (navToggle && siteNav) {
  const setOpen = (open) => {
    navToggle.setAttribute("aria-expanded", String(open));
    siteNav.classList.toggle("is-open", open);
  };

  navToggle.addEventListener("click", () => {
    setOpen(navToggle.getAttribute("aria-expanded") !== "true");
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
}

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function colorToCss(color) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function hslToRgb(hue, saturation, lightness) {
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const hueToRgb = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clamp(hueToRgb(p, q, h + 1 / 3) * 255),
    g: clamp(hueToRgb(p, q, h) * 255),
    b: clamp(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function pickerColorAt(x, y) {
  const safeX = Math.max(0, Math.min(0.9999, x));
  const safeY = Math.max(0, Math.min(1, y));
  const hue = safeX * 360;
  const lightness = PICKER_LIGHT_TOP - safeY * (PICKER_LIGHT_TOP - PICKER_LIGHT_BOTTOM);
  return hslToRgb(hue, PICKER_SATURATION, lightness);
}

function randomTarget() {
  return pickerColorAt(Math.random(), Math.random());
}

function colorDistance(first, second) {
  return Math.hypot(first.r - second.r, first.g - second.g, first.b - second.b);
}

function calculateSimilarity(first, second) {
  return Math.max(0, Math.min(100, Math.round((1 - colorDistance(first, second) / MAX_COLOR_DISTANCE) * 100)));
}

function loadBestScore() {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

function setSwatch(element, color) {
  if (!element || !color) return;
  element.style.setProperty("--swatch", colorToCss(color));
}

function updateHud(status) {
  if (scoreValue) scoreValue.textContent = `${game.score}`;
  if (bestValue) bestValue.textContent = `${game.best}`;
  if (statusValue) statusValue.textContent = status;
  if (roundValue) roundValue.textContent = `Round ${String(game.round).padStart(2, "0")}`;
}

function resultCopy(score) {
  if (score >= 98) return "완벽에 가까워요. 색감 감각이 아주 섬세합니다.";
  if (score >= 92) return "정말 근접했어요. 미묘한 톤 차이까지 잘 잡았습니다.";
  if (score >= 82) return "좋은 선택이에요. 한 번 더 도전해 더 가까이 맞춰보세요.";
  if (score >= 68) return "분위기는 비슷해요. 다음에는 명도 변화를 더 살펴보세요.";
  return "색의 결이 꽤 달랐어요. 새 색상에서 다시 감각을 시험해 보세요.";
}

function drawColorPicker() {
  if (!colorPicker || !colorPalette || colorPalette.hidden) return;
  const context = colorPicker.getContext("2d");
  if (!context) return;

  const width = Math.max(1, Math.floor(colorPicker.clientWidth));
  const height = Math.max(1, Math.floor(colorPicker.clientHeight));
  const dpr = window.devicePixelRatio || 1;
  colorPicker.width = Math.round(width * dpr);
  colorPicker.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  for (let column = 0; column < width; column += 1) {
    const x = column / Math.max(1, width - 1);
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colorToCss(pickerColorAt(x, 0)));
    gradient.addColorStop(1, colorToCss(pickerColorAt(x, 1)));
    context.fillStyle = gradient;
    context.fillRect(column, 0, 1.5, height);
  }
}

function pointFromEvent(event) {
  if (!colorPicker) return null;
  const rect = colorPicker.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function movePickerCursor(point) {
  if (!point || !colorPickerCursor) return null;
  const color = pickerColorAt(point.x, point.y);
  game.pickerPosition = point;
  colorPickerCursor.hidden = false;
  colorPickerCursor.style.left = `${point.x * 100}%`;
  colorPickerCursor.style.top = `${point.y * 100}%`;
  colorPickerCursor.style.setProperty("--cursor-color", colorToCss(color));
  showPickerPreview(point, color);
  return color;
}

function showPickerPreview(point, color) {
  if (!colorPickerPreview || !colorPalette) return;
  const size = 48;
  const margin = 10;
  const offset = 22;
  const width = colorPalette.clientWidth;
  const height = colorPalette.clientHeight;
  const left = Math.max(margin, Math.min(width - size - margin, point.x * width + offset));
  const top = Math.max(margin, Math.min(height - size - margin, point.y * height + offset));
  colorPickerPreview.hidden = false;
  colorPickerPreview.style.left = `${left}px`;
  colorPickerPreview.style.top = `${top}px`;
  colorPickerPreview.style.setProperty("--preview-color", colorToCss(color));
}

function prepareRound() {
  game.round += 1;
  game.target = randomTarget();
  game.selected = null;
  game.score = 0;
  game.active = false;
  game.pickerPosition = { x: 0.5, y: 0.5 };

  setSwatch(targetSwatch, game.target);
  if (targetSwatch) targetSwatch.hidden = false;
  if (selectedSwatch) selectedSwatch.hidden = true;
  if (colorPalette) colorPalette.hidden = true;
  if (colorPickerCursor) colorPickerCursor.hidden = true;
  if (colorPickerPreview) colorPickerPreview.hidden = true;
  if (memoryMessage) memoryMessage.hidden = true;
  if (resultCard) resultCard.hidden = true;
  if (colorStage) colorStage.classList.remove("is-result", "is-picking");

  if (colorKicker) colorKicker.textContent = "Remember this color";
  if (colorTitle) colorTitle.textContent = "이 색을 눈에 담아두세요.";
  if (colorHint) colorHint.textContent = "팔레트를 열면 목표 색상은 사라지고, 그라데이션 필드가 나타납니다.";
  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = "팔레트 열기";
  }
  updateHud("Ready");
}

function openPalette() {
  if (!game.target || game.active) return;
  game.active = true;

  if (targetSwatch) targetSwatch.hidden = true;
  if (memoryMessage) memoryMessage.hidden = false;
  if (colorPalette) colorPalette.hidden = false;
  if (colorStage) colorStage.classList.add("is-picking");
  if (colorKicker) colorKicker.textContent = "Move, then click";
  if (colorTitle) colorTitle.textContent = "그라데이션 위에서 가장 가까운 색을 찾으세요.";
  if (colorHint) colorHint.textContent = "마우스를 움직여 위치를 살피고, 원하는 색을 클릭하면 점수가 확정됩니다.";
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "선택 대기";
  }
  window.requestAnimationFrame(() => {
    drawColorPicker();
  });
  updateHud("Picking");
}

function selectColor(color) {
  if (!game.active || game.selected) return;
  game.active = false;
  game.selected = color;
  game.score = calculateSimilarity(game.target, color);
  game.best = Math.max(game.best, game.score);
  saveBestScore(game.best);

  setSwatch(targetSwatch, game.target);
  setSwatch(selectedSwatch, color);
  if (targetSwatch) targetSwatch.hidden = false;
  if (selectedSwatch) selectedSwatch.hidden = false;
  if (colorPalette) colorPalette.hidden = true;
  if (colorPickerCursor) colorPickerCursor.hidden = true;
  if (colorPickerPreview) colorPickerPreview.hidden = true;
  if (memoryMessage) memoryMessage.hidden = true;
  if (colorStage) {
    colorStage.classList.remove("is-picking");
    colorStage.classList.add("is-result");
  }
  if (colorKicker) colorKicker.textContent = "Target and your choice";
  if (colorTitle) colorTitle.textContent = `${game.score}점의 색감 매칭`;
  if (colorHint) colorHint.textContent = "왼쪽은 처음 본 목표 색, 오른쪽은 그라데이션에서 선택한 색입니다.";
  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = "다음 색상 보기";
  }
  if (resultCard) resultCard.hidden = false;
  if (resultValue) resultValue.textContent = `${game.score}점`;
  if (resultMessage) resultMessage.textContent = resultCopy(game.score);
  updateHud("Result");
}

if (startButton) {
  startButton.addEventListener("click", () => {
    if (game.selected) {
      prepareRound();
      return;
    }
    openPalette();
  });
}

if (restartButton) {
  restartButton.addEventListener("click", prepareRound);
}

if (colorPicker) {
  colorPicker.addEventListener("pointermove", (event) => {
    if (!game.active) return;
    movePickerCursor(pointFromEvent(event));
  });

  colorPicker.addEventListener("pointerleave", () => {
    if (game.active && colorPickerCursor) colorPickerCursor.hidden = true;
    if (game.active && colorPickerPreview) colorPickerPreview.hidden = true;
  });

  colorPicker.addEventListener("pointerdown", (event) => {
    if (!game.active || (event.pointerType === "mouse" && event.button !== 0)) return;
    const point = pointFromEvent(event);
    const color = movePickerCursor(point);
    if (color) selectColor(color);
  });

  colorPicker.addEventListener("keydown", (event) => {
    if (!game.active) return;
    const step = event.shiftKey ? 0.08 : 0.025;
    const nextPoint = { ...game.pickerPosition };
    if (event.key === "ArrowLeft") nextPoint.x -= step;
    else if (event.key === "ArrowRight") nextPoint.x += step;
    else if (event.key === "ArrowUp") nextPoint.y -= step;
    else if (event.key === "ArrowDown") nextPoint.y += step;
    else if (event.key === "Enter" || event.key === " ") {
      selectColor(pickerColorAt(nextPoint.x, nextPoint.y));
      event.preventDefault();
      return;
    } else {
      return;
    }
    nextPoint.x = Math.max(0, Math.min(1, nextPoint.x));
    nextPoint.y = Math.max(0, Math.min(1, nextPoint.y));
    movePickerCursor(nextPoint);
    event.preventDefault();
  });

  window.addEventListener("resize", () => {
    if (!colorPalette?.hidden) drawColorPicker();
  });
}

if (colorStage) {
  game.best = loadBestScore();
  prepareRound();
}
