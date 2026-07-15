const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const year = document.querySelector("#year");

const canvas = document.querySelector("#tetris-canvas");
const overlay = document.querySelector("#game-overlay");
const overlayTitle = document.querySelector("#game-overlay-title");
const overlayText = document.querySelector("#game-overlay-text");
const scoreValue = document.querySelector("#score-value");
const bestValue = document.querySelector("#best-value");
const linesValue = document.querySelector("#lines-value");
const statusValue = document.querySelector("#status-value");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const dpadButtons = document.querySelectorAll(".pad-btn");

if (year) {
  year.textContent = String(new Date().getFullYear());
}

if (navToggle && siteNav) {
  const setOpen = (open) => {
    navToggle.setAttribute("aria-expanded", String(open));
    siteNav.classList.toggle("is-open", open);
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const STORAGE_KEY = "surprisen.tetris.best";
const INITIAL_SPEED = 680;
const SPEED_STEP = 48;
const MIN_SPEED = 110;
const PIECE_TYPES = ["I", "J", "L", "O", "S", "T", "Z"];
const PIECE_SHAPES = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  T: [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
};

const PIECE_COLORS = {
  I: { fill: "#76d7ff", accent: "#ecfbff" },
  J: { fill: "#6fa3ff", accent: "#eef4ff" },
  L: { fill: "#ffb26b", accent: "#fff4e8" },
  O: { fill: "#ffd56c", accent: "#fff9df" },
  S: { fill: "#78e0b6", accent: "#effcf5" },
  T: { fill: "#be94ff", accent: "#f5edff" },
  Z: { fill: "#ff8fb0", accent: "#fff0f4" },
};

const SCORE_TABLE = [0, 100, 300, 500, 800];

const state = {
  board: createBoard(),
  current: null,
  nextQueue: [],
  bag: [],
  score: 0,
  best: 0,
  lines: 0,
  level: 1,
  running: false,
  paused: false,
  over: false,
  timerId: null,
  speed: INITIAL_SPEED,
  canvasWidth: 0,
  canvasHeight: 0,
};

let ctx = null;

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures.
  }
}

function syncCanvasSize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(200, Math.floor(rect.width || 360));
  const height = Math.max(400, Math.floor(rect.height || 720));
  state.canvasWidth = width;
  state.canvasHeight = height;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
}

function setOverlay(title, text, visible) {
  if (!overlay || !overlayTitle || !overlayText) return;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = !visible;
}

function updateHud() {
  if (scoreValue) scoreValue.textContent = String(state.score);
  if (bestValue) bestValue.textContent = String(state.best);
  if (linesValue) linesValue.textContent = String(state.lines);
  if (statusValue) {
    statusValue.textContent = state.over
      ? "Game Over"
      : state.paused
        ? "Paused"
        : state.running
          ? `Level ${state.level}`
          : "Ready";
  }
}

function clearTimer() {
  if (state.timerId != null) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function scheduleTick() {
  clearTimer();
  if (!state.running || state.paused || state.over) return;
  state.timerId = window.setTimeout(tick, state.speed);
}

function randomType() {
  if (!state.bag.length) {
    state.bag = PIECE_TYPES.slice();
    for (let i = state.bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
    }
  }
  return state.bag.pop();
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      rotated[x][size - y - 1] = matrix[y][x];
    }
  }
  return rotated;
}

function getRotations(type) {
  const base = PIECE_SHAPES[type][0];
  const rotations = [base];
  for (let i = 1; i < 4; i += 1) {
    rotations.push(rotateMatrix(rotations[i - 1]));
  }
  return rotations;
}

function createPiece(type) {
  return {
    type,
    rotation: 0,
    x: 3,
    y: -1,
    rotations: getRotations(type),
  };
}

function spawnPiece() {
  if (!state.nextQueue.length) {
    state.nextQueue.push(randomType(), randomType());
  }
  const type = state.nextQueue.shift();
  state.nextQueue.push(randomType());
  state.current = createPiece(type);
  if (!canPlace(state.current)) {
    endGame();
  }
}

function isOccupied(board, x, y) {
  return y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && board[y][x];
}

function getCells(piece = state.current, rotation = piece.rotation, offsetX = 0, offsetY = 0) {
  const matrix = piece.rotations[rotation];
  const cells = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x]) {
        cells.push({ x: piece.x + x + offsetX, y: piece.y + y + offsetY });
      }
    }
  }
  return cells;
}

function canPlace(piece = state.current, offsetX = 0, offsetY = 0, rotation = piece.rotation) {
  const matrix = piece.rotations[rotation];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;
      if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) return false;
      if (boardY >= 0 && state.board[boardY][boardX]) return false;
    }
  }
  return true;
}

function setLevelFromLines() {
  state.level = Math.max(1, Math.floor(state.lines / 10) + 1);
  state.speed = Math.max(MIN_SPEED, INITIAL_SPEED - (state.level - 1) * SPEED_STEP);
}

