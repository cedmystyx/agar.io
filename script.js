const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const gameContainer = document.getElementById("gameContainer");

const startBtn = document.getElementById("startBtn");
const pseudoInput = document.getElementById("pseudo");
const colorPicker = document.getElementById("colorPicker");

const scoreDiv = document.getElementById("score");
const levelDiv = document.getElementById("level");
const gradeDiv = document.getElementById("grade");
const timerDiv = document.getElementById("timer");

let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Constantes et variables globales
const MAX_BOTS = 20;
const FOOD_COUNT = 100;
const BONUS_COUNT = 3;
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes en ms

let player = null;
let bots = [];
let foods = [];
let bonuses = [];

let cameraZoom = 1;
let cameraTargetZoom = 1;

let gameStartTime = null;
let gameOver = false;

let lastFrameTime = performance.now();

// Système de niveaux & grades
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

// -- UTILITAIRES -- //
function dist(a,b) {
  return Math.hypot(a.x-b.x, a.y-b.y);
}

function clamp(val,min,max) {
  return Math.min(Math.max(val,min), max);
}

function getGrade(level) {
  // Calcule grade selon niveau
  if(level >= MAX_LEVEL) return GRADES[GRADES.length-1];
  let index = Math.floor(level / (MAX_LEVEL / (GRADES.length-1)));
  return GRADES[index];
}

// -- SPAWN ENTITÉS -- //
function spawnFood() {
  return {
    x: Math.random() * 3000 - 1500,
    y: Math.random() * 3000 - 1500,
    r: 5 + Math.random()*5,
    color: "orange"
  };
}

function spawnBonus() {
  return {
    x: Math.random() * 3000 - 1500,
    y: Math.random() * 3000 - 1500,
    r: 12,
    type: Math.random() < 0.5 ? "yellow" : "pink",
    active: true
  };
}

function randomColor() {
  const letters = "789ABCD";
  let c = "#";
  for(let i=0; i<6; i++) c += letters[Math.floor(Math.random()*letters.length)];
  return c;
}

function spawnBot(level = 1) {
  // Bots ont une taille, vitesse, score et couleur selon leur niveau
  const baseR = 15 + level * 0.5 + Math.random() * 5;
  return {
    x: Math.random() * 3000 - 1500,
    y: Math.random() * 3000 - 1500,
    r: baseR,
    speed: 1 + 0.02 * level,
    baseSpeed: 1 + 0.02 * level,
    color: randomColor(),
    dx: (Math.random() - 0.5),
    dy: (Math.random() - 0.5),
    score: 0,
    name: "Bot",
    level: level,
    boostTimer: 0
  };
}

// -- GESTION DU JOUEUR -- //
function initPlayer(name, color) {
  return {
    x: 0,
    y: 0,
    r: 20,
    speed: 3,
    baseSpeed: 3,
    color: color,
    score: 0,
    name: name || "Anonyme",
    level: 1,
    boostTimer: 0
  };
}

// -- MOUVEMENTS -- //
function moveTowards(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const distance = Math.hypot(dx, dy);
  if(distance > 1) {
    entity.x += (dx/distance)*entity.speed;
    entity.y += (dy/distance)*entity.speed;
  }
}

// -- BONUS -- //
function applyBonus(entity, type) {
  if(type === "yellow") {
    entity.r += 5; // taille +
  } else if(type === "pink") {
    entity.speed += 2;
    entity.boostTimer = 300;
  }
}

// -- DESSINS -- //
function drawStar(x,y,r,color) {
  const spikes = 5;
  const step = Math.PI / spikes;
  let rot = Math.PI/2*3;
  let cx = x;
  let cy = y;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  for(let i=0; i < spikes; i++) {
    let x1 = cx + Math.cos(rot) * r;
    let y1 = cy + Math.sin(rot) * r;
    ctx.lineTo(x1,y1);
    rot += step;
    x1 = cx + Math.cos(rot) * r/2;
    y1 = cy + Math.sin(rot) * r/2;
    ctx.lineTo(x1,y1);
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
  ctx.arc(entity.x, entity.y, entity.r, 0, Math.PI*2);
  ctx.fillStyle = entity.color;
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12, entity.r / 2)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(entity.name, entity.x, entity.y + 4);
}

