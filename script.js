/* script.js */

/* === Game Variables and Elements === */

// Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD Elements
const hud = document.getElementById('hud');
const playerHealthSpan = document.getElementById('playerHealth');
const currentRoundSpan = document.getElementById('currentRound');
const multiplierSpan = document.getElementById('multiplier');
const playerAmmoSpan = document.getElementById('playerAmmo');
const currentWeaponSpan = document.getElementById('currentWeapon');

// Menus and Buttons
const startScreen = document.getElementById('mainMenu');
const startButton = document.getElementById('startButton');
const viewHighScoresButton = document.getElementById('viewHighScores');
const settingsButton = document.getElementById('settingsButton');
const highScoresContainer = document.getElementById('highScoresContainer');
const backFromHighScoresButton = document.getElementById('backFromHighScores');
const settingsContainer = document.getElementById('settingsContainer');
const backFromSettingsButton = document.getElementById('backFromSettings');
const mouseSensitivityInput = document.getElementById('mouseSensitivity');
const mouseSensitivityValue = document.getElementById('mouseSensitivityValue');
const roundInfo = document.getElementById('roundInfo');
const roundMessage = document.getElementById('roundMessage');
const countdownElement = document.getElementById('countdown');
const restartButton = document.getElementById('restartButton');
const pauseMenu = document.getElementById('pauseMenu');
const resumeButton = document.getElementById('resumeButton');
const quitButton = document.getElementById('quitButton');
const crosshair = document.querySelector('.crosshair');

// Mini-Map
const miniMap = document.getElementById('miniMap');
const miniMapCtx = miniMap.getContext('2d');

// Audio Elements
const backgroundMusic = document.getElementById('backgroundMusic');
const shootSound = document.getElementById('shootSound');
const hitSound = document.getElementById('hitSound');
const killSound = document.getElementById('killSound');
const reloadSound = document.getElementById('reloadSound');
const noAmmoSound = document.getElementById('noAmmoSound');
const collectSound = document.getElementById('collectSound');

/* === Game Configuration === */

// Player Rotation Speed
let playerRotationSpeed = parseFloat(mouseSensitivityInput.value);

// Weapons Data
const weapons = {
    pistol: {
        name: 'Pistol',
        damage: 25,
        fireRate: 500,
        ammo: Infinity,
        maxAmmo: Infinity
    },
    shotgun: {
        name: 'Shotgun',
        damage: 10, // Damage per pellet
        fireRate: 1000,
        ammo: 20,
        maxAmmo: 20
    },
    rifle: {
        name: 'Rifle',
        damage: 35,
        fireRate: 300,
        ammo: 30,
        maxAmmo: 30
    }
};

let currentWeapon = 'pistol';

/* === Game Classes === */

class Player {
    constructor() {
        this.reset();
    }

    move(moveX, moveY) {
        if (getMap(Math.floor(this.x + moveX), Math.floor(this.y)) === '.') {
            this.x += moveX;
        }
        if (getMap(Math.floor(this.x), Math.floor(this.y + moveY)) === '.') {
            this.y += moveY;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        playerHealthSpan.textContent = Math.floor(this.health);
        if (this.health > 0) {
            playDamageSound();
        }
        if (this.health <= 0) {
            gameOver = true;
        }
    }

    heal(amount) {
        this.health += amount;
        this.health = Math.min(this.health, 100);
        playerHealthSpan.textContent = Math.floor(this.health);
    }

    reset() {
        this.x = 3;
        this.y = 3;
        this.dir = 0;
        this.health = 100;
        this.speed = 0.1;
        this.damageMultiplier = 1.0;
        this.currentWeapon = 'pistol';
    }
}

class Enemy {
    constructor(x, y, health) {
        this.x = x + 0.5;
        this.y = y + 0.5;
        this.health = health;
        this.lastAttackTime = 0;
        this.distance = 0;
        this.hitThisShot = false;
    }

    moveTowards(player, deltaTime) {
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.hypot(dx, dy);

        if (dist > 0.5) {
            let moveSpeed = 0.02 * deltaTime * 60;
            let moveX = (dx / dist) * moveSpeed;
            let moveY = (dy / dist) * moveSpeed;
            let newX = this.x + moveX;
            let newY = this.y + moveY;

            if (getMap(Math.floor(newX), Math.floor(this.y)) === '.' && isPositionFree(newX, this.y, this)) {
                this.x = newX;
            }
            if (getMap(Math.floor(this.x), Math.floor(newY)) === '.' && isPositionFree(this.x, newY, this)) {
                this.y = newY;
            }
        }
    }

