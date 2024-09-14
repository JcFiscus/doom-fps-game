/* script.js */

/* === Global Variables and Constants === */

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

// Field of View
const fov = Math.PI / 3; // 60 degrees field of view

// Variable to store last shot data for visual effects
let lastShot = null;

/* === Game Classes === */

class Player {
    constructor() {
        this.reset();
    }

    move(moveX, moveY) {
        const newX = this.x + moveX;
        const newY = this.y + moveY;

        // Prevent moving into walls
        if (getMap(Math.floor(newX), Math.floor(this.y)) === '.') {
            this.x = newX; // Move horizontally
        }
        if (getMap(Math.floor(this.x), Math.floor(newY)) === '.') {
            this.y = newY; // Move vertically
        }

        // Prevent moving too fast
        if (Math.abs(moveX) > 0.2 || Math.abs(moveY) > 0.2) {
            this.speed = 0.1; // Reset speed to prevent issues
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
        this.isHit = false;
        this.hitTime = 0;
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

            // Update HUD if needed
            updateHUD();
        }
    }

    render(ctx) {
        if (!this.collected) {
            ctx.fillStyle = 'green';
            ctx.fillRect(this.x * 10 - 5, this.y * 10 - 5, 10, 10); // Render health pack
        }
    }
}

class AmmoPack {
    constructor(x, y, ammoAmount) {
        this.x = x + 0.5;
        this.y = y + 0.5;
        this.ammoAmount = ammoAmount;
        this.collected = false;
    }

    checkCollection(player) {
        let dx = this.x - player.x;
        let dy = this.y - player.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
            weapons[currentWeapon].ammo = Math.min(weapons[currentWeapon].maxAmmo, weapons[currentWeapon].ammo + this.ammoAmount);
            this.collected = true;
            playCollectSound();

            updateHUD(); // Update HUD immediately
        }
    }

    render(ctx) {
        if (!this.collected) {
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x * 10 - 5, this.y * 10 - 5, 10, 10); // Render ammo pack
        }
    }
}

/* === Game State Variables === */

const player = new Player();
const keys = {};
let enemies = [];

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
        return '.'; // Health pack tiles are walkable
    }
    return map[y][x];
}

function startGame() {
    isPaused = false;
    gameOver = false;
    startScreen.style.display = 'none'; // Hide the main menu
    canvas.style.display = 'block'; // Show the game canvas
    crosshair.style.display = 'block'; // Show the crosshair
    hud.style.display = 'block'; // Show the HUD
    backgroundMusic.currentTime = 0; // Reset background music to the start
    backgroundMusic.play(); // Start the music
    document.addEventListener('mousemove', mouseMoveHandler);
    canvas.requestPointerLock(); // Lock the mouse pointer to the game canvas
    initGame(); // Initialize the game elements
    requestAnimationFrame(gameLoop); // Start the game loop
}

function initGame() {
    player.reset();
    currentWeapon = 'pistol';
    weapons.pistol.ammo = Infinity;
    weapons.shotgun.ammo = weapons.shotgun.maxAmmo;
    weapons.rifle.ammo = weapons.rifle.maxAmmo;
    currentRound = 1;
    totalRounds = 0;
    totalKills = 0;
    shotsFired = 0;
    shotsHit = 0;
    score = 0;
    player.damageMultiplier = 1.0;
    updateHUD();
    parseHealthPacks(); // Initialize health packs on the map
    parseAmmoPacks(); // Initialize ammo packs on the map
    showRoundInfo(`Round ${currentRound}`, false); // Display round info
    initEnemies(); // Initialize enemies for the first round
}

function parseHealthPacks() {
    healthPacksArray = [];
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            if (map[y][x] === 'H') {
                healthPacksArray.push(new HealthPack(x, y, 25));
            }
        }
    }
}