// -- GESTION DE LA CAMÉRA -- //
function updateCamera() {
  // Zoom dynamique : plus petit, plus zoomé mais pas trop fort
  // on map la taille joueur r entre 10-150 à un zoom entre 2 (petit) et 0.7 (grand)
  const minR = 10;
  const maxR = 150;
  const minZoom = 2;
  const maxZoom = 0.7;

  let targetZoom = minZoom - ((player.r - minR) / (maxR - minR)) * (minZoom - maxZoom);
  targetZoom = clamp(targetZoom, maxZoom, minZoom);

  // Lissage zoom
  cameraZoom += (targetZoom - cameraZoom) * 0.1;

  // Centre caméra sur joueur
  ctx.setTransform(cameraZoom, 0, 0, cameraZoom, canvas.width/2 - player.x * cameraZoom, canvas.height/2 - player.y * cameraZoom);
}

// -- COLLISIONS & MANGEAGE -- //
function canEat(eater, eaten) {
  return eater.r > eaten.r * 1.1 && dist(eater, eaten) < eater.r;
}

function handleEating() {
  // Joueur mange bots
  for(let i = bots.length - 1; i >= 0; i--) {
    let bot = bots[i];
    if(canEat(player, bot)) {
      player.r += bot.r * 0.8;
      player.score += Math.floor(bot.r);
      bots.splice(i, 1);
      bots.push(spawnBot(player.level));
    }
  }
  // Bots mangent joueur
  for(let bot of bots) {
    if(canEat(bot, player)) {
      alert("Vous avez été mangé ! Partie terminée.");
      gameOver = true;
    }
  }
  // Bots mangent bots
  for(let i = bots.length - 1; i >= 0; i--) {
    for(let j = bots.length - 1; j >= 0; j--) {
      if(i === j) continue;
      if(canEat(bots[i], bots[j])) {
        bots[i].r += bots[j].r * 0.8;
        bots[i].score += Math.floor(bots[j].r);
        bots.splice(j, 1);
        bots.push(spawnBot(player.level));
        break;
      }
    }
  }
}

