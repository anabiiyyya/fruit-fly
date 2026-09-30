/**
 * Fruit Fly Adventure
 * A beginner-friendly Flappy Bird-style game built with vanilla HTML5 Canvas & JavaScript.
 */

// ==========================================
// 1. DOM Elements & Canvas Setup
// ==========================================
const gameWrapper = document.getElementById('gameWrapper');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const currentScoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const newRecordTag = document.getElementById('newRecordTag');
const restartBtn = document.getElementById('restartBtn');

// Internal game resolution (400 x 600)
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// ==========================================
// 2. Audio Effects (Web Audio API Synthesizer)
// ==========================================
// Self-contained sound effects without needing external audio files
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Gentle upward flap sound
function playFlapSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {}
}

// Pleasant fruit collected chime
function playScoreSound() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.0, now + 0.08); // A5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {}
}

// Soft thud collision sound
function playHitSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  } catch (e) {}
}

// ==========================================
// 3. Game State & Persistence
// ==========================================
const STATE_START = 'START';
const STATE_PLAYING = 'PLAYING';
const STATE_GAMEOVER = 'GAMEOVER';
let gameState = STATE_START;

let currentScore = 0;
let highestRecord = 0;
let isNewRecordAchieved = false;

// Load highest record from localStorage
function loadHighestRecord() {
  try {
    const saved = localStorage.getItem('fruitFlyBestScore');
    if (saved !== null) {
      highestRecord = parseInt(saved, 10) || 0;
    }
  } catch (err) {
    highestRecord = 0;
  }
  bestScoreEl.textContent = highestRecord;
}

// Save highest record to localStorage
function saveHighestRecord(score) {
  try {
    localStorage.setItem('fruitFlyBestScore', score.toString());
  } catch (err) {
    // LocalStorage might be restricted in some iframe environments
  }
}

// Physics & speed constants
const GROUND_HEIGHT = 80;
const GRAVITY = 0.38;
const JUMP_FORCE = -6.8;
const BASE_SPEED = 2.4;
let currentSpeed = BASE_SPEED;

// Floating fruit pickup effect list
let floatingEffects = [];

