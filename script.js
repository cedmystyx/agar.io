// Récupérations éléments DOM
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

// CONSTANTES ET VARIABLES GLOBALES
const MAX_BOTS = 20;
const FOOD_COUNT = 2200; // multiplié par 4
const GAME_DURATION = 3 * 60 * 1000; // 3 minutes
const MAP_SIZE = 4500;
const HALF_MAP = MAP_SIZE / 2;
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

// Liste emojis nourriture
const FOOD_EMOJIS = ["🍰","🍉","🍕","🍔","🍦","🍩","🍇","🍒","🍎","🍌","🍟","🌮"];

// Stats dans localStorage
let stats = {
  wins: parseInt(localStorage.getItem("wins")) || 0,
  losses: parseInt(localStorage.getItem("losses")) || 0,
};

// Variables de jeu
let player = null;
let bots = [];
let foods = [];
let virus = null;
let bonuses = [];

let cameraZoom = 1;
let gameStartTime = null;
let gameOver = false;

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Fonctions utilitaires
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

// Resize dynamique du canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Suivi souris et tactile
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

// Génère nourriture avec emoji
function spawnFood() {
  foods = [];
  for(let i=0; i<FOOD_COUNT; i++){
    foods.push({
      x: (Math.random()-0.5)*MAP_SIZE,
      y: (Math.random()-0.5)*MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random()*FOOD_EMOJIS.length)]
    });
  }
}

// Ajoute nourriture aléatoire quand mangée
function spawnRandomFood(count=5){
  for(let i=0; i<count; i++){
    foods.push({
      x: (Math.random()-0.5)*MAP_SIZE,
      y: (Math.random()-0.5)*MAP_SIZE,
      r: 10,
      emoji: FOOD_EMOJIS[Math.floor(Math.random()*FOOD_EMOJIS.length)]
    });
  }
}

// Génère bots
function spawnBots(initial=true){
  if(initial) bots = [];
  while(bots.length < MAX_BOTS){
    bots.push({
      x: (Math.random()-0.5)*MAP_SIZE,
      y: (Math.random()-0.5)*MAP_SIZE,
      r: 15 + Math.random()*15,
      color: `hsl(${Math.random()*360}, 60%, 50%)`,
      speed: 1 + Math.random()*1.5,
      target: null,
      score: 0,
      respawnTimeout: null,
      changeTargetTime: 0,
    });
  }
}

// Respawn bot
function respawnBot(bot){
  bot.x = (Math.random()-0.5)*MAP_SIZE;
  bot.y = (Math.random()-0.5)*MAP_SIZE;
  bot.r = 15 + Math.random()*15;
  bot.color = `hsl(${Math.random()*360}, 60%, 50%)`;
  bot.speed = 1 + Math.random()*1.5;
  bot.target = null;
  bot.score = 0;
  bot.respawnTimeout = null;
  bot.changeTargetTime = 0;
}

// Clamp position dans la map
function clampPosition(entity){
  entity.x = clamp(entity.x, -HALF_MAP, HALF_MAP);
  entity.y = clamp(entity.y, -HALF_MAP, HALF_MAP);
}

// Virus (Forma Virus)
function spawnVirus(){
  virus = {
    x: (Math.random()-0.5)*MAP_SIZE,
    y: (Math.random()-0.5)*MAP_SIZE,
    r: 30,
    color: "red",
    speed: 1.2,
    direction: Math.random()*Math.PI*2
  };
}

function moveVirus(){
  if(!virus) return;
  virus.x += Math.cos(virus.direction)*virus.speed;
  virus.y += Math.sin(virus.direction)*virus.speed;

  // Rebond sur les bords
  if(virus.x < -HALF_MAP || virus.x > HALF_MAP) virus.direction = Math.PI - virus.direction;
  if(virus.y < -HALF_MAP || virus.y > HALF_MAP) virus.direction = -virus.direction;

  clampPosition(virus);
}

// BONUS SYSTEME
const bonusTypes = ["speed", "shield", "reset"];
const bonusColors = { speed: "yellow", shield: "cyan", reset: "white" };

function spawnBonuses(){
  if(bonuses.length >= 5) return; // max 5 bonus en jeu max
  const type = bonusTypes[Math.floor(Math.random()*bonusTypes.length)];
  bonuses.push({
    x: (Math.random()-0.5)*MAP_SIZE,
    y: (Math.random()-0.5)*MAP_SIZE,
    r: 8,
    type: type,
    color: bonusColors[type]
  });
}

setInterval(spawnBonuses, 15000);