    attack(player, currentTime) {
        if (currentTime - this.lastAttackTime > 500) {
            this.lastAttackTime = currentTime;
            player.takeDamage(25);
        }
    }
}

class HealthPack {
    constructor(x, y, healingAmount) {
        this.x = x + 0.5;
        this.y = y + 0.5;
        this.healingAmount = healingAmount;
        this.collected = false;
    }

    checkCollection(player) {
        let dx = this.x - player.x;
        let dy = this.y - player.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
            player.heal(this.healingAmount);
            this.collected = true;
            playCollectSound();
        }
    }
}

/* === Game State Variables === */

const player = new Player();
const keys = {};
let enemies = [];
let healthPacks = [];

let gameOver = false;
let currentRound = 1;
let totalRounds = 0;
let totalKills = 0;
let shotsFired = 0;
let shotsHit = 0;
let inCountdown = false;
let score = 0;
let isPaused = false;
let isFiring = false;
let fireRate = weapons[currentWeapon].fireRate;
let fireTimeout;
let lastFrameTime = null;

/* === Map Configuration === */

const mapWidth = 16;
const mapHeight = 16;
const map = [
    '################',
    '#....H.........#',
    '#..............#',
    '#.......#......#',
    '#.......#......#',
    '#.......#......#',
    '#..............#',
    '#....H.........#',
    '#.......#......#',
    '#.......#......#',
    '#.......#......#',
    '#........H.....#',
    '#..............#',
    '#..............#',
    '#..............#',
    '################'
];

/* === Game Initialization === */

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getMap(x, y) {
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
        return '#';
    }
    if (map[y][x] === 'H') {
        return '.';
    }
    return map[y][x];
}

function startGame() {
    isPaused = false;
    startScreen.style.display = 'none';
    canvas.style.display = 'block';
    crosshair.style.display = 'block';
    backgroundMusic.play();
    document.addEventListener('mousemove', mouseMoveHandler);
    canvas.requestPointerLock();
    initGame();
    requestAnimationFrame(gameLoop);
}

function initGame() {
    player.reset();
    currentWeapon = 'pistol';
    weapons.pistol.ammo = Infinity;
    weapons.shotgun.ammo = weapons.shotgun.maxAmmo;
    weapons.rifle.ammo = weapons.rifle.maxAmmo;
    gameOver = false;
    totalRounds = 0;
    totalKills = 0;
    shotsFired = 0;
    shotsHit = 0;
    inCountdown = false;
    isFiring = false;
    fireRate = weapons[currentWeapon].fireRate;
    lastFrameTime = null;
    score = 0;
    updateHUD();
    parseHealthPacks();
    showRoundInfo(`Round ${currentRound}`, false);
}

function parseHealthPacks() {
    healthPacks = [];
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            if (map[y][x] === 'H') {
                healthPacks.push(new HealthPack(x, y, 25));
            }
        }
    }
}

/* === Event Listeners === */

startButton.addEventListener('click', startGame);
viewHighScoresButton.addEventListener('click', () => {
    displayHighScores();
    highScoresContainer.style.display = 'block';
});
backFromHighScoresButton.addEventListener('click', () => {
    highScoresContainer.style.display = 'none';
});
settingsButton.addEventListener('click', () => {
    settingsContainer.style.display = 'block';
});
backFromSettingsButton.addEventListener('click', () => {
    settingsContainer.style.display = 'none';
});

mouseSensitivityInput.addEventListener('input', () => {
    mouseSensitivityValue.textContent = mouseSensitivityInput.value;
    playerRotationSpeed = parseFloat(mouseSensitivityInput.value);
});

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === '1') {
        currentWeapon = 'pistol';
        updateHUD();
    } else if (e.key === '2') {
        currentWeapon = 'shotgun';
        updateHUD();
    } else if (e.key === '3') {
        currentWeapon = 'rifle';
        updateHUD();
    }

    if (e.key.toLowerCase() === 'r') {
        reloadWeapon();
    }

    if (e.key === 'Escape') {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

function mouseMoveHandler(e) {
    if (document.pointerLockElement === canvas) {
        player.dir += e.movementX * playerRotationSpeed;
        if (player.dir < 0) player.dir += 2 * Math.PI;
        if (player.dir > 2 * Math.PI) player.dir -= 2 * Math.PI;
    }
}

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement === canvas && e.button === 0) {
        isFiring = true;
        fireRate = weapons[currentWeapon].fireRate;
        fireShot();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isFiring = false;
        clearTimeout(fireTimeout);
        fireRate = weapons[currentWeapon].fireRate;
    }
});

canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas && !isPaused) {
        canvas.requestPointerLock();
    }
});

/* === Game Loop === */

function gameLoop(timestamp) {
    if (gameOver) {
        endGame();
        return;
    }

    if (!lastFrameTime) lastFrameTime = timestamp;
    let deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    if (!isPaused) {
        update(deltaTime);
        render();
    }

    requestAnimationFrame(gameLoop);
}

/* === Game Update and Render === */

function update(deltaTime) {
    if (gameOver || inCountdown) return;

    // Player Movement
    let moveX = 0;
    let moveY = 0;
    if (keys['w']) {
        moveX += Math.cos(player.dir) * player.speed;
        moveY += Math.sin(player.dir) * player.speed;
    }
    if (keys['s']) {
        moveX -= Math.cos(player.dir) * player.speed;
        moveY -= Math.sin(player.dir) * player.speed;
    }
    if (keys['a']) {
        moveX += Math.cos(player.dir - Math.PI / 2) * player.speed;
        moveY += Math.sin(player.dir - Math.PI / 2) * player.speed;
    }
    if (keys['d']) {
        moveX += Math.cos(player.dir + Math.PI / 2) * player.speed;
        moveY += Math.sin(player.dir + Math.PI / 2) * player.speed;
    }

    player.move(moveX, moveY);

    // Enemies Update
    let currentTime = performance.now();
    enemies.forEach((enemy) => {
        enemy.moveTowards(player, deltaTime);
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let dist = Math.hypot(dx, dy);
        if (dist <= 0.5) {
            enemy.attack(player, currentTime);
        }
    });

    enemies = enemies.filter(enemy => enemy.health > 0);

    // Round Completion
    if (enemies.length === 0 && !inCountdown) {
        totalRounds++;
        currentRound++;
        updateHUD();
        showRoundInfo(`Round ${currentRound}`, false);
    }

    // Health Packs Collection
    healthPacks.forEach(healthPack => {
        if (!healthPack.collected) {
            healthPack.checkCollection(player);
        }
    });

    healthPacks = healthPacks.filter(pack => !pack.collected);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Raycasting and Drawing Walls and Enemies...

    // Draw Mini-Map
    drawMiniMap();
}

/* === Game Functions === */

// Include functions like initEnemies, getEnemiesPerRound, getEnemyHealth, getRandomSpawnPosition, showRoundInfo, etc.

/* === HUD and UI Updates === */

function updateHUD() {
    playerHealthSpan.textContent = Math.floor(player.health);
    currentRoundSpan.textContent = currentRound;
    multiplierSpan.textContent = player.damageMultiplier.toFixed(1);
    playerAmmoSpan.textContent = weapons[currentWeapon].ammo === Infinity ? '∞' : weapons[currentWeapon].ammo;
    currentWeaponSpan.textContent = weapons[currentWeapon].name;
}

/* === Shooting and Weapon Handling === */

// Include the updated shoot function with shotgun pellet spread and rifle piercing logic

/* === Pause Menu Handling === */

function togglePause() {
    if (!isPaused) {
        isPaused = true;
        pauseMenu.style.display = 'flex';
        crosshair.style.display = 'none';
        document.exitPointerLock();
        document.removeEventListener('mousemove', mouseMoveHandler);
    } else {
        isPaused = false;
        pauseMenu.style.display = 'none';
        crosshair.style.display = 'block';
        canvas.requestPointerLock();
        document.addEventListener('mousemove', mouseMoveHandler);
    }
}

resumeButton.addEventListener('click', togglePause);

quitButton.addEventListener('click', () => {
    gameOver = true;
    isPaused = false;
    pauseMenu.style.display = 'none';
    canvas.style.display = 'none';
    crosshair.style.display = 'none';
    startScreen.style.display = 'flex';
    backgroundMusic.pause();
    document.exitPointerLock();
});

/* === Game Over Handling === */

// Include the endGame function

/* === Sound Effects === */

// Include sound effect functions like playHitSound, playKillSound, etc.

/* === Mini-Map Rendering === */

function drawMiniMap() {
    // Mini-map rendering logic
}

/* === High Scores Handling === */

// Include functions for saving and displaying high scores

/* === Initialization on Page Load === */

window.onload = () => {
    displayHighScoresOnStart();
};

function displayHighScoresOnStart() {
    displayHighScores();
}
