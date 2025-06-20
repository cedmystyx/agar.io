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
const leaderboardList = document.getElementById("leaderboardList");

// === CONSTANTES ===
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 min
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 4000; // augmenté max level (pour grossir plus)
const MAX_PLAYER_RADIUS = 250; // augmenté rayon max
const PLAYER_BASE_SPEED = 3;
const PLAYER_SPLIT_SPEED = 7;
const PLAYER_FUSION_DELAY = 4000; // ms
const FUSION_SPEED = 0.05;

// Liste de vrais pseudos random pour bots
const BOT_PSEUDOS = [
  "ShadowFox","NinjaCat","PixelPro","GhostWolf","FireStorm",
  "IceDragon","CyberPunk","DarkKnight","AlphaWolf","SilentArrow",
  "RedHawk","BlueTiger","CrazyDuck","SpeedyRabbit","MetalSlug",
  "IronGiant","SilverBlade","ThunderBolt","LoneWolf","FrostBite",
  "RogueAgent","WildCard","NeonFlash","TurboJet","SkyWalker"
];

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

// === SPAWN BOTS (amélioré) ===
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
    pseudo: BOT_PSEUDOS[Math.floor(Math.random() * BOT_PSEUDOS.length)],
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
    pseudo: BOT_PSEUDOS[Math.floor(Math.random() * BOT_PSEUDOS.length)],
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

// === SPLIT JOUEUR ===
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
    dy: Math.sin(angle) * PLAYER_SPLIT_SPEED,
    pseudo: mainCell.pseudo // conserve pseudo joueur aux splits
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

  for(const bot of bots){
    if(bot.respawnTimeout) continue;
    for(const cell of playerCells){
      if(dist(cell, bot) < bot.r && bot.r > cell.r * 1.1){
        gameOver = true;
        stats.losses++;
        localStorage.setItem("losses", stats.losses);
        endGame(false);
        break;
      }
    }
  }
}

// === CAMÉRA ===
function updateCamera(){
  if(playerCells.length === 0) return;
  const mainCell = playerCells[0];
  const targetZoom = clamp(200 / mainCell.r, 0.4, 1.2);
  cameraZoom = lerp(cameraZoom, targetZoom, 0.05);
}

// === DESSINS ===
function drawCircle(x, y, r, color){
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 10;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Dessine une nourriture avec emoji
function drawFood(food){
  ctx.font = `${food.r * 2}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(food.emoji, food.x, food.y);
}

function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(playerCells.length === 0) return;

  const mainCell = playerCells[0];

  // Décalage et zoom caméra
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-mainCell.x, -mainCell.y);

  // Dessin aliments
  for(const food of foods){
    drawFood(food);
  }

  // Dessin bots
  for(const bot of bots){
    if(bot.respawnTimeout) continue;
    drawCircle(bot.x, bot.y, bot.r, bot.color);

    // Pseudo centré dans cercle bot
    ctx.fillStyle = "white";
    ctx.font = `${bot.r / 3}px Arial Black`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 3;
    ctx.fillText(bot.pseudo, bot.x, bot.y);
    ctx.shadowBlur = 0;
  }

  // Dessin joueur (cells)
  for(const cell of playerCells){
    drawCircle(cell.x, cell.y, cell.r, cell.color);

    // Pseudo centré dans cercle joueur
    ctx.fillStyle = "white";
    ctx.font = `${cell.r / 3}px Arial Black`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 3;
    const pseudo = cell.pseudo || pseudoInput.value.trim() || "Vous";
    ctx.fillText(pseudo, cell.x, cell.y);
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // HUD
  scoreDiv.textContent = `Score : ${Math.floor(mainCell.r)}`;
  const timeLeftMs = Math.max(0, GAME_DURATION_MS - (performance.now() - gameStartTime));
  const m = Math.floor(timeLeftMs / 60000);
  const s = Math.floor((timeLeftMs % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// === LEADERBOARD ===
function updateLeaderboard(){
  // Classement par score
  const allPlayers = [
    ...bots.filter(bot => !bot.respawnTimeout).map(b => ({pseudo: b.pseudo, score: Math.floor(b.r)})),
    {pseudo: playerCells[0]?.pseudo || "Vous", score: Math.floor(playerCells[0]?.r || 0)}
  ];

  allPlayers.sort((a,b) => b.score - a.score);

  leaderboardList.innerHTML = "";
  for(let i=0; i < Math.min(10, allPlayers.length); i++){
    const p = allPlayers[i];
    const li = document.createElement("li");
    li.textContent = `${p.pseudo} — ${p.score}`;
    leaderboardList.appendChild(li);
  }
}

// === RESET & START ===
function resetGame(){
  playerCells = [];
  bots = [];
  foods = [];
  gameOver = false;

  const pseudo = pseudoInput.value.trim();
  if(!pseudo){
    alert("Choisis un pseudo !");
    return false;
  }
  const color = colorPicker.value || "#00ff00";

  playerCells.push({
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color,
    score: 0,
    speed: PLAYER_BASE_SPEED,
    shield: false,
    lastSplit: 0,
    pseudo,
  });

  spawnFood();
  spawnBots(true);

  gameStartTime = performance.now();

  updateLevelStats();

  return true;
}

function updateLevelStats(){
  const level = Math.floor(playerCells[0].score);
  menuLevelSpan.textContent = level;
  menuGradeSpan.textContent = getGrade(level);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;
}

// === END GAME ===
function endGame(won){
  gameOver = true;
  if(won){
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    alert("Bravo, tu as gagné !");
  } else {
    stats.losses++;
    localStorage.setItem("losses", stats.losses);
    alert("Perdu, essaie encore !");
  }
  menu.style.display = "block";
  gameContainer.style.display = "none";
  updateLevelStats();
  cancelAnimationFrame(animationFrameId);
}

// === GAME LOOP ===
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
  updateCamera();
  draw();
  updateLeaderboard();

  if(performance.now() - gameStartTime > GAME_DURATION_MS){
    endGame(true);
    return;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// === BUTTON START ===
startBtn.addEventListener("click", () => {
  if(resetGame()){
    menu.style.display = "none";
    gameContainer.style.display = "block";
    lastTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
});

// === Initial affichage du score et stats ===
updateLevelStats();
