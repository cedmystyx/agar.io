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

let player = null;
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
    if(dist(player, bonus) < player.r + bonus.r){
      switch(bonus.type){
        case "speed":
          player.speed *= 1.5;
          setTimeout(() => player.speed = PLAYER_BASE_SPEED, 5000);
          break;
        case "shield":
          player.shield = true;
          setTimeout(() => player.shield = false, 5000);
          break;
        case "reset":
          player.r = 20;
          player.targetR = 20;
          player.score = 0;
          break;
      }
      return false;
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
    x: (mouse.x - canvas.width / 2) / cameraZoom + player.x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + player.y,
  };
}

// === DÉPLACEMENT JOUEUR VERS SOURIS ===
function movePlayerTowardsMouse(){
  const target = getMouseWorldPos();
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  if(distance > 1){
    const moveDist = Math.min(distance, player.speed);
    player.x += (dx / distance) * moveDist;
    player.y += (dy / distance) * moveDist;
    clampPosition(player);
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

      if(player.r < bot.r * 0.9 && !gameOver){
        possibleTargets.push(player);
      }

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

    // Fuir joueur plus gros
    if(bot.target === player && player.r > bot.r * 1.1){
      targetX = bot.x - (player.x - bot.x);
      targetY = bot.y - (player.y - bot.y);
    }

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

  // Hors carte pendant respawn
  bot.x = 99999;
  bot.y = 99999;
  bot.r = 0;
  bot.target = null;
  bot.score = 0;
}

// === VÉRIFICATIONS & INTERACTIONS ===
function eatCheck(){
  handleBonuses();

  if(virus && dist(player, virus) < player.r + virus.r){
    if(!player.shield){
      player.r = Math.max(10, player.r / 2);
      player.targetR = player.r; // Pour éviter animation size up/down incohérente
      spawnVirus();
    }
  }

  // Joueur mange nourriture
  for(let i = foods.length - 1; i >= 0; i--){
    let food = foods[i];
    if(dist(player, food) < player.r + food.r){
      foods.splice(i, 1);
      player.targetR = Math.min(MAX_PLAYER_RADIUS, player.targetR + 0.5);
      spawnRandomFood(1);
    }
  }

  // Joueur mange bots plus petits
  for(let i = bots.length - 1; i >= 0; i--){
    let bot = bots[i];
    if(bot.respawnTimeout) continue;
    if(bot !== player && dist(player, bot) < player.r && player.r > bot.r * 1.1){
      player.score += Math.floor(bot.r);
      player.targetR = Math.min(MAX_PLAYER_RADIUS, player.targetR + bot.r * 0.6);
      removeBot(i);
    }
  }

  // Bots mangent nourriture
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    for(let i = foods.length - 1; i >= 0; i--){
      let food = foods[i];
      if(dist(bot, food) < bot.r + food.r){
        foods.splice(i, 1);
        bot.score++;
        bot.r = Math.min(MAX_PLAYER_RADIUS, bot.r + 0.2);
        spawnRandomFood(1);
      }
    }
  });

  // Bots mangent joueur
  for(let i = bots.length - 1; i >= 0; i--){
    let bot = bots[i];
    if(bot.respawnTimeout) continue;
    if(dist(bot, player) < bot.r && bot.r > player.r * 1.1){
      if(!player.shield){
        gameOver = true;
        alert("Tu as été mangé par un bot !");
        stats.losses++;
        localStorage.setItem("losses", stats.losses);
        endGame();
        return;
      }
    }
  }

  // Bots mangent bots plus petits
  for(let i = bots.length - 1; i >= 0; i--){
    for(let j = bots.length - 1; j >= 0; j--){
      if(i === j) continue;
      const b1 = bots[i], b2 = bots[j];
      if(b1.respawnTimeout || b2.respawnTimeout) continue;
      if(dist(b1,b2) < b1.r && b1.r > b2.r * 1.1){
        b1.r = Math.min(MAX_PLAYER_RADIUS, b1.r + b2.r * 0.3);
        b1.score += Math.floor(b2.r);
        removeBot(j);
        if(j < i) i--;
      }
    }
  }
}

