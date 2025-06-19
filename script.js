const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");
const menu = document.getElementById("menu");
const gameContainer = document.getElementById("gameContainer");
const startBtn = document.getElementById("startBtn");
const pseudoInput = document.getElementById("pseudo");
const colorPicker = document.getElementById("colorPicker");

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
document.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

let player = null;
let foods = [];
let bots = [];
let bonuses = [];

const FOOD_COUNT = 100;
const BOT_COUNT = 5;
const BONUS_COUNT = 3;

let animationFrameId = null;

function randomColor() {
  // Couleur vive aléatoire
  const letters = "789ABCD";
  let color = "#";
  for(let i=0; i<6; i++) {
    color += letters[Math.floor(Math.random()*letters.length)];
  }
  return color;
}

function spawnFood() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 5 + Math.random() * 5,
    color: "orange"
  };
}

function spawnBonus() {
  // Bonus étoile jaune ou rose
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 12,
    type: Math.random() < 0.5 ? "yellow" : "pink",
    active: true
  };
}

function spawnBot() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 15 + Math.random() * 10,
    speed: 1 + Math.random() * 1.5,
    baseSpeed: 1 + Math.random() * 1.5,
    color: randomColor(),
    dx: (Math.random() - 0.5),
    dy: (Math.random() - 0.5),
    score: 0,
    name: "Bot",
    boostTimer: 0
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
    baseSpeed: 3,
    color: colorPicker.value,
    score: 0,
    name: pseudoInput.value.trim() || "Anonyme",
    boostTimer: 0
  };

  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push(spawnFood());
  }

  bonuses = [];
  for (let i = 0; i < BONUS_COUNT; i++) {
    bonuses.push(spawnBonus());
  }

  bots = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    bots.push(spawnBot());
  }

  menu.style.display = "none";
  gameContainer.style.display = "block";

  loop();
}

function updateEntityMovement(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    entity.x += (dx / dist) * entity.speed;
    entity.y += (dy / dist) * entity.speed;
  }
}

function updatePlayer() {
  if (!player) return;

  // Déplacement vers la souris
  updateEntityMovement(player, mouse);

  // Manger nourriture
  for (let i = foods.length - 1; i >= 0; i--) {
    if (distance(player, foods[i]) < player.r + foods[i].r) {
      player.r += foods[i].r * 0.05;
      player.score++;
      foods.splice(i, 1);
      foods.push(spawnFood());
    }
  }

  // Manger bonus
  for (let i = bonuses.length - 1; i >= 0; i--) {
    const b = bonuses[i];
    if (!b.active) continue;
    if (distance(player, b) < player.r + b.r) {
      applyBonus(player, b.type);
      b.active = false;
      bonuses.splice(i,1);
      bonuses.push(spawnBonus());
    }
  }

  if (player.boostTimer > 0) {
    player.boostTimer--;
    if (player.boostTimer === 0) {
      player.speed = player.baseSpeed;
    }
  }
}

function applyBonus(entity, type) {
  if(type === "yellow") {
    entity.r += 5; // bonus taille
  } else if(type === "pink") {
    entity.speed += 2; // bonus vitesse
    entity.boostTimer = 300; // dure 300 frames (~5s)
  }
}

function updateBots() {
  for (let bot of bots) {
    if(bot.boostTimer > 0) {
      bot.boostTimer--;
      if(bot.boostTimer === 0) {
        bot.speed = bot.baseSpeed;
      }
    }

    // Comportement IA :

    // Fuir joueurs + bots plus gros
    let threat = null;
    let threatDist = Infinity;

    // Chercher plus gros joueurs à fuir
    const others = [...bots, player].filter(e => e !== bot);

    for(let other of others) {
      if(other.r > bot.r * 1.1) {
        let d = distance(bot, other);
        if(d < threatDist) {
          threatDist = d;
          threat = other;
        }
      }
    }

    if(threat && threatDist < 200) {
      // Fuir
      const fleeX = bot.x - threat.x;
      const fleeY = bot.y - threat.y;
      const dist = Math.hypot(fleeX, fleeY);
      bot.x += (fleeX / dist) * bot.speed;
      bot.y += (fleeY / dist) * bot.speed;
    } else {
      // Chercher cible plus petite pour chasser
      let target = null;
      let targetDist = Infinity;
      for(let other of others) {
        if(other.r * 1.1 < bot.r) {
          let d = distance(bot, other);
          if(d < targetDist) {
            targetDist = d;
            target = other;
          }
        }
      }

      if(target && targetDist < 300) {
        // Approcher
        updateEntityMovement(bot, target);
      } else {
        // Déplacement aléatoire
        bot.x += bot.dx * bot.speed;
        bot.y += bot.dy * bot.speed;
        // Rebonds
        if(bot.x < bot.r || bot.x > canvas.width - bot.r) bot.dx = -bot.dx;
        if(bot.y < bot.r || bot.y > canvas.height - bot.r) bot.dy = -bot.dy;
      }
    }

    // Manger nourriture
    for(let i = foods.length-1; i >= 0; i--) {
      if(distance(bot, foods[i]) < bot.r + foods[i].r) {
        bot.r += foods[i].r * 0.05;
        bot.score++;
        foods.splice(i, 1);
        foods.push(spawnFood());
      }
    }

    // Manger bonus
    for(let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      if(!b.active) continue;
      if(distance(bot, b) < bot.r + b.r) {
        applyBonus(bot, b.type);
        b.active = false;
        bonuses.splice(i, 1);
        bonuses.push(spawnBonus());
      }
    }
  }
}