function parseAmmoPacks() {
    ammoPacksArray = [];
    // Optionally, you can define specific ammo pack locations
    // For now, they will be spawned periodically
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
    // Set default mouse sensitivity
    mouseSensitivityInput.value = '1'; // You can adjust this default value as needed
    mouseSensitivityValue.textContent = '1';
    // Initialize player rotation speed with a default value if necessary
    let playerRotationSpeed = parseFloat(mouseSensitivityInput.value) || 1;
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
        player.dir += e.movementX * playerRotationSpeed * 0.01; // Increased from 0.002 to 0.01
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
        player.damageMultiplier = 1.0; // Reset multiplier at the end of the round
        updateHUD();
        showRoundInfo(`Round ${currentRound}`, false);
    }

    // Health Packs Collection
    healthPacksArray.forEach(pack => {
        if (!pack.collected) {
            pack.checkCollection(player);
        }
    });

    healthPacksArray = healthPacksArray.filter(pack => !pack.collected);

    // Ammo Packs Collection
    ammoPacksArray.forEach(pack => {
        if (!pack.collected) {
            pack.checkCollection(player);
        }
    });

    ammoPacksArray = ammoPacksArray.filter(pack => !pack.collected);

    // Periodically Drop Supplies
    dropSupplies();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const zBuffer = [];

    // Raycasting and drawing walls
    for (let x = 0; x < canvas.width; x++) {
        let cameraX = 2 * x / canvas.width - 1;
        let rayAngle = player.dir + Math.atan(cameraX * Math.tan(fov / 2));
        let distanceToWall = 0;
        let hitWall = false;
        let eyeX = Math.cos(rayAngle);
        let eyeY = Math.sin(rayAngle);

        while (!hitWall && distanceToWall < 16) {
            distanceToWall += 0.05;
            let testX = Math.floor(player.x + eyeX * distanceToWall);
            let testY = Math.floor(player.y + eyeY * distanceToWall);

            if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
                hitWall = true;
                distanceToWall = 16;
            } else {
                if (getMap(testX, testY) === '#') {
                    hitWall = true;
                }
            }
        }

        let lineHeight = canvas.height / distanceToWall;

        let drawStart = -lineHeight / 2 + canvas.height / 2;
        if (drawStart < 0) drawStart = 0;
        let drawEnd = lineHeight / 2 + canvas.height / 2;
        if (drawEnd >= canvas.height) drawEnd = canvas.height - 1;

        let shade = 1 - distanceToWall / 16;
        if (shade < 0) shade = 0;
        ctx.fillStyle = `rgba(150, 150, 150, ${shade})`;
        ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);

        ctx.fillStyle = 'black';
        ctx.fillRect(x, drawEnd, 1, canvas.height - drawEnd);

        zBuffer[x] = distanceToWall;
    }

    // Sort entities by distance
    const entities = [...enemies, ...healthPacksArray, ...ammoPacksArray];

    entities.forEach((entity) => {
        let dx = entity.x - player.x;
        let dy = entity.y - player.y;
        entity.distance = Math.hypot(dx, dy);
    });

    entities.sort((a, b) => b.distance - a.distance);

    // Render entities
    entities.forEach((entity) => {
        let dx = entity.x - player.x;
        let dy = entity.y - player.y;
        let distance = Math.hypot(dx, dy);

        let angle = Math.atan2(dy, dx) - player.dir;
        if (angle < -Math.PI) angle += 2 * Math.PI;
        if (angle > Math.PI) angle -= 2 * Math.PI;

        if (Math.abs(angle) < fov / 2) {
            let entitySize = (canvas.height / distance) * 0.7;
            let projectionPlaneDistance = (canvas.width / 2) / Math.tan(fov / 2);
            let screenX = Math.tan(angle) * projectionPlaneDistance + canvas.width / 2 - entitySize / 2;
            let entityY = canvas.height / 2 - entitySize / 2;

            let screenXCenter = Math.floor(screenX + entitySize / 2);

            if (screenXCenter >= 0 && screenXCenter < canvas.width) {
                if (distance < zBuffer[screenXCenter] || isNaN(zBuffer[screenXCenter])) {
                    if (entity instanceof Enemy) {
                        // Check for hit effect
                        if (entity.isHit && performance.now() - entity.hitTime < 200) {
                            ctx.fillStyle = 'orange';
                        } else {
                            ctx.fillStyle = 'red';
                            entity.isHit = false;
                        }

                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 2;
                        ctx.fillRect(screenX, entityY, entitySize, entitySize);
                        ctx.strokeRect(screenX, entityY, entitySize, entitySize);

                        // Enemy health bar
                        ctx.fillStyle = 'black';
                        ctx.fillRect(screenX + entitySize / 4, entityY - 10, entitySize / 2, 5);
                        ctx.fillStyle = 'green';
                        ctx.fillRect(screenX + entitySize / 4, entityY - 10, (entity.health / getEnemyHealth(currentRound)) * (entitySize / 2), 5);
                    } else if (entity instanceof HealthPack || entity instanceof AmmoPack) {
                        ctx.fillStyle = entity instanceof HealthPack ? 'green' : 'blue';
                        ctx.fillRect(screenX, entityY, entitySize, entitySize);
                    }
                }
            }
        }
    });

    // Render bullet trace
    if (lastShot && performance.now() - lastShot.time < 100) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;

        let dx = lastShot.x - player.x;
        let dy = lastShot.y - player.y;

        let distance = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx) - player.dir;

        if (Math.abs(angle) < fov / 2) {
            let screenXStart = canvas.width / 2;
            let screenYStart = canvas.height / 2;

            let projectionPlaneDistance = (canvas.width / 2) / Math.tan(fov / 2);
            let screenXEnd = Math.tan(angle) * projectionPlaneDistance + canvas.width / 2;
            let screenYEnd = canvas.height / 2; // Adjust if needed

            ctx.beginPath();
            ctx.moveTo(screenXStart, screenYStart);
            ctx.lineTo(screenXEnd, screenYEnd);
            ctx.stroke();
        }
    } else {
        lastShot = null;
    }

    // Draw mini-map
    drawMiniMap();
}