// ==========================================
// 4. Fruit Fly Character
// ==========================================
const fly = {
  x: GAME_WIDTH / 2, // Centered on start screen
  y: GAME_HEIGHT / 2 - 10,
  radius: 12, // Hitbox radius
  velocity: 0,
  rotation: 0,
  wingAngle: 0,
  wingSpeed: 0.35,

  // Reset fly to gameplay position
  reset() {
    this.x = 100;
    this.y = GAME_HEIGHT / 2 - 20;
    this.velocity = 0;
    this.rotation = 0;
    this.wingAngle = 0;
  },

  // Flap upward
  flap() {
    this.velocity = JUMP_FORCE;
    playFlapSound();
  },

  // Update physics and rotation
  update(time) {
    if (gameState === STATE_PLAYING) {
      this.velocity += GRAVITY;
      this.y += this.velocity;

      // Calculate tilt angle based on velocity (upward when flapping, downward when diving)
      const targetRotation = Math.min(Math.PI / 3, Math.max(-Math.PI / 5, this.velocity * 0.08));
      this.rotation += (targetRotation - this.rotation) * 0.2;

      // Faster wing flutter when moving upward
      this.wingSpeed = this.velocity < 0 ? 0.7 : 0.4;
      this.wingAngle += this.wingSpeed;
    } else if (gameState === STATE_START) {
      // Centered gentle bobbing animation on start screen
      this.x = GAME_WIDTH / 2;
      this.y = GAME_HEIGHT / 2 - 10 + Math.sin(time * 0.005) * 10;
      this.rotation = Math.sin(time * 0.003) * 0.08;
      this.wingAngle += 0.35;
    }
  },

  // Draw the detailed fruit fly character
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Enlarge slightly on start screen for extra visual charm
    if (gameState === STATE_START) {
      ctx.scale(1.2, 1.2);
    }

    // 1. Legs
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(-10, 14);
    ctx.moveTo(2, 6);
    ctx.lineTo(3, 14);
    ctx.stroke();

    // 2. Fly Abdomen (Segmented honey amber body with stripes)
    const bodyGradient = ctx.createLinearGradient(-16, 0, 14, 0);
    bodyGradient.addColorStop(0, '#d97706'); // Warm honey amber
    bodyGradient.addColorStop(0.7, '#f59e0b');
    bodyGradient.addColorStop(1, '#b45309');

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Segment stripes characteristic of fruit flies
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-8, 8);
    ctx.moveTo(-2, -9);
    ctx.lineTo(-2, 9);
    ctx.moveTo(4, -8);
    ctx.lineTo(4, 8);
    ctx.stroke();

    // Body dark border
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Translucent Fluttering Wings
    const wingFlap = Math.sin(this.wingAngle);
    const wingYOffset = -6;

    // Left Wing
    ctx.save();
    ctx.translate(-2, wingYOffset);
    ctx.rotate(-0.35 + wingFlap * 0.45);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-10, -10, 14, 6, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Wing vein detail
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-18, -14);
    ctx.lineTo(-4, -6);
    ctx.stroke();
    ctx.restore();

    // Right Wing
    ctx.save();
    ctx.translate(4, wingYOffset);
    ctx.rotate(0.25 - wingFlap * 0.4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-4, -12, 13, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Distinctive Ruby-Red Compound Eye
    const eyeX = 9;
    const eyeY = -3;
    const eyeRadius = 5.5;

    const eyeGrad = ctx.createRadialGradient(eyeX - 1, eyeY - 1, 1, eyeX, eyeY, eyeRadius);
    eyeGrad.addColorStop(0, '#f87171');
    eyeGrad.addColorStop(0.6, '#dc2626');
    eyeGrad.addColorStop(1, '#991b1b');

    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eye highlight shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, eyeY - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 5. Antennae
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(13, -5);
    ctx.lineTo(18, -9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(18, -9, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    ctx.restore();
  }
};

// ==========================================
// 5. Obstacles (Pillars & Gaps)
// ==========================================
const PILLAR_WIDTH = 56;
const PILLAR_GAP = 145; // Height of gap between top and bottom pillars
const PILLAR_SPACING = 210; // Distance between successive pillar pairs

let pillars = [];

// Helper to spawn a new pillar pair
function spawnPillar(startX) {
  const minTop = 60;
  const maxTop = GAME_HEIGHT - GROUND_HEIGHT - PILLAR_GAP - 60;
  const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
  const bottomY = topHeight + PILLAR_GAP;

  pillars.push({
    x: startX,
    topHeight: topHeight,
    bottomY: bottomY,
    width: PILLAR_WIDTH,
    passed: false, // Flag ensuring score increases only once per pair
    fruitY: topHeight + PILLAR_GAP / 2 // Floating strawberry position
  });
}

// Reset pillars array
function initPillars() {
  pillars = [];
  spawnPillar(GAME_WIDTH + 80);
  spawnPillar(GAME_WIDTH + 80 + PILLAR_SPACING);
}

// Update pillar positions and remove offscreen ones
function updatePillars() {
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    p.x -= currentSpeed;

    // Check if fruit fly successfully passed the pillar
    if (!p.passed && p.x + p.width < fly.x) {
      p.passed = true;
      incrementScore(p.x + p.width / 2, p.fruitY);
    }
  }

  // Remove pillars that have exited the screen on the left
  if (pillars.length > 0 && pillars[0].x < -PILLAR_WIDTH) {
    pillars.shift();
  }

  // Add a new pillar when the last pillar is far enough onto the screen
  const lastPillar = pillars[pillars.length - 1];
  if (lastPillar && lastPillar.x < GAME_WIDTH - PILLAR_SPACING + PILLAR_WIDTH) {
    spawnPillar(GAME_WIDTH);
  }
}

// Draw a single vertical pipe pillar with collar and highlights
function drawPillar(x, y, width, height, isTop) {
  ctx.save();

  // Main body gradient (vibrant green with cylindrical shading)
  const pipeGrad = ctx.createLinearGradient(x, 0, x + width, 0);
  pipeGrad.addColorStop(0, '#15803d');
  pipeGrad.addColorStop(0.2, '#22c55e');
  pipeGrad.addColorStop(0.5, '#4ade80');
  pipeGrad.addColorStop(0.85, '#16a34a');
  pipeGrad.addColorStop(1, '#14532d');

  ctx.fillStyle = pipeGrad;
  ctx.fillRect(x, y, width, height);

  // Darker border
  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, width, height);

  // Pipe Cap / Collar (rim near the gap)
  const capHeight = 24;
  const capOverhang = 5;
  const capX = x - capOverhang;
  const capWidth = width + capOverhang * 2;
  const capY = isTop ? y + height - capHeight : y;

  const capGrad = ctx.createLinearGradient(capX, 0, capX + capWidth, 0);
  capGrad.addColorStop(0, '#15803d');
  capGrad.addColorStop(0.25, '#4ade80');
  capGrad.addColorStop(0.7, '#22c55e');
  capGrad.addColorStop(1, '#14532d');

  ctx.fillStyle = capGrad;
  ctx.fillRect(capX, capY, capWidth, capHeight);
  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(capX, capY, capWidth, capHeight);

  ctx.restore();
}

