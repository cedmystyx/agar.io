// === Récupération des éléments DOM ===
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

// === CONSTANTES & CONFIGURATION ===
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const MAX_PLAYER_RADIUS = 150;
const PLAYER_BASE_SPEED = 3;
const PLAYER_SPLIT_SPEED = 7;
const PLAYER_FUSION_DELAY = 4000; // ms avant fusion possible
const FUSION_SPEED = 0.05; // vitesse fusion radius

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

const FOOD_EMOJIS = ["🍰","🍉","🍕","🍔","🍦","🍩","🍇","🍒","🍎","🍌","🍟","🌮"];

const BONUS_TYPES = ["speed", "shield", "reset"];
const BONUS_COLORS = { speed: "yellow", shield: "cyan", reset: "white" };
const MAX_BONUSES = 5;
const BONUS_SPAWN_INTERVAL_MS = 15000;

// === Variables de jeu ===
let stats = {
  wins: parseInt(localStorage.getItem("wins")) || 0,
  losses: parseInt(localStorage.getItem("losses")) || 0,
};

let playerCells = []; // array des cellules du joueur (pour split/fusion)
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
const getGrade = (level) => {
  if (level >= MAX_LEVEL) return GRADES[GRADES.length - 1];
  const index = Math.floor(level / (MAX_LEVEL / (GRADES.length - 1)));
  return GRADES[index];
};

// === CANVAS & INPUT ===
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

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

// Pour split sur clic gauche ou espace
window.addEventListener("mousedown", e => {
  if(!gameOver) splitPlayer();
});
window.addEventListener("keydown", e => {
  if(e.code === "Space" && !gameOver){
    e.preventDefault();
    splitPlayer();
  }
});

// === SPAWN NOURRITURE ===
function spawnFood() {
  foods = [];
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

// === SPAWN BOTS ===
function createBot() {
  return {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 15 + Math.random() * 15,
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    speed: 1 + Math.random() * 1.5,
    target: null,
    score: 0,
    respawnTimeout: null,
    changeTargetTime: 0,
  };
}
function spawnBots(initial = true) {
  if (initial) bots = [];
  while (bots.length < MAX_BOTS) {
    bots.push(createBot());
  }
}
function respawnBot(bot){
  Object.assign(bot, createBot());
}

// === POSITION DANS LA MAP ===
function clampPosition(entity){
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// === VIRUS ===
function spawnVirus(){
  virus = {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 30,
    color: "red",
    speed: 1.2,
    direction: Math.random() * Math.PI * 2
  };
}
function moveVirus(){
  if(!virus) return;

  virus.x += Math.cos(virus.direction) * virus.speed;
  virus.y += Math.sin(virus.direction) * virus.speed;

  if(virus.x < -HALF_MAP || virus.x > HALF_MAP) virus.direction = Math.PI - virus.direction;
  if(virus.y < -HALF_MAP || virus.y > HALF_MAP) virus.direction = -virus.direction;

  clampPosition(virus);
}

// === BONUS ===
function spawnBonuses(){
  if(bonuses.length >= MAX_BONUSES) return;
  const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
  bonuses.push({
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 8,
    type,
    color: BONUS_COLORS[type]
  });
}
setInterval(spawnBonuses, BONUS_SPAWN_INTERVAL_MS);

function handleBonuses(){
  bonuses = bonuses.filter(bonus => {
    for(const cell of playerCells){
      if(dist(cell, bonus) < cell.r + bonus.r){
        switch(bonus.type){
          case "speed":
            playerCells.forEach(c => c.speed *= 1.5);
            setTimeout(() => playerCells.forEach(c => c.speed = PLAYER_BASE_SPEED), 5000);
            break;
          case "shield":
            playerCells.forEach(c => c.shield = true);
            setTimeout(() => playerCells.forEach(c => c.shield = false), 5000);
            break;
          case "reset":
            playerCells = [{
              x: playerCells[0].x,
              y: playerCells[0].y,
              r: 20,
              targetR: 20,
              color: playerCells[0].color,
              speed: PLAYER_BASE_SPEED,
              score: 0,
              shield: false,
              lastSplit: 0,
              dx: 0,
              dy: 0
            }];
            break;
        }
        return false;
      }
    }
    return true;
  });
}

// === DESSIN BONUS ===
function drawBonuses(){
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI*2);
    ctx.fill();
  });
}