function lockPiece() {
  const cells = getCells();
  for (const cell of cells) {
    if (cell.y < 0) {
      endGame();
      return;
    }
    state.board[cell.y][cell.x] = state.current.type;
  }

  let cleared = 0;
  for (let y = BOARD_HEIGHT - 1; y >= 0; y -= 1) {
    if (state.board[y].every(Boolean)) {
      state.board.splice(y, 1);
      state.board.unshift(Array(BOARD_WIDTH).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    state.lines += cleared;
    state.score += SCORE_TABLE[cleared] * state.level;
    setLevelFromLines();
    state.best = Math.max(state.best, state.score);
    saveBestScore(state.best);
  }

  spawnPiece();
}

function movePiece(dx, dy) {
  if (!state.current || state.over) return false;
  if (canPlace(state.current, dx, dy)) {
    state.current.x += dx;
    state.current.y += dy;
    return true;
  }
  return false;
}

function rotatePiece() {
  if (!state.current || state.over) return;
  const nextRotation = (state.current.rotation + 1) % 4;
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (canPlace(state.current, kick, 0, nextRotation)) {
      state.current.rotation = nextRotation;
      state.current.x += kick;
      return;
    }
  }
}

function hardDrop() {
  if (!state.current || state.over || state.paused) return;
  let dropped = 0;
  while (movePiece(0, 1)) {
    dropped += 1;
  }
  state.score += dropped * 2;
  state.best = Math.max(state.best, state.score);
  saveBestScore(state.best);
  lockPiece();
  updateHud();
  drawBoard();
  if (state.running && !state.paused && !state.over) {
    scheduleTick();
  }
}

function softDrop() {
  if (!state.current || state.over || state.paused) return;
  if (movePiece(0, 1)) {
    state.score += 1;
  } else {
    lockPiece();
  }
  state.best = Math.max(state.best, state.score);
  saveBestScore(state.best);
  updateHud();
  drawBoard();
  if (state.running && !state.paused && !state.over) {
    scheduleTick();
  }
}

function endGame() {
  clearTimer();
  state.running = false;
  state.paused = false;
  state.over = true;
  state.best = Math.max(state.best, state.score);
  saveBestScore(state.best);
  setOverlay("Game Over", "Press Restart or Enter to start a fresh stack.", true);
  updateHud();
}

function resetGame(autoStart = false) {
  clearTimer();
  state.board = createBoard();
  state.current = null;
  state.bag = [];
  state.nextQueue = [randomType(), randomType()];
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.speed = INITIAL_SPEED;
  state.running = autoStart;
  state.paused = false;
  state.over = false;
  state.best = loadBestScore();
  spawnPiece();
  setOverlay(
    "Tetris Atelier",
    autoStart ? "The stack is live. Move with arrows, WASD, or the pad." : "Press Start or Enter to begin the rebuilt Tetris mode.",
    !autoStart
  );
  updateHud();
  drawBoard();
  if (autoStart && !state.over) {
    scheduleTick();
  }
}

function startGame() {
  if (state.over || !state.current) {
    resetGame(true);
    return;
  }
  if (!state.running || state.paused) {
    state.running = true;
    state.paused = false;
    setOverlay("Tetris Atelier", "The stack is live. Keep the skyline clean.", false);
    updateHud();
    scheduleTick();
  }
}

function pauseGame() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  if (state.paused) {
    clearTimer();
    setOverlay("Paused", "Press P, Enter, or Pause to continue.", true);
  } else {
    setOverlay("Tetris Atelier", "The stack is live. Keep the skyline clean.", false);
    scheduleTick();
  }
  updateHud();
}

function restartGame() {
  resetGame(true);
}

function tick() {
  state.timerId = null;
  if (!state.running || state.paused || state.over || !state.current) return;

  if (!movePiece(0, 1)) {
    lockPiece();
  }

  updateHud();
  drawBoard();

  if (state.running && !state.paused && !state.over) {
    scheduleTick();
  }
}

function getGhostPiece() {
  if (!state.current) return null;
  const ghost = {
    ...state.current,
    rotations: state.current.rotations,
    rotation: state.current.rotation,
  };
  while (canPlace(ghost, 0, 1)) {
    ghost.y += 1;
  }
  return ghost;
}

function drawCell(x, y, cellSize, fillColor, accentColor, glow = false, alpha = 1) {
  if (!ctx) return;
  const radius = Math.max(4, Math.floor(cellSize * 0.24));
  const px = x;
  const py = y;
  const inset = Math.max(1, Math.floor(cellSize * 0.08));
  const w = cellSize - inset * 2;
  const h = cellSize - inset * 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = Math.max(6, Math.floor(cellSize * 0.18));
  }
  ctx.beginPath();
  ctx.moveTo(px + inset + radius, py + inset);
  ctx.arcTo(px + inset + w, py + inset, px + inset + w, py + inset + h, radius);
  ctx.arcTo(px + inset + w, py + inset + h, px + inset, py + inset + h, radius);
  ctx.arcTo(px + inset, py + inset + h, px + inset, py + inset, radius);
  ctx.arcTo(px + inset, py + inset, px + inset + w, py + inset, radius);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(1, accentColor);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.restore();
}

