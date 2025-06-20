// === Récupération DOM ===
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
const modalMessage = document.getElementById("modalMessage");

// === Constantes & config ===
const MAX_BOTS = 25;
const FOOD_COUNT = 1600;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const MAX_PLAYER_RADIUS = 160;
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

let animationFrameId = null;
let lastTime = 0;

// === Utilitaires ===
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const getGrade = (level) => {
  if(level >= MAX_LEVEL) return GRADES[GRADES.length - 1];
  const index = Math.floor(level / (MAX_LEVEL / (GRADES.length - 1)));
  return GRADES[index];
};

function showMessage(text){
  modalMessage.textContent = text;
  modalMessage.style.display = "block";
  setTimeout(() => {
    modalMessage.style.display = "none";
  }, 2500);
}
modalMessage.addEventListener("click", () => {
  modalMessage.style.display = "none";
});

// === Canvas resize avec DPI ===
function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// === Souris & touch ===
function updatePointerPos(x, y){
  mouse.x = clamp(x, 0, window.innerWidth);
  mouse.y = clamp(y, 0, window.innerHeight);
}
window.addEventListener("mousemove", e => updatePointerPos(e.clientX, e.clientY));
window.addEventListener("touchmove", e => {
  if(e.touches.length > 0){
    updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive:true });

// === Spawn nourriture ===
function spawnFood(){
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
  // Limiter la taille du tableau
  if(foods.length > FOOD_COUNT * 1.2){
    foods.splice(FOOD_COUNT);
  }
}

// === Spawn bots amélioré (taille aléatoire) ===
function createBot() {
  return {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 10 + Math.random() * 45, // taille aléatoire entre 10 et 55 (plus varié)
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    speed: 1 + Math.random() * 1.7,
    target: null,
    score: 0,
    respawnTimeout: null,
    changeTargetTime: 0,
  };
}
function spawnBots(initial = true) {
  if(initial) bots = [];
  while (bots.length < MAX_BOTS) {
    bots.push(createBot());
  }
}
function respawnBot(bot){
  Object.assign(bot, createBot());
}

// === Clamp position ===
function clampPosition(entity){
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// === Virus ===
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

// === Bonus ===
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
          player.speed = PLAYER_BASE_SPEED * 1.7;
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

// === Dessin bonus ===
function drawBonuses(){
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI*2);
    ctx.fill();
  });
}

// === Position souris dans monde ===
function getMouseWorldPos(){
  return {
    x: (mouse.x - canvas.width / (2 * (window.devicePixelRatio || 1))) / cameraZoom + player.x,
    y: (mouse.y - canvas.height / (2 * (window.devicePixelRatio || 1))) / cameraZoom + player.y,
  };
}

// === Déplacement joueur vers souris ===
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

