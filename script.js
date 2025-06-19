script.js
----------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
document.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 20,
  speed: 3,
  color: "lime",
  score: 0
};

const foods = [];
const FOOD_COUNT = 100;

function spawnFood() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 5 + Math.random() * 5,
    color: "orange"
  };
}

for (let i = 0; i < FOOD_COUNT; i++) {
  foods.push(spawnFood());
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function update() {
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    player.x += dx / dist * player.speed;
    player.y += dy / dist * player.speed;
  }

  for (let i = foods.length - 1; i >= 0; i--) {
    if (distance(player, foods[i]) < player.r + foods[i].r) {
      player.r += foods[i].r * 0.05;
      player.score++;
      foods.splice(i, 1);
      foods.push(spawnFood());
    }
  }

  scoreDiv.textContent = `Score : ${player.score}`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  // Draw foods
  for (let f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
