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
const menuLevelSpan = document.getElementById("menuLevel");
const menuGradeSpan = document.getElementById("menuGrade");
const menuWinsSpan = document.getElementById("menuWins");
const menuLossesSpan = document.getElementById("menuLosses");
const leaderboardDiv = document.getElementById("leaderboard");

// === CONSTANTES ===
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 min
const MAP_SIZE = 9000;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const MAX_PLAYER_RADIUS = 200;  // augmenté
const PLAYER_BASE_SPEED = 3;
const PLAYER_SPLIT_SPEED = 7;
const PLAYER_FUSION_DELAY = 4000; // ms
const FUSION_SPEED = 0.05;

// === Variables de jeu ===
let stats = {
  wins: parseInt(localStorage.getItem("wins")) || 0,
  losses: parseInt(localStorage.getItem("losses")) || 0,
};

let playerCells = [];
let bots = [];
let foods = [];
let bonuses = [];

let cameraZoom = 1;
let gameStartTime = null;
let gameOver = false;

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

let animationFrameId;
let lastTime = 0;

// === UTILITAIRES ===
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (start, end, t) => start + (end - start) * t;

const GRADES = [
  "Bronze 1","Bronze 2","Bronze 3",
  "Argent 1","Argent 2","Argent 3",
  "Or 1","Or 2","Or 3",
  "Diamant 1","Diamant 2","Diamant 3",
  "Élite 1","Élite 2","Élite 3",
  "Immortal 1","Immortal 2","Immortal 3",
  "Champion 1","Champion 2","Champion 3",
  "Légendes 1","Légendes 2","Légendes 3",
  "Ranked"
];

function getGrade(level) {
  if (level >= MAX_LEVEL) return GRADES[GRADES.length - 1];
  const index = Math.floor(level / (MAX_LEVEL / (GRADES.length - 1)));
  return GRADES[index];
}

// === Input ===
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener("touchmove", e => {
  if(e.touches.length > 0){
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  }
}, { passive:true });

window.addEventListener("mousedown", () => {
  if(!gameOver) splitPlayer();
});
window.addEventListener("keydown", e => {
  if(e.code === "Space" && !gameOver){
    e.preventDefault();
    splitPlayer();
  }
});

// === Resize ===
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// === Spawn food ===
const FOOD_EMOJIS = ["🍕", "🍔", "🌭", "🍎", "🍉", "🍇", "🍩", "🍬", "🥐", "🍫"];

function spawnFood() {
  foods.length = 0;
  for(let i=0; i < FOOD_COUNT; i++){
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
    });
  }
}

function spawnRandomFood(count=5){
  for(let i=0; i < count; i++){
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
    });
  }
}

// === Spawn bots ===
const BOT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
  "Xray", "Yankee", "Zulu"
];

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
    name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random()*999)
  };
}

function spawnBots(initial = true) {
  if (initial) bots.length = 0;
  while (bots.length < MAX_BOTS) {
    const minRadius = playerCells[0]?.r ? playerCells[0].r + 10 : 30;
    bots.push(createBot(minRadius));
  }
}

function respawnBot(bot){
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
    name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random()*999)
  });
}