// Draw all pillars and floating fruit collectibles
function renderPillars() {
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];

    // Top pillar
    drawPillar(p.x, 0, p.width, p.topHeight, true);

    // Bottom pillar
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - p.bottomY;
    drawPillar(p.x, p.bottomY, p.width, bottomHeight, false);

    // Floating Fruit in the gap (if not yet collected)
    if (!p.passed) {
      ctx.save();
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bob = Math.sin(Date.now() * 0.005 + p.x) * 4;
      ctx.fillText('🍓', p.x + p.width / 2, p.fruitY + bob);
      ctx.restore();
    }
  }
}

// ==========================================
// 6. Background, Clouds, and Moving Ground
// ==========================================
let groundOffset = 0;
const clouds = [
  { x: 30, y: 50, scale: 0.9, speed: 0.3 },
  { x: 180, y: 110, scale: 1.2, speed: 0.4 },
  { x: 320, y: 70, scale: 0.75, speed: 0.25 }
];

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.beginPath();
  ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x + 16 * scale, y - 6 * scale, 20 * scale, 0, Math.PI * 2);
  ctx.arc(x + 36 * scale, y - 2 * scale, 17 * scale, 0, Math.PI * 2);
  ctx.arc(x + 48 * scale, y + 2 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderEnvironment() {
  // 1. Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT - GROUND_HEIGHT);
  skyGrad.addColorStop(0, '#38bdf8'); // Sky blue
  skyGrad.addColorStop(0.7, '#7dd3fc');
  skyGrad.addColorStop(1, '#bae6fd');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);

  // 2. Moving Clouds
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    if (gameState === STATE_PLAYING) {
      c.x -= c.speed;
      if (c.x < -80) c.x = GAME_WIDTH + 40;
    }
    drawCloud(c.x, c.y, c.scale);
  }

  // 3. Distant soft hills
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.ellipse(80, GAME_HEIGHT - GROUND_HEIGHT, 140, 50, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(280, GAME_HEIGHT - GROUND_HEIGHT, 160, 60, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // 4. Moving Ground
  if (gameState === STATE_PLAYING) {
    groundOffset = (groundOffset + currentSpeed) % 24;
  }

  const groundY = GAME_HEIGHT - GROUND_HEIGHT;

  // Grass top border
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(0, groundY, GAME_WIDTH, 14);

  // Grass blade highlight
  ctx.fillStyle = '#84cc16';
  ctx.fillRect(0, groundY, GAME_WIDTH, 5);

  // Soil
  const dirtGrad = ctx.createLinearGradient(0, groundY + 14, 0, GAME_HEIGHT);
  dirtGrad.addColorStop(0, '#b45309');
  dirtGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(0, groundY + 14, GAME_WIDTH, GROUND_HEIGHT - 14);

  // Ground stripe texture
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -groundOffset; x < GAME_WIDTH + 24; x += 20) {
    ctx.moveTo(x, groundY + 14);
    ctx.lineTo(x - 10, GAME_HEIGHT);
  }
  ctx.stroke();

  // Ground top line
  ctx.strokeStyle = '#3f6212';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(GAME_WIDTH, groundY);
  ctx.stroke();
}

// ==========================================
// 7. Floating Score Animations
// ==========================================
function spawnFruitCollectEffect(x, y) {
  floatingEffects.push({
    x: x,
    y: y,
    alpha: 1,
    dy: -1.8,
    text: '+1 🍓'
  });
}

function updateAndRenderEffects() {
  for (let i = floatingEffects.length - 1; i >= 0; i--) {
    const fx = floatingEffects[i];
    fx.y += fx.dy;
    fx.alpha -= 0.025;

    if (fx.alpha <= 0) {
      floatingEffects.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.alpha);
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e11d48';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeText(fx.text, fx.x, fx.y);
    ctx.fillText(fx.text, fx.x, fx.y);
    ctx.restore();
  }
}

// ==========================================
// 8. Scoring & Collision Logic
// ==========================================

