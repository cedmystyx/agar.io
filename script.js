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

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

const MAX_BOTS = 20;
const FOOD_COUNT = 300;  // augmenté de 100 à 300
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes
const MAP_SIZE = 3000;   // augmenté de 2000 à 3000
const HALF_MAP = MAP_SIZE / 2;

let player = null;
let bots = [];
let foods = [];
let virus = null; // Forma virus (malus)
let bonuses = [];

let cameraZoom = 1;

let gameStartTime = null;
let gameOver = false;

let lastFrameTime = performance.now();

const MAX_LEVEL = 2000;
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

// Partie stockage stats parties jouées/gagnées/perdues pour le rank
let stats = {
  wins: parseInt(localStorage.getItem("wins")) || 0,
  losses: parseInt(localStorage.getItem("losses")) || 0,
};

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getGrade(level) {
  if (level >= MAX_LEVEL) return GRADES[GRADES.length - 1];
  let index = Math.floor(level / (MAX_LEVEL / (GRADES.length - 1)));
  return GRADES[index];
}

// La "rank" (grade) en fonction des wins/pertes
function getRank(wins, losses) {
  const total = wins + losses;
  if (total === 0) return "Débutant";
  const ratio = wins / total;

  if (ratio >= 0.9) return "Légende";
  if (ratio >= 0.7) return "Champion";
  if (ratio >= 0.5) return "Immortal";
  if (ratio >= 0.3) return "Élite";
  if (ratio >= 0.1) return "Or";
  return "Bronze";
}

// Crée la nourriture
function spawnFood() {
  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 5,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      type: "food"
    });
  }
}

// Nourriture supplémentaire quand mangée
function spawnRandomFood(count = 5) {
  for (let i = 0; i < count; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 5,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      type: "food"
    });
  }
}

// Création bots
function spawnBots(initial = true) {
  if (initial) bots = [];
  while (bots.length < MAX_BOTS) {
    bots.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 15 + Math.random() * 15,
      color: `hsl(${Math.random() * 360}, 60%, 50%)`,
      speed: 1 + Math.random() * 1.5,
      target: null,
      score: 0,
      respawnTimeout: null,
      changeTargetTime: 0,
    });
  }
}

function respawnBot(bot) {
  bot.x = (Math.random() - 0.5) * MAP_SIZE;
  bot.y = (Math.random() - 0.5) * MAP_SIZE;
  bot.r = 15 + Math.random() * 15;
  bot.color = `hsl(${Math.random() * 360}, 60%, 50%)`;
  bot.speed = 1 + Math.random() * 1.5;
  bot.target = null;
  bot.score = 0;
  bot.respawnTimeout = null;
  bot.changeTargetTime = 0;
}

function clampPosition(entity) {
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// Le virus (Forma Virus)
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
  virus.x += Math.cos(virus.direction) * virus.speed;
  virus.y += Math.sin(virus.direction) * virus.speed;

  // Change direction si virus sort de la map
  if (virus.x < -HALF_MAP || virus.x > HALF_MAP) virus.direction = Math.PI - virus.direction;
  if (virus.y < -HALF_MAP || virus.y > HALF_MAP) virus.direction = -virus.direction;
  clampPosition(virus);
}

// BONUS SYSTEME

let bonusTypes = ["speed", "shield", "reset"];
let bonusColors = { speed: "yellow", shield: "cyan", reset: "white" };