// === MISE À JOUR DU JEU ===
function updateGame(delta){
  if(gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  eatCheck();
  moveVirus();

  // Animation grossissement taille joueur (vitesse augmentée)
  const growthSpeed = 0.3;
  player.r += (player.targetR - player.r) * growthSpeed;

  // Timer
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if(remaining <= 0){
    gameOver = true;
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    alert("Temps écoulé, tu as gagné la partie !");
    endGame();
  }

  player.level = clamp(Math.floor(player.score / 10) + 1, 1, MAX_LEVEL);
  scoreDiv.textContent = `Score : ${player.score}`;
}

// === FIN DE PARTIE ===
function endGame(){
  menuLevelSpan.textContent = player.level;
  menuGradeSpan.textContent = getGrade(player.level);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;

  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

// === DESSIN ===
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for(let i = 0; i < spikes; i++){
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x,y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x,y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = "yellow";
  ctx.fill();
  ctx.strokeStyle = "orange";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawElectricPipe(ctx, x1, y1, x2, y2, time) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // Tube extérieur (transparent gris bleuté)
  ctx.strokeStyle = 'rgba(100,100,255,0.4)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  // Animation électrique : zigzag cyan
  const waveAmplitude = 6;
  const waveLength = 30;
  const speed = 0.15;
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for(let i = 0; i <= length; i++) {
    const y = waveAmplitude * Math.sin((i / waveLength + time * speed) * Math.PI * 2);
    if(i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  ctx.stroke();

  ctx.restore();
}

function drawBonuses(){
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI*2);
    ctx.fill();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Center camera on player
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-player.x, -player.y);

  // Background simple
  ctx.fillStyle = "#010026";
  ctx.fillRect(player.x - canvas.width / (2*cameraZoom), player.y - canvas.height / (2*cameraZoom), canvas.width / cameraZoom, canvas.height / cameraZoom);

  // Draw food
  foods.forEach(food => {
    ctx.font = `${food.r * 2}px Arial`;
    ctx.fillText(food.emoji, food.x - food.r, food.y + food.r / 2);
  });

  // Draw virus
  if(virus){
    ctx.fillStyle = virus.color;
    ctx.beginPath();
    ctx.arc(virus.x, virus.y, virus.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw bonuses
  drawBonuses();

  // Draw bots
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI*2);
    ctx.fill();
  });

  // Draw player with shield effect
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
  ctx.fillStyle = colorPicker.value;
  ctx.fill();

  if(player.shield){
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 5, 0, Math.PI*2);
    ctx.stroke();
  }

  // Draw player name
  ctx.fillStyle = "white";
  ctx.font = `${player.r / 2}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(player.name, player.x, player.y - player.r - 10);

  // Draw electric pipes (map barriers)
  const time = performance.now() / 1000;
  // Exemple: dessiner 4 tuyaux autour de la map
  drawElectricPipe(ctx, -HALF_MAP, -HALF_MAP, HALF_MAP, -HALF_MAP, time);
  drawElectricPipe(ctx, HALF_MAP, -HALF_MAP, HALF_MAP, HALF_MAP, time);
  drawElectricPipe(ctx, HALF_MAP, HALF_MAP, -HALF_MAP, HALF_MAP, time);
  drawElectricPipe(ctx, -HALF_MAP, HALF_MAP, -HALF_MAP, -HALF_MAP, time);

  ctx.restore();
}

// === BOUCLE PRINCIPALE ===
function gameLoop(timestamp){
  if(!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  updateGame(delta);
  draw();

  if(!gameOver) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// === INITIALISATION DU JOUEUR ===
function initPlayer(name, color){
  player = {
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    speed: PLAYER_BASE_SPEED,
    color,
    name,
    score: 0,
    shield: false,
    level: 1,
  };
}

// === LANCER LA PARTIE ===
startBtn.addEventListener("click", () => {
  if(pseudoInput.value.trim() === ""){
    alert("Entrez un pseudo pour commencer.");
    return;
  }
  menu.style.display = "none";
  gameContainer.style.display = "block";

  initPlayer(pseudoInput.value.trim(), colorPicker.value);
  spawnFood();
  spawnBots();
  spawnVirus();

  gameStartTime = performance.now();
  gameOver = false;

  animationFrameId = requestAnimationFrame(gameLoop);
});

// === DÉBUT ===
menu.style.display = "block";
gameContainer.style.display = "none";
menuLevelSpan.textContent = "-";
menuGradeSpan.textContent = "-";
menuWinsSpan.textContent = stats.wins;
menuLossesSpan.textContent = stats.losses;
scoreDiv.textContent = "Score : 0";
timerDiv.textContent = "Temps restant : 03:00";