function handleBonuses(){
  bonuses = bonuses.filter(bonus => {
    if(dist(player, bonus) < player.r + bonus.r){
      switch(bonus.type){
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
function drawBonuses(){
  bonuses.forEach(bonus => {
    ctx.fillStyle = bonus.color;
    ctx.beginPath();
    ctx.arc(bonus.x, bonus.y, bonus.r, 0, Math.PI*2);
    ctx.fill();
  });
}

// Calcul position souris dans monde (relatif à player)
function getMouseWorldPos(){
  return {
    x: (mouse.x - canvas.width/2)/cameraZoom + player.x,
    y: (mouse.y - canvas.height/2)/cameraZoom + player.y,
  };
}

// Déplacement joueur vers souris
function movePlayerTowardsMouse(){
  const target = getMouseWorldPos();
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distToTarget = Math.hypot(dx, dy);
  if(distToTarget > 1){
    const moveDist = Math.min(distToTarget, player.speed);
    player.x += (dx/distToTarget)*moveDist;
    player.y += (dy/distToTarget)*moveDist;
    clampPosition(player);
  }
}

// IA des bots
function botsAI(){
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;

    if(!bot.changeTargetTime || performance.now() > bot.changeTargetTime){
      bot.changeTargetTime = performance.now() + 2000 + Math.random()*3000;

      let possibleTargets = [];

      // Nourriture
      possibleTargets = possibleTargets.concat(foods);

      // Bots plus petits
      bots.forEach(otherBot => {
        if(otherBot !== bot && !otherBot.respawnTimeout && otherBot.r < bot.r*0.9){
          possibleTargets.push(otherBot);
        }
      });

      // Joueur si plus petit
      if(player.r < bot.r*0.9 && !gameOver){
        possibleTargets.push(player);
      }

      // Points aléatoires
      for(let i=0; i<5; i++){
        possibleTargets.push({
          x: (Math.random()-0.5)*MAP_SIZE,
          y: (Math.random()-0.5)*MAP_SIZE,
          r: 0,
          isPoint: true,
        });
      }

      bot.target = possibleTargets[Math.floor(Math.random()*possibleTargets.length)];
    }

    if(!bot.target) return;

    let targetX = bot.target.x;
    let targetY = bot.target.y;

    // Fuir joueur s'il est plus gros
    if(bot.target === player && player.r > bot.r*1.1){
      targetX = bot.x - (player.x - bot.x);
      targetY = bot.y - (player.y - bot.y);
    }

    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const distance = Math.hypot(dx, dy);

    if(distance > 1){
      const moveDist = Math.min(distance, bot.speed);
      bot.x += (dx/distance)*moveDist;
      bot.y += (dy/distance)*moveDist;
      clampPosition(bot);
    }
  });
}

// Supprimer bot (mort)
function removeBot(botIndex){
  let bot = bots[botIndex];
  if(bot.respawnTimeout) return;

  bot.respawnTimeout = setTimeout(() => {
    respawnBot(bot);
  }, 2000);

  bot.x = 99999;
  bot.y = 99999;
  bot.r = 0;
  bot.target = null;
  bot.score = 0;
}

// Vérifications collisions et interactions
function eatCheck(){
  handleBonuses();

  if(virus && dist(player, virus) < player.r + virus.r){
    if(!player.shield){
      player.r = Math.max(10, player.r/2);
      spawnVirus();
    }
  }

  // Joueur mange nourriture
for(let i=foods.length-1; i>=0; i--){
  let food = foods[i];
  if(dist(player, food) < player.r + food.r){
    foods.splice(i,1);
    player.targetR = Math.min(150, player.targetR + 0.5);  // <-- ici
    spawnRandomFood(1);
  }
}

// Joueur mange bots plus petits
for(let i=bots.length-1; i>=0; i--){
  let bot = bots[i];
  if(bot.respawnTimeout) continue;
  if(bot !== player && dist(player, bot) < player.r && player.r > bot.r*1.1){
    player.score += Math.floor(bot.r);
    player.targetR = Math.min(150, player.targetR + bot.r*0.6);  // <-- ici
    removeBot(i);
  }
}

  // Bots mangent nourriture
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    for(let i=foods.length-1; i>=0; i--){
      let food = foods[i];
      if(dist(bot, food) < bot.r + food.r){
        foods.splice(i,1);
        bot.score++;
        bot.r = Math.min(150, bot.r + 0.2);
        spawnRandomFood(1);
      }
    }
  });

  // Bots mangent joueur si plus gros
  for(let i=bots.length-1; i>=0; i--){
    let bot = bots[i];
    if(bot.respawnTimeout) continue;
    if(dist(bot, player) < bot.r && bot.r > player.r*1.1){
      if(!player.shield){
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
  for(let i=bots.length-1; i>=0; i--){
    for(let j=bots.length-1; j>=0; j--){
      if(i === j) continue;
      let b1 = bots[i], b2 = bots[j];
      if(b1.respawnTimeout || b2.respawnTimeout) continue;
      if(dist(b1,b2) < b1.r && b1.r > b2.r*1.1){
        b1.r = Math.min(150, b1.r + b2.r*0.3);
        b1.score += Math.floor(b2.r);
        removeBot(j);
        if(j < i) i--;
      }
    }
  }
}

// Mise à jour du jeu chaque frame
function updateGame(delta){
  if(gameOver) return;

  movePlayerTowardsMouse();
  botsAI();
  eatCheck();
  moveVirus();

  // Lissage taille joueur pour éviter les sauts brusques
  const growthSpeed = 0.1; // Ajustable (0.05 à 0.2)
  player.r += (player.targetR - player.r) * growthSpeed;

  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);

  const minutes = Math.floor(remaining/60000);
  const seconds = Math.floor((remaining%60000)/1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(remaining <= 0){
    gameOver = true;
    stats.wins++;
    localStorage.setItem("wins", stats.wins);
    alert("Temps écoulé, tu as gagné la partie !");
    endGame();
  }

  player.level = clamp(Math.floor(player.score/10)+1, 1, MAX_LEVEL);
  scoreDiv.textContent = `Score : ${player.score}`;
}

  player.level = clamp(Math.floor(player.score/10)+1, 1, MAX_LEVEL);
  scoreDiv.textContent = `Score : ${player.score}`;
}

// Fin de partie : mise à jour stats et affichage menu
function endGame(){
  menuLevelSpan.textContent = player.level;
  menuGradeSpan.textContent = getGrade(player.level);
  menuWinsSpan.textContent = stats.wins;
  menuLossesSpan.textContent = stats.losses;

  cancelAnimationFrame(animationFrameId);
  menu.style.display = "block";
  gameContainer.style.display = "none";
}

// Dessiner étoile (pour virus)
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for(let i=0; i<spikes; i++){
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x,y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x,y);
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

// Fonction pour dessiner tuyaux électriques animés
function drawElectricPipe(ctx, x1, y1, x2, y2, time) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);
  
  // Tube extérieur (transparent gris bleuté)
  ctx.strokeStyle = 'rgba(100,100,255,0.4)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  
  // Animation électrique : zigzag cyan
  const waveAmplitude = 6;
  const waveLength = 30;
  const speed = 0.15;
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for(let i = 0; i <= length; i++) {
    const y = waveAmplitude * Math.sin((i / waveLength + time * speed) * Math.PI * 2);
    if(i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  ctx.stroke();
  
  ctx.restore();
}

// Boucle dessin
let animationFrameId;
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();

  cameraZoom = 100 / (player.r + 30);
  cameraZoom = clamp(cameraZoom, 0.3, 1.5);
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-player.x, -player.y);

  // Nourriture avec emojis
  foods.forEach(food => {
    ctx.font = `${food.r * 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(food.emoji, food.x, food.y);
  });

  // Dessiner bots
  bots.forEach(bot => {
    if(bot.respawnTimeout) return;
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.r, 0, Math.PI*2);
    ctx.fill();
  });

  // Dessiner joueur
  ctx.fillStyle = player.shield ? "lightblue" : player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
  ctx.fill();

  // Dessiner virus (forme étoile)
  if(virus){
    drawStar(ctx, virus.x, virus.y, 5, virus.r, virus.r/2);
  }

  // Dessiner bonus
  drawBonuses();

  // Dessiner limites tuyaux électriques
  const time = performance.now() / 1000;
  drawElectricPipe(ctx, -HALF_MAP, -HALF_MAP, HALF_MAP, -HALF_MAP, time); // haut
  drawElectricPipe(ctx, HALF_MAP, -HALF_MAP, HALF_MAP, HALF_MAP, time);   // droite
  drawElectricPipe(ctx, HALF_MAP, HALF_MAP, -HALF_MAP, HALF_MAP, time);   // bas
  drawElectricPipe(ctx, -HALF_MAP, HALF_MAP, -HALF_MAP, -HALF_MAP, time); // gauche

  ctx.restore();

  animationFrameId = requestAnimationFrame(draw);
}

// Initialisation du joueur
function initPlayer(){
  player = {
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,       // <-- taille cible pour interpolation
    color: "limegreen",
    speed: 3,
    score: 0,
    level: 1,
    shield: false,
  };
}

// Démarrer la partie
function startGame(){
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
let lastTime = 0;
function gameLoop(time=0){
  const delta = time - lastTime;
  lastTime = time;
  updateGame(delta);
  if(!gameOver) requestAnimationFrame(gameLoop);
}

// Gestion bouton démarrer
startBtn.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  if(pseudo.length < 2){
    alert("Veuillez entrer un pseudo d'au moins 2 caractères.");
    return;
  }

  // Initialise le joueur avec les bonnes valeurs et la couleur choisie
  player = {
    x: 0,
    y: 0,
    r: 20,
    targetR: 20,
    color: colorPicker.value || "limegreen",
    speed: 3,
    score: 0,
    level: 1,
    shield: false,
  };

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
});

// Affichage stats menu au chargement
menuWinsSpan.textContent = stats.wins;
menuLossesSpan.textContent = stats.losses;

// Appelle le spawn initial
spawnFood();
spawnBots(true);
spawnVirus();