/* === Shooting and Weapon Handling === */

// Constants for Shotgun
const SHOTGUN_PELLETS = 7;
const SHOTGUN_SPREAD = Math.PI / 12; // 15 degrees
const SHOTGUN_RANGE = 8;

// Fire rate parameters for pistol
const defaultFireRate = weapons.pistol.fireRate; // 500ms
const minFireRate = 100; // Minimum fire rate
const fireRateDecrease = 50; // Decrease fire rate by 50ms per hit

function fireShot() {
    if (!isFiring || gameOver || isPaused) return;

    shoot();

    // Continue firing based on current fire rate
    fireTimeout = setTimeout(fireShot, fireRate);
}

function shoot() {
    shotsFired++;

    // Check ammo
    if (weapons[currentWeapon].ammo <= 0) {
        playNoAmmoSound();
        return;
    }

    // Decrement ammo if not infinite
    if (weapons[currentWeapon].ammo !== Infinity) {
        weapons[currentWeapon].ammo--;
        updateHUD();
    }

    // Play shooting sound
    shootSound.currentTime = 0;
    shootSound.play();

    let hit = false;

    // Determine damage based on weapon
    let damage = weapons[currentWeapon].damage * player.damageMultiplier;

    if (currentWeapon === 'shotgun') {
        // Shotgun logic with pellet spread
        for (let i = 0; i < SHOTGUN_PELLETS; i++) {
            let spreadAngle = player.dir + (Math.random() - 0.5) * SHOTGUN_SPREAD;
            let eyeX = Math.cos(spreadAngle);
            let eyeY = Math.sin(spreadAngle);

            let distanceToWall = 0;
            let maxDistance = SHOTGUN_RANGE;

            let pelletHit = false;

            while (distanceToWall < maxDistance) {
                distanceToWall += 0.1;
                let testX = player.x + eyeX * distanceToWall;
                let testY = player.y + eyeY * distanceToWall;

                if (getMap(Math.floor(testX), Math.floor(testY)) === '#') {
                    break;
                }

                for (let enemy of enemies) {
                    let dx = enemy.x - testX;
                    let dy = enemy.y - testY;
                    let dist = Math.hypot(dx, dy);
                    if (dist < 0.3) {
                        enemy.health -= damage;
                        pelletHit = true;
                        hit = true;

                        enemy.isHit = true;
                        enemy.hitTime = performance.now();

                        if (enemy.health <= 0) {
                            totalKills++;
                            score += Math.floor(100 * player.damageMultiplier);
                            enemies.splice(enemies.indexOf(enemy), 1);
                            playKillSound();
                            player.damageMultiplier += 0.1;
                            updateHUD();
                        } else {
                            playHitSound();
                        }
                        break;
                    }
                }

                if (pelletHit) {
                    break;
                }
            }
        }

        if (hit) {
            shotsHit++;
        } else {
            // Missed shot logic
            player.damageMultiplier = 1.0;
            fireRate = weapons[currentWeapon].fireRate;
            updateHUD();
            playMissSound();
        }
    } else {
        // For pistol and rifle, align the bullet with the crosshair

        // Calculate the ray angle aligned with the crosshair
        let cameraX = 0; // Center of the screen
        let rayAngle = player.dir + Math.atan(cameraX * Math.tan(fov / 2));
        let eyeX = Math.cos(rayAngle);
        let eyeY = Math.sin(rayAngle);

        let maxDistance = currentWeapon === 'rifle' ? 16 : 16;

        let shotHitX = null;
        let shotHitY = null;

        for (let distanceToWall = 0; distanceToWall < maxDistance; distanceToWall += 0.05) {
            let testX = player.x + eyeX * distanceToWall;
            let testY = player.y + eyeY * distanceToWall;

            if (getMap(Math.floor(testX), Math.floor(testY)) === '#') {
                shotHitX = testX;
                shotHitY = testY;
                break;
            }

            for (let enemy of enemies) {
                let dx = enemy.x - testX;
                let dy = enemy.y - testY;
                let dist = Math.hypot(dx, dy);
                if (dist < 0.3 && (!enemy.hitThisShot || currentWeapon !== 'rifle')) {
                    enemy.health -= damage;
                    hit = true;
                    shotHitX = testX;
                    shotHitY = testY;

                    enemy.isHit = true;
                    enemy.hitTime = performance.now();

                    if (currentWeapon === 'rifle') {
                        enemy.hitThisShot = true;
                    } else {
                        // For pistol, break after first hit
                        break;
                    }

                    if (enemy.health <= 0) {
                        totalKills++;
                        score += Math.floor(100 * player.damageMultiplier);
                        enemies.splice(enemies.indexOf(enemy), 1);
                        playKillSound();
                        player.damageMultiplier += 0.1;
                        updateHUD();
                    } else {
                        playHitSound();
                    }
                    break;
                }
            }

            if (currentWeapon !== 'rifle' && hit) {
                break; // Stop the ray if we've hit an enemy with pistol
            }
        }

        if (currentWeapon === 'rifle') {
            enemies.forEach(enemy => {
                enemy.hitThisShot = false;
            });
        }

        // Store the shot data for rendering the bullet trace
        if (shotHitX !== null && shotHitY !== null) {
            lastShot = {
                x: shotHitX,
                y: shotHitY,
                time: performance.now()
            };
        }

        if (hit) {
            shotsHit++;
        } else {
            // Missed shot logic
            player.damageMultiplier = 1.0;
            fireRate = weapons[currentWeapon].fireRate;
            updateHUD();
            playMissSound();
        }

        // Accelerate fire rate if hit with pistol
        if (currentWeapon === 'pistol' && hit) {
            player.damageMultiplier += 0.1;
            fireRate = Math.max(minFireRate, fireRate - fireRateDecrease);
            updateHUD();
        } else if (currentWeapon === 'pistol' && !hit) {
            fireRate = defaultFireRate; // Reset fire rate on miss
        }
    }
}

