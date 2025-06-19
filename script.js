// Récupération DOM — clairement séparée
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

// Constants - en majuscules, constantes fixes
const MAX_BOTS = 20;
const FOOD_COUNT = 2200;
const GAME_DURATION = 3 * 60 * 1000; // 3 minutes en ms
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
const MAX_LEVEL = 2000;
const BONUS_MAX_COUNT = 5;

// Grades & nourriture
const GRADES = [/* ton tableau inchangé */];
const FOOD_EMOJIS = ["🍰","🍉","🍕","🍔","🍦","🍩","🍇","🍒","🍎","🍌","🍟","🌮"];
const BONUS_TYPES = ["speed", "shield", "reset"];
const BONUS_COLORS = { speed: "yellow", shield: "cyan", reset: "white" };

// Stockage stats localStorage
const stats = {
  wins: parseInt(localStorage.getItem("wins")) || 0,
  losses: parseInt(localStorage.getItem("losses")) || 0,
};

// Variables de jeu globales
let player, bots = [], foods = [], virus = null, bonuses = [];
let cameraZoom = 1;
let gameStartTime = null;
let gameOver = false;
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let animationFrameId;
let lastTime = 0;

// UTILS
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function getGrade(level) {
  if (level >= MAX_LEVEL) return GRADES[GRADES.length - 1];
  const index = Math.floor(level / (MAX_LEVEL / (GRADES.length - 1)));
  return GRADES[index];
}

// Canvas responsive
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Souris & tactile
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener("touchmove", e => {
  if (e.touches.length) {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  }
}, { passive: true });

// Spawn nourriture initiale
function spawnFood() {
  foods = Array.from({ length: FOOD_COUNT }, () => ({
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 10,
    emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
  }));
}

// Spawn nourriture aléatoire après consommation
function spawnRandomFood(count = 5) {
  for (let i = 0; i < count; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
    });
  }
}

// Spawn bots (initial et respawn)
function spawnBots(initial = true) {
  if (initial) bots = [];
  while (bots.length < MAX_BOTS) {
    bots.push(createBot());
  }
}

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

function respawnBot(bot) {
  Object.assign(bot, createBot());
}