function canEat(eater, eaten) {
  // Peut manger si 10% plus gros
  return eater.r > eaten.r * 1.1 && distance(eater, eaten) < eater.r;
}

function handleEating() {
  // Joueur mange bots
  for(let i = bots.length-1; i >=0; i--) {
    let bot = bots[i];
    if(canEat(player, bot)) {
      player.r += bot.r * 0.8;
      player.score += Math.floor(bot.r);
      bots.splice(i, 1);
      bots.push(spawnBot());
    }
  }
  // Bots mangent joueur
  for(let bot of bots) {
    if(canEat(bot, player)) {
      // Game over
      alert("Vous avez été mangé ! Partie terminée.");
      window.location.reload();
      return;
    }
  }

  // Bots mangent bots (ils peuvent se manger entre eux)
  for(let i = bots.length-1; i>=0; i--) {
    for(let j = bots.length-1; j>=0; j--) {
      if(i === j) continue;
      if(canEat(bots[i], bots[j])) {
        bots[i].r += bots[j].r * 0.8;
        bots[i].score += Math.floor(bots[j].r);
        bots.splice(j,1);
        bots.push(spawnBot());
        break;
      }
    }
  }
}

function drawStar(x, y, r, color) {
  const spikes = 5;
  const step = Math.PI / spikes;
  let rot = Math.PI / 2 * 3;
  let cx = x;
  let cy = y;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  for(let i=0; i < spikes; i++) {
    let x1 = cx + Math.cos(rot) * r;
    let y1 = cy + Math.sin(rot) * r;
    ctx.lineTo(x1, y1);
    rot += step;

    x1 = cx + Math.cos(rot) * r/2;
    y1 = cy + Math.sin(rot) * r/2;
    ctx.lineTo(x1, y1);
    rot += step;
  }
  ctx.lineTo(cx, cy - r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function drawCircle(entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.r, 0, Math.PI * 2);
  ctx.fillStyle = entity.color;
  ctx.fill();

  // Nom
  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12, entity.r / 2)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(entity.name, entity.x, entity.y + 4);
}

function draw() {
  if(!player) return;
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // Nourriture
  for(let f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  // Bonus étoiles
  for(let b of bonuses) {
    if(!b.active) continue;
    drawStar(b.x, b.y, b.r, b.type === "yellow" ? "yellow" : "deeppink");
  }

  // Bots
  for(let bot of bots) {
    drawCircle(bot);
  }

  // Joueur
  drawCircle(player);
}

function updateScore() {
  if(!player) return;
  // Tri classement par score décroissant (r)
  let leaderboard = [...bots, player].sort((a,b) => b.r - a.r);
  let rank = leaderboard.findIndex(e => e === player) + 1;
  scoreDiv.textContent = `${player.name} - Rang: ${rank} / ${leaderboard.length} - Score: ${player.score}`;
}

function loop() {
  updatePlayer();
  updateBots();
  handleEating();
  draw();
  updateScore();
  animationFrameId = requestAnimationFrame(loop);
}

startBtn.addEventListener("click", () => {
  if(pseudoInput.value.trim().length === 0) {
    alert("Merci de saisir un pseudo.");
    return;
  }
  initGame();
});

window.addEventListener("resize", () => {
  if(!player) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