/* === Pause Menu Handling === */

function togglePause() {
    if (!isPaused) {
        isPaused = true;
        pauseMenu.style.display = 'flex'; // Show pause menu
        crosshair.style.display = 'none'; // Hide crosshair when paused
        document.exitPointerLock(); // Exit pointer lock mode
        document.removeEventListener('mousemove', mouseMoveHandler);

        // Pause background music
        backgroundMusic.pause();
    } else {
        isPaused = false;
        pauseMenu.style.display = 'none'; // Hide pause menu
        crosshair.style.display = 'block'; // Show crosshair again
        canvas.requestPointerLock(); // Lock the pointer to the canvas
        document.addEventListener('mousemove', mouseMoveHandler);

        // Resume background music
        backgroundMusic.play();
    }
}

resumeButton.addEventListener('click', togglePause);

function quitGame() {
    gameOver = true;
    isPaused = false;
    pauseMenu.style.display = 'none';
    canvas.style.display = 'none';
    crosshair.style.display = 'none';
    hud.style.display = 'none'; // Hide the HUD
    startScreen.style.display = 'flex';
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0; // Reset background music
    document.exitPointerLock();

    // Reset game state
    player.reset();
    enemies = [];
    ammoPacksArray = [];
    healthPacksArray = [];
    currentRound = 1;
    score = 0;
    totalKills = 0;
    totalRounds = 0;
    shotsFired = 0;
    shotsHit = 0;
}