// Clamp position dans la map (utile partout)
function clampPosition(entity) {
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// Virus spawn & mouvement
function spawnVirus() {
  virus = {
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 30,
    color: "red",
    speed: 1.2,
    direction: Math.random() * Math.PI * 2,
  };
}

function moveVirus() {
  if (!virus) return;
  virus.x += Math.cos(virus.direction) * virus.speed;
  virus.y += Math.sin(virus.direction) * virus.speed;

  if (virus.x < -HALF_MAP || virus.x > HALF_MAP) virus.direction = Math.PI - virus.direction;
  if (virus.y < -HALF_MAP || virus.y > HALF_MAP) virus.direction = -virus.direction;

  clampPosition(virus);
}

// BONUS SYSTEME
function spawnBonuses() {
  if (bonuses.length >= BONUS_MAX_COUNT) return;
  const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
  bonuses.push({
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 8,
    type,
    color: BONUS_COLORS[type],
  });
}
setInterval(spawnBonuses, 15000);

function handleBonuses() {
  bonuses = bonuses.filter(bonus => {
    if (dist(player, bonus) < player.r + bonus.r) {
      switch (bonus.type) {
        case "speed":
          player.speed *= 1.5;
          setTimeout(() => player.speed = 3, 5000);
          break;
        case "shield":
          player.shield = true;
          setTimeout(() => player.shield = false, 5000);
          break;
        case "reset":
          player.r = 20;
          player.score = 0;
          break;
      }
      return false;
    }
    return true;
  });
}

// Dessiner bonus
function drawBonuses() {
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Calcul position souris dans monde (relatif au player)
function getMouseWorldPos() {
  return {
    x: (mouse.x - canvas.width / 2) / cameraZoom + player.x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + player.y,
  };
}

// Déplacement joueur vers souris (smooth)
function movePlayerTowardsMouse() {
  const target = getMouseWorldPos();
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distToTarget = Math.hypot(dx, dy);

  if (distToTarget > 1) {
    const moveDist = Math.min(distToTarget, player.speed);
    player.x += (dx / distToTarget) * moveDist;
    player.y += (dy / distToTarget) * moveDist;
    clampPosition(player);
  }
}

// IA bots
function botsAI() {
  const now = performance.now();

  bots.forEach(bot => {
    if (bot.respawnTimeout) return;

    if (!bot.changeTargetTime || now > bot.changeTargetTime) {
      bot.changeTargetTime = now + 2000 + Math.random() * 3000;

      let possibleTargets = [
        ...foods,
        ...bots.filter(b => b !== bot && !b.respawnTimeout && b.r < bot.r * 0.9),
      ];

      if (player.r < bot.r * 0.9 && !gameOver) possibleTargets.push(player);

      // Points aléatoires pour errance
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

    let targetX = bot.target.x;
    let targetY = bot.target.y;

    // Fuir joueur plus gros
    if (bot.target === player && player.r > bot.r * 1.1) {
      targetX = bot.x - (player.x - bot.x);
      targetY = bot.y - (player.y - bot.y);
    }

    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 1) {
      const moveDist = Math.min(distance, bot.speed);
      bot.x += (dx / distance) * moveDist;
      bot.y += (dy / distance) * moveDist;
      clampPosition(bot);
    }
  });
}

// Remove bot (mort) et respawn delayed
function removeBot(botIndex) {
  const bot = bots[botIndex];
  if (bot.respawnTimeout) return;

  bot.respawnTimeout = setTimeout(() => {
    respawnBot(bot);
    bot.respawnTimeout = null;
  }, 2000);

  // Téléport hors carte pour éviter interactions
  bot.x = 99999;
  bot.y = 99999;
  bot.r = 0;
  bot.target = null;
  bot.score = 0;
}

// Check collisions et interactions
function eatCheck() {
  handleBonuses();

  if (virus && dist(player, virus) < player.r + virus.r) {
    if (!player.shield) {
      player.r = Math.max(10, player.r / 2);
      spawnVirus();
    }
  }

  // Joueur mange nourriture
  for (let i = foods.length - 1; i >= 0; i--) {
    if (dist(player, foods[i]) < player.r + foods[i].r) {
      foods.splice(i, 1);
      player.targetR = Math.min(150, player.targetR + 0.5);
      spawnRandomFood(1);
    }
  }

  // Joueur mange bots plus petits
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (bot !== player && dist(player, bot) < player.r && player.r > bot.r * 1.1) {
      player.score += Math.floor(bot.r);
      player.targetR = Math.min(150, player.targetR + bot.r * 0.6);
      removeBot(i);
    }
  }

  // Bots mangent nourriture
  bots.forEach(bot => {
    if (bot.respawnTimeout) return;
    for (let i = foods.length - 1; i >= 0; i--) {
      if (dist(bot, foods[i]) < bot.r + foods[i].r) {
        foods.splice(i, 1);
        bot.score++;
        bot.r = Math.min(150, bot.r + 0.2);
        spawnRandomFood(1);
      }
    }
  });

  // Bots mangent joueur si plus gros
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (dist(bot, player) < bot.r && bot.r > player.r * 1.1) {
      if (!player.shield) {
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
  for (let i = bots.length - 1; i >= 0; i--) {
    for (let j = bots.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const b1 = bots[i];
      const b2 = bots[j];
      if (b1.respawnTimeout || b2.respawnTimeout) continue;
      if (dist(b1, b2) < b1.r && b1.r > b2.r * 1.1) {
        b1.r = Math.min(150, b1.r + b2.r * 0.3);
        b1.score += Math.floor(b2.r);
        removeBot(j);
        if (j < i) i--;
      }
    }
  }
}

// Mise à jour frame delta
function updateGame(delta) {
  if (gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  eatCheck();
  moveVirus();

  // Lissage croissance joueur
  const growthSpeed = 0.1;
  player.r += (player.targetR - player.r) * growthSpeed;

  // Timer & affichage
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (remaining <= 0) {
    gameOver = true;
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    alert("Temps écoulé, tu as gagné la partie !");
    endGame();
  }

  player.level = clamp(Math.floor(player.score / 10) + 1, 1, MAX_LEVEL);
  scoreDiv.textContent = `Score : ${player.score}`;
}

// Fin de partie & mise à jour menu
function endGame() {
  menuLevelSpan.textContent = player.level;
  menuGradeSpan.textContent = getGrade(player.level);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;

  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

// Dessin étoile (virus)
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
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

// Dessin tuyaux électriques animés
function drawElectricPipe(ctx, x1, y1, x2, y2, time) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.strokeStyle = 'rgba(100,100,255,0.4)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  // Zigzag cyan anim
  const waveAmplitude = 6;
  const waveLength = 30;
  const speed = 0.15;
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= length; i++) {
    const y = waveAmplitude * Math.sin((i / waveLength + time * speed) * Math.PI * 2);
    ctx.lineTo(i, y);
  }
  ctx.stroke();

  ctx.restore();
}

// Dessin général (boucle)
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  cameraZoom = clamp(100 / (player.r + 30), 0.3, 1.5);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-player.x, -player.y);

  // Nourriture emojis
  foods.forEach(food => {
    ctx.font = `${food.r * 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(food.emoji, food.x, food.y);
  });

  // Bots
  bots.forEach(bot => {
    if (bot.respawnTimeout) return;
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Joueur
  ctx.fillStyle = player.shield ? "lightblue" : player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  // Virus (étoile)
  if (virus) drawStar(ctx, virus.x, virus.y, 5, virus.r, virus.r / 2);

  // Bonus
  drawBonuses();

  // Limites tuyaux électriques animés
  const time = performance.now() / 1000;
  drawElectricPipe(ctx, -HALF_MAP, -HALF_MAP, HALF_MAP, -HALF_MAP, time); // haut
  drawElectricPipe(ctx, HALF_MAP, -HALF_MAP, HALF_MAP, HALF_MAP, time);   // droite
  drawElectricPipe(ctx, HALF_MAP, HALF_MAP, -HALF_MAP, HALF_MAP, time);   // bas
  drawElectricPipe(ctx, -HALF_MAP, HALF_MAP, -HALF_MAP, -HALF_MAP, time); // gauche

  ctx.restore();

  animationFrameId = requestAnimationFrame(draw);
}

// Initialisation joueur
function initPlayer() {
  player = {
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: "limegreen",
    speed: 3,
    score: 0,
    level: 1,
    shield: false,
  };
}

// Démarrer partie
function startGame() {
  initPlayer();
  spawnFood();
  spawnBots(true);
  spawnVirus();
  gameStartTime = performance.now();
  gameOver = false;
  menu.style.display = "none";
  gameContainer.style.display = "block";
  draw();
  lastTime = performance.now();
  gameLoop();
}

// Boucle update delta
function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  updateGame(delta);
  if (!gameOver) requestAnimationFrame(gameLoop);
}

// Bouton start
startBtn.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  if (pseudo.length < 2) {
    alert("Veuillez entrer un pseudo d'au moins 2 caractères.");
    return;
  }
  startGame();
});

// Initialisation UI
menuWinsSpan.textContent = stats.wins;
menuLossesSpan.textContent = stats.losses;

// Spawn initial
spawnFood();
spawnBots(true);
spawnVirus();
