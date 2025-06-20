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

// === CONSTANTES ===
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 min
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const MAX_PLAYER_RADIUS = 150;
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
let virus = null;
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

// === INPUTS ===
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

// === RESIZE ===
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// === SPAWN FOOD ===
function spawnFood() {
  foods.length = 0; // plus rapide que new array
  for(let i=0; i < FOOD_COUNT; i++){
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: "🍕"
    });
  }
}
function spawnRandomFood(count=5){
  for(let i=0; i < count; i++){
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: "🍕"
    });
  }
}

// === SPAWN BOTS (amélioré) ===
function createBot(minRadius = 30) {
  const r = minRadius + Math.random() * 40; // plus gros bots dès le départ
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
  const variation = Math.random() * 40 - 20; // entre -20 et +20
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
  });
}

// === POSITION DANS LA MAP ===
function clampPosition(entity){
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// === DÉPLACEMENT JOUEUR ===
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
  // boucle inverse pour éviter bugs splice lors fusion
  for(let idx = playerCells.length - 1; idx >= 0; idx--){
    const cell = playerCells[idx];
    let target;
    if(idx === 0){
      target = getMouseWorldPos();
    } else {
      target = playerCells[0];
    }
    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const distance = Math.hypot(dx, dy);
    let speed = cell.speed || PLAYER_BASE_SPEED;
    if(idx !== 0) speed *= 1.2; // split cells plus rapides
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

// === SPLIT JOUEUR ===
function splitPlayer(){
  if(playerCells.length >= 8) return; // max 8 splits
  const mainCell = playerCells[0];
  if(mainCell.r < 40) return; // trop petit pour split
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

// === MOUVEMENT CELLULES SPLIT ===
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

// === IA BOTS (améliorée) ===
function botsAI(){
  const now = performance.now();
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    if(!bot.changeTargetTime || now > bot.changeTargetTime){
      bot.changeTargetTime = now + 1500 + Math.random() * 2500;

      let possibleTargets = [];

      // Nourriture
      possibleTargets.push(...foods);

      // Cibles bots plus petits que lui
      for(const otherBot of bots){
        if(otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r * 0.9){
          possibleTargets.push(otherBot);
        }
      }

      // Joueur : bots ciblent cellules plus petites et fuient cellules plus grosses
      for(const cell of playerCells){
        if(cell.r < bot.r * 0.9 && !gameOver){
          possibleTargets.push(cell);
        }
        if(cell.r > bot.r * 1.1 && !gameOver){
          // fuir joueur plus gros
          const fleeX = bot.x - (cell.x - bot.x);
          const fleeY = bot.y - (cell.y - bot.y);
          possibleTargets.push({x: fleeX, y: fleeY, isPoint:true});
        }
      }

      // Cibles aléatoires pour errer
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

// === SUPPRESSION & RESPAWN BOT ===
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

// === INTERACTIONS ===
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
      if(dist(cell, bot) < cell.r && cell.r > bot.r * 1.1){
        cell.score += Math.floor(bot.r);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + bot.r * 0.6);
        removeBot(i);
        break;
      }
    }
  }

  // Bots mangent joueur plus petits
  for(const bot of bots){
    if(bot.respawnTimeout) continue;
    for(const cell of playerCells){
      if(dist(bot, cell) < bot.r && bot.r > cell.r * 1.1 && !gameOver){
        gameOver = true;
        alert("Tu as été mangé ! Réessaie.");
        stats.losses++;
        localStorage.setItem("losses", stats.losses);
        menu.style.display = "block";
        gameContainer.style.display = "none";
        resetGame();
        return; // Stop après gameOver
      }
    }
  }
}

// === DESSIN CELLULE ===
function drawCell(entity, options = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = options.color || entity.color || "#00ff00";
  ctx.shadowColor = options.color || entity.color || "#00ff00";
  ctx.shadowBlur = 10;
  ctx.arc(entity.x, entity.y, entity.r, 0, Math.PI * 2);
  ctx.fill();

  if (options.emoji) {
    ctx.font = `${entity.r}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.fillText(options.emoji, entity.x, entity.y + entity.r * 0.1);
  }

  if(entity.shield){
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// === DESSIN ===
function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(playerCells.length === 0) return; // safeguard

  const mainCell = playerCells[0];
  cameraZoom = 1 / (mainCell.r / 50);
  cameraZoom = clamp(cameraZoom, 0.3, 1.2);

  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-mainCell.x, -mainCell.y);

  // Nourriture
  for(const food of foods){
    drawCell(food, {emoji: food.emoji, color: "#66bb66"});
  }

  // Bots
  for(const bot of bots){
    if(bot.respawnTimeout) continue;
    drawCell(bot, {color: bot.color});
  }

  // Joueur
  for(const cell of playerCells){
    drawCell(cell, {color: cell.color});
  }

  ctx.restore();

  // HUD
  let totalScore = 0;
  for(const c of playerCells) totalScore += c.score;
  scoreDiv.textContent = "Score : " + Math.floor(totalScore);

  const elapsed = Math.max(0, GAME_DURATION_MS - (performance.now() - gameStartTime));
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(elapsed <= 0){
    gameOver = true;
    alert("Temps écoulé ! Ton score final : " + Math.floor(totalScore));
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    menu.style.display = "block";
    gameContainer.style.display = "none";
    resetGame();
  }
}

// === RESET JEU ===
function resetGame(){
  playerCells = [{
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: colorPicker.value,
    speed: PLAYER_BASE_SPEED,
    score: 0,
    shield: false,
    lastSplit: 0,
    dx: 0,
    dy: 0
  }];
  spawnFood();
  spawnBots(true);
  bonuses = [];
  gameStartTime = performance.now();
  gameOver = false;
  updateMenuStats();
  // Ne rien faire ici avec l'affichage
}

// === UPDATE MENU STATS ===
function updateMenuStats(){
  if(playerCells.length === 0) return;
  const mainCell = playerCells[0];
  menuLevelSpan.textContent = Math.floor(mainCell.r);
  menuGradeSpan.textContent = getGrade(mainCell.r);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;
}

// === BOUCLE PRINCIPALE ===
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
  draw();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// === START GAME ===
startBtn.onclick = () => {
  const name = pseudoInput.value.trim();
  if(name.length < 1){
    alert("Veuillez entrer un pseudo !");
    return;
  }
  playerCells = [{
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: colorPicker.value,
    speed: PLAYER_BASE_SPEED,
    score: 0,
    shield: false,
    lastSplit: 0,
    dx: 0,
    dy: 0
  }];
  updateMenuStats();
  menu.style.display = "none";
  gameContainer.style.display = "block";
  spawnFood();
  spawnBots();
  bonuses = [];
  gameStartTime = performance.now();
  gameOver = false;
  animationFrameId = requestAnimationFrame(gameLoop);
};