quitButton.addEventListener('click', quitGame);

/* === Game Over Handling === */

function endGame() {
    isPaused = false;
    crosshair.style.display = 'none';
    hud.style.display = 'none'; // Hide the HUD
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    document.removeEventListener('mousemove', mouseMoveHandler);

    let accuracy = shotsFired > 0 ? ((shotsHit / shotsFired) * 100).toFixed(1) : 0;
    let scoreDisplay = `
        <h2>Game Over</h2>
        <p>Score: ${score}</p>
        <p>Rounds Survived: ${totalRounds}</p>
        <p>Enemies Killed: ${totalKills}</p>
        <p>Shots Fired: ${shotsFired}</p>
        <p>Accuracy: ${accuracy}%</p>
    `;

    let highScores = getHighScores();
    let qualifies = highScores.length < 10 || score > highScores[highScores.length - 1].score;

    if (qualifies) {
        scoreDisplay += `<p>New High Score!</p>
                        <input type="text" id="playerName" placeholder="Enter your name" maxlength="10">
                        <button id="saveScoreButton">Save Score</button>`;
    }

    roundMessage.innerHTML = scoreDisplay;
    countdownElement.style.display = 'none';
    roundInfo.style.display = 'flex';
    roundInfo.style.pointerEvents = 'auto';
    restartButton.style.display = 'block';
    inCountdown = false;

    if (qualifies) {
        document.getElementById('saveScoreButton').addEventListener('click', function () {
            let playerName = document.getElementById('playerName').value.trim() || 'Anonymous';
            saveHighScore(playerName, score);
            displayHighScores();
            document.getElementById('playerName').style.display = 'none';
            document.getElementById('saveScoreButton').style.display = 'none';
        });
    }
}

restartButton.addEventListener('click', function () {
    roundInfo.style.display = 'none';
    startGame();
});

/* === Sound Effects === */

function playHitSound() {
    hitSound.currentTime = 0;
    hitSound.play();
}

function playKillSound() {
    killSound.currentTime = 0;
    killSound.play();
}

function playMissSound() {
    // Optional: Implement miss sound
}

function playNoAmmoSound() {
    noAmmoSound.currentTime = 0;
    noAmmoSound.play();
}

function playCollectSound() {
    collectSound.currentTime = 0;
    collectSound.play();
}

function playDamageSound() {
    // Optional: Implement damage sound
}

/* === HUD and UI Updates === */

function updateHUD() {
    playerHealthSpan.textContent = Math.floor(player.health);
    currentRoundSpan.textContent = currentRound;
    multiplierSpan.textContent = player.damageMultiplier.toFixed(1);
    playerAmmoSpan.textContent = weapons[currentWeapon].ammo === Infinity ? '∞' : weapons[currentWeapon].ammo;
    currentWeaponSpan.textContent = weapons[currentWeapon].name;
}