// === Position & déplacement ===
function clampPosition(entity){
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

function getMouseWorldPos(){
  if(playerCells.length === 0) return {x: 0, y:0};
  const mainCell = playerCells[0];
  return {
    x: (mouse.x - canvas.width / 2) / cameraZoom + mainCell.x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + mainCell.y,
  };
}

function movePlayerCells(){
  const now = performance.now();
  for(let idx = playerCells.length - 1; idx >= 0; idx--){
    const cell = playerCells[idx];
    let target = (idx === 0) ? getMouseWorldPos() : playerCells[0];

    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const distance = Math.hypot(dx, dy);
    let speed = cell.speed || PLAYER_BASE_SPEED;
    if(idx !== 0) speed *= 1.2;
    if(distance > 1){
      const moveDist = Math.min(distance, speed);
      cell.x += (dx / distance) * moveDist;
      cell.y += (dy / distance) * moveDist;
      clampPosition(cell);
    }

    if(playerCells.length > 1 && now - cell.lastSplit > PLAYER_FUSION_DELAY){
      const distToMain = dist(cell, playerCells[0]);
      if(distToMain < cell.r + playerCells[0].r){
        playerCells[0].targetR = Math.min(MAX_PLAYER_RADIUS, playerCells[0].targetR + cell.r * 0.8);
        playerCells[0].score += cell.score || 0;
        playerCells.splice(idx,1);
      }
    }
    cell.r = lerp(cell.r, cell.targetR, FUSION_SPEED);
  }
}

function splitPlayer(){
  if(playerCells.length >= 8) return;
  const mainCell = playerCells[0];
  if(mainCell.r < 40) return;
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
    dy: Math.sin(angle) * PLAYER_SPLIT_SPEED
  };
  playerCells.push(newCell);
}

function moveSplitCells(){
  for(let i=1; i < playerCells.length; i++){
    const cell = playerCells[i];
    cell.x += cell.dx;
    cell.y += cell.dy;
    clampPosition(cell);
    cell.dx *= 0.9;
    cell.dy *= 0.9;
  }
}

// === Bots AI ===
function botsAI(){
  const now = performance.now();
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    if(!bot.changeTargetTime || now > bot.changeTargetTime){
      bot.changeTargetTime = now + 1500 + Math.random() * 2500;

      let possibleTargets = [];

      possibleTargets.push(...foods);

      for(const otherBot of bots){
        if(otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r * 0.9){
          possibleTargets.push(otherBot);
        }
      }

      for(const cell of playerCells){
        if(cell.r < bot.r * 0.9 && !gameOver){
          possibleTargets.push(cell);
        }
        if(cell.r > bot.r * 1.1 && !gameOver){
          const fleeX = bot.x - (cell.x - bot.x);
          const fleeY = bot.y - (cell.y - bot.y);
          possibleTargets.push({x: fleeX, y: fleeY, isPoint:true});
        }
      }

      for(let i=0; i<5; i++){
        possibleTargets.push({
          x: (Math.random() - 0.5) * MAP_SIZE,
          y: (Math.random() - 0.5) * MAP_SIZE,
          r: 0,
          isPoint: true,
        });
      }

      bot.target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    }

    if(!bot.target) return;

    const dx = bot.target.x - bot.x;
    const dy = bot.target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    if(distance > 1){
      const moveDist = Math.min(distance, bot.speed);
      bot.x += (dx / distance) * moveDist;
      bot.y += (dy / distance) * moveDist;
      clampPosition(bot);
    }
  });
}

// === Remove & respawn bot ===
function removeBot(index){
  const bot = bots[index];
  if(bot.respawnTimeout) return;

  bot.respawnTimeout = setTimeout(() => {
    respawnBot(bot);
  }, 2000);

  bot.x = 99999;
  bot.y = 99999;
  bot.r = 0;
  bot.target = null;
  bot.score = 0;
}

