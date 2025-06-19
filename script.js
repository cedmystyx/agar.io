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

let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

const MAX_BOTS = 20;
const FOOD_COUNT = 100;
const BONUS_COUNT = 3;
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes

let player = null;
let bots = [];
let foods = [];
let bonuses = [];

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

function clamp(val,min,max) {
  return Math.min(Math.max(val,min), max);
}

function dist(a,b) {
  return Math.hypot(a.x-b.x, a.y-b.y);
}

function getGrade(level) {
  if(level >= MAX_LEVEL) return GRADES[GRADES.length-1];
  let index = Math.floor(level / (MAX_LEVEL / (GRADES.length-1)));
  return GRADES[index];
}

// --- GÉNÉRATION NOURRITURE ---
function spawnFood() {
  foods = [];
  for(let i=0; i<FOOD_COUNT; i++) {
    foods.push({
      x: (Math.random()-0.5)*2000,
      y: (Math.random()-0.5)*2000,
      r: 5,
      color: `hsl(${Math.random()*360}, 80%, 60%)`
    });
  }
}

// --- GÉNÉRATION BOTS ---
function spawnBots() {
  bots = [];
  for(let i=0; i<MAX_BOTS; i++) {
    bots.push({
      x: (Math.random()-0.5)*2000,
      y: (Math.random()-0.5)*2000,
      r: 15 + Math.random()*15,
      color: `hsl(${Math.random()*360}, 60%, 50%)`,
      speed: 1 + Math.random()*1.5,
      target: null,
      score: 0,
    });
  }
}

function getMouseWorldPos() {
  return {
    x: (mouse.x - canvas.width/2) / cameraZoom + player.x,
    y: (mouse.y - canvas.height/2) / cameraZoom + player.y
  };
}

function movePlayerTowardsMouse() {
  const target = getMouseWorldPos();
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distToTarget = Math.hypot(dx, dy);
  if(distToTarget > 1) {
    const moveDist = Math.min(distToTarget, player.speed);
    player.x += dx / distToTarget * moveDist;
    player.y += dy / distToTarget * moveDist;
  }
}

function botsAI() {
  bots.forEach(bot => {
    // Choisir une cible : nourriture ou joueur selon proximité et taille
    if(!bot.target || bot.target === null || bot.target.r <= 0) {
      // Chercher plus gros joueur si possible sinon nourriture
      if(player.r > bot.r * 1.1) {
        bot.target = player;
      } else {
        // Nourriture la plus proche
        let minDist = Infinity;
        let closest = null;
        foods.forEach(food => {
          let d = dist(bot, food);
          if(d < minDist) {
            minDist = d;
            closest = food;
          }
        });
        bot.target = closest;
      }
    }
    if(bot.target) {
      const dx = bot.target.x - bot.x;
      const dy = bot.target.y - bot.y;
      const distance = Math.hypot(dx, dy);
      if(distance > 1) {
        const moveDist = Math.min(distance, bot.speed);
        bot.x += dx / distance * moveDist;
        bot.y += dy / distance * moveDist;
      }
    }
  });
}

function eatCheck() {
  // Joueur mange nourriture
  for(let i = foods.length -1; i>=0; i--) {
    let food = foods[i];
    if(dist(player, food) < player.r) {
      foods.splice(i, 1);
      player.score += 1;
      player.r = Math.min(150, player.r + 0.3); // grossit lentement
    }
  }

  // Joueur mange bots plus petits
  for(let i = bots.length -1; i>=0; i--) {
    let bot = bots[i];
    if(bot !== player && dist(player, bot) < player.r && player.r > bot.r * 1.1) {
      player.score += Math.floor(bot.r);
      player.r = Math.min(150, player.r + bot.r * 0.5);
      bots.splice(i,1);
    }
  }

  // Bots mangent nourriture
  bots.forEach(bot => {
    for(let i = foods.length -1; i>=0; i--) {
      let food = foods[i];
      if(dist(bot, food) < bot.r) {
        foods.splice(i,1);
        bot.score++;
        bot.r = Math.min(150, bot.r + 0.2);
      }
    }
  });

  // Bots mangent joueur si plus gros
  for(let i = bots.length -1; i>=0; i--) {
    let bot = bots[i];
    if(dist(bot, player) < bot.r && bot.r > player.r * 1.1) {
      // Game over, le joueur est mangé
      gameOver = true;
      alert("Tu as été mangé par un bot !");
      endGame();
      return;
    }
  }

  // Bots mangent bots plus petits entre eux
  for(let i = bots.length -1; i>=0; i--) {
    for(let j = bots.length -1; j>=0; j--) {
      if(i === j) continue;
      let b1 = bots[i], b2 = bots[j];
      if(dist(b1, b2) < b1.r && b1.r > b2.r * 1.1) {
        b1.r = Math.min(150, b1.r + b2.r * 0.3);
        b1.score += Math.floor(b2.r);
        bots.splice(j,1);
        if(j < i) i--;
      }
    }
  }
}

function updateGame(delta) {
  if(gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  eatCheck();

  // Timer
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(remaining <= 0) {
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
  gameOver = false;
}

function draw() {
  ctx.resetTransform();

  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const minR = 10;
  const maxR = 150;
  const minZoom = 2;
  const maxZoom = 0.7;

  let targetZoom = minZoom - ((player.r - minR) / (maxR - minR)) * (minZoom - maxZoom);
  targetZoom = clamp(targetZoom, maxZoom, minZoom);

  cameraZoom += (targetZoom - cameraZoom) * 0.1;

  ctx.setTransform(
    cameraZoom,
    0,
    0,
    cameraZoom,
    canvas.width / 2 - player.x * cameraZoom,
    canvas.height / 2 - player.y * cameraZoom
  );

  // Dessiner nourriture
  foods.forEach(food => {
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.fill();
  });

  // Dessiner bots
  bots.forEach(bot => {
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI * 2);
    ctx.fillStyle = bot.color;
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = `${Math.max(12, bot.r / 2)}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("Bot", bot.x, bot.y + 4);
  });

  // Dessiner joueur
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12, player.r / 2)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(player.name, player.x, player.y + 4);

  scoreDiv.textContent = `Score : ${player.score}`;
}

function startGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  player = {
    x: 0,
    y: 0,
    r: 20,
    speed: 3,
    baseSpeed: 3,
    color: colorPicker.value,
    score: 0,
    name: pseudoInput.value.trim() || "Anonyme",
    level: savedLevel,
    boostTimer: 0,
  };

  spawnFood();
  spawnBots();

  gameStartTime = performance.now();
  gameOver = false;

  menu.style.display = "none";
  gameContainer.style.display = "block";

  scoreDiv.textContent = `Score : 0`;
  timerDiv.textContent = `Temps restant : 05:00`;

  lastFrameTime = performance.now();
  loop();
}

let animationFrameId;
let lastFrame = performance.now();

function loop(time = 0) {
  let delta = time - lastFrame;
  lastFrame = time;

  updateGame(delta);
  draw();

  if (!gameOver) animationFrameId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

menuLevelSpan.textContent = savedLevel;
menuGradeSpan.textContent = getGrade(savedLevel);

startBtn.onclick = () => {
  menuLevelSpan.textContent = savedLevel;
  menuGradeSpan.textContent = getGrade(savedLevel);
  startGame();
};
