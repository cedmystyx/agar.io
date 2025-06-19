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

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

const MAX_BOTS = 20;
const FOOD_COUNT = 100;
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes

const MAP_SIZE = 2000;
const HALF_MAP = MAP_SIZE / 2;

let player = null;
let bots = [];
let foods = [];

let cameraZoom = 1;

let gameStartTime = null;
let gameOver = false;

let lastFrameTime = performance.now();

let savedLevel = parseInt(localStorage.getItem("playerLevel")) || 1;
let savedScore = parseInt(localStorage.getItem("playerScore")) || 0;

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

function spawnFood() {
  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 5,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    });
  }
}

function spawnRandomFood(count = 5) {
  for (let i = 0; i < count; i++) {
    foods.push({
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      r: 5,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    });
  }
}

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
  // Joueur mange nourriture
  for (let i = foods.length - 1; i >= 0; i--) {
    let food = foods[i];
    if (dist(player, food) < player.r) {
      foods.splice(i, 1);
      player.score += 1;
      player.r = Math.min(150, player.r + 0.3);
    }
  }

  // Joueur mange bots plus petits
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (bot !== player && dist(player, bot) < player.r && player.r > bot.r * 1.1) {
      player.score += Math.floor(bot.r);
      player.r = Math.min(150, player.r + bot.r * 0.5);
      removeBot(i);
    }
  }

  // Bots mangent nourriture
  bots.forEach((bot) => {
    if (bot.respawnTimeout) return;
    for (let i = foods.length - 1; i >= 0; i--) {
      let food = foods[i];
      if (dist(bot, food) < bot.r) {
        foods.splice(i, 1);
        bot.score++;
        bot.r = Math.min(150, bot.r + 0.2);
        spawnRandomFood(5);
      }
    }
  });

  // Bots mangent joueur si plus gros
  for (let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if (bot.respawnTimeout) continue;
    if (dist(bot, player) < bot.r && bot.r > player.r * 1.1) {
      gameOver = true;
      alert("Tu as été mangé par un bot !");
      endGame();
      return;
    }
  }

  // Bots mangent bots plus petits
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

  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (remaining <= 0) {
    gameOver = true;
    endGame();
  }

  player.level = clamp(Math.floor(player.score / 5) + savedLevel, 1, MAX_LEVEL);
}

function endGame() {
  savedLevel = player.level;
  savedScore = player.score;
  localStorage.setItem("playerLevel", savedLevel);
  localStorage.setItem("playerScore", savedScore);

  alert(`Partie terminée !\nNiveau atteint : ${savedLevel}\nGrade : ${getGrade(savedLevel)}`);

  menuLevelSpan.textContent = savedLevel;
  menuGradeSpan.textContent = getGrade(savedLevel);

  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Zoom caméra en fonction de la taille du joueur (plus gros -> zoom arrière)
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

  // Dessiner joueur
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Afficher score en jeu
  scoreDiv.textContent = `Score: ${player.score} | Niveau: ${player.level} | Grade: ${getGrade(player.level)}`;

  animationFrameId = requestAnimationFrame(() => {
    let now = performance.now();
    let delta = now - lastFrameTime;
    lastFrameTime = now;
    updateGame(delta);
    draw();
  });
}

function startGame() {
  menu.style.display = "none";
  gameContainer.style.display = "block";

  player = {
    x: 0,
    y: 0,
    r: 20,
    color: colorPicker.value,
    speed: 3,
    score: 0,
    level: savedLevel,
  };

  spawnFood();
  spawnBots(true);

  gameStartTime = performance.now();
  gameOver = false;

  menuLevelSpan.textContent = savedLevel;
  menuGradeSpan.textContent = getGrade(savedLevel);

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