// === Eat check ===
function eatCheck(){
  // Joueur mange nourriture
  for(let i = foods.length - 1; i >= 0; i--){
    const food = foods[i];
    for(const cell of playerCells){
      if(dist(cell, food) < cell.r + food.r){
        foods.splice(i, 1);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + 0.5);
        spawnRandomFood(1);
        break;
      }
    }
  }

  // Joueur mange bots plus petits
  for(let i = bots.length - 1; i >= 0; i--){
    const bot = bots[i];
    if(bot.respawnTimeout) continue;
    for(const cell of playerCells){
      if(cell.r > bot.r * 1.1 && dist(cell, bot) < cell.r + bot.r){
        removeBot(i);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + bot.r * 0.7);
        break;
      }
    }
  }

  // Bots mangent nourriture
  for(let i = foods.length - 1; i >= 0; i--){
    const food = foods[i];
    bots.forEach(bot => {
      if(bot.respawnTimeout) return;
      if(dist(bot, food) < bot.r + food.r){
        foods.splice(i, 1);
        bot.r = Math.min(MAX_PLAYER_RADIUS, bot.r + 0.5);
        spawnRandomFood(1);
      }
    });
  }

  // Bots mangent bots plus petits
  for(let i = bots.length - 1; i >= 0; i--){
    const botA = bots[i];
    if(botA.respawnTimeout) continue;
    for(let j = bots.length - 1; j >= 0; j--){
      if(i === j) continue;
      const botB = bots[j];
      if(botB.respawnTimeout) continue;
      if(botA.r > botB.r * 1.1 && dist(botA, botB) < botA.r + botB.r){
        removeBot(j);
        botA.r = Math.min(MAX_PLAYER_RADIUS, botA.r + botB.r * 0.7);
      }
    }
  }
}

// === DRAWING ===

