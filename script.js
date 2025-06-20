// === Variables DOM & jeu ===
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const gameContainer = document.getElementById("gameContainer");
const startBtn = document.getElementById("startBtn");
const pseudoInput = document.getElementById("pseudo");
const colorPicker = document.getElementById("colorPicker");
const scoreDiv = document.getElementById("score");
const timerDiv = document.getElementById("timer");
const leaderboardList = document.getElementById("leaderboardList");

// === CONSTANTES ===
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const MAX_PLAYER_RADIUS = 200;  // augmenté
const PLAYER_BASE_SPEED = 3;
const PLAYER_SPLIT_SPEED = 7;
const PLAYER_FUSION_DELAY = 4000; // ms
const FUSION_SPEED = 0.05;

// Pseudos bot réalistes
const BOT_NAMES = [
  "Luna", "Kai", "Nova", "Zara", "Axel", "Rex", "Mila", "Neo", "Ivy", "Jax",
  "Zane", "Lexi", "Finn", "Vera", "Troy", "Skye", "Nash", "Rhea", "Dax", "Lior"
];

// === Variables de jeu ===
let playerCells = [];
let bots = [];
let foods = [];
let gameStartTime = null;
let gameOver = false;
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let animationFrameId;
let lastTime = 0;

// === UTILITAIRES ===
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (start, end, t) => start + (end - start) * t;

// === RESIZE ===
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// === SPAWN FOOD ===
const FOOD_EMOJIS = ["🍕", "🍔", "🌭", "🍎", "🍉", "🍇", "🍩", "🍬", "🥐", "🍫"];

function spawnFood() {
  foods.length = 0;
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
    });
  }
}

function spawnRandomFood(count = 5) {
  for (let i = 0; i < count; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
    });
  }
}

// === SPAWN BOTS ===
function createBot(minRadius = 30) {
  const r = minRadius + Math.random() * 40;
  return {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r,
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    speed: 0.8 + Math.random() * 1.2,
    target: null,
    score: Math.floor(r),
    respawnTimeout: null,
    changeTargetTime: 0,
    pseudo: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 99) // pseudo unique simple
  };
}

function spawnBots(initial = true) {
  if (initial) bots.length = 0;
  while (bots.length < MAX_BOTS) {
    const minRadius = playerCells[0]?.r ? playerCells[0].r + 10 : 30;
    bots.push(createBot(minRadius));
  }
}

function respawnBot(bot) {
  const playerMainR = playerCells[0]?.r || 20;
  const variation = Math.random() * 40 - 20;
  const newRadius = clamp(playerMainR + variation, 10, MAX_PLAYER_RADIUS - 10);
  Object.assign(bot, {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: newRadius,
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    speed: 0.8 + Math.random() * 1.5,
    target: null,
    score: Math.floor(newRadius),
    respawnTimeout: null,
    changeTargetTime: 0,
    pseudo: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 99)
  });
}