// Increase score by 1 when passing pillar gap
function incrementScore(fruitX, fruitY) {
  currentScore++;
  currentScoreEl.textContent = currentScore;
  playScoreSound();
  spawnFruitCollectEffect(fruitX, fruitY);

  // Update highest record immediately if current score exceeds it
  if (currentScore > highestRecord) {
    highestRecord = currentScore;
    bestScoreEl.textContent = highestRecord;
    saveHighestRecord(highestRecord);
    isNewRecordAchieved = true;
  }

  // Gently scale speed for progression while remaining playable
  if (currentScore % 5 === 0 && currentSpeed < 3.8) {
    currentSpeed += 0.12;
  }
}

// Circle-to-box collision check helper
function checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY < radius * radius;
}

// Check if fruit fly has hit obstacles, ceiling, or ground
function checkCollisions() {
  const flyEffectiveRadius = 11; // Slightly forgiving player hitbox

  // 1. Ceiling collision
  if (fly.y - flyEffectiveRadius <= 0) {
    return true;
  }

  // 2. Ground collision
  if (fly.y + flyEffectiveRadius >= GAME_HEIGHT - GROUND_HEIGHT) {
    return true;
  }

  // 3. Pillar obstacle collisions
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];

    // Check collision with top pillar
    if (checkCircleRectCollision(fly.x, fly.y, flyEffectiveRadius, p.x, 0, p.width, p.topHeight)) {
      return true;
    }

    // Check collision with bottom pillar
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - p.bottomY;
    if (checkCircleRectCollision(fly.x, fly.y, flyEffectiveRadius, p.x, p.bottomY, p.width, bottomHeight)) {
      return true;
    }
  }

  return false;
}

// Handle Game Over
function triggerGameOver() {
  gameState = STATE_GAMEOVER;
  playHitSound();

  // Populate game over modal
  finalScoreEl.textContent = currentScore;
  finalBestEl.textContent = highestRecord;

  if (isNewRecordAchieved && currentScore > 0) {
    newRecordTag.classList.remove('hidden');
  } else {
    newRecordTag.classList.add('hidden');
  }

  // Show Game Over overlay
  gameOverScreen.classList.remove('hidden');
}

// Reset and restart game
function restartGame() {
  initAudio();
  gameState = STATE_PLAYING;

  // Reset current score
  currentScore = 0;
  currentScoreEl.textContent = '0';
  isNewRecordAchieved = false;

  // Reset speed
  currentSpeed = BASE_SPEED;

  // Reset fly and obstacles
  fly.reset();
  initPillars();
  floatingEffects = [];

  // Hide overlays
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  // Immediately flap on start/restart for active player control
  fly.flap();
}

// ==========================================
// 9. Input Handlers (Keyboard, Click, Touch)
// ==========================================
function handleAction() {
  initAudio();

  if (gameState === STATE_START) {
    restartGame();
  } else if (gameState === STATE_PLAYING) {
    fly.flap();
  } else if (gameState === STATE_GAMEOVER) {
    restartGame();
  }
}

// Spacebar Listener (prevents page scrolling)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    e.preventDefault(); // Prevent page scroll
    handleAction();
  }
});

// Full game wrapper pointer listener (handles canvas, start screen, and game over screen clicks)
gameWrapper.addEventListener('pointerdown', (e) => {
  // If clicking directly on restart button, let restartBtn handler take it
  if (e.target === restartBtn || (restartBtn && restartBtn.contains(e.target))) {
    return;
  }
  e.preventDefault();
  handleAction();
});

// Restart button listener
if (restartBtn) {
  restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restartGame();
  });
  restartBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
}

// ==========================================
// 10. Main Game Loop
// ==========================================
let lastTime = 0;

function gameLoop(timestamp) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Render environment (sky, clouds, ground)
  renderEnvironment();

  if (gameState === STATE_PLAYING) {
    // Update game logic
    fly.update(timestamp);
    updatePillars();

    // Check collisions
    if (checkCollisions()) {
      triggerGameOver();
    }
  } else if (gameState === STATE_START) {
    fly.update(timestamp);
  }

  // Draw pillars & collectibles (only when playing or game over)
  if (gameState !== STATE_START) {
    renderPillars();
  }

  // Draw floating effects
  updateAndRenderEffects();

  // Draw fruit fly
  fly.draw();

  lastTime = timestamp;
  requestAnimationFrame(gameLoop);
}

// ==========================================
// 11. Initial Startup
// ==========================================
function init() {
  loadHighestRecord();
  fly.x = GAME_WIDTH / 2;
  fly.y = GAME_HEIGHT / 2 - 10;
  requestAnimationFrame(gameLoop);
}

// Start the game initialization when script loads
init();