/* === Mini-Map Rendering === */

function drawMiniMap() {
    // Mini-map scaling factor
    const scale = 10; // Each map tile is 10x10 pixels

    // Clear mini-map
    miniMapCtx.clearRect(0, 0, miniMap.width, miniMap.height);

    // Draw the map
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            if (map[y][x] === '#') {
                miniMapCtx.fillStyle = 'gray';
                miniMapCtx.fillRect(x * scale, y * scale, scale, scale);
            } else if (map[y][x] === 'H') {
                miniMapCtx.fillStyle = 'green';
                miniMapCtx.fillRect(x * scale, y * scale, scale, scale);
            } else {
                miniMapCtx.fillStyle = 'black';
                miniMapCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }

    // Draw health packs
    healthPacksArray.forEach(pack => {
        if (!pack.collected) {
            miniMapCtx.fillStyle = 'green';
            miniMapCtx.fillRect(pack.x * scale - 5, pack.y * scale - 5, 10, 10);
        }
    });

    // Draw ammo packs
    ammoPacksArray.forEach(pack => {
        if (!pack.collected) {
            miniMapCtx.fillStyle = 'blue';
            miniMapCtx.fillRect(pack.x * scale - 5, pack.y * scale - 5, 10, 10);
        }
    });

    // Draw enemies
    enemies.forEach(enemy => {
        miniMapCtx.fillStyle = 'red';
        miniMapCtx.fillRect(enemy.x * scale - 2, enemy.y * scale - 2, 4, 4);
    });

    // Draw player
    miniMapCtx.fillStyle = 'blue';
    miniMapCtx.beginPath();
    miniMapCtx.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
    miniMapCtx.fill();

    // Draw player direction
    miniMapCtx.strokeStyle = 'blue';
    miniMapCtx.beginPath();
    miniMapCtx.moveTo(player.x * scale, player.y * scale);
    miniMapCtx.lineTo(
        (player.x + Math.cos(player.dir)) * scale,
        (player.y + Math.sin(player.dir)) * scale
    );
    miniMapCtx.stroke();
}

/* === High Scores Handling === */

function saveHighScore(name, score) {
    let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
    highScores.push({ name, score });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
    localStorage.setItem('highScores', JSON.stringify(highScores));
}

function getHighScores() {
    return JSON.parse(localStorage.getItem('highScores')) || [];
}

function displayHighScores() {
    let highScores = getHighScores();
    const highScoresList = document.getElementById('highScoresList');
    highScoresList.innerHTML = '';

    if (highScores.length === 0) {
        highScoresList.innerHTML = '<li>No high scores yet.</li>';
        return;
    }

    highScores.forEach(scoreEntry => {
        let li = document.createElement('li');
        li.textContent = `${scoreEntry.name}: ${scoreEntry.score}`;
        highScoresList.appendChild(li);
    });
}

function displayHighScoresOnStart() {
    displayHighScores();
}

window.onload = () => {
    displayHighScoresOnStart();
};

/* === Additional Functions === */

function isPositionFree(x, y, currentEntity) {
    const entities = [...enemies, ...healthPacksArray, ...ammoPacksArray];
    for (let entity of entities) {
        if (entity !== currentEntity) {
            let dx = entity.x - x;
            let dy = entity.y - y;
            if (Math.hypot(dx, dy) < 0.4) {
                return false;
            }
        }
    }
    return true;
}


function initEnemies() {
    enemies = [];
    let enemiesToSpawn = getEnemiesPerRound(currentRound);
    for (let i = 0; i < enemiesToSpawn; i++) {
        let spawn = getRandomSpawnPosition();
        if (spawn) {
            enemies.push(new Enemy(spawn.x, spawn.y, getEnemyHealth(currentRound)));
        }
    }
    updateHUD();
}