// Draw map grid
function drawMapGrid(offsetX, offsetY){
  const gridSize = 500;
  const left = -HALF_MAP;
  const top = -HALF_MAP;
  ctx.save();
  ctx.strokeStyle = "#0a0";
  ctx.lineWidth = 1;

  ctx.translate(canvas.width/2 - offsetX * cameraZoom, canvas.height/2 - offsetY * cameraZoom);

  ctx.beginPath();
  for(let x = left; x <= HALF_MAP; x += gridSize){
    ctx.moveTo(x, top);
    ctx.lineTo(x, HALF_MAP);
  }
  for(let y = top; y <= HALF_MAP; y += gridSize){
    ctx.moveTo(left, y);
    ctx.lineTo(HALF_MAP, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMap(offsetX, offsetY){
  drawMapGrid(offsetX, offsetY);
}

function drawFoods(offsetX, offsetY){
  ctx.save();
  ctx.font = `${12 * cameraZoom}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  foods.forEach(food => {
    const screenX = (food.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (food.y - offsetY) * cameraZoom + canvas.height / 2;
    ctx.fillText(food.emoji, screenX, screenY);
  });
  ctx.restore();
}

function drawBots(offsetX, offsetY){
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `${12 * cameraZoom}px Arial`;
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    const screenX = (bot.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (bot.y - offsetY) * cameraZoom + canvas.height / 2;

    // Cercle bot
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, bot.r * cameraZoom, 0, Math.PI * 2);
    ctx.fill();

    // Pseudo centré dans cercle
    ctx.fillStyle = "#000";
    ctx.font = `${Math.min(bot.r * 1.2, 18) * cameraZoom}px Arial Black`;
    ctx.fillText(bot.name, screenX, screenY);
  });
  ctx.restore();
}

function drawPlayerCells(offsetX, offsetY){
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  playerCells.forEach(cell => {
    const screenX = (cell.x - offsetX) * cameraZoom + canvas.width / 2;
    const screenY = (cell.y - offsetY) * cameraZoom + canvas.height / 2;

    ctx.fillStyle = cell.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, cell.r * cameraZoom, 0, Math.PI * 2);
    ctx.fill();

    // Pseudo joueur (seulement sur la cellule principale)
    if(cell === playerCells[0]){
      ctx.fillStyle = "#000";
      ctx.font = `${Math.min(cell.r * 1.5, 24) * cameraZoom}px Arial Black`;
      ctx.fillText(cell.pseudo || "Joueur", screenX, screenY);
    }
  });

  ctx.restore();
}

function drawLeaderboard(){
  leaderboardDiv.innerHTML = "";
  const sortedPlayers = [...bots, ...playerCells];
  sortedPlayers.sort((a, b) => (b.score || b.r) - (a.score || a.r));
  const topPlayers = sortedPlayers.slice(0, 10);

  topPlayers.forEach((p, i) => {
    const div = document.createElement("div");
    div.textContent = `${i + 1}. ${p.name || p.pseudo || "Joueur"} - Score: ${Math.floor(p.score || p.r)}`;
    leaderboardDiv.appendChild(div);
  });
}

let barrierGlowPulse = 0;
let barrierGlowDirection = 1;

const barrierParticles = [];
for(let i=0; i < 40; i++){
  barrierParticles.push({
    side: ["left","right","top","bottom"][i % 4],
    offset: Math.random() * MAP_SIZE,
    speed: 0.3 + Math.random() * 0.7
  });
}

function drawBarrier(offsetX, offsetY, deltaTime) {
  const thickness = 60 * cameraZoom;
  const inner = thickness / 2;

  ctx.save();

  // Pulsation glow
  barrierGlowPulse += barrierGlowDirection * deltaTime * 0.005;
  if(barrierGlowPulse > 1) {
    barrierGlowPulse = 1;
    barrierGlowDirection = -1;
  } else if(barrierGlowPulse < 0) {
    barrierGlowPulse = 0;
    barrierGlowDirection = 1;
  }
  const glowIntensity = 10 + 10 * barrierGlowPulse;

  ctx.lineWidth = thickness;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#00ff00");
  gradient.addColorStop(0.5, "#0f0");
  gradient.addColorStop(1, "#004400");
  ctx.strokeStyle = gradient;

  ctx.shadowColor = "#00ff00";
  ctx.shadowBlur = glowIntensity;

  const left = (-HALF_MAP - offsetX) * cameraZoom + canvas.width / 2;
  const right = (HALF_MAP - offsetX) * cameraZoom + canvas.width / 2;
  const top = (-HALF_MAP - offsetY) * cameraZoom + canvas.height / 2;
  const bottom = (HALF_MAP - offsetY) * cameraZoom + canvas.height / 2;

  // Draw solid borders (4 sides)
  ctx.beginPath();
  ctx.moveTo(left, top + inner);
  ctx.lineTo(left, bottom - inner);
  ctx.moveTo(left + inner, top);
  ctx.lineTo(right - inner, top);
  ctx.moveTo(right, top + inner);
  ctx.lineTo(right, bottom - inner);
  ctx.moveTo(left + inner, bottom);
  ctx.lineTo(right - inner, bottom);
  ctx.stroke();

  // Draw moving particles on border
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#7fff7f";
  ctx.shadowBlur = 15;

  barrierParticles.forEach(p => {
    p.offset += p.speed * deltaTime * 0.001;
    if(p.offset > MAP_SIZE) p.offset = 0;

    let x1, y1, x2, y2;
    const size = 20 * cameraZoom;

    switch(p.side) {
      case "left":
        x1 = left + thickness/3;
        y1 = top + p.offset * cameraZoom;
        x2 = x1;
        y2 = y1 + size;
        break;
      case "right":
        x1 = right - thickness/3;
        y1 = bottom - p.offset * cameraZoom;
        x2 = x1;
        y2 = y1 - size;
        break;
      case "top":
        x1 = left + p.offset * cameraZoom;
        y1 = top + thickness/3;
        x2 = x1 + size;
        y2 = y1;
        break;
      case "bottom":
        x1 = right - p.offset * cameraZoom;
        y1 = bottom - thickness/3;
        x2 = x1 - size;
        y2 = y1;
        break;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // Draw blinking segments on borders
  ctx.lineWidth = thickness / 4;
  const segmentLength = MAP_SIZE / 10;

  for(let i=0; i < 10; i++) {
    const phase = (performance.now() / 500 + i) % 2;
    const alpha = 0.5 + 0.5 * Math.sin(phase * Math.PI);

    ctx.strokeStyle = `rgba(0,255,0,${alpha.toFixed(2)})`;

    // Top
    ctx.beginPath();
    ctx.moveTo(left + i * segmentLength * cameraZoom, top + inner);
    ctx.lineTo(left + (i+1) * segmentLength * cameraZoom, top + inner);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(left + i * segmentLength * cameraZoom, bottom - inner);
    ctx.lineTo(left + (i+1) * segmentLength * cameraZoom, bottom - inner);
    ctx.stroke();

    // Left
    ctx.beginPath();
    ctx.moveTo(left + inner, top + i * segmentLength * cameraZoom);
    ctx.lineTo(left + inner, top + (i+1) * segmentLength * cameraZoom);
    ctx.stroke();

    // Right
    ctx.beginPath();
    ctx.moveTo(right - inner, top + i * segmentLength * cameraZoom);
    ctx.lineTo(right - inner, top + (i+1) * segmentLength * cameraZoom);
    ctx.stroke();
  }

  ctx.restore();
}

// === Drawing main loop ===
function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(playerCells.length === 0) return;

  updateCameraZoom();

  const offsetX = playerCells[0].x;
  const offsetY = playerCells[0].y;

  drawMap(offsetX, offsetY);
  drawFoods(offsetX, offsetY);
  drawBots(offsetX, offsetY);
  drawPlayerCells(offsetX, offsetY);
  drawLeaderboard();

  // Affiche score et temps
  scoreDiv.textContent = "Score : " + Math.floor(playerCells[0].score || playerCells[0].r);
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes}:${seconds.toString().padStart(2, "0")}`;

  if(remaining <= 0) {
    endGame();
  }
}

function updateCameraZoom(){
  const baseZoom = 1;
  const maxZoomOut = 0.3;
  const targetRadius = playerCells[0].r;
  // Zoom out when player grows to keep them visible
  cameraZoom = clamp(baseZoom - (targetRadius / MAX_PLAYER_RADIUS) * (baseZoom - maxZoomOut), maxZoomOut, baseZoom);
}

function endGame(){
  gameOver = true;
  cancelAnimationFrame(animationFrameId);

  const finalScore = Math.floor(playerCells[0].score || playerCells[0].r);
  const level = Math.floor(finalScore);
  menuLevelSpan.textContent = "Niveau : " + level;
  menuGradeSpan.textContent = "Grade : " + getGrade(level);
  if(level >= 100){
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    menuWinsSpan.textContent = stats.wins;
  } else {
    stats.losses++;
    localStorage.setItem("losses", stats.losses);
    menuLossesSpan.textContent = stats.losses;
  }

  gameContainer.style.display = "none";
  menu.style.display = "block";
}

function resetGame() {
  playerCells.length = 0;
  bots.length = 0;
  foods.length = 0;
  bonuses.length = [];
  gameOver = false;
  cameraZoom = 1;

  playerCells.push({
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: colorPicker.value || "#00ff00",
    pseudo: pseudoInput.value || "Joueur",
    score: 0,
    speed: PLAYER_BASE_SPEED,
    shield: false,
    lastSplit: 0
  });

  spawnFood();
  spawnBots();
  gameStartTime = performance.now();

  menu.style.display = "none";
  gameContainer.style.display = "block";

  gameLoop();
}

// === Game loop ===
function gameLoop(timestamp){
  if(!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if(gameOver){
    cancelAnimationFrame(animationFrameId);
    return;
  }

  movePlayerCells();
  moveSplitCells();
  botsAI();
  eatCheck();

  if(playerCells.length === 0){
    endGame();
    return;
  }

  const offsetX = playerCells[0].x;
  const offsetY = playerCells[0].y;

  draw();
  drawBarrier(offsetX, offsetY, delta);

  animationFrameId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener("click", () => {
  if(!pseudoInput.value.trim()){
    alert("Choisis un pseudo !");
    return;
  }
  resetGame();
});

// Initial stats
menuWinsSpan.textContent = stats.wins;
menuLossesSpan.textContent = stats.losses;
menuLevelSpan.textContent = "Niveau : 0";
menuGradeSpan.textContent = "Grade : Bronze 1";