// === POSITION DANS LA MAP ===
function clampPosition(entity) {
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// === DÉPLACEMENT JOUEUR ===
function getMouseWorldPos() {
  if (playerCells.length === 0) return { x: 0, y: 0 };
  const mainCell = playerCells[0];
  return {
    x: (mouse.x - canvas.width / 2) / cameraZoom + mainCell.x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + mainCell.y,
  };
}

function movePlayerCells() {
  const now = performance.now();
  for (let idx = playerCells.length - 1; idx >= 0; idx--) {
    const cell = playerCells[idx];
    let target;
    if (idx === 0) {
      target = getMouseWorldPos();
    } else {
      target = playerCells[0];
    }
    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const distance = Math.hypot(dx, dy);
    let speed = cell.speed || PLAYER_BASE_SPEED;
    if (idx !== 0) speed *= 1.2;
    if (distance > 1) {
      const moveDist = Math.min(distance, speed);
      cell.x += (dx / distance) * moveDist;
      cell.y += (dy / distance) * moveDist;
      clampPosition(cell);
    }

    if (playerCells.length > 1 && now - cell.lastSplit > PLAYER_FUSION_DELAY) {
      const distToMain = dist(cell, playerCells[0]);
      if (distToMain < cell.r + playerCells[0].r) {
        playerCells[0].targetR = Math.min(MAX_PLAYER_RADIUS, playerCells[0].targetR + cell.r * 0.8);
        playerCells[0].score += cell.score || 0;
        playerCells.splice(idx, 1);
      }
    }
    cell.r = lerp(cell.r, cell.targetR, FUSION_SPEED);
  }
}

function splitPlayer() {
  if (playerCells.length >= 8) return;
  const mainCell = playerCells[0];
  if (mainCell.r < 40) return;
  const splitRadius = mainCell.r / 2;
  mainCell.targetR = mainCell.r - splitRadius;
  mainCell.lastSplit = performance.now();
  const mousePos = getMouseWorldPos();
  const angle = Math.atan2(mousePos.y - mainCell.y, mousePos.x - mainCell.x);
  const newCell = {
    x: mainCell.x + Math.cos(angle) * (mainCell.r + splitRadius + 5),
    y: mainCell.y + Math.sin(angle) * (mainCell.r + splitRadius + 5),
    r: splitRadius,
    targetR: splitRadius,
    color: mainCell.color,
    speed: PLAYER_SPLIT_SPEED,
    score: 0,
    shield: false,
    lastSplit: performance.now(),
    dx: Math.cos(angle) * PLAYER_SPLIT_SPEED,
    dy: Math.sin(angle) * PLAYER_SPLIT_SPEED,
    pseudo: playerCells[0].pseudo || "Vous"
  };
  playerCells.push(newCell);
}

function moveSplitCells() {
  for (let i = 1; i < playerCells.length; i++) {
    const cell = playerCells[i];
    cell.x += cell.dx;
    cell.y += cell.dy;
    clampPosition(cell);
    cell.dx *= 0.9;
    cell.dy *= 0.9;
  }
}

// === IA BOTS ===
function botsAI() {
  const now = performance.now();
  bots.forEach(bot => {
    if (bot.respawnTimeout) return;
    if (!bot.changeTargetTime || now > bot.changeTargetTime) {
      bot.changeTargetTime = now + 1500 + Math.random() * 2500;

      let possibleTargets = [];

      // Nourriture
      possibleTargets.push(...foods);

      // Cibles bots plus petits que lui
      for (const otherBot of bots) {
        if (otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r * 0.9) {
          possibleTargets.push(otherBot);
        }
      }

      // Joueur : bots ciblent cellules plus petites et fuient cellules plus grosses
      for (const cell of playerCells) {
        if (cell.r < bot.r * 0.9 && !gameOver) {
          possibleTargets.push(cell);
        }
        if (cell.r > bot.r * 1.1 && !gameOver) {
          const fleeX = bot.x - (cell.x - bot.x);
          const fleeY = bot.y - (cell.y - bot.y);
          possibleTargets.push({ x: fleeX, y: fleeY, isPoint: true });
        }
      }

      // Cibles aléatoires pour errer
      for (let i = 0; i < 5; i++) {
        possibleTargets.push({
          x: (Math.random() - 0.5) * MAP_SIZE,
          y: (Math.random() - 0.5) * MAP_SIZE,
          r: 0,
          isPoint: true,
        });
      }

      bot.target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    }

    if (!bot.target) return;

    const dx = bot.target.x - bot.x;
    const dy = bot.target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      const moveDist = Math.min(distance, bot.speed);
      bot.x += (dx / distance) * moveDist;
      bot.y += (dy / distance) * moveDist;
      clampPosition(bot);
    }
  });
}

// === SUPPRESSION & RESPAWN BOT ===
function removeBot(index) {
  const bot = bots[index];
  if (bot.respawnTimeout) return;

  bot.respawnTimeout = setTimeout(() => {
    respawnBot(bot);
  }, 2000);

  bot.x = 99999;
  bot.y = 99999;
  bot.r = 0;
  bot.target = null;
  bot.score = 0;
}

// === INTERACTIONS ===
function eatCheck() {
  // Joueur mange nourriture
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    for (const cell of playerCells) {
      if (dist(cell, food) < cell.r + food.r) {
        foods.splice(i, 1);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + 0.5);
        spawnRandomFood(1);
        break;
      }
    }
  }

  // Joueur mange bots plus petits
  for (let i = bots.length - 1; i >= 0; i--) {
    const bot = bots[i];
    if (bot.respawnTimeout) continue;
    for (const cell of playerCells) {
      if (dist(cell, bot) < cell.r && cell.r > bot.r * 1.1) {
        cell.score += Math.floor(bot.r);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + bot.r * 0.6);
        removeBot(i);
        break;
      }
    }
  }

  // Bots mangent joueur plus petits
  for (const bot of bots) {
    if (bot.respawnTimeout) continue;
    for (const cell of playerCells) {
      if (dist(bot, cell) < bot.r && bot.r > cell.r * 1.1) {
        // Mort du joueur (on reset)
        gameOver = true;
      }
    }
  }

  // Bots mangent nourriture
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    for (const bot of bots) {
      if (bot.respawnTimeout) continue;
      if (dist(bot, food) < bot.r + food.r) {
        foods.splice(i, 1);
        bot.r = Math.min(MAX_PLAYER_RADIUS, bot.r + 0.5);
        spawnRandomFood(1);
        break;
      }
    }
  }

  // Bots mangent bots plus petits
  for (let i = 0; i < bots.length; i++) {
    const botA = bots[i];
    if (botA.respawnTimeout) continue;
    for (let j = i + 1; j < bots.length; j++) {
      const botB = bots[j];
      if (botB.respawnTimeout) continue;
      if (botA.r > botB.r * 1.1 && dist(botA, botB) < botA.r) {
        botA.r = Math.min(MAX_PLAYER_RADIUS, botA.r + botB.r * 0.5);
        removeBot(j);
        break;
      }
    }
  }
}