// === POSITION SOURIS DANS LE MONDE ===
function getMouseWorldPos(){
  return {
    x: (mouse.x - canvas.width / 2) / cameraZoom + playerCells[0].x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + playerCells[0].y,
  };
}

// === DÉPLACEMENT DES CELLULES JOUEUR VERS SOURIS ===
function movePlayerCells(){
  const now = performance.now();

  playerCells.forEach((cell, idx) => {
    // Cible = souris uniquement pour la cellule principale (indice 0)
    // Les autres suivent la cellule principale (fusion)
    let target;
    if(idx === 0){
      target = getMouseWorldPos();
    } else {
      target = playerCells[0];
    }

    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const distance = Math.hypot(dx, dy);

    // Vitesse avec accélération
    let speed = cell.speed || PLAYER_BASE_SPEED;
    if(idx !== 0){
      // Plus petites cellules plus rapides pour suivre
      speed *= 1.2;
    }

    if(distance > 1){
      const moveDist = Math.min(distance, speed);
      cell.x += (dx / distance) * moveDist;
      cell.y += (dy / distance) * moveDist;
      clampPosition(cell);
    }

    // Fusion automatique si possible
    if(playerCells.length > 1 && now - cell.lastSplit > PLAYER_FUSION_DELAY){
      const distToMain = dist(cell, playerCells[0]);
      if(distToMain < cell.r + playerCells[0].r){
        // Fusion
        playerCells[0].targetR = Math.min(MAX_PLAYER_RADIUS, playerCells[0].targetR + cell.r * 0.8);
        playerCells[0].score += cell.score || 0;
        playerCells.splice(idx,1);
      }
    }

    // Lissage taille
    cell.r = lerp(cell.r, cell.targetR, FUSION_SPEED);
  });
}

