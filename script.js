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

  // Bots mangent joueurs plus petits
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    if(dist(bot, player) < bot.r && bot.r > player.r * 1.1 && !gameOver){
      // Player lost
      gameOver = true;
      alert("Tu as été mangé ! Réessaie.");
      stats.losses++;
      localStorage.setItem("losses", stats.losses);
      resetGame();
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

  // Centre caméra sur joueur + zoom dynamique (taille influence zoom)
  cameraZoom = 1 / (player.r / 50);
  cameraZoom = clamp(cameraZoom, 0.3, 1.2);

  ctx.save();
  // translation monde
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-player.x, -player.y);

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

  // DESSIN JOUEUR
  player.r = lerp(player.r, player.targetR, 0.1);
  drawCell(player, {color: player.color});

  ctx.restore();

  // Mise à jour HUD
  scoreDiv.textContent = "Score : " + Math.floor(player.score);
  const elapsed = Math.max(0, GAME_DURATION_MS - (performance.now() - gameStartTime));
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(elapsed <= 0){
    gameOver = true;
    alert("Temps écoulé ! Ton score final : " + Math.floor(player.score));
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    resetGame();
  }
}

// === RESET JEU ===
function resetGame(){
  player.r = 20;
  player.targetR = 20;
  player.score = 0;
  player.x = 0;
  player.y = 0;
  player.shield = false;
  player.speed = PLAYER_BASE_SPEED;
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
  menuLevelSpan.textContent = Math.floor(player.r);
  menuGradeSpan.textContent = getGrade(player.r);
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

  movePlayerTowardsMouse();
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
  player = {
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: colorPicker.value,
    speed: PLAYER_BASE_SPEED,
    score: 0,
    shield: false,
  };
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