function drawBoard() {
  if (!ctx || !canvas) return;

  const width = state.canvasWidth;
  const height = state.canvasHeight;
  const cellSize = Math.max(1, Math.floor(Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT)));
  const boardPixelWidth = cellSize * BOARD_WIDTH;
  const boardPixelHeight = cellSize * BOARD_HEIGHT;
  const offsetX = Math.floor((width - boardPixelWidth) / 2);
  const offsetY = Math.floor((height - boardPixelHeight) / 2);

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#202c46");
  bg.addColorStop(0.55, "#111a2b");
  bg.addColorStop(1, "#0a101b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.2, height * 0.16, width * 0.06, width * 0.5, height * 0.5, height * 0.72);
  glow.addColorStop(0, "rgba(126, 161, 255, 0.26)");
  glow.addColorStop(0.45, "rgba(245, 159, 99, 0.08)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.beginPath();
  const radius = Math.max(12, Math.floor(cellSize * 0.4));
  const x = offsetX + 2;
  const y = offsetY + 2;
  const w = boardPixelWidth - 4;
  const h = boardPixelHeight - 4;
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(186, 208, 255, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(205, 219, 255, 0.09)";
  ctx.lineWidth = 1;
  for (let row = 0; row <= BOARD_HEIGHT; row += 1) {
    const py = offsetY + row * cellSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(offsetX, py);
    ctx.lineTo(offsetX + boardPixelWidth, py);
    ctx.stroke();
  }
  for (let col = 0; col <= BOARD_WIDTH; col += 1) {
    const px = offsetX + col * cellSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, offsetY);
    ctx.lineTo(px, offsetY + boardPixelHeight);
    ctx.stroke();
  }

  for (let row = 0; row < BOARD_HEIGHT; row += 1) {
    for (let col = 0; col < BOARD_WIDTH; col += 1) {
      const cell = state.board[row][col];
      if (!cell) continue;
      const palette = PIECE_COLORS[cell];
      drawCell(
        offsetX + col * cellSize,
        offsetY + row * cellSize,
        cellSize,
        palette.fill,
        palette.accent,
        false,
        1
      );
    }
  }

  const ghost = getGhostPiece();
  if (ghost) {
    const cells = getCells(ghost);
    const palette = PIECE_COLORS[ghost.type];
    cells.forEach((cell) => {
      if (cell.y < 0) return;
      drawCell(
        offsetX + cell.x * cellSize,
        offsetY + cell.y * cellSize,
        cellSize,
        palette.fill,
        palette.accent,
        false,
        0.18
      );
    });
  }

  if (state.current) {
    const cells = getCells();
    const palette = PIECE_COLORS[state.current.type];
    cells.forEach((cell, index) => {
      if (cell.y < 0) return;
      drawCell(
        offsetX + cell.x * cellSize,
        offsetY + cell.y * cellSize,
        cellSize,
        palette.fill,
        palette.accent,
        index === 0,
        1
      );
    });
  }
}

function applyMove(direction) {
  if (state.paused || state.over) return;
  if (!state.running && !state.over) startGame();
  if (direction === "left") movePiece(-1, 0);
  if (direction === "right") movePiece(1, 0);
  if (direction === "down") softDrop();
  if (direction === "rotate") rotatePiece();
  updateHud();
  drawBoard();
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    applyMove("left");
    event.preventDefault();
  } else if (key === "arrowright" || key === "d") {
    applyMove("right");
    event.preventDefault();
  } else if (key === "arrowdown" || key === "s") {
    applyMove("down");
    event.preventDefault();
  } else if (key === "arrowup" || key === "w" || key === "x") {
    applyMove("rotate");
    event.preventDefault();
  } else if (key === " " ) {
    if (!state.running && !state.over) startGame();
    hardDrop();
    event.preventDefault();
  } else if (key === "p") {
    pauseGame();
    event.preventDefault();
  } else if (key === "enter") {
    if (state.over) restartGame();
    else if (!state.running || state.paused) startGame();
    event.preventDefault();
  } else if (key === "r") {
    restartGame();
    event.preventDefault();
  }
}

if (canvas) {
  ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.imageSmoothingEnabled = true;
  }

  window.addEventListener("resize", () => {
    syncCanvasSize();
    drawBoard();
  });

  window.addEventListener("keydown", handleKeydown);

  if (startButton) startButton.addEventListener("click", startGame);
  if (pauseButton) pauseButton.addEventListener("click", pauseGame);
  if (restartButton) restartButton.addEventListener("click", restartGame);

  dpadButtons.forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const dir = button.dataset.dir;
      if (dir === "up") applyMove("rotate");
      if (dir === "left") applyMove("left");
      if (dir === "down") applyMove("down");
      if (dir === "right") applyMove("right");
    });
  });

  state.best = loadBestScore();
  syncCanvasSize();
  resetGame(false);
}
