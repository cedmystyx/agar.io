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

// Variables de jeu et constantes
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

// XP et progression conservés en localStorage
let savedLevel = parseInt(localStorage.getItem("playerLevel")) || 1;
let savedScore = parseInt(localStorage.getItem("playerScore")) || 0;

// Grades et niveaux comme avant
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

// Position cible en "monde" calculée à partir de la souris et de la caméra
function getMouseWorldPos() {
  return {
    x: (mouse.x - canvas.width/2) / cameraZoom + player.x,
    y: (mouse.y - canvas.height/2) / cameraZoom + player.y
  };
}

// Déplacement joueur vers la position monde de la souris
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

// ... Le reste du code reste identique sauf :
// 1) Affichage niveau + grade dans le menu, pas en jeu
// 2) Mise à jour du niveau sauvegardé et affichage dans le menu

function updateGame(delta) {
  if(gameOver) return;

  movePlayerTowardsMouse();

  // Gestion nourriture, bonus, bots, manger etc. identique...

  // Mise à jour timer
  const elapsed = performance.now() - gameStartTime;
  const remaining = Math.max(0, GAME_DURATION - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDiv.textContent = `Temps restant : ${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;

  if(remaining <= 0) {
    gameOver = true;
    endGame();
  }

  // Mise à jour du score / level du joueur en cours de partie
  player.level = clamp(Math.floor(player.score / 5) + savedLevel, 1, MAX_LEVEL);
}

function endGame() {
  // Met à jour le niveau global sauvegardé
  savedLevel = player.level;
  savedScore = player.score;
  localStorage.setItem("playerLevel", savedLevel);
  localStorage.setItem("playerScore", savedScore);

  alert(`Partie terminée !\nNiveau atteint : ${savedLevel}\nGrade : ${getGrade(savedLevel)}`);

  // Met à jour affichage menu
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
  ctx.fillRect(0,0,canvas.width, canvas.height);

  // Zoom et centrage caméra sur joueur
  const minR = 10;
  const maxR = 150;
  const minZoom = 2;
  const maxZoom = 0.7;

  let targetZoom = minZoom - ((player.r - minR) / (maxR - minR)) * (minZoom - maxZoom);
  targetZoom = clamp(targetZoom, maxZoom, minZoom);

  cameraZoom += (targetZoom - cameraZoom) * 0.1;

  ctx.setTransform(cameraZoom, 0, 0, cameraZoom, canvas.width/2 - player.x * cameraZoom, canvas.height/2 - player.y * cameraZoom);

  // Dessin nourriture, bonus, bots comme avant

  // Dessin joueur
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12, player.r / 2)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(player.name, player.x, player.y + 4);
}

// Gestion événement démarrage
startBtn.onclick = () => {
  // Met à jour le niveau affiché dans le menu à partir du localStorage
  menuLevelSpan.textContent = savedLevel;
  menuGradeSpan.textContent = getGrade(savedLevel);

  startGame();
};

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
    boostTimer: 0
  };

  // Spawn bots, nourriture, bonus etc. comme avant...

  gameStartTime = performance.now();
  gameOver = false;

  menu.style.display = "none";
  gameContainer.style.display = "block";

  scoreDiv.textContent = `Score : 0`;
  timerDiv.textContent = `Temps restant : 05:00`;

  loop();
}

let animationFrameId;
let lastFrame = performance.now();

function loop(time=0) {
  let delta = time - lastFrame;
  lastFrame = time;

  updateGame(delta);
  draw();

  if(!gameOver) animationFrameId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Initialisation affichage menu niveau/grade au chargement
menuLevelSpan.textContent = savedLevel;
menuGradeSpan.textContent = getGrade(savedLevel);