// === IA bots améliorée ===
function botsAI(){
  const now = performance.now();

  bots.forEach(bot => {
    if(bot.respawnTimeout) return;

    if(!bot.changeTargetTime || now > bot.changeTargetTime){
      bot.changeTargetTime = now + 1500 + Math.random() * 2500;

      let possibleTargets = [];

      possibleTargets.push(...foods);

      // Bots plus petits
      bots.forEach(otherBot => {
        if(otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r * 0.9){
          possibleTargets.push(otherBot);
        }
      });

      if(player.r < bot.r * 0.9 && !gameOver){
        possibleTargets.push(player);
      }

      // Points aléatoires dans zone limitée autour du bot (amélioration IA)
      for(let i=0; i<8; i++){
        possibleTargets.push({
          x: bot.x + (Math.random() - 0.5) * 400,
          y: bot.y + (Math.random() - 0.5) * 400,
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

// === Vérification des collisions & nourrir ===
function eatCheck(){
  // Nourriture
  for(let i = foods.length - 1; i >= 0; i--){
    if(dist(player, foods[i]) < player.r + foods[i].r){
      player.score++;
      player.targetR = Math.min(MAX_PLAYER_RADIUS, 20 + player.score * 0.8);
      foods.splice(i,1);
      spawnRandomFood(1);
    }
  }

  // Bonus
  handleBonuses();

  // Virus : touche le joueur => game over
  if(virus && dist(player, virus) < player.r + virus.r){
    if(player.shield){
      player.shield = false; // shield absorb virus once
      virus.x = (Math.random() - 0.5) * MAP_SIZE;
      virus.y = (Math.random() - 0.5) * MAP_SIZE;
    } else {
      endGame(false);
    }
  }

  // Bots mangent nourriture & joueur & bots plus petits
  for(let i = bots.length - 1; i >= 0; i--){
    const bot = bots[i];
    if(bot.respawnTimeout) continue;

    // Mange nourriture
    for(let j = foods.length -1; j>=0; j--){
      if(dist(bot, foods[j]) < bot.r + foods[j].r){
        bot.score++;
        bot.r = Math.min(MAX_PLAYER_RADIUS, 10 + bot.score * 0.7);
        foods.splice(j,1);
        spawnRandomFood(1);
      }
    }

    // Mange joueur
    if(!gameOver && player.r * 0.9 < bot.r && dist(bot, player) < bot.r + player.r){
      endGame(false);
      return;
    }

    // Mange bots plus petits
    for(let k = bots.length -1; k>=0; k--){
      if(k === i) continue;
      const other = bots[k];
      if(other.respawnTimeout) continue;
      if(other.r * 0.9 < bot.r && dist(bot, other) < bot.r + other.r){
        bot.score += other.score + 1;
        bot.r = Math.min(MAX_PLAYER_RADIUS, bot.r + other.r * 0.8);
        other.respawnTimeout = setTimeout(() => {
          respawnBot(other);
          other.respawnTimeout = null;
        }, 12000);
        bots.splice(k, 1);
      }
    }
  }
}

// === Zoom caméra suivant taille joueur ===
function updateCameraZoom(){
  const minZoom = 0.25;
  const maxZoom = 1.6;
  const normalized = (player.r - 20) / (MAX_PLAYER_RADIUS - 20);
  cameraZoom = maxZoom - (maxZoom - minZoom) * normalized;
}

// === Animation interpolation ===
function lerp(a, b, t){
  return a + (b - a) * t;
}

// === Mise à jour joueur (taille) ===
function updatePlayerSize(delta){
  player.r = lerp(player.r, player.targetR, 0.15);
}

// === Affichage texte stylé ===
function drawText(text, x, y, size = 20, color = "#0f0"){
  ctx.fillStyle = color;
  ctx.font = `${size}px Arial Black, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "#0f0";
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

// === Dessin du joueur & bots & nourriture & virus ===
function draw(){
  // Fond noir
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  // Translate au centre écran et zoom caméra
  ctx.translate(canvas.width / (2 * (window.devicePixelRatio || 1)), canvas.height / (2 * (window.devicePixelRatio || 1)));
  ctx.scale(cameraZoom, cameraZoom);

  // Translate inverse joueur pour le centrer
  ctx.translate(-player.x, -player.y);

  // Dessiner nourriture
  foods.forEach(food => {
    ctx.font = `${food.r * 2.5}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(food.emoji, food.x, food.y + food.r);
  });

  // Dessiner bonus
  drawBonuses();

  // Dessiner virus
  if(virus){
    ctx.fillStyle = virus.color;
    ctx.beginPath();
    ctx.arc(virus.x, virus.y, virus.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dessiner bots
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI * 2);
    ctx.fill();
    // Affichage score bot au-dessus
    drawText(bot.score.toString(), bot.x, bot.y - bot.r - 10, 16, "#ccc");
  });

  // Dessiner joueur (avec shield)
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  if(player.shield){
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Affichage score joueur
  drawText(player.score.toString(), player.x, player.y - player.r - 10, 22, player.color);

  ctx.restore();
}

// === Mise à jour UI menu & HUD ===
function updateMenuStats(){
  const level = Math.floor(player.score / 7);
  const grade = getGrade(level);
  menuLevelSpan.textContent = level.toString();
  menuGradeSpan.textContent = grade;
  menuWinsSpan.textContent = stats.wins.toString();
  menuLossesSpan.textContent = stats.losses.toString();
}

function updateHUD(){
  scoreDiv.textContent = `Score : ${player.score}`;
  const timePassed = Math.floor((performance.now() - gameStartTime) / 1000);
  const timeLeft = Math.max(0, GAME_DURATION_MS / 1000 - timePassed);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
}

// === Fin du jeu ===
function endGame(won){
  gameOver = true;
  cancelAnimationFrame(animationFrameId);
  if(won){
    stats.wins++;
    showMessage("Bravo, tu as gagné !");
  } else {
    stats.losses++;
    showMessage("Perdu... Essaie encore !");
  }
  localStorage.setItem("wins", stats.wins);
  localStorage.setItem("losses", stats.losses);
  menu.style.display = "block";
  gameContainer.style.display = "none";
  updateMenuStats();
}

// === Loop principal ===
function gameLoop(timestamp){
  if(!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if(gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  moveVirus();
  eatCheck();
  handleBonuses();

  updatePlayerSize(delta);
  updateCameraZoom();
  updateHUD();

  draw();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// === Lancement jeu ===
startBtn.onclick = () => {
  const name = pseudoInput.value.trim();
  if(name.length < 1){
    showMessage("Veuillez entrer un pseudo !");
    return;
  }
  player = {
    name,
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

// === Initialisation UI ===
updateMenuStats();