// === ZOOM ET CAMERA ===
let cameraZoom = 1;
function updateCamera() {
  if (!playerCells.length) return;
  const mainCell = playerCells[0];
  const targetZoom = clamp(50 / mainCell.r, 0.2, 1);
  cameraZoom = lerp(cameraZoom, targetZoom, 0.05);
}

// === DESSIN ===
function drawCircle(x, y, r, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawTextInCircle(text, x, y, r, color = "#fff") {
  ctx.fillStyle = color;
  ctx.font = `${Math.max(r / 3, 12)}px Arial Black, Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

// === DESSIN DE LA CARTE ===
function drawMap() {
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// === DESSIN DES OBJETS ===
function drawFoods(offsetX, offsetY) {
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  foods.forEach(food => {
    const screenX = (food.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (food.y - offsetY) * cameraZoom + canvas.height / 2;
    if (
      screenX + food.r * cameraZoom < 0 ||
      screenX - food.r * cameraZoom > canvas.width ||
      screenY + food.r * cameraZoom < 0 ||
      screenY - food.r * cameraZoom > canvas.height
    ) return;
    ctx.fillText(food.emoji, screenX, screenY);
  });
}

function drawBots(offsetX, offsetY) {
  bots.forEach(bot => {
    if (bot.respawnTimeout) return;
    const screenX = (bot.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (bot.y - offsetY) * cameraZoom + canvas.height / 2;
    const rScaled = bot.r * cameraZoom;
    if (
      screenX + rScaled < 0 ||
      screenX - rScaled > canvas.width ||
      screenY + rScaled < 0 ||
      screenY - rScaled > canvas.height
    ) return;

    drawCircle(screenX, screenY, rScaled, bot.color);
    drawTextInCircle(bot.pseudo, screenX, screenY, rScaled, "#fff");
  });
}

function drawPlayerCells(offsetX, offsetY) {
  playerCells.forEach(cell => {
    const screenX = (cell.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (cell.y - offsetY) * cameraZoom + canvas.height / 2;
    const rScaled = cell.r * cameraZoom;
    drawCircle(screenX, screenY, rScaled, cell.color);
    drawTextInCircle(cell.pseudo || "Vous", screenX, screenY, rScaled, "#fff");
  });
}

// === LEADERBOARD ===
function updateLeaderboard() {
  const allPlayers = [...bots, ...playerCells];
  allPlayers.sort((a, b) => (b.r || 0) - (a.r || 0));
  leaderboardList.innerHTML = "";
  for (let i = 0; i < Math.min(10, allPlayers.length); i++) {
    const p = allPlayers[i];
    const li = document.createElement("li");
    li.textContent = p.pseudo || "???";
    const scoreSpan = document.createElement("span");
    scoreSpan.textContent = Math.floor(p.r || 0);
    li.appendChild(scoreSpan);
    leaderboardList.appendChild(li);
  }
}

// === TIMER ===
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
}

// === BOUCLE DE JEU ===
function gameLoop(time = 0) {
  if (!gameStartTime) gameStartTime = time;
  const elapsed = time - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION_MS - elapsed);

  if (remaining === 0 || gameOver) {
    endGame();
    return;
  }

  movePlayerCells();
  moveSplitCells();
  botsAI();
  eatCheck();
  updateCamera();

  // Centre caméra sur le joueur
  const offsetX = playerCells[0].x;
  const offsetY = playerCells[0].y;

  drawMap();
  drawFoods(offsetX, offsetY);
  drawBots(offsetX, offsetY);
  drawPlayerCells(offsetX, offsetY);

  updateLeaderboard();

  // Update HUD
  scoreDiv.textContent = `Score : ${Math.floor(playerCells[0].r)}`;
  timerDiv.textContent = `Temps restant : ${formatTime(remaining)}`;

  animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame() {
  cancelAnimationFrame(animationFrameId);
  alert(`Fin de la partie ! Score final : ${Math.floor(playerCells[0].r)}`);
  location.reload();
}

// === EVENEMENTS ===
startBtn.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    alert("Choisis un pseudo !");
    pseudoInput.focus();
    return;
  }
  startGame(pseudo, colorPicker.value);
});

canvas.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

canvas.addEventListener("click", () => {
  splitPlayer();
});

// Touch support for mobile: move mouse position on touchmove
canvas.addEventListener("touchmove", e => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchstart", e => {
  splitPlayer();
  e.preventDefault();
}, { passive: false });

// === DEMARRER JEU ===
function startGame(pseudo, color) {
  menu.style.display = "none";
  gameContainer.style.display = "block";
  playerCells = [{
    x: 0,
    y: 0,
    r: 30,
    targetR: 30,
    color,
    speed: PLAYER_BASE_SPEED,
    score: 0,
    shield: false,
    lastSplit: 0,
    pseudo,
  }];
  spawnFood();
  spawnBots();
  gameStartTime = null;
  gameOver = false;
  animationFrameId = requestAnimationFrame(gameLoop);
}
