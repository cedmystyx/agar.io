const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");
const menu = document.getElementById("menu");
const gameContainer = document.getElementById("gameContainer");
const startBtn = document.getElementById("startBtn");
const pseudoInput = document.getElementById("pseudo");

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
document.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

let player = null;
let foods = [];
let bots = [];
const FOOD_COUNT = 100;
const BOT_COUNT = 5;
let animationFrameId = null;

function spawnFood() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 5 + Math.random() * 5,
    color: "orange"
  };
}

function spawnBot() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 15 + Math.random() * 10,
    speed: 1 + Math.random() * 1.5,
    color: "red",
    dx: (Math.random() - 0.5) * 2,
    dy: (Math.random() - 0.5) * 2,
    score: 0,
    name: "Bot"
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function initGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    r: 20,
    speed: 3,
    color: "lime",
    score: 0,
    name: pseudoInput.value.trim() || "Anonyme"
  };

  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push(spawnFood());
  }

  bots = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    bots.push(spawnBot());
  }

  menu.style.display = "none";
  gameContainer.style.display = "block";

  loop();
}

function updatePlayer() {
  if (!player) return;
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    player.x += (dx / dist) * player.speed;
    player.y += (dy / dist) * player.speed;
  }

  // Mange nourriture
  for (let i = foods.length -1; i >= 0; i--) {
    if (distance(player, foods[i]) < player.r + foods[i].r) {
      player.r += foods[i].r * 0.05;
      player.score++;
      foods.splice(i, 1);
      foods.push(spawnFood());
    }
  }
}

function updateBots() {
  for (let bot of bots) {
    // Déplacement aléatoire simple
    bot.x += bot.dx * bot.speed;
    bot.y += bot.dy * bot.speed;

    // Rebondir sur les bords
    if (bot.x < bot.r || bot.x > canvas.width - bot.r) bot.dx = -bot.dx;
    if (bot.y < bot.r || bot.y > canvas.height - bot.r) bot.dy = -bot.dy;

    // Manger nourriture
    for (let i = foods.length - 1; i >= 0; i--) {
      if (distance(bot, foods[i]) < bot.r + foods[i].r) {
        bot.r += foods[i].r * 0.05;
        bot.score++;
        foods.splice(i, 1);
        foods.push(spawnFood());
      }
    }
  }
}

function drawCircle(entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.r, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();

  // Nom du joueur/bot
  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12, entity.r / 2)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(entity.name, entity.x, entity.y + 4);
}

function draw() {
  if (!player) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Nourriture
  for (let f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  // Bots
  for (let bot of bots) {
    drawCircle(bot);
  }

  // Joueur
  drawCircle(player);
}

function updateScore() {
  if (!player) return;
  scoreDiv.textContent = `${player.name} - Score : ${player.score}`;
}

function loop() {
  updatePlayer();
  updateBots();
  draw();
  updateScore();
  animationFrameId = requestAnimationFrame(loop);
}

startBtn.addEventListener("click", () => {
  if (pseudoInput.value.trim().length === 0) {
    alert("Merci de saisir un pseudo.");
    return;
  }
  initGame();
});

window.addEventListener("resize", () => {
  if (!player) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