// === SPLIT JOUEUR ===
function splitPlayer(){
  if(playerCells.length >= 8) return; // max 8 splits

  const mainCell = playerCells[0];
  if(mainCell.r < 40) return; // trop petit pour split

  const splitRadius = mainCell.r / 2;
  mainCell.targetR = mainCell.r - splitRadius;
  mainCell.lastSplit = performance.now();

  // Nouvelle cellule lancée vers souris
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

// === MOUVEMENT CELLULES SPLIT (lancées) ===
function moveSplitCells(){
  for(let i=1; i < playerCells.length; i++){
    const cell = playerCells[i];

    cell.x += cell.dx;
    cell.y += cell.dy;
    clampPosition(cell);

    // Décélération progressive
    cell.dx *= 0.9;
    cell.dy *= 0.9;
  }
}

// === IA BOTS ===
function botsAI(){
  const now = performance.now();

  bots.forEach(bot => {
    if(bot.respawnTimeout) return;

    if(!bot.changeTargetTime || now > bot.changeTargetTime){
      bot.changeTargetTime = now + 2000 + Math.random() * 3000;

      let possibleTargets = [];

      possibleTargets.push(...foods);

      bots.forEach(otherBot => {
        if(otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r * 0.9){
          possibleTargets.push(otherBot);
        }
      });

      // Pour bots, ils fuient joueur plus gros et ciblent joueur plus petit
      playerCells.forEach(cell => {
        if(cell.r < bot.r * 0.9 && !gameOver){
          possibleTargets.push(cell);
        }
        if(cell.r > bot.r * 1.1 && !gameOver){
          // Fuire joueur gros
          const fleeX = bot.x - (cell.x - bot.x);
          const fleeY = bot.y - (cell.y - bot.y);
          possibleTargets.push({x: fleeX, y: fleeY, isPoint:true});
        }
      });

      // Points aléatoires
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

    let targetX = bot.target.x;
    let targetY = bot.target.y;

    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
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

// === VÉRIFICATIONS & INTERACTIONS ===
function eatCheck(){
  handleBonuses();

  // Virus touche joueur (toutes cellules)
  if(virus){
    playerCells.forEach(cell => {
      if(dist(cell, virus) < cell.r + virus.r){
        if(!cell.shield){
          cell.r = Math.max(10, cell.r / 2);
          cell.targetR = cell.r;
          spawnVirus();
        }
      }
    });
  }

  // Joueur mange nourriture (toutes cellules)
  for(let i = foods.length - 1; i >= 0; i--){
    let food = foods[i];
    for(let cell of playerCells){
      if(dist(cell, food) < cell.r + food.r){
        foods.splice(i, 1);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + 0.5);
        spawnRandomFood(1);
        break;
      }
    }
  }

  // Joueur mange bots plus petits (toutes cellules)
  for(let i = bots.length - 1; i >= 0; i--){
    let bot = bots[i];
    if(bot.respawnTimeout) continue;
    for(let cell of playerCells){
      if(bot !== cell && dist(cell, bot) < cell.r && cell.r > bot.r * 1.1){
        cell.score += Math.floor(bot.r);
        cell.targetR = Math.min(MAX_PLAYER_RADIUS, cell.targetR + bot.r * 0.6);
        removeBot(i);
        break;
      }
    }
  }

  // Bots mangent joueur plus petits
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    for(let cell of playerCells){
      if(dist(bot, cell) < bot.r && bot.r > cell.r * 1.1 && !gameOver){
        gameOver = true;
        alert("Tu as été mangé ! Réessaie.");
        stats.losses++;
        localStorage.setItem("losses", stats.losses);
        resetGame();
      }
    }
  });
}

// === DESSIN FONCTIONS ===
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

function drawVirus(v) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = v.color;
  ctx.shadowColor = "red";
  ctx.shadowBlur = 15;
  ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
  ctx.fill();

  // Virus spikes
  for(let i=0; i<12; i++){
    const angle = (i * Math.PI * 2) / 12;
    const spikeStart = {
      x: v.x + Math.cos(angle) * v.r,
      y: v.y + Math.sin(angle) * v.r
    };
    const spikeEnd = {
      x: v.x + Math.cos(angle) * (v.r + 12),
      y: v.y + Math.sin(angle) * (v.r + 12)
    };
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(spikeStart.x, spikeStart.y);
    ctx.lineTo(spikeEnd.x, spikeEnd.y);
    ctx.stroke();
  }
  ctx.restore();
}

// === ANIMATION DE LA TAILLE (LISSAGE) ===
function lerp(start, end, t){
  return start + (end - start) * t;
}

// === CAMÉRA & DESSIN ===
function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Centre caméra sur cellule principale + zoom dynamique (taille influence zoom)
  const mainCell = playerCells[0];
  cameraZoom = 1 / (mainCell.r / 50);
  cameraZoom = clamp(cameraZoom, 0.3, 1.2);

  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-mainCell.x, -mainCell.y);

  // DESSIN FOODS
  foods.forEach(food => drawCell(food, {emoji: food.emoji, color: "#66bb66"}));

  // DESSIN BONUS
  drawBonuses();

  // DESSIN VIRUS
  if(virus) drawVirus(virus);

  // DESSIN BOTS
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    drawCell(bot, {color: bot.color});
  });

  // DESSIN CELLULES JOUEUR
  playerCells.forEach(cell => {
    drawCell(cell, {color: cell.color});
  });

  ctx.restore();

  // Mise à jour HUD
  let totalScore = playerCells.reduce((sum, c) => sum + c.score, 0);
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
  spawnBots();
  spawnVirus();
  bonuses = [];
  gameStartTime = performance.now();
  gameOver = false;
  updateMenuStats();
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

// === UPDATE MENU STATS ===
function updateMenuStats(){
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
  moveVirus();
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
  spawnVirus();
  bonuses = [];
  gameStartTime = performance.now();
  gameOver = false;
  animationFrameId = requestAnimationFrame(gameLoop);
};