function getEnemiesPerRound(round) {
    let baseEnemies = 5;
    let enemiesIncrementPerRound = 2;
    let maxEnemies = 20;
    let enemiesCount = baseEnemies + (round - 1) * enemiesIncrementPerRound;
    if (round % 10 === 0) {
        enemiesCount += enemiesIncrementPerRound;
    }
    return Math.min(enemiesCount, maxEnemies);
}

function getEnemyHealth(round) {
    let baseEnemyHealth = 50;
    let enemyHealthIncrement = 10;
    return baseEnemyHealth + (round - 1) * enemyHealthIncrement;
}

function getRandomSpawnPosition() {
    const minDistanceFromPlayer = 5;
    let maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
        let x = Math.floor(Math.random() * (mapWidth - 2) + 1);
        let y = Math.floor(Math.random() * (mapHeight - 2) + 1);
        if (getMap(x, y) === '.') {
            let distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
            if (distance > minDistanceFromPlayer) {
                let isOccupied = enemies.some(enemy =>
                    Math.floor(enemy.x) === x && Math.floor(enemy.y) === y
                );
                if (!isOccupied) {
                    return { x, y };
                }
            }
        }
    }
    return null;
}

function showRoundInfo(message, isGameOver) {
    roundMessage.innerHTML = `<h2>${message}</h2>`;
    roundInfo.style.display = 'flex';
    roundInfo.style.pointerEvents = 'none'; // Allow player movement

    if (isGameOver) {
        restartButton.style.display = 'block';
        roundInfo.style.pointerEvents = 'auto'; // Allow clicking buttons
        countdownElement.style.display = 'none';
        inCountdown = false;
    } else {
        restartButton.style.display = 'none';
        countdownElement.style.display = 'block';
        inCountdown = true;

        let countdown = 3;
        countdownElement.textContent = `Next round starts in ${countdown}`;
        let countdownInterval = setInterval(() => {
            countdown--;

            if (countdown > 0) {
                countdownElement.textContent = `Next round starts in ${countdown}`;
            } else {
                clearInterval(countdownInterval);
                roundInfo.style.display = 'none';
                inCountdown = false; // Countdown over, enemies spawn

                initEnemies(); // Spawn enemies
            }
        }, 1000); // 1 second interval
    }
}

/* === Supply Dropping === */

function dropSupplies() {
    if (Math.random() < 0.01) { // 1% chance each frame to drop a supply
        // Decide to drop health or ammo
        if (Math.random() < 0.5) {
            // Drop health pack
            let spawn = getRandomSpawnPositionForSupply();
            if (spawn) {
                healthPacksArray.push(new HealthPack(spawn.x, spawn.y, 25));
            }
        } else {
            // Drop ammo pack
            let spawn = getRandomSpawnPositionForSupply();
            if (spawn) {
                ammoPacksArray.push(new AmmoPack(spawn.x, spawn.y, 10));
            }
        }
    }
}

function getRandomSpawnPositionForSupply() {
    const minDistanceFromPlayer = 3;
    let maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
        let x = Math.floor(Math.random() * (mapWidth - 2) + 1);
        let y = Math.floor(Math.random() * (mapHeight - 2) + 1);
        if (getMap(x, y) === '.') {
            let distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
            if (distance > minDistanceFromPlayer) {
                let isOccupied = enemies.some(enemy =>
                    Math.floor(enemy.x) === x && Math.floor(enemy.y) === y
                );
                let isHealthPack = healthPacksArray.some(pack =>
                    Math.floor(pack.x) === x && Math.floor(pack.y) === y
                );
                let isAmmoPack = ammoPacksArray.some(pack =>
                    Math.floor(pack.x) === x && Math.floor(pack.y) === y
                );
                if (!isOccupied && !isHealthPack && !isAmmoPack) {
                    return { x, y };
                }
            }
        }
    }
    return null;
}

/* === Pointer Lock Handling === */

// Already handled in event listeners

/* === Utility Functions === */

// Existing utility functions like getMap, etc.