// -- MISE À JOUR DU JEU -- //
function updateGame(delta) {
  if(gameOver) return;

  // Déplacement joueur vers souris
  moveTowards(player, mouse);

  // Nourriture et bonus pour joueur
  for(let i = foods.length-1; i >=0; i--) {
    if(dist(player, foods[i]) < player.r + foods[i].r) {
      player.r += foods[i].r * 0.05;
      player.score++;
      foods.splice(i,1);
      foods.push(spawnFood());
    }
  }

  for(let i = bonuses.length-1; i >=0; i--) {
    if(!bonuses[i].active) continue;
    if(dist(player, bonuses[i]) < player.r + bonuses[i].r) {
      applyBonus(player, bonuses[i].type);
      bonuses[i].active = false;
      bonuses.splice(i,1);
      bonuses.push(spawnBonus());
    }
  }

  if(player.boostTimer > 0) {
    player.boostTimer--;
    if(player.boostTimer === 0) player.speed = player.baseSpeed;
  }

  // Bots update
  for(let bot of bots) {
    if(bot.boostTimer > 0) {
      bot.boostTimer--;
      if(bot.boostTimer === 0) bot.speed = bot.baseSpeed;
    }

    // IA bots améliorée
    const others = [...bots, player].filter(e => e !== bot);

    // Fuir joueurs/bots plus gros proches
    let threat = null;
    let threatDist = Infinity;

    for(let other of others) {
      if(other.r > bot.r * 1.1) {
        let d = dist(bot, other);
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
      const distThreat = Math.hypot(fleeX, fleeY);
      bot.x += (fleeX/distThreat)*bot.speed;
      bot.y += (fleeY/distThreat)*bot.speed;
    } else {
      // Chercher cible plus petite pour chasser
      let target = null;
      let targetDist = Infinity;
      for(let other of others) {
        if(other.r * 1.1 < bot.r) {
          let d = dist(bot, other);
          if(d < targetDist) {
            targetDist = d;
            target = other;
          }
        }
      }
      if(target && targetDist < 300) {
        moveTowards(bot, target);
      } else {
        // Déplacement aléatoire avec rebonds
        bot.x += bot.dx * bot.speed;
        bot.y += bot.dy * bot.speed;
        if(bot.x < bot.r || bot.x > 3000 - bot.r) bot.dx = -bot.dx;
        if(bot.y < bot.r || bot.y > 3000 - bot.r) bot.dy = -bot.dy;
      }
    }

    // Manger nourriture et bonus bots
    for(let i = foods.length-1; i >= 0; i--) {
      if(dist(bot, foods[i]) < bot.r + foods[i].r) {
        bot.r += foods[i].r * 0.05;
        bot.score++;
        foods.splice(i, 1);
        foods.push(spawnFood());
      }
    }
    for(let i = bonuses.length-1; i >= 0; i--) {
      if(!bonuses[i].active) continue;
      if(dist(bot, bonuses[i]) < bot.r + bonuses[i].r) {
        applyBonus(bot, bonuses[i].type);
        bonuses[i].active = false;
        bonuses.splice(i,1);
        bonuses.push(spawnBonus());
      }
    }
  }

  handleEating();

  // Mise à jour du timer
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(remaining <= 0) {
    gameOver = true;
    endGame();
  }

  // Mise à jour du niveau et grade selon score/taille
  // Niveau augmente lentement avec score
  player.level = clamp(Math.floor(player.score / 5), 1, MAX_LEVEL);
  levelDiv.textContent = `Niveau : ${player.level}`;
  gradeDiv.textContent = `Grade : ${getGrade(player.level)}`;
}

// -- FIN DE PARTIE -- //
function endGame() {
  alert(`Partie terminée ! Ton score : ${player.score.toFixed(0)}\nNiveau actuel : ${player.level}\nGrade : ${getGrade(player.level)}`);
  // Reset et retour au menu
  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
  gameOver = false;
}

// -- DESSIN -- //
function draw() {
  ctx.resetTransform();

  // Fond
  ctx.fillStyle = "#222";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  updateCamera();

  // Dessiner nourriture
  for(let f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  // Dessiner bonus
  for(let b of bonuses) {
    if(!b.active) continue;
    drawStar(b.x, b.y, b.r, b.type === "yellow" ? "yellow" : "pink");
  }

  // Dessiner bots
  for(let bot of bots) {
    drawCircle(bot);
  }

  // Dessiner joueur
  drawCircle(player);
}

// -- BOUCLE PRINCIPALE -- //
let animationFrameId;

function loop(t = 0) {
  const delta = t - lastFrameTime;
  lastFrameTime = t;

  updateGame(delta);
  draw();

  if(!gameOver) animationFrameId = requestAnimationFrame(loop);
}

// -- INITIALISATION -- //
function startGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Reset variables
  player = initPlayer(pseudoInput.value.trim() || "Anonyme", colorPicker.value);
  bots = [];
  for(let i=0; i<MAX_BOTS; i++) {
    bots.push(spawnBot(player.level));
  }
  foods = [];
  for(let i=0; i<FOOD_COUNT; i++) {
    foods.push(spawnFood());
  }
  bonuses = [];
  for(let i=0; i<BONUS_COUNT; i++) {
    bonuses.push(spawnBonus());
  }

  cameraZoom = 1;
  gameStartTime = performance.now();
  gameOver = false;

  menu.style.display = "none";
  gameContainer.style.display = "block";

  scoreDiv.textContent = `Score : 0`;
  levelDiv.textContent = `Niveau : 1`;
  gradeDiv.textContent = `Grade : ${getGrade(1)}`;
  timerDiv.textContent = `Temps restant : 05:00`;

  loop();
}

startBtn.onclick = startGame;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