function spawnBonuses() {
  const type = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
  bonuses.push({
    x: (Math.random() - 0.5) * MAP_SIZE,
    y: (Math.random() - 0.5) * MAP_SIZE,
    r: 8,
    type: type,
    color: bonusColors[type],
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

// Dessin des bonus
function drawBonuses() {
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getMouseWorldPos() {
  return {
    x: (mouse.x - canvas.width / 2) / cameraZoom + player.x,
    y: (mouse.y - canvas.height / 2) / cameraZoom + player.y,
  };
}

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

function botsAI() {
  bots.forEach((bot) => {
    if (bot.respawnTimeout) return; // Bot "mort"

    if (!bot.changeTargetTime || performance.now() > bot.changeTargetTime) {
      bot.changeTargetTime = performance.now() + 2000 + Math.random() * 3000;

      let possibleTargets = [];

      // Nourriture
      possibleTargets = possibleTargets.concat(foods);

      // Bots plus petits
      bots.forEach(otherBot => {
        if (
          otherBot !== bot &&
          !otherBot.respawnTimeout &&
          otherBot.r < bot.r * 0.9
        ) {
          possibleTargets.push(otherBot);
        }
      });

      // Joueur si plus petit
      if (player.r < bot.r * 0.9 && !gameOver) {
        possibleTargets.push(player);
      }

      // Points aléatoires
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

    // Fuir le joueur s'il est plus gros
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

function removeBot(botIndex) {
  let bot = bots[botIndex];
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

function eatCheck() {
  // Gérer bonus
  handleBonuses();

  // Joueur touche virus => divise taille par 2 + message
  if (virus && dist(player, virus) < player.r + virus.r) {
    player.r = Math.max(10, player.r / 2);
    // Pour ne pas toucher plusieurs fois de suite, on repositionne le virus
    spawnVirus();
  }

  // Joueur mange nourriture -> augmente taille mais pas score
  for (let i = foods.length - 1; i >= 0; i--) {
    let food = foods[i];
    if (dist(player, food) < player.r + food.r) {
      foods.splice(i, 1);
      player.r = Math.min(150, player.r + 0.5);
      spawnRandomFood(1);
    }
  }

  // Joueur mange bots plus petits -> augmente taille + score (exp)
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (bot !== player && dist(player, bot) < player.r && player.r > bot.r * 1.1) {
      player.score += Math.floor(bot.r); // gagne du score/exp en mangeant bots
      player.r = Math.min(150, player.r + bot.r * 0.6);
      removeBot(i);
    }
  }

  // Bots mangent nourriture -> augmente taille + score bot
  bots.forEach((bot) => {
    if (bot.respawnTimeout) return;
    for (let i = foods.length - 1; i >= 0; i--) {
      let food = foods[i];
      if (dist(bot, food) < bot.r + food.r) {
        foods.splice(i, 1);
        bot.score++;
        bot.r = Math.min(150, bot.r + 0.2);
        spawnRandomFood(1);
      }
    }
  });

  // Bots mangent joueur si plus gros -> fin partie et perte
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (dist(bot, player) < bot.r && bot.r > player.r * 1.1) {
      gameOver = true;
      alert("Tu as été mangé par un bot !");
      stats.losses++;
      localStorage.setItem("losses", stats.losses);
      endGame();
      return;
    }
  }

  // Bots mangent bots plus petits -> augmente taille + score bot
  for (let i = bots.length - 1; i >= 0; i--) {
    for (let j = bots.length - 1; j >= 0; j--) {
      if (i === j) continue;
      let b1 = bots[i],
          b2 = bots[j];
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

function updateGame(delta) {
  if (gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  eatCheck();
  moveVirus();

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

  // Niveau basé sur score = expérience gagnée uniquement en mangeant bots
  player.level = clamp(Math.floor(player.score / 10) + 1, 1, MAX_LEVEL);
}

function endGame() {
  menuLevelSpan.textContent = player.level;
  menuGradeSpan.textContent = getGrade(player.level);

  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;

  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

let animationFrameId;
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  cameraZoom = 100 / (player.r + 30);
  cameraZoom = clamp(cameraZoom, 0.3, 1.5);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-player.x, -player.y);

  // Dessiner nourriture
  foods.forEach(food => {
    ctx.fillStyle = food.color;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dessiner bots
  bots.forEach(bot => {
    if (bot.respawnTimeout) return;
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dessiner virus
  if(virus){
    ctx.fillStyle = virus.color;
    ctx.beginPath();
    ctx.arc(virus.x, virus.y, virus.r, 0, Math.PI * 2);
    ctx.fill();

    // Dessiner étoile (forme virus) au centre du cercle rouge
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 3;
    drawStar(ctx, virus.x, virus.y, 5, virus.r * 0.8, virus.r * 0.4);
  }

  // Dessiner bonus
  drawBonuses();

  // Dessiner joueur
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  // Dessiner barrières tuyaux électriques
  drawElectricPipes();

  ctx.restore();

  scoreDiv.textContent = `Score: ${player.score} | Niveau: ${player.level} | Grade: ${getGrade(player.level)} | Rank: ${getRank(stats.wins, stats.losses)} | Wins: ${stats.wins} | Losses: ${stats.losses}`;

  animationFrameId = requestAnimationFrame(() => {
    let now = performance.now();
    let delta = now - lastFrameTime;
    lastFrameTime = now;
    updateGame(delta);
    draw();
  });
}

// Fonction utilitaire pour dessiner une étoile (virus)
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

// Dessiner barrières "tuyaux électriques" sur les bords de la map
function drawElectricPipes() {
  const pipeColor = "#00FFFF";
  const pipeGlowColor = "rgba(0, 255, 255, 0.5)";
  const pipeWidth = 20;
  const glowWidth = 30;
  const spacing = 30;

  ctx.lineCap = "round";

  // Bord supérieur
  for(let x = -HALF_MAP; x < HALF_MAP; x += spacing){
    ctx.strokeStyle = pipeGlowColor;
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(x, -HALF_MAP);
    ctx.lineTo(x + spacing/2, -HALF_MAP);
    ctx.stroke();

    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = pipeWidth;
    ctx.beginPath();
    ctx.moveTo(x, -HALF_MAP);
    ctx.lineTo(x + spacing/2, -HALF_MAP);
    ctx.stroke();
  }

  // Bord inférieur
  for(let x = -HALF_MAP; x < HALF_MAP; x += spacing){
    ctx.strokeStyle = pipeGlowColor;
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(x, HALF_MAP);
    ctx.lineTo(x + spacing/2, HALF_MAP);
    ctx.stroke();

    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = pipeWidth;
    ctx.beginPath();
    ctx.moveTo(x, HALF_MAP);
    ctx.lineTo(x + spacing/2, HALF_MAP);
    ctx.stroke();
  }

  // Bord gauche
  for(let y = -HALF_MAP; y < HALF_MAP; y += spacing){
    ctx.strokeStyle = pipeGlowColor;
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(-HALF_MAP, y);
    ctx.lineTo(-HALF_MAP, y + spacing/2);
    ctx.stroke();

    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = pipeWidth;
    ctx.beginPath();
    ctx.moveTo(-HALF_MAP, y);
    ctx.lineTo(-HALF_MAP, y + spacing/2);
    ctx.stroke();
  }

  // Bord droit
  for(let y = -HALF_MAP; y < HALF_MAP; y += spacing){
    ctx.strokeStyle = pipeGlowColor;
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(HALF_MAP, y);
    ctx.lineTo(HALF_MAP, y + spacing/2);
    ctx.stroke();

    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = pipeWidth;
    ctx.beginPath();
    ctx.moveTo(HALF_MAP, y);
    ctx.lineTo(HALF_MAP, y + spacing/2);
    ctx.stroke();
  }
}

function startGame() {
  menu.style.display = "none";
  gameContainer.style.display = "block";

  // Réinitialisation totale niveau/score/statistiques partie, pas de sauvegarde !
  player = {
    x: 0,
    y: 0,
    r: 20,
    color: colorPicker.value,
    speed: 3,
    score: 0,
    level: 1,
    shield: false,
  };

  spawnFood();
  spawnBots(true);
  spawnVirus();
  bonuses = [];

  gameStartTime = performance.now();
  gameOver = false;

  menuLevelSpan.textContent = player.level;
  menuGradeSpan.textContent = getGrade(player.level);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;

  lastFrameTime = performance.now();
  draw();
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

startBtn.addEventListener("click", () => {
  if (!pseudoInput.value.trim()) {
    alert("Veuillez entrer un pseudo !");
    return;
  }
  startGame();
});
