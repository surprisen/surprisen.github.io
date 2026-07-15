const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const year = document.querySelector("#year");

const canvas = document.querySelector("#snake-canvas");
const overlay = document.querySelector("#game-overlay");
const overlayTitle = document.querySelector("#game-overlay-title");
const overlayText = document.querySelector("#game-overlay-text");
const scoreValue = document.querySelector("#score-value");
const bestValue = document.querySelector("#best-value");
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

const STORAGE_KEY = "surprisen.snake.best";
const GRID_SIZE = 20;
const INITIAL_SPEED = 120;
const SPEED_STEP = 4;
const MIN_SPEED = 70;

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const game = {
  snake: [],
  direction: directions.right,
  nextDirection: directions.right,
  food: { x: 0, y: 0 },
  score: 0,
  best: 0,
  running: false,
  paused: false,
  over: false,
  timerId: null,
  speed: INITIAL_SPEED,
  boardSize: 0,
  canvasSize: 480,
};

let ctx = null;

function loadBestScore() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function updateScoreboard() {
  if (scoreValue) scoreValue.textContent = String(game.score);
  if (bestValue) bestValue.textContent = String(game.best);
  if (statusValue) {
    statusValue.textContent = game.over
      ? "Game Over"
      : game.paused
        ? "Paused"
        : game.running
          ? "Playing"
          : "Ready";
  }
}

function showOverlay(title, text, visible) {
  if (!overlay || !overlayTitle || !overlayText) {
    return;
  }

  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = !visible;
}

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function setDirection(next) {
  if (!next) return;

  if (game.over) {
    return;
  }

  if (isOpposite(next, game.direction) || isOpposite(next, game.nextDirection)) {
    return;
  }

  game.nextDirection = next;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function cloneSnake() {
  return game.snake.map((segment) => ({ x: segment.x, y: segment.y }));
}

function getRandomFoodPosition() {
  let candidate;
  do {
    candidate = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (game.snake.some((segment) => samePoint(segment, candidate)));
  return candidate;
}

function syncCanvasSize() {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const size = Math.max(240, Math.floor(rect.width || game.canvasSize));
  game.boardSize = size;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function drawCell(x, y, color, inset = 0.1) {
  if (!ctx) return;

  const cellSize = game.boardSize / GRID_SIZE;
  const pad = cellSize * inset;
  ctx.fillStyle = color;
  ctx.fillRect(
    x * cellSize + pad,
    y * cellSize + pad,
    cellSize - pad * 2,
    cellSize - pad * 2,
  );
}

function drawBoard() {
  if (!ctx || !canvas) return;

  const size = game.boardSize;
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = "#081019";
  ctx.fillRect(0, 0, size, size);

  const cellSize = size / GRID_SIZE;
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const pos = Math.round(i * cellSize) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  drawCell(game.food.x, game.food.y, "#8bd3ff", 0.18);

  game.snake.forEach((segment, index) => {
    const color = index === 0 ? "#eaf6ff" : "#51c0ff";
    drawCell(segment.x, segment.y, color, 0.12);
  });
}

function endGame(reason = "게임 오버") {
  clearTimeout(game.timerId);
  game.timerId = null;
  game.running = false;
  game.paused = false;
  game.over = true;
  showOverlay(reason, "재시작 버튼 또는 Enter 키로 다시 시작할 수 있습니다.", true);
  updateScoreboard();
}

function placeFood() {
  game.food = getRandomFoodPosition();
}

function resetGame(autoStart = false) {
  clearTimeout(game.timerId);
  game.timerId = null;
  game.snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  game.direction = directions.right;
  game.nextDirection = directions.right;
  game.score = 0;
  game.speed = INITIAL_SPEED;
  game.running = false;
  game.paused = false;
  game.over = false;
  placeFood();
  showOverlay("준비 완료", "시작 버튼 또는 Space 키로 게임을 시작하세요.", true);
  updateScoreboard();
  drawBoard();

  if (autoStart) {
    startGame();
  }
}

function scheduleTick() {
  clearTimeout(game.timerId);

  if (!game.running || game.paused || game.over) {
    game.timerId = null;
    return;
  }

  game.timerId = window.setTimeout(tick, game.speed);
}

function tick() {
  if (!game.running || game.paused || game.over) {
    return;
  }

  game.direction = game.nextDirection;

  const head = game.snake[0];
  const nextHead = {
    x: head.x + game.direction.x,
    y: head.y + game.direction.y,
  };

  const hitWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= GRID_SIZE ||
    nextHead.y >= GRID_SIZE;

  const hitSelf = game.snake.some((segment) => samePoint(segment, nextHead));

  if (hitWall || hitSelf) {
    if (game.score > game.best) {
      game.best = game.score;
      saveBestScore(game.best);
    }
    drawBoard();
    showOverlay("게임 오버", "재시작 버튼 또는 Enter 키로 다시 시작하세요.", true);
    updateScoreboard();
    endGame("게임 오버");
    return;
  }

  game.snake.unshift(nextHead);

  if (samePoint(nextHead, game.food)) {
    game.score += 1;
    game.best = Math.max(game.best, game.score);
    saveBestScore(game.best);
    game.speed = Math.max(MIN_SPEED, INITIAL_SPEED - game.score * SPEED_STEP);
    placeFood();
  } else {
    game.snake.pop();
  }

  drawBoard();
  updateScoreboard();
  scheduleTick();
}

function startGame() {
  if (game.over) {
    resetGame(false);
  }

  if (!game.running) {
    game.running = true;
    game.paused = false;
    showOverlay("", "", false);
    updateScoreboard();
    scheduleTick();
    return;
  }

  if (game.paused) {
    game.paused = false;
    showOverlay("", "", false);
    updateScoreboard();
    scheduleTick();
  }
}

function pauseGame() {
  if (!game.running || game.over) {
    return;
  }

  game.paused = !game.paused;
  if (game.paused) {
    clearTimeout(game.timerId);
    game.timerId = null;
    showOverlay("일시정지", "Pause 버튼, Space 키, 또는 Start 버튼으로 다시 진행합니다.", true);
  } else {
    showOverlay("", "", false);
    scheduleTick();
  }

  updateScoreboard();
}

function restartGame() {
  resetGame(false);
  startGame();
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (key === "arrowup" || key === "w") {
    event.preventDefault();
    setDirection(directions.up);
    return;
  }

  if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    setDirection(directions.down);
    return;
  }

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    setDirection(directions.left);
    return;
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    setDirection(directions.right);
    return;
  }

  if (key === " " || key === "spacebar") {
    event.preventDefault();
    if (!game.running || game.over) {
      startGame();
    } else {
      pauseGame();
    }
    return;
  }

  if (key === "enter") {
    event.preventDefault();
    if (game.over) {
      restartGame();
    } else if (!game.running) {
      startGame();
    }
  }
}

function bindControls() {
  if (startButton) {
    startButton.addEventListener("click", () => {
      if (game.over) {
        restartGame();
      } else {
        startGame();
      }
    });
  }

  if (pauseButton) {
    pauseButton.addEventListener("click", pauseGame);
  }

  if (restartButton) {
    restartButton.addEventListener("click", restartGame);
  }

  dpadButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const dir = button.dataset.dir;
      if (dir && directions[dir]) {
        setDirection(directions[dir]);
        if (!game.running || game.paused || game.over) {
          startGame();
        }
      }
    });
  });
}

function initGame() {
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  game.best = loadBestScore();
  updateScoreboard();
  bindControls();
  syncCanvasSize();
  resetGame(false);
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", () => {
  syncCanvasSize();
  drawBoard();
});

initGame();